#!/usr/bin/env node
// Starflip end to end, in a headless phone-sized Chromium, through real touches: Play, hold and let go
// to launch, flippers on each half of the screen, the mission banner, a bonus table unlocked on the
// menu, pause in the menu drawer, and the result screen. Serves dist/ (run `npm run build` first;
// `npm test` does it), or the source with --src.
//
//   node tests/starflip/e2e.mjs [--src]
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
if (!existsSync(join(DIR, "games/starflip/index.html"))) { console.error(`No Starflip in ${DIR}. Run: npm run build`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/games/starflip/index.html`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
const problems = [];
page.on("pageerror", (e) => problems.push("JS error: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log("✓ " + name); }
  catch (e) { failures++; console.log("✗ " + name + "\n    " + (e && e.message)); }
}
function ok(v, msg) { if (!v) throw new Error(msg); }
const sf = (fn, arg) => page.evaluate(fn, arg);
const cdp = await ctx.newCDPSession(page);
/** Touch points down (or up, with an empty list): [{ x, y, id }]. */
const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 1 })) });
const W = 412, H = 915;

await page.goto(base);
await page.waitForTimeout(600);

await check("the start screen lists the six missions and three locked bonus tables", async () => {
  ok((await page.locator(".missions li").count()) === 6, "six missions");
  ok((await page.locator(".minis button:disabled").count()) === 3, "three bonus tables, locked before you reach them");
});

await check("Play starts a game with a ball in the plunger lane and says how to launch it", async () => {
  await page.locator(".lob-play .lob-go").click();
  await page.waitForTimeout(300);
  ok((await sf(() => Starflip.state)) === "play", "playing");
  ok(await sf(() => !!Starflip.game.ready), "a ball waits in the plunger lane");
  ok((await page.locator("#banner").getAttribute("class")).includes("k-ready"), "the banner shows the launch hint");
});

await check("holding the screen pulls the plunger, letting go launches the ball", async () => {
  await touch("touchStart", [{ x: W / 2, y: 600 }]);
  await page.waitForTimeout(500);
  const power = await sf(() => Starflip.game.power);
  ok(power > 0.2, `the plunger pulls back (${power})`);
  await touch("touchEnd", []);
  await page.waitForTimeout(400);
  ok(await sf(() => !Starflip.game.ready && Starflip.game.main.balls.some((b) => b.y < 800)), "the ball is on its way");
});

await check("touching each half of the screen works that flipper", async () => {
  await touch("touchStart", [{ x: 60, y: 700 }]);
  await page.waitForTimeout(120);
  ok(await sf(() => Starflip.game.input.L && !Starflip.game.input.R), "left half → left flipper");
  await touch("touchStart", [{ x: 60, y: 700, id: 1 }, { x: W - 60, y: 700, id: 2 }]);
  await page.waitForTimeout(120);
  ok(await sf(() => Starflip.game.input.L && Starflip.game.input.R), "both at once");
  await touch("touchEnd", []);
  await page.waitForTimeout(120);
  ok(await sf(() => !Starflip.game.input.L && !Starflip.game.input.R), "let go → both down");
});

await check("the banner tells you what to shoot in a mission, and the game keeps scoring", async () => {
  await sf(() => { const g = Starflip.game; if (!g.active) g.startMission(); });
  await page.waitForTimeout(300);
  const line = await page.locator("#bLine").textContent();
  ok(/BUMPERS/.test(line), `the first step says what to shoot: "${line}"`);
  ok(/\d:\d\d/.test(await page.locator("#bTime").textContent()), "with the time left");
  await sf(() => { const g = Starflip.game; for (let i = 0; i < 8; i++) g.shot("bumpers"); g.shot("rightOrbit"); });
  await page.waitForTimeout(300);
  ok(/WORMHOLE/.test(await page.locator("#bSub").textContent()), "a finished mission says the wormhole is open");
});

await check("the menu drawer pauses the game, and closing it plays on", async () => {
  await page.click(".gnav-menu");
  await page.waitForTimeout(300);
  ok((await sf(() => Starflip.state)) === "pause", "paused");
  const t = await sf(() => Starflip.game.t);
  await page.waitForTimeout(300);
  ok((await sf(() => Starflip.game.t)) === t, "nothing moves while paused");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok((await sf(() => Starflip.state)) === "play", "playing again");
});

await check("the wormhole warps to a bonus table, which unlocks it on the start screen", async () => {
  await sf(() => { const g = Starflip.game; g.main.balls.length = 0; g.enterMini("asteroids"); });
  await page.waitForTimeout(400);
  ok((await page.locator("#banner").getAttribute("class")).includes("k-mini"), "the banner shows the bonus round");
  await sf(() => { Starflip.game.mini.time = 0.05; });
  await page.waitForTimeout(400);
  ok(await sf(() => Starflip.game.phase === "play" && Starflip.game.world === Starflip.game.main), "back on the main table");
  await page.screenshot({ path: join(OUT, "starflip-play.png") });
});

await check("losing the last ball shows the result, and the menu remembers the game", async () => {
  await sf(() => { const g = Starflip.game; g.ballNo = g.balls; g.ballSave = 0; for (const b of [...g.main.balls]) { g.main.removeBall(b); g.onDrain(b); } });
  await page.waitForSelector("#result:not([hidden])", { timeout: 6000 });
  ok(/\d/.test(await page.locator("#resultScore").textContent()), "the score is shown");
  await page.locator("#resultMenuBtn").click();
  await page.waitForTimeout(300);
  ok((await sf(() => Starflip.state)) === "menu", "back on the start screen");
  ok((await page.locator(".minis button:not(:disabled)").count()) === 1, "the bonus table you reached can now be played on its own");
  ok((await page.locator(".missions li.done").count()) === 1, "the mission you finished is marked");
});

await check("a bonus table played from the menu ends on its own result", async () => {
  await page.locator(".minis button:not(:disabled)").click();
  await page.waitForTimeout(300);
  ok(await sf(() => Starflip.game.practice === "asteroids" && Starflip.game.phase === "mini"), "the bonus table on its own");
  await sf(() => { Starflip.game.mini.time = 0.05; });
  await page.waitForSelector("#result:not([hidden])", { timeout: 6000 });
});

if (problems.length) { failures++; console.log("✗ no errors in the page\n    " + [...new Set(problems)].join("\n    ")); }
await browser.close();
server.close();
console.log(failures ? `\n${failures} Starflip check(s) failed.` : "\nStarflip: all checks passed.");
process.exit(failures ? 1 : 0);
