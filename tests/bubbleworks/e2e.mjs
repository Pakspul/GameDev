#!/usr/bin/env node
// Bubbleworks end to end, in a headless phone-sized Chromium, through real touches where it matters:
// the lobby, drag to aim and release to fire, cancel by dragging back, tap the launcher to swap, a power
// from the tray, help in a level (Aim+, +5 shots after running out), winning a level (played by the
// autoplayer through the page), pause in the menu drawer, every mode starting. Serves dist/ (run
// `npm run build` first; `npm test` does it), or the source with --src.
//
//   node tests/bubbleworks/e2e.mjs [--src]
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
if (!existsSync(join(DIR, "games/bubbleworks/index.html"))) { console.error(`No Bubbleworks in ${DIR}. Run: npm run build`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/games/bubbleworks/index.html`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const problems = [];
page.on("pageerror", (e) => problems.push("JS error: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log("✓ " + name); }
  catch (e) { failures++; console.log("✗ " + name + "\n    " + (e && e.message)); }
}
function ok(v, msg) { if (!v) throw new Error(msg); }
const bw = (fn, arg) => page.evaluate(fn, arg);
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
const settle = () => page.waitForFunction(() => !Bubbleworks.flying);

await page.goto(base);
await page.waitForTimeout(500);

await check("the lobby shows the daily level, three modes and Play", async () => {
  ok(await page.locator(".lob-daily").isVisible(), "daily card");
  ok((await page.locator(".lob-choice button").count()) === 3, "three modes");
  ok(await page.locator(".lob-play .lob-go").isVisible(), "Play");
});

await check("Play starts Classic stage 1", async () => {
  await page.locator(".lob-play .lob-go").click();
  ok((await bw(() => Bubbleworks.state)) === "play", "playing");
  ok((await bw(() => Bubbleworks.kind)) === "classic", "classic");
  ok((await bw(() => Bubbleworks.game.stage)) === 1, "stage 1");
});

await check("drag up and let go fires a bubble, which sticks to the board", async () => {
  const L = await bw(() => Bubbleworks.launcher());
  const before = await bw(() => ({ shots: Bubbleworks.game.shots, n: Bubbleworks.game.grid.count() }));
  await touch("touchStart", L.x, L.y - 60);
  await touch("touchMove", L.x - 40, L.y - 220);
  await page.waitForTimeout(80);
  await touch("touchEnd");
  await page.waitForTimeout(50);
  await settle();
  const after = await bw(() => ({ shots: Bubbleworks.game.shots, n: Bubbleworks.game.grid.count() }));
  ok(after.shots === before.shots + 1, "one shot fired");
  ok(after.n !== before.n, "the board changed (the bubble stuck, or popped some)");
});

await check("dragging back below the launcher cancels the shot", async () => {
  const L = await bw(() => Bubbleworks.launcher());
  const before = await bw(() => Bubbleworks.game.shots);
  await touch("touchStart", L.x, L.y - 60);
  await touch("touchMove", L.x + 30, L.y - 200);
  await touch("touchMove", L.x + 30, L.y + 20);
  await touch("touchEnd");
  await page.waitForTimeout(300);
  ok((await bw(() => Bubbleworks.game.shots)) === before, "nothing fired");
});

await check("tapping the launcher swaps the bubble with the next one", async () => {
  // Make sure the two differ.
  await bw(() => { const g = Bubbleworks.game, have = [...g.grid.colours().keys()]; g.current = have[0]; g.next = have[1] ?? have[0]; });
  const before = await bw(() => [Bubbleworks.game.current, Bubbleworks.game.next]);
  const L = await bw(() => Bubbleworks.launcher());
  await touch("touchStart", L.x, L.y);
  await touch("touchEnd");
  await page.waitForTimeout(100);
  const after = await bw(() => [Bubbleworks.game.current, Bubbleworks.game.next]);
  ok(after[0] === before[1] && after[1] === before[0], `swapped ${before} → ${after}`);
});

await check("a power in the tray: tap to load it, fire it, and it's used up without costing a shot", async () => {
  await bw(() => { Bubbleworks.game.tray.push("bomb"); Bubbleworks.refresh(); });
  await page.locator("#tray .slot").first().click();
  ok(await page.locator("#tray .slot.armed").isVisible(), "the slot shows it's loaded");
  const shots = await bw(() => Bubbleworks.game.shots);
  await bw(() => Bubbleworks.fire(0));
  await settle();
  ok((await bw(() => Bubbleworks.game.tray.length)) === 0, "used up");
  ok((await bw(() => Bubbleworks.game.shots)) === shots, "no shot used");
  await page.screenshot({ path: join(OUT, "bubbleworks-classic.png") });
});

await check("the menu drawer pauses, and closing it resumes", async () => {
  await page.locator(".gnav-menu").click();
  ok((await bw(() => Bubbleworks.state)) === "pause", "paused");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok((await bw(() => Bubbleworks.state)) === "play", "playing again");
});

await check("Levels: Aim+ costs stardust and stays on for the level", async () => {
  await bw(() => Bubbleworks.start("levels", 1));
  ok(await page.locator("#helps").isVisible(), "help buttons in a level");
  const dust = await bw(() => Bubbleworks.dust);
  await page.locator("#aimBtn").click();
  ok(await bw(() => Bubbleworks.aimFull), "Aim+ on");
  ok((await bw(() => Bubbleworks.dust)) < dust, "it cost stardust");
});

await check("Levels: out of shots offers 5 more, and the level goes on", async () => {
  await bw(() => Bubbleworks.start("levels", 2));
  await bw(() => { Bubbleworks.dust = 500; Bubbleworks.game.shotsLeft = 1; });
  await bw(() => Bubbleworks.fire(-0.2));
  await page.waitForSelector("#result:not([hidden])");
  ok((await page.locator("#resultMain").textContent()).includes("5"), "+5 shots offered");
  await page.locator("#resultMain").click();
  ok((await bw(() => Bubbleworks.state)) === "play", "playing again");
  ok((await bw(() => Bubbleworks.game.shotsLeft)) === 5, "five shots");
});

await check("Levels: winning shows stars, pays stardust and opens the next level", async () => {
  await bw(() => Bubbleworks.start("levels", 1));
  const dust = await bw(() => Bubbleworks.dust);
  await page.evaluate(async () => {
    const { bestMove } = await import("./src/bot.js");
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 80 && Bubbleworks.game.status === "play"; i++) {
      const m = bestMove(Bubbleworks.game);
      if (m.swap) Bubbleworks.swap();
      if (m.arm >= 0) Bubbleworks.arm(m.arm);
      Bubbleworks.fire(m.angle);
      while (Bubbleworks.flying) await wait(30);
    }
  });
  await page.waitForSelector("#result:not([hidden])");
  ok((await page.locator("#resultStars svg.on").count()) >= 1, "stars");
  ok((await bw(() => Bubbleworks.dust)) > dust, "stardust paid");
  ok((await bw(() => Bubbleworks.save.levels.best)) >= 1, "level 1 cleared");
  await page.screenshot({ path: join(OUT, "bubbleworks-won.png") });
  await page.locator("#resultMain").click();
  ok((await bw(() => Bubbleworks.level)) === 2, "on to level 2");
});

await check("Endless and the daily level start", async () => {
  await bw(() => Bubbleworks.start("endless"));
  ok((await bw(() => Bubbleworks.game.mode)) === "endless", "endless");
  await bw(() => Bubbleworks.start("daily"));
  ok((await bw(() => Bubbleworks.game.goal)) != null, "the daily has a goal");
  await page.screenshot({ path: join(OUT, "bubbleworks-daily.png") });
});

await check("back goes to the lobby, which shows the cleared level", async () => {
  await page.locator(".gnav-back").click();
  ok((await bw(() => Bubbleworks.state)) === "menu", "menu");
  await page.locator(".lob-choice button").nth(1).click();
  ok((await page.locator(".lob-lvl .lob-stars").count()) >= 1, "level 1 with its stars");
});

await check("no errors on the page", async () => { ok(!problems.length, problems.join("\n    ")); });

await browser.close();
server.close();
console.log(failures ? `\n${failures} Bubbleworks check(s) failed.` : "\nBubbleworks OK.");
process.exit(failures ? 1 : 0);
