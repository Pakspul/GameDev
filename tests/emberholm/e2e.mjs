#!/usr/bin/env node
// Emberholm end to end, in a headless phone-sized Chromium held in landscape: the start screen,
// Play, walking with the touch stick and the keyboard, the camera drag, the map, the menu drawer
// pausing the game, a save that survives a reload, and the "turn your phone" screen in portrait.
// Serves dist/ (run `npm run build -- --experimental` first; `npm test` does it), or the source with --src.
//
//   node tests/emberholm/e2e.mjs [--src]
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
if (!existsSync(join(DIR, "games/emberholm/index.html"))) { console.error(`No Emberholm in ${DIR}. Run: npm run build -- --experimental`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/games/emberholm/index.html`;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ ...devices["Pixel 7 landscape"] });
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
const ev = (fn, arg) => page.evaluate(fn, arg);
const pos = () => ev(() => ({ x: Emberholm.player.x, z: Emberholm.player.z }));
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 1 })) });
const { width: W, height: H } = page.viewportSize();

await page.goto(base);
await page.waitForTimeout(1500);

await check("the start screen offers to wash ashore", async () => {
  ok((await ev(() => Emberholm.state)) === "menu", "on the start screen");
  ok(await page.locator(".lob-play .lob-go").isVisible(), "a Play button");
});

await check("Play starts on the beach, with the clock and the minimap showing", async () => {
  await page.locator(".lob-play .lob-go").click();
  await page.waitForTimeout(400);
  ok((await ev(() => Emberholm.state)) === "play", "playing");
  ok(/^\d\d:\d\d$/.test(await page.locator("#clock").textContent()), "a clock");
  ok(await page.locator("#mini").isVisible(), "a minimap");
});

await check("dragging on the left half walks (the stick), forward is away from the camera", async () => {
  const a = await pos();
  const x = W * 0.2, y = H * 0.6;
  await touch("touchStart", [{ x, y }]);
  for (let i = 1; i <= 6; i++) { await touch("touchMove", [{ x, y: y - i * 7 }]); await page.waitForTimeout(16); }
  await page.waitForTimeout(1500);
  await touch("touchEnd", []);
  const b = await pos();
  ok(a.z - b.z > 3, `walked north ${(a.z - b.z).toFixed(1)} m`);
});

await check("dragging on the right half turns the camera", async () => {
  const yaw = await ev(() => Emberholm.chase.yaw);
  const x = W * 0.75, y = H * 0.5;
  await touch("touchStart", [{ x, y }]);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [{ x: x + i * 20, y }]); await page.waitForTimeout(16); }
  await touch("touchEnd", []);
  await page.waitForTimeout(300);
  const turned = (await ev(() => Emberholm.chase.yaw)) - yaw;
  ok(turned < -0.3, `the camera turned right (${turned.toFixed(2)} rad)`);
});

await check("the keyboard walks too", async () => {
  const a = await pos();
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1200);
  await page.keyboard.up("KeyA");
  const b = await pos();
  ok(Math.hypot(b.x - a.x, b.z - a.z) > 2, "moved with A");
});

await check("tapping the minimap opens the map, and the game waits while it's open", async () => {
  await page.locator("#mini").click();
  await page.waitForTimeout(300);
  ok(await page.locator("#mapView").isVisible(), "the map shows");
  const t = await ev(() => Emberholm.clock.t);
  await page.waitForTimeout(500);
  ok((await ev(() => Emberholm.clock.t)) === t, "time stands still");
  await page.locator("#mapClose").click();
  ok(!(await page.locator("#mapView").isVisible()), "closed");
});

await check("the menu drawer pauses, and the time-of-day tool makes it night", async () => {
  await page.locator(".gnav-menu").click();
  await page.waitForTimeout(300);
  ok((await ev(() => Emberholm.state)) === "pause", "paused");
  await page.locator('.gnav-seg button', { hasText: "Night" }).click();
  ok(await ev(() => Emberholm.clock.night), "it's night");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok((await ev(() => Emberholm.state)) === "play", "playing again");
  await page.screenshot({ path: join(OUT, "emberholm-night.png") });
});

await check("where you are is saved, and Continue brings you back there", async () => {
  const a = await pos();
  await page.locator(".gnav-back").click();
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(1200);
  const b = await pos();
  ok(Math.hypot(b.x - a.x, b.z - a.z) < 1, "same spot after a reload");
  ok(/Continue/.test(await page.locator(".lob-play").textContent()), "the start screen says Continue");
});

await check("in portrait a phone is asked to turn sideways", async () => {
  await page.locator(".lob-play .lob-go").click();
  await page.waitForTimeout(300);
  // Play asked for full screen (a phone); a full-screen window can't be resized, so leave it first.
  await ev(() => document.fullscreenElement && document.exitFullscreen());
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: H, height: W });
  await page.waitForTimeout(400);
  ok(await page.locator("#turn").isVisible(), "the turn screen shows");
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(300);
  ok(!(await page.locator("#turn").isVisible()), "and goes away in landscape");
});

await page.screenshot({ path: join(OUT, "emberholm-play.png") });
for (const p of problems) { failures++; console.log("✗ " + p); }
await browser.close();
server.close();
console.log(failures ? `\n${failures} Emberholm check(s) failed.` : "\nEmberholm OK");
process.exit(failures ? 1 : 0);
