#!/usr/bin/env node
// Loopline end to end, in a headless phone-sized Chromium, through real taps: the lobby with its modes
// and difficulties, a blocked bus, clearing a level in each mode by tapping the movers the solver
// picks (Orbit, the 3D mode, fast-forwarded up to the last tap), the result screen and the saved progress, undo, hints, the toolbar and the menu drawer,
// the loop bar and Repeat, a sure win finishing itself, buddies, and the model gallery with its test levels. Serves dist/ (run `npm run build` first;
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
// SwiftShader: WebGL without a GPU, for Orbit's 3D view.
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
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

await check("the start screen offers three modes, three difficulties and level 1", async () => {
  ok((await page.locator(".lob-choice button").count()) === 3, "Depot, Critters, Orbit");
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
  const saved = await ll(() => JSON.parse(localStorage.getItem("loopline.v3")));
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

await check("Orbit: a 3D sculpture of 10,000+ blocks, lanes and bays under it, a tap sends a critter", async () => {
  await page.locator("#hud .gnav-back").click();
  await page.waitForTimeout(250);
  await ll(() => { Loopline.setMode("orbit"); Loopline.setDiff("easy"); });
  await page.waitForTimeout(200);
  ok((await page.locator(".lob-choice button[aria-checked=true]").innerText()).includes("Orbit"), "Orbit chosen");
  await page.locator(".lob-play .lob-go").click();
  await page.waitForTimeout(500);
  ok(await ll(() => Loopline.game.kind === "orbit" && Loopline.game.remaining >= 10000), "an Orbit level of 10,000+ blocks");
  ok(await page.locator("#gl").isVisible(), "the 3D view is on");
  const L = await ll(() => Loopline.layoutInfo());
  ok(L.view.y + L.view.h <= L.slots[0].y && L.slots[0].y + L.slots[0].s <= L.yard.y, "view, then bays, then lanes");
  const toolsTop = await page.locator("#tools").evaluate((e) => e.getBoundingClientRect().top);
  ok(L.yard.y + L.yard.h <= toolsTop, "the lanes clear the toolbar");
  const before = await ll(() => Loopline.game.remaining);
  const m = (await ll(() => Loopline.solve()))[0];
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await idle();
  ok((await ll(() => Loopline.game.remaining)) < before, "the critter popped blocks");
  await page.screenshot({ path: join(OUT, "loopline-orbit.png") });
});

await check("Orbit: dragging turns the view; undo and a hint work", async () => {
  const yaw = await ll(() => Loopline.yaw);
  await page.mouse.move(120, 300); await page.mouse.down(); await page.mouse.move(260, 280, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(200);
  ok(Math.abs((await ll(() => Loopline.yaw)) - yaw) > 0.5, "the view turned");
  await page.locator("#undoBtn").click();
  await page.waitForTimeout(100);
  ok(await ll(() => Loopline.game.history.length === 0), "undone");
  await page.locator("#hintBtn").click();
  await page.waitForTimeout(200);
  ok(problems.length === 0, "no errors");
});

await check("Orbit: the last tap clears the sculpture, with three stars", async () => {
  await ll(() => Loopline.start(1)); // a clean start: the undo and hint above cost stars
  await page.waitForTimeout(200);
  // Play all but the last send in the engine (a full level takes minutes of laps), then tap the last one.
  const last = await ll(() => {
    const g = Loopline.game, sol = Loopline.solve();
    for (const m of sol.slice(0, -1)) { g.launch(m); g.settle(); }
    g.events.length = 0;
    return sol[sol.length - 1];
  });
  const [x, y] = await spot(last);
  await page.touchscreen.tap(x, y);
  await page.waitForSelector("#result:not([hidden])", { timeout: 20000 });
  ok((await page.locator("#resultStars svg.on").count()) === 3, "three stars");
  const saved = await ll(() => JSON.parse(localStorage.getItem("loopline.v3")));
  ok(saved.progress["orbit:easy"].best === 1, "Orbit progress saved");
  await page.screenshot({ path: join(OUT, "loopline-orbit-won.png") });
});

await check("Coins: clearing pays them, the HUD and the lobby show them", async () => {
  ok((await page.locator("#resultCoins").innerText()).includes("+"), "the result says what it paid");
  const coins = await ll(() => Loopline.coins);
  await page.locator("#resultAlt").click();
  await page.waitForTimeout(250);
  ok((await page.locator(".lob-play").innerText()).includes(String(coins)), "the lobby shows the balance");
});

await check("Powers: +1 Bay adds a bay at once; Pick sends a critter from the back of a lane; undo hands its coins back", async () => {
  await ll(() => { Loopline.coins = 1000; Loopline.setMode("critters"); Loopline.setDiff("medium"); Loopline.start(5); });
  await page.waitForTimeout(300);
  ok((await page.locator("#hud #coins").innerText()) === "1000", "the HUD shows the balance");
  const bays = await ll(() => Loopline.game.bays.length);
  await page.locator("#bayBtn").click();
  await page.waitForTimeout(150);
  ok((await ll(() => Loopline.game.bays.length)) === bays + 1, "one more bay");
  ok((await ll(() => Loopline.coins)) === 930, "+1 Bay costs two Medium levels' pay (70)");
  await page.locator("#pickBtn").click();
  ok((await ll(() => Loopline.armed)) === "pick", "Pick waits for a tap");
  ok((await ll(() => Loopline.coins)) === 930, "nothing paid yet");
  const m = await ll(() => Loopline.game.lanes.find((l) => l.length > 1)[1]);
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(100);
  ok((await ll((m) => Loopline.game.where[m], m)) !== 0, "the second critter of a lane went");
  ok((await ll(() => Loopline.coins)) === 860 && (await ll(() => Loopline.armed)) === null, "paid when it went");
  await idle();
  await page.locator("#undoBtn").click();
  await page.waitForTimeout(100);
  ok((await ll((m) => Loopline.game.where[m], m)) === 0 && (await ll(() => Loopline.coins)) === 930, "undo puts it back and refunds Pick");
  await page.screenshot({ path: join(OUT, "loopline-powers.png") });
});

await check("Hard: undo costs coins", async () => {
  await ll(() => { Loopline.setDiff("hard"); Loopline.start(1); });
  await page.waitForTimeout(300);
  ok((await page.locator("#undoCost").innerText()).trim() === "30", "the price is on the button");
  const m = (await ll(() => Loopline.solve()))[0];
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await idle();
  const before = await ll(() => Loopline.coins);
  await page.locator("#undoBtn").click();
  await page.waitForTimeout(100);
  ok((await ll(() => Loopline.coins)) === before - 30, "half a Hard level's pay");
});

await check("the loop bar counts the critters on the loop, n / 4, with a chequered start line on the rail", async () => {
  await ll(() => { Loopline.setMode("critters"); Loopline.setDiff("easy"); Loopline.start(5); });
  await page.waitForTimeout(300);
  ok(await page.locator("#loopbar").isVisible(), "the loop bar shows in Critters");
  ok((await page.locator("#loopNum").innerText()) === "0/4", "nobody on the loop yet");
  const m = await ll(() => Loopline.game.lanes[0][0]);
  const [x, y] = await spot(m);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(120);
  ok((await page.locator("#loopNum").innerText()) === "1/4", "one critter rides");
  ok((await page.locator("#loopPips i[style]").count()) === 1, "one pip in its colour");
  await idle();
  ok((await page.locator("#loopNum").innerText()) === "0/4", "back to none after its lap");
  await ll(() => Loopline.setMode("depot"));
  ok(!(await page.locator("#loopbar").isVisible()), "no loop bar in Depot");
});

await check("Repeat sends parked critters round again by itself, and stops once they pop nothing", async () => {
  await ll(() => { Loopline.setMode("critters"); Loopline.setDiff("medium"); Loopline.start(2); });
  await page.waitForTimeout(300);
  // Play the made solution in the engine until a critter is parked.
  const parked = await ll(() => {
    const g = Loopline.game;
    for (const m of g.level.solution) { if (g.bays.some((b) => b >= 0)) break; g.launch(m); g.settle(); }
    g.events.length = 0;
    return g.bays.find((b) => b >= 0);
  });
  ok(parked != null, "a critter waits in a bay");
  await page.locator("#repeatBtn").click();
  ok(await ll(() => Loopline.repeat), "Repeat is on");
  await page.waitForFunction((m) => Loopline.game.where[m] !== 3, parked, { timeout: 3000 });
  await page.waitForFunction(() => !Loopline.repeat, null, { timeout: 90000 });
  ok(await ll(() => Loopline.game.status !== "lost"), "nothing lost by repeating");
  ok((await page.locator("#repeatBtn").getAttribute("aria-pressed")) === "false", "the button is off again");
});

await check("buddies: tied critters at the front of two lanes go together, and wait for each other", async () => {
  await ll(() => { Loopline.setMode("critters"); Loopline.setDiff("easy"); Loopline.start(10); });
  await page.waitForTimeout(400);
  const { pairs, lanes } = await ll(() => ({ pairs: Loopline.game.level.pairs, lanes: Loopline.game.lanes }));
  ok(pairs && pairs.length, "Easy level 10 has buddies");
  const ready = pairs.find(([a, b]) => lanes.some((l) => l[0] === a) && lanes.some((l) => l[0] === b));
  const waiting = pairs.find((p) => p !== ready);
  if (waiting) {
    const [a, b] = waiting, front = lanes.some((l) => l[0] === a) ? a : lanes.some((l) => l[0] === b) ? b : -1;
    if (front >= 0) {
      const [x, y] = await spot(front);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(100);
      ok(await ll((m) => Loopline.game.where[m] === 0, front), "a buddy doesn't go without the other");
      ok((await page.locator("#toast").innerText()).includes("Buddies"), "and the game says why");
    }
  }
  ok(ready, "a pair at the front of two lanes");
  const [x, y] = await spot(ready[1]);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(100);
  ok(await ll(([a, b]) => Loopline.game.where[a] !== 0 && Loopline.game.where[b] !== 0, ready), "tapping one sends both");
});

await check("a sure win (every critter left would find a free bay) finishes itself", async () => {
  await ll(() => { Loopline.setMode("critters"); Loopline.setDiff("easy"); Loopline.start(2); });
  await page.waitForTimeout(300);
  let sends = 0, said = false;
  const total = await ll(() => Loopline.game.level.solution.length);
  for (let k = 0; k < 20; k++) {
    await page.waitForFunction(() => Loopline.auto || Loopline.state !== "play" || (Loopline.game.idle && Loopline.game.events.length === 0), null, { timeout: 15000 });
    said = said || (await page.locator("#toast").innerText()).includes("Finishing");
    if (await ll(() => Loopline.auto || Loopline.state !== "play" || Loopline.game.status !== "play")) break;
    const m = (await ll(() => Loopline.solve()))[0];
    await ll((m) => Loopline.send(m), m);
    sends++;
    await page.waitForTimeout(250);
    said = said || (await page.locator("#toast").innerText()).includes("Finishing");
  }
  await page.waitForFunction(() => Loopline.auto || Loopline.state === "over", null, { timeout: 15000 });
  const from = Date.now();
  ok(await ll(() => Loopline.state === "over" || Loopline.game.remaining > 0), "the critters pop what's left as they ride, not all at once");
  await page.waitForSelector("#result:not([hidden])", { timeout: 20000 });
  ok(Date.now() - from > 4000, `it takes its time, so you see what happens (${Date.now() - from} ms)`);
  ok(said, "it said it would finish the level");
  ok(sends < total, `it finished with sends to spare (${sends} of ${total})`);
  ok((await page.locator("#resultStars svg.on").count()) === 3, "it counts as a clean clear");
});

await check("the model gallery: from the lobby, turn through every Orbit model, test-play one, back to the gallery", async () => {
  await page.locator("#resultAlt").click();
  await page.waitForTimeout(250);
  await page.locator(".lob-models").click();
  await page.waitForTimeout(500);
  ok((await ll(() => Loopline.state)) === "models", "in the gallery");
  ok(await page.locator("#gl").isVisible(), "a 3D view, whatever mode is chosen");
  const first = await page.locator("#mName").innerText();
  await page.locator("#mNext").click();
  await page.waitForTimeout(300);
  ok((await page.locator("#mName").innerText()) !== first, "the next model");
  ok((await page.locator("#mCount").innerText()).includes("32"), "32 models");
  const yaw = await ll(() => Loopline.yaw);
  await page.mouse.move(100, 300); await page.mouse.down(); await page.mouse.move(260, 300, { steps: 6 }); await page.mouse.up();
  ok(Math.abs((await ll(() => Loopline.yaw)) - yaw) > 0.5, "drag turns the model");
  await page.screenshot({ path: join(OUT, "loopline-gallery.png") });
  const id = await ll(() => Loopline.gallery.id);
  const coins = await ll(() => Loopline.coins);
  await page.locator("#mPlay").click();
  await page.waitForTimeout(500);
  ok(await ll(() => Loopline.state === "play" && Loopline.testing && Loopline.game.kind === "orbit"), "a test level");
  ok(await ll((id) => Loopline.game.level.picture === id, id), "of that model");
  ok((await page.locator("#levelName").innerText()).startsWith("Test"), "the HUD says it's a test");
  ok(await page.locator("#hintCost").isHidden(), "hints are free in a test");
  await page.locator("#hintBtn").click();
  await page.waitForTimeout(200);
  ok((await ll(() => Loopline.coins)) === coins, "nothing paid");
  await page.locator("#hud .gnav-back").click();
  await page.waitForTimeout(300);
  ok((await ll(() => Loopline.state)) === "models", "back leads to the gallery");
  await page.locator(".gnav-bar .gnav-back").click();
  await page.waitForTimeout(300);
  ok((await ll(() => Loopline.state)) === "menu", "and from there to the lobby");
});

if (problems.length) { failures++; console.log("✗ no errors on the page\n    " + [...new Set(problems)].join("\n    ")); }
else console.log("✓ no errors on the page");

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nLoopline end to end: all good.");
process.exit(failures ? 1 : 0);
