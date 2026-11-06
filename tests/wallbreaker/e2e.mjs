#!/usr/bin/env node
// Wallbreaker end to end, in a headless phone-sized Chromium: the acceptance criteria that need a
// real page. Serves dist/ (run `npm run build` first; `npm test` does it), or the source with --src.
//
//   node tests/wallbreaker/e2e.mjs [--src]
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
if (!existsSync(join(DIR, "games/wallbreaker/index.html"))) { console.error(`No Wallbreaker in ${DIR}. Run: npm run build`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/games/wallbreaker/index.html`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
const problems = [];
page.on("pageerror", (e) => problems.push("JS error: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });

let failures = 0;
async function check(name, fn) {
  try { await toMenu(); await fn(); console.log("✓ " + name); }
  catch (e) { failures++; console.log("✗ " + name + "\n    " + (e && e.message)); }
}
function ok(v, msg) { if (!v) throw new Error(msg); }
const wb = (expr) => page.evaluate(expr);
const click = async (text) => { await page.getByRole("button", { name: text, exact: false }).first().click(); await page.waitForTimeout(150); };
async function toMenu() {
  if (await wb("!!window.Wallbreaker.engine")) {
    await page.click("#pauseBtn");
    await page.waitForTimeout(150);
    await click("Quit to menu");
  }
  while (await page.getByRole("button", { name: "← Back" }).count()) { await page.getByRole("button", { name: "← Back" }).first().click(); await page.waitForTimeout(100); }
}

await page.goto(base);
await page.waitForTimeout(600);

await check("each of the seven modes can be started from the menu", async () => {
  const flows = [
    ["Classic", ["Play"], "classic"], ["Zen", ["Play"], "zen"], ["Descent", ["Play"], "descent"],
    ["Run", ["Start a new run"], "run"], ["Daily", ["Play"], "daily"], ["Puzzle", ["Puzzle 1,"], "puzzle"], ["Time Attack", ["Sprint"], "timeattack"],
  ];
  for (const [card, steps, mode] of flows) {
    await toMenu();
    await page.locator(".mode-card", { hasText: card }).first().click();
    await page.waitForTimeout(150);
    for (const s of steps) await page.getByRole("button", { name: s }).first().click();
    await page.waitForTimeout(300);
    const rules = await wb("window.Wallbreaker.engine && window.Wallbreaker.engine.rules.id");
    ok(rules === mode, `${card}: engine runs "${rules}"`);
    await page.screenshot({ path: join(OUT, `wallbreaker-${mode}.png`) });
  }
  await toMenu();
});

await check("the paddle follows relative thumb movement (the finger never needs to cover it)", async () => {
  await page.locator(".mode-card", { hasText: "Zen" }).click();
  await click("Play");
  await page.waitForTimeout(200);
  const x0 = await wb("window.Wallbreaker.engine.paddle.x");
  const scale = await page.evaluate(() => { const c = document.querySelector("#cv"); return c.clientWidth / 360; });
  // Put the thumb far from the paddle (top-left) and drag right by 60 px.
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", 40, 300);
  for (let i = 1; i <= 6; i++) await touch("touchMove", 40 + i * 10, 300);
  await touch("touchEnd");
  await page.waitForTimeout(100);
  const x1 = await wb("window.Wallbreaker.engine.paddle.x");
  ok(Math.abs(x1 - x0 - 60 / scale) < 3, `paddle moved ${(x1 - x0).toFixed(1)}, expected ${(60 / scale).toFixed(1)} (from ${x0} with the finger at x=40)`);
  // A short tap launches the ball.
  ok((await wb("window.Wallbreaker.engine.state")) === "serve", "ball waits on the paddle");
  await touch("touchStart", 300, 400); await touch("touchEnd");
  await page.waitForTimeout(150);
  ok((await wb("window.Wallbreaker.engine.state")) === "play", "a tap launches");
  await toMenu();
});

await check("a boost is consumed only after the first brick breaks; quitting costs nothing", async () => {
  await wb(`(() => { const s = window.Wallbreaker.save; s.boosts.life = 1; s.equip = ["life"]; s.credits = 500; })()`);
  await page.locator(".mode-card", { hasText: "Classic" }).click();
  await click("Play");
  await page.waitForTimeout(200);
  ok((await wb("window.Wallbreaker.engine.lives")) === 4, "Extra Life applied");
  await toMenu();
  ok((await wb("window.Wallbreaker.save.boosts.life")) === 1, "quit before a brick broke: boost kept");
  ok((await wb("window.Wallbreaker.save.credits")) === 500, "quitting cost no credits");
  await page.locator(".mode-card", { hasText: "Classic" }).click();
  await click("Play");
  await wb("(() => { const e = window.Wallbreaker.engine; e.damage(e.bricks[0], 1); })()");
  ok((await wb("window.Wallbreaker.save.boosts.life")) === 0, "used once the first brick broke");
  const level = await wb("window.Wallbreaker.save.classic.level");
  await toMenu();
  ok((await wb("window.Wallbreaker.save.classic.level")) === level, "progress unchanged");
  ok((await wb("window.Wallbreaker.save.credits")) === 500, "still no credits lost");
});

await check("clearing a level pays credits per the formula and moves on", async () => {
  const before = await wb("window.Wallbreaker.save.credits");
  await page.locator(".mode-card", { hasText: "Classic" }).click();
  await click("Play");
  await wb("(() => { const e = window.Wallbreaker.engine; e.tap(); for (const b of e.bricks) if (b.alive) e.damage(b, 99); })()");
  await page.waitForTimeout(1300);
  ok(await page.getByText("Wall cleared!").isVisible(), "result shown");
  const after = await wb("window.Wallbreaker.save.credits");
  ok(after - before >= 20 && after - before <= 40, `level 1 paid ${after - before}`);
  await page.screenshot({ path: join(OUT, "wallbreaker-result.png") });
  await click("Menu");
  await toMenu();
});

await check("a run shows its code, and that code replays the same run", async () => {
  await page.locator(".mode-card", { hasText: "Run" }).click();
  if (await page.getByRole("button", { name: "End run and bank credits" }).count()) { await click("End run and bank credits"); await click("New run"); }
  await click("Start a new run");
  await page.waitForTimeout(200);
  const hud = await page.textContent("#hudLeft");
  const code = await wb("window.Wallbreaker.save.run.active.code");
  ok(hud.includes(code), `HUD "${hud}" shows the code ${code}`);
  await toMenu();
  await page.locator(".mode-card", { hasText: "Run" }).click();
  await click("End run and bank credits");
  await click("New run");
  await page.fill("input[type=text]", code.toLowerCase());
  await click("Play this code");
  ok((await wb("window.Wallbreaker.save.run.active.code")) === code, "same code");
  await toMenu();
});

await check("settings: colour-blind palette, reduced motion, left-handed layout and haptics all work", async () => {
  await click("Settings");
  const toggle = (label) => page.locator("label", { hasText: label }).locator("input").click();
  await page.locator("label", { hasText: "Brick colours" }).locator("select").selectOption("cb");
  await toggle("Reduce motion");
  await toggle("Left-handed layout");
  await toggle("Vibration");
  const s = await wb("window.Wallbreaker.save.settings");
  ok(s.palette === "cb", "palette saved");
  ok(await wb("document.body.classList.contains('reduced-motion')"), "reduced motion on");
  ok(await wb("document.body.classList.contains('left-handed')"), "left-handed on");
  ok(s.haptics === false, "haptics off");
  // With haptics off, nothing vibrates.
  await wb("window.__buzz = 0; window.Platform.haptic = () => window.__buzz++");
  await toMenu();
  await page.locator(".mode-card", { hasText: "Zen" }).click();
  await click("Play");
  await wb("(() => { const e = window.Wallbreaker.engine; e.tap(); e.damage(e.bricks[0], 9); })()");
  ok((await wb("window.__buzz")) === 0, "no vibration");
  await page.screenshot({ path: join(OUT, "wallbreaker-settings-play.png") });
  await toMenu();
  await click("Settings");
  await page.locator("label", { hasText: "Brick colours" }).locator("select").selectOption("default");
  await toggle("Reduce motion"); await toggle("Left-handed layout"); await toggle("Vibration");
  await toMenu();
});

await check("no real-money purchase path: the shop sells for credits only", async () => {
  await click("Shop");
  const html = await page.content();
  ok(!/€|\$\d|USD|EUR|purchase now|buy credits/i.test(html), "no money prices");
  ok(/can never be bought/.test(html), "says credits can't be bought");
  await page.screenshot({ path: join(OUT, "wallbreaker-shop.png") });
  await toMenu();
});

await check("the game installs and plays fully offline", async () => {
  const manifest = await wb("document.querySelector('link[rel=manifest]').href");
  ok(manifest.endsWith("manifest.webmanifest"), "has a web app manifest");
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 8000 });
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForTimeout(800);
  ok(await page.locator(".logo").isVisible(), "menu loads with no network");
  await page.locator(".mode-card", { hasText: "Classic" }).click();
  await click("Play");
  ok((await wb("window.Wallbreaker.engine && window.Wallbreaker.engine.rules.id")) === "classic", "and plays");
  await ctx.setOffline(false);
  await toMenu();
});

if (problems.length) { failures++; console.log("✗ no errors on the page\n    " + [...new Set(problems)].join("\n    ")); }
await browser.close();
server.close();
console.log(failures ? `\n${failures} Wallbreaker check(s) failed.` : "\nWallbreaker end to end: all checks passed.");
process.exit(failures ? 1 : 0);
