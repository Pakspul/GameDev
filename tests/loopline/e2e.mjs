#!/usr/bin/env node
// Loopline end to end, in a headless phone-sized Chromium, through real taps: the lobby with its modes
// and difficulties, a blocked bus, clearing a level in each mode by tapping the movers the solver
// picks, the result screen and the saved progress, undo, hints, the toolbar and the menu drawer. Serves dist/ (run `npm run build` first;
// `npm test` does it), or the source with --src.
//
//   node tests/loopline/e2e.mjs [--src]
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
if (!existsSync(join(DIR, "games/loopline/index.html"))) { console.error(`No Loopline in ${DIR}. Run: npm run build`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const server = await startServer({ dir: DIR, port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${server.address().port}/games/loopline/index.html`;
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
const ll = (fn, arg) => page.evaluate(fn, arg);
const idle = () => page.waitForFunction(() => Loopline.game.idle && Loopline.game.events.length === 0, null, { timeout: 15000 });

/** Where on screen mover m can be tapped now (a critter in a bay, or in the yard). */
const spot = (m) => ll((m) => {
  const g = Loopline.game;
  return g.kind !== "depot" && g.where[m] === 3 ? Loopline.bayPoint(g.bays.indexOf(m)) : Loopline.point(m);
}, m);

/** Clear the level on screen by tapping, one send at a time, as the solver says. */
async function clearLevel() {
  for (let k = 0; k < 80; k++) {
    await idle();
    if (await ll(() => Loopline.state === "over" || Loopline.game.status !== "play")) break;
    const sol = await ll(() => Loopline.solve());
    ok(sol && sol.length, "the solver finds a way from here");
    const [x, y] = await spot(sol[0]);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(60);
    ok(await ll((m) => { const g = Loopline.game; return g.where[m] !== 0 && (g.kind === "depot" || g.where[m] !== 3); }, sol[0]), `the tap on mover ${sol[0]} sent it`);
  }
  await page.waitForSelector("#result:not([hidden])");
}

await page.goto(base);
await page.waitForTimeout(500);

await check("the start screen offers both modes, three difficulties and level 1", async () => {
  ok((await page.locator(".lob-choice button").count()) === 2, "two modes");
  ok((await page.locator(".lob-choice button[aria-checked=true]").innerText()).includes("Depot"), "Depot first");
  ok((await page.locator(".lob-tabs .lob-tab").count()) === 3, "Easy, Medium, Hard");
  ok((await page.locator(".lob-tab[aria-selected=true]").innerText()).includes("Easy"), "Easy first");
  ok((await page.locator(".lob-lvl").first().innerText()).trim().startsWith("1"), "level 1 tile");
  await page.screenshot({ path: join(OUT, "loopline-lobby.png") });
});

await check("Play starts Depot Easy level 1 with a tip, a loop that fills, docks and a car park", async () => {
  await page.locator(".lob-play .lob-go").click();
  await page.waitForTimeout(300);
  ok((await ll(() => Loopline.state)) === "play", "playing");
  ok(await page.locator("#tip").isVisible(), "a tip for the first level");
  ok(await ll(() => Loopline.game.kind === "depot" && Loopline.game.level.lot && Loopline.game.docks.length === 4), "a car park and four docks");
  await idle();
  ok(await ll(() => Loopline.game.filled > 0), "pixels ride the loop");
  ok(await page.locator("#tools").isVisible(), "the toolbar");
});

await check("tapping a blocked bus doesn't send it and says why", async () => {
  const m = await ll(() => { const g = Loopline.game; return g.level.movers.map((_, i) => i).find((i) => g.where[i] === 0 && !g.free(i)); });
  ok(m != null, "level 1 has a blocked bus");
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
  ok((await ll((m) => Loopline.game.where[m], m)) === 0, "still parked");
  ok((await page.locator("#toast").innerText()).length > 0, "a message");
});

await check("undo puts the last send back", async () => {
  const before = await ll(() => Loopline.game.remaining);
  const m = (await ll(() => Loopline.solve()))[0];
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await idle();
  ok((await ll(() => Loopline.game.remaining)) < before, "pixels got on the bus");
  await page.locator("#undoBtn").click();
  await page.waitForTimeout(100);
  ok((await ll(() => Loopline.game.remaining)) === before, "back to where it was");
  await ll(() => Loopline.start(1)); // a clean start, so it counts for three stars
});

await check("clearing Depot level 1 by tapping shows three stars and saves it", async () => {
  await clearLevel();
  ok((await page.locator("#resultStars svg.on").count()) === 3, "three stars without help");
  const saved = await ll(() => JSON.parse(localStorage.getItem("loopline.v2")));
  ok(saved.progress["depot:easy"].best === 1 && saved.progress["depot:easy"].stars[1] === 3, "progress saved");
  await page.screenshot({ path: join(OUT, "loopline-won.png") });
});

await check("Next level goes to level 2; a hint marks a mover to send", async () => {
  await page.locator("#resultMain").click();
  await page.waitForTimeout(200);
  ok((await ll(() => Loopline.level)) === 2, "level 2");
  await idle();
  await page.locator("#hintBtn").click();
  await page.waitForTimeout(200);
  ok(problems.length === 0, "no errors");
  await page.screenshot({ path: join(OUT, "loopline-depot.png") });
});

await check("Restart in the toolbar starts the level again", async () => {
  const m = (await ll(() => Loopline.solve()))[0];
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(100);
  await page.locator("#restartBtn").click();
  await page.waitForTimeout(150);
  ok(await ll(() => Loopline.game.history.length === 0 && Loopline.level === 2), "a fresh level 2");
});

await check("the menu drawer pauses, and the back button leads to the lobby with level 2 next", async () => {
  await page.locator("#hud .gnav-menu").click();
  await page.waitForTimeout(250);
  ok((await ll(() => Loopline.state)) === "pause", "paused");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok((await ll(() => Loopline.state)) === "play", "playing again");
  await page.locator("#hud .gnav-back").click();
  await page.waitForTimeout(250);
  ok((await ll(() => Loopline.state)) === "menu", "in the lobby");
  ok((await page.locator(".lob-play h2").innerText()).includes("2"), "level 2 next");
});

await check("Critters: clearing Medium level 1 by tapping lane fronts", async () => {
  await page.locator(".lob-choice button").nth(1).click();
  await page.waitForTimeout(200);
  ok((await ll(() => Loopline.mode)) === "critters", "Critters chosen");
  await page.locator(".lob-tabs .lob-tab").nth(1).click();
  await page.waitForTimeout(200);
  ok((await ll(() => Loopline.diff)) === "medium", "Medium chosen");
  ok((await page.locator(".lob-play h2").innerText()).includes("1"), "its own track starts at level 1");
  await page.locator(".lob-play .lob-go").click();
  await page.waitForTimeout(300);
  ok(await ll(() => !!Loopline.game.level.lanes), "lanes of critters");
  await clearLevel();
  ok((await page.locator("#resultTitle").innerText()).length > 0, "a result");
  await page.screenshot({ path: join(OUT, "loopline-critters-won.png") });
});

await check("a lost level offers undo, which brings the game back", async () => {
  await ll(() => Loopline.start(3));
  // Play badly on purpose: always the mover that would take the least, until a bay is missing.
  for (let k = 0; k < 40; k++) {
    await idle();
    if (await ll(() => Loopline.game.status !== "play")) break;
    await ll(async () => {
      const { lap } = await import("./src/engine.js");
      const g = Loopline.game;
      const score = (m) => lap(g.cells.slice(), g.track, g.color(m), g.left[m]) / g.left[m] + (g.where[m] === 3 ? 5 : 0);
      Loopline.send(g.ready().sort((a, b) => score(a) - score(b))[0]);
    });
  }
  ok((await ll(() => Loopline.game.status)) === "lost", "Critters Medium level 3 is lost by playing it badly");
  await page.waitForSelector("#result:not([hidden])");
  await page.locator("#resultMain").click();
  await page.waitForTimeout(150);
  ok((await ll(() => Loopline.game.status)) === "play", "undo after losing");
  ok((await ll(() => Loopline.state)) === "play", "back in the level");
});

if (problems.length) { failures++; console.log("✗ no errors on the page\n    " + [...new Set(problems)].join("\n    ")); }
else console.log("✓ no errors on the page");

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nLoopline end to end: all good.");
process.exit(failures ? 1 : 0);
