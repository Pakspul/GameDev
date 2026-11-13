#!/usr/bin/env node
// Coin Dozer end to end, in a headless phone-sized Chromium: the acceptance criteria that need a real
// page (docs/COIN-DOZER.md). Serves dist/ (run `npm run build` first; `npm test` does it), or the
// source with --src.
//
//   node tests/coin-dozer/e2e.mjs [--src]
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../../scripts/serve.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = process.argv.includes("--src") ? ROOT : join(ROOT, "dist");
const OUT = join(ROOT, "test-results");
if (!existsSync(join(DIR, "games/coin-dozer/index.html"))) { console.error(`No Coin Dozer in ${DIR}. Run: npm run build`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/games/coin-dozer/index.html`;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const problems = [];
page.on("pageerror", (e) => problems.push("JS error: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });
page.on("request", (r) => { if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url())) problems.push("network request: " + r.url()); });

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log("✓ " + name); }
  catch (e) { failures++; console.log("✗ " + name + "\n    " + (e && e.message)); }
}
function ok(v, msg) { if (!v) throw new Error(msg); }
const cd = (expr) => page.evaluate(expr);
async function open() {
  await page.goto(base);
  await page.waitForFunction(() => window.CoinDozer && window.CoinDozer.ready, null, { timeout: 15000 });
}
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
async function closeScreens() {
  while (await cd("!document.querySelector('#overlay').hidden")) { await page.keyboard.press("Escape"); await page.waitForTimeout(120); }
}

await check("AC1: opens straight into play: about 60 coins, 3 prizes, a bank of 50, no splash", async () => {
  const t0 = Date.now();
  await open();
  ok(Date.now() - t0 < 12000, "took too long to start");
  const s = await cd(`(() => { const m = CoinDozer.machine, it = [...m.board.items.values()];
    return { bank: m.bank, coins: it.filter((i) => ["coin","gold"].includes(i.kind)).length, prizes: it.filter((i) => i.kind === "gem" || i.kind === "figure").length, overlay: !document.querySelector("#overlay").hidden }; })()`);
  ok(s.bank === 50, `bank ${s.bank}`);
  ok(s.coins >= 50 && s.coins <= 60, `coins ${s.coins}`);
  ok(s.prizes === 3, `prizes ${s.prizes}`);
  ok(!s.overlay, "something covers the board");
  ok(await cd("!document.querySelector('#hint').hidden"), "the first-launch hint is missing");
  await page.screenshot({ path: join(OUT, "coin-dozer-start.png"), timeout: 30000 });
});

await check("AC2: a new player starts on the pin wall; dragging picks one of its three slots", async () => {
  ok((await cd("CoinDozer.machine.type")) === "pins", "not the pin wall");
  await touch("touchStart", 206, 700);
  await touch("touchMove", 400, 700);
  await page.waitForTimeout(100);
  const a1 = await cd("CoinDozer.machine.aim");
  await touch("touchMove", 2, 700);
  await page.waitForTimeout(100);
  const a2 = await cd("CoinDozer.machine.aim");
  ok(a1 === 2.1 && a2 === -2.1, `slots after dragging right and left: ${a1}, ${a2}`);
  ok(await cd("CoinDozer.renderer.ghost.visible"), "no ghost coin");
  await touch("touchEnd");
  await page.waitForTimeout(300);
});

await check("AC3: a press drops exactly one coin at once; a second within 0.25 s is ignored", async () => {
  const ready = () => page.waitForFunction(() => CoinDozer.machine.time - CoinDozer.machine.lastDrop > 0.3);
  await ready();
  const before = await cd("CoinDozer.save.progress.stats.dropped");
  // Two taps in the same instant (a real phone could be slower than this; the rule is game time).
  await page.evaluate(() => {
    const cv = document.querySelector("#cv");
    const ev = (type) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: 206, clientY: 720, bubbles: true, isPrimary: true, pointerType: "touch" }));
    ev("pointerdown"); ev("pointerup"); ev("pointerdown"); ev("pointerup");
  });
  await page.waitForTimeout(50);
  const after = await cd("CoinDozer.save.progress.stats.dropped");
  ok(after - before === 1, `drops: ${after - before}`);
  ok(await cd("document.querySelector('#hint').hidden"), "the hint should go after the first drop");
  // A press drops before it's released, and a press on the top half (where the pin wall's slots are) counts.
  await ready();
  await touch("touchStart", 330, 260);
  ok((await cd("CoinDozer.save.progress.stats.dropped")) === after + 1, "a press on the slots didn't drop a coin straight away");
  ok((await cd("CoinDozer.machine.aim")) === 2.1, "a press on the right picks the right slot");
  await touch("touchEnd");
  // A mouse click does the same.
  await ready();
  await page.mouse.move(80, 600);
  await page.mouse.down();
  ok((await cd("CoinDozer.save.progress.stats.dropped")) === after + 2, "a mouse press didn't drop a coin");
  await page.mouse.up();
});

await check("AC20: every button is at least 44 × 44 CSS px and sits in the bottom 35% of the screen (the arcade's back and menu buttons excepted)", async () => {
  const bad = await cd(`[...document.querySelectorAll("button")].filter((b) => b.offsetParent && !b.closest(".gnav-drawer")).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.className || b.textContent.trim(), w: r.width, h: r.height, top: r.top, nav: b.classList.contains("gnav-btn") }; })
    .filter((r) => r.w < 44 || r.h < 44 || (!r.nav && r.top < innerHeight * 0.65))`);
  ok(bad.length === 0, "buttons: " + JSON.stringify(bad));
  ok((await cd("document.querySelectorAll('#controls button').length")) === 4, "four controls");
});

await check("AC18 + AC19: auto-drop toggles; nudge uses a charge", async () => {
  await page.click("#autoBtn");
  await page.waitForTimeout(1800);
  ok(await cd("CoinDozer.machine.auto"), "auto-drop didn't turn on");
  ok((await cd("document.querySelector('#autoBtn').getAttribute('aria-pressed')")) === "true", "aria-pressed");
  await page.click("#autoBtn");
  ok(!(await cd("CoinDozer.machine.auto")), "auto-drop didn't turn off");
  await page.click("#nudgeBtn");
  ok((await cd("CoinDozer.machine.nudges")) === 2, "a nudge should use a charge");
  ok((await page.textContent("#nudgeCount")).trim() === "2", "the charge count shows 2");
});

await check("Pause stops the physics and shows Resume, Workshop, Settings and Exit", async () => {
  await page.click("#pauseBtn");
  const t = await cd("CoinDozer.machine.time");
  await page.waitForTimeout(500);
  ok((await cd("CoinDozer.machine.time")) === t, "the board moved while paused");
  for (const b of ["Resume", "Workshop", "Settings", "Exit to the arcade"]) ok(await page.getByRole("button", { name: b }).count(), `no ${b} button`);
  await page.screenshot({ path: join(OUT, "coin-dozer-pause.png"), timeout: 30000 });
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForTimeout(300);
  ok((await cd("CoinDozer.machine.time")) > t, "Resume didn't restart the board");
});

await check("Machines: the free drop aims anywhere (clamped); switching keeps the bank and parks the other board", async () => {
  await page.click("#pauseBtn");
  const before = await cd(`(() => { const m = CoinDozer.machine; return { bank: m.bank, n: m.board.items.size }; })()`);
  await page.locator(".machine.classic").click();
  ok((await cd("CoinDozer.machine.type")) === "classic", "didn't switch");
  ok((await cd("CoinDozer.machine.bank")) === before.bank, "the bank didn't come along");
  ok((await cd("CoinDozer.save.parked.pins.board.items.length")) === before.n, "the pin wall's board isn't parked");
  ok((await page.locator('.machine.classic[aria-checked="true"]').count()) === 1, "the card doesn't show the choice");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForTimeout(200);
  await touch("touchStart", 206, 700);
  await touch("touchMove", 300, 700);
  await page.waitForTimeout(100);
  const a1 = await cd("CoinDozer.machine.aim");
  await touch("touchMove", 2, 700);
  await page.waitForTimeout(100);
  const a2 = await cd("CoinDozer.machine.aim");
  ok(a1 > 0.5, `aim after dragging right: ${a1}`);
  ok(Math.abs(a2 + 3) < 1e-9, `aim at the far left: ${a2} (expected the clamp, -3)`);
  await touch("touchEnd");
  await page.screenshot({ path: join(OUT, "coin-dozer-classic.png"), timeout: 30000 });
  // And back: the pin wall's board returns as it was.
  await page.click("#pauseBtn");
  await page.locator(".machine.pins").click();
  ok((await cd("CoinDozer.machine.type")) === "pins" && (await cd("CoinDozer.machine.board.items.size")) >= before.n - 3, "the pin wall's board didn't come back");
  await page.getByRole("button", { name: "Resume" }).click();
});

await check("The menu drawer (top right) pauses the board and offers the machines; back (top left) is there", async () => {
  ok(await page.isVisible(".gnav-back"), "no back button");
  await page.click(".gnav-menu");
  ok(await cd("document.querySelector('.gnav-drawer').open"), "the drawer didn't open");
  const t = await cd("CoinDozer.machine.time");
  await page.waitForTimeout(300);
  ok((await cd("CoinDozer.machine.time")) === t, "the board moved behind the drawer");
  ok(await page.locator(".gnav-drawer").getByText("Pin wall").count(), "no machine choice");
  await page.click(".gnav-close");
  await page.waitForTimeout(1000);
  ok(!(await cd("document.querySelector('.gnav-drawer').open")), "the drawer didn't close");
  ok((await cd("CoinDozer.machine.time")) > t, "closing the drawer didn't resume");
});

await check("AC15: the Workshop blocks a purchase without credits, and a purchase with credits applies and persists", async () => {
  await page.click("#pauseBtn");
  await page.getByRole("button", { name: "Workshop" }).click();
  await page.locator(".row", { hasText: "Nudge charges" }).locator("button").click();
  await page.waitForTimeout(100);
  ok((await page.textContent("#toast")).includes("Not enough credits"), "no clear message");
  ok((await cd("CoinDozer.save.progress.workshop.nudges")) === 0, "bought without credits");
  await cd("CoinDozer.save.progress.credits = 100");
  await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Workshop" }).click();
  const buy = page.locator(".row", { hasText: "Nudge charges" }).locator("button");
  await buy.click();
  ok((await buy.textContent()).includes("Buy"), "the first tap asks to confirm");
  ok((await cd("CoinDozer.save.progress.credits")) === 100, "nothing is spent before the confirm tap");
  await buy.click();
  ok((await cd("CoinDozer.save.progress.credits")) === 60, "40 credits spent");
  ok((await cd("CoinDozer.machine.maxNudges")) === 4, "the upgrade applies at once");
  await page.screenshot({ path: join(OUT, "coin-dozer-workshop.png"), fullPage: true, timeout: 30000 });
  await closeScreens();
});

await check("The collection shows 12 slots per theme, silhouettes for prizes not yet won", async () => {
  await cd(`CoinDozer.save.progress.collection.classic[4] = "2026-11-07"`);
  await page.click("#collBtn");
  ok((await page.locator(".grid .slot").count()) === 12, "12 slots");
  ok((await page.locator(".grid .slot.has").count()) === 1, "one owned");
  await page.locator(".grid .slot.has").click();
  ok((await page.textContent(".detail")).includes("Rubber Duck"), "tapping shows the name");
  await page.screenshot({ path: join(OUT, "coin-dozer-collection.png"), timeout: 30000 });
  await closeScreens();
});

await check("AC21: sound, vibration and screen shake each switch off and stay off after a reload", async () => {
  await page.click("#pauseBtn");
  await page.getByRole("button", { name: "Settings" }).click();
  for (const name of ["Sound", "Vibration", "Screen shake"]) await page.getByRole("switch", { name }).click();
  await page.screenshot({ path: join(OUT, "coin-dozer-settings.png"), timeout: 30000 });
  await closeScreens();
  await open();
  const s = await cd("CoinDozer.save.settings");
  ok(!s.sound && !s.haptics && !s.shake, "settings: " + JSON.stringify(s));
  ok(!(await cd("CoinDozer.renderer.shakeOn")), "shake still on");
});

await check("AC21: screen shake is off when the system asks for reduced motion", async () => {
  const p2 = await ctx.newPage();
  await p2.emulateMedia({ reducedMotion: "reduce" });
  await p2.evaluate(() => 0);
  await p2.goto(base);
  await p2.waitForFunction(() => window.CoinDozer && window.CoinDozer.ready, null, { timeout: 15000 });
  await p2.evaluate(() => { CoinDozer.save.settings.shake = true; });
  ok(!(await p2.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches && CoinDozer.renderer.shakeOn)), "shake on under reduced motion");
  await p2.close();
});

await check("AC25: closing and reopening restores bank, credits, upgrades, collection and the board", async () => {
  await page.waitForTimeout(500);
  await cd("CoinDozer.save.progress.credits = 321");
  const before = await cd(`(() => { const m = CoinDozer.machine; return { bank: m.bank, n: m.board.items.size, cycles: m.board.cycles, pos: [...m.board.items.values()].map((i) => [i.kind, i.x, i.z]) }; })()`);
  await open();                                   // the reload fires pagehide, which saves
  const after = await cd(`(() => { const m = CoinDozer.machine; return { bank: m.bank, n: m.board.items.size, credits: CoinDozer.save.progress.credits, nudges: CoinDozer.save.progress.workshop.nudges, coll: Object.keys(CoinDozer.save.progress.collection.classic), pos: [...m.board.items.values()].map((i) => [i.kind, i.x, i.z]) }; })()`);
  ok(after.bank === before.bank || Math.abs(after.bank - before.bank) <= 3, `bank ${before.bank} → ${after.bank}`);
  ok(after.credits === 321 && after.nudges === 1 && after.coll.includes("4"), "progress: " + JSON.stringify(after));
  ok(Math.abs(after.n - before.n) <= 3, `bodies ${before.n} → ${after.n}`);
  let moved = 0;
  for (let i = 0; i < Math.min(before.pos.length, after.pos.length); i++) if (Math.hypot(before.pos[i][1] - after.pos[i][1], before.pos[i][2] - after.pos[i][2]) > 1.5) moved++;
  ok(moved <= 5, `${moved} bodies are far from where they were`);
});

await check("AC26: a corrupt save doesn't crash the game; it starts fresh", async () => {
  // Leave the game first (it saves on the way out), then break the save from the hub page.
  await page.goto(origin + "/index.html");
  await page.evaluate(() => localStorage.setItem("coin-dozer.save", "{broken"));
  await open();
  ok((await cd("CoinDozer.machine.bank")) === 50, "a fresh board");
});

await check("Landscape doesn't break: the board letterboxes and the controls stay usable", async () => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.waitForTimeout(500);
  ok(await page.isVisible("#controls"), "controls hidden");
  await page.screenshot({ path: join(OUT, "coin-dozer-landscape.png"), timeout: 30000 });
  await page.setViewportSize({ width: 412, height: 839 });
  await page.waitForTimeout(300);
});

await check("AC27: plays fully offline after the first visit", async () => {
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await open();
  ok((await cd("CoinDozer.machine.board.items.size")) > 30, "no board offline");
  await ctx.setOffline(false);
});

for (const p of problems.filter((p) => !p.includes("ERR_INTERNET_DISCONNECTED"))) { failures++; console.log("✗ " + p); }
await browser.close();
server.close();
console.log(failures ? `\n${failures} Coin Dozer check(s) failed.` : "\nCoin Dozer: all end-to-end checks passed.");
process.exit(failures ? 1 : 0);
