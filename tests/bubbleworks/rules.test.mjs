// Bubbleworks' rules, without a browser: the honeycomb, flight and sticking, popping and dropping, every
// power, the three modes, dealing, the levels (fixed, finishable, fingerprinted) and the economy.
//   npm run test:bubbleworks
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { CONFIG } from "../../games/bubbleworks/src/config.js";
import { Grid, trace, snap, resolve, group, floating, NORMAL, STONE, ICE } from "../../games/bubbleworks/src/grid.js";
import { Game } from "../../games/bubbleworks/src/engine.js";
import { makeLevel, solveLevel, makeDaily, levelGame, classicGame, endlessGame, fingerprint, tierOf } from "../../games/bubbleworks/src/levels.js";
import { SOLVED } from "../../games/bubbleworks/src/levels.gen.js";
import { autoplay } from "../../games/bubbleworks/src/bot.js";

const { R, D, RH, width: W } = CONFIG;
const B = (c, extra) => ({ c, k: NORMAL, ...extra });
/** A grid from rows of letters: digits are colours, "s" stone, "i" ice (colour 0), "." empty. */
function grid(rows, parity = 0) {
  const g = new Grid(parity);
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === ".") return;
    g.set(r, c, ch === "s" ? { c: -1, k: STONE } : ch === "i" ? { c: 0, k: ICE } : B(Number(ch)));
  }));
  return g;
}
/** A shot that ends right at cell (r, c) (it sticks there), having hit `hit`. */
const at = (g, r, c, hit = null) => ({ pts: [[g.x(r, c), 400], [g.x(r, c), g.y(r)]], x: g.x(r, c), y: g.y(r), hit, passed: [] });
/** Fire straight up from under (x) and return the trace. */
const up = (g, x, y = 380) => trace(g, x, y, 0);

test("the honeycomb: shifted rows hold one less, and every cell has up to six neighbours", () => {
  const g = new Grid(0);
  assert.equal(g.width(0), 11);
  assert.equal(g.width(1), 10);
  assert.equal(g.x(1, 0), R + R);
  assert.equal(g.neighbours(2, 5).length, 6);
  for (const [r, c] of g.neighbours(2, 5)) assert.ok(Math.abs(Math.hypot(g.x(r, c) - g.x(2, 5), g.y(r) - g.y(2)) - D) < 0.01, "neighbours are one bubble apart");
  assert.equal(g.neighbours(0, 0).length, 2, "a corner on the ceiling has two");
});

test("pushing a row in on top keeps every other bubble where it was in the honeycomb", () => {
  const g = grid(["01234567890", "0123456789"]);
  const before = g.all().map(([r, c, b]) => [g.x(r, c), b.c]);
  g.pushTop([B(5), B(5), B(5), B(5), B(5), B(5), B(5), B(5), B(5), B(5)]);
  assert.equal(g.width(0), 10, "the new row is shifted, because the old row 0 wasn't");
  const after = g.all().filter(([r]) => r > 0).map(([r, c, b]) => [g.x(r, c), b.c]);
  assert.deepEqual(after, before);
});

test("a shot flies straight up and sticks under the bubble it touches", () => {
  const g = grid(["00000000000"]);
  const x = g.x(0, 5);
  const tr = up(g, x);
  assert.deepEqual(tr.hit, [0, 5]);
  const cell = snap(g, tr.x, tr.y);
  assert.equal(cell[0], 1);
  assert.ok(g.neighbours(1, cell[1]).some(([a, b]) => a === 0 && b === 5));
});

test("a shot bounces off a side wall and the aim line is the same path", () => {
  const g = new Grid(0);
  const tr = trace(g, W / 2, 400, -1.2);
  assert.ok(tr.pts.length >= 3, "it bounced");
  assert.ok(tr.pts.every(([x]) => x >= R - 1e-9 && x <= W - R + 1e-9), "never outside the walls");
  assert.equal(tr.y, R, "with nothing in the way it reaches the ceiling");
  const game = new Game({ mode: "classic", grid: grid(["00000000000"]), colours: 1, seed: 1 });
  const aim = game.aim(-0.4), shot = game.fire(-0.4);
  assert.deepEqual(aim.pts, shot.tr.pts, "the aim line never lies");
});

test("a shot never slips past a bubble (stepping is fine enough at any angle)", () => {
  const g = grid(["...........", "....0......"]);
  let checked = 0;
  for (let i = 0; i <= 400; i++) {
    const a = -CONFIG.maxAngle + (2 * CONFIG.maxAngle * i) / 400;
    const tr = trace(g, W / 2, 400, a);
    // Walk the path finely: before the end, the centre never comes within `hit` of the bubble.
    const pts = tr.pts;
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const last = k === pts.length - 1;
      for (let s = 0; s <= 1; s += 0.01) {
        if (last && s > 0.98) break;
        const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s;
        assert.ok(Math.hypot(x - g.x(1, 4), y - g.y(1)) >= CONFIG.hit - CONFIG.step - 1e-6, `angle ${a} passes through the bubble`);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000);
});

test("three of a colour pop, two don't", () => {
  const g = grid(["11000000000"]);
  const out = resolve(g, up(g, g.x(1, 0) + 0.5), { c: 1 }); // sticks under the two 1s
  assert.equal(out.popped.length, 3);
  const g2 = grid(["10000000000"]);
  const out2 = resolve(g2, up(g2, g2.x(1, 0)), { c: 1 });
  assert.equal(out2.popped.length, 0);
  assert.equal(group(g2, 1, 0).length, 2);
});

test("everything that no longer hangs from the ceiling drops", () => {
  const g = grid(["22222222222", "11........", ".3", "4"]);
  assert.deepEqual(floating(g), []);
  // A third 1 pops the 1s: the 3 and the 4 that hung from them fall.
  const out = resolve(g, at(g, 1, 2, [1, 1]), { c: 1 });
  assert.equal(out.popped.length, 3);
  assert.deepEqual(out.dropped.map((q) => q.b.c).sort(), [3, 4]);
  assert.deepEqual(floating(g), []);
});

test("stones never pop but do drop; ice thaws next to a pop", () => {
  const g = grid(["11s00000000", "i.........."]);
  // A third 1 under the two: they pop, the ice next to them thaws, the stone stays (it hangs from the ceiling).
  const out = resolve(g, at(g, 1, 1, [0, 1]), { c: 1 });
  assert.equal(out.popped.length, 3);
  assert.ok(out.popped.every((q) => q.b.k !== STONE));
  assert.deepEqual(out.thawed, [[1, 0]]);
  assert.ok(out.dropped.some((q) => q.r === 1 && q.c === 0 && q.b.k === NORMAL), "it thawed, and with nothing left to hang from, it dropped");
  assert.equal(g.get(0, 2).k, STONE);
  // A stone that loses its hold drops.
  const s2 = grid(["11", ".s"]);
  const out2 = resolve(s2, at(s2, 1, 0, [0, 0]), { c: 1 });
  assert.ok(out2.dropped.some((q) => q.b.k === STONE));
});

test("powers: bomb, prism, laser, comet, black hole", () => {
  // Bomb: clears everything within two bubbles, stones too.
  let g = grid(["00000000000", "1111s11111", "22222222222"]);
  let out = resolve(g, at(g, 3, 5, [2, 5]), { p: "bomb" });
  assert.ok(out.popped.some((q) => q.b.k === STONE), "the bomb takes stones");
  assert.equal(out.popped.length, 7, "four in the row above, three in the row above that");
  // Prism: takes the colour that pops the most.
  g = grid(["33333333333", "0011......"]);
  out = resolve(g, at(g, 2, 1, [1, 0]), { p: "prism" });
  assert.equal(out.colour, 0);
  assert.equal(out.popped.length, 3, "the prism matched the two 0s");
  // Laser: the row of the bubble it hits.
  g = grid(["00000000000", "1212121212"]);
  out = resolve(g, at(g, 2, 4, [1, 4]), { p: "laser" });
  assert.equal(out.popped.length, 10);
  // Comet: through everything in its path, up to the ceiling.
  g = grid(["01234012340", "0123401234", "01234012340"]);
  const tr = trace(g, g.x(0, 5), 380, 0, true);
  assert.equal(tr.y, R, "the comet reaches the ceiling");
  out = resolve(g, tr, { p: "comet" });
  assert.ok(out.popped.length >= 3);
  // Black hole: every bubble of the colour it hits.
  g = grid(["01010101010", "2020202020"]);
  out = resolve(g, at(g, 2, 0, [1, 0]), { p: "blackhole" });
  assert.equal(out.colour, 2);
  assert.equal(out.popped.length, 5);
  assert.ok(g.all().every(([, , b]) => b.c !== 2), "that colour is gone");
});

test("colours: you're only dealt colours that are still on the board", () => {
  const g = grid(["22222222222", "3333333333"]);
  const game = new Game({ mode: "endless", grid: g, colours: 6, seed: 9 });
  for (let i = 0; i < 200; i++) assert.ok([2, 3].includes(game.deal()));
});

test("Classic: every 8 shots that pop nothing, the ceiling drops a row; reaching the line ends it", () => {
  const game = new Game({ mode: "classic", grid: grid(["01234501234", "5432105432"]), colours: 6, seed: 3, stage: 1 });
  for (let i = 0; i < 7; i++) game.classicRules(null, 0);
  assert.equal(game.ceil, 0);
  game.classicRules(null, 5);
  assert.equal(game.ceil, 0, "a shot that pops something doesn't count");
  game.classicRules(null, 0);
  assert.equal(game.ceil, 1, "the eighth miss brings the ceiling down");
  assert.equal(game.offset, RH);
  // Fill up to the line: the game ends.
  const deep = new Game({ mode: "classic", grid: grid(Array.from({ length: CONFIG.lineRow + 1 }, (_, r) => (r % 2 ? "0101010101" : "10101010101"))), colours: 2, seed: 1 });
  deep.checkLine();
  assert.equal(deep.status, "lost");
  assert.equal(deep.lost, "line");
});

test("Classic: clearing the screen goes on to the next stage, keeping the score and the tray", () => {
  const game = classicGame(5);
  game.tray.push("bomb");
  game.grid = grid(["00"]);
  game.score = 100;
  game.flight = { shot: { c: 0 }, tr: at(game.grid, 1, 0, [0, 0]) };
  game.land();
  assert.equal(game.status, "stage");
  game.advance();
  assert.equal(game.stage, 2);
  assert.ok(game.score > 100 + CONFIG.score.stageClear);
  assert.deepEqual(game.tray, ["bomb"]);
  assert.ok(game.grid.count() > 0);
});

test("Endless: a new row every few shots, held back by a big clear, faster over time", () => {
  const game = endlessGame(4);
  const first = game.pushIn;
  assert.equal(first, CONFIG.endless.pushFirst);
  game.endlessRules(null, 0);
  assert.equal(game.pushIn, first - 1);
  game.endlessRules(null, CONFIG.endless.bigClear);
  assert.equal(game.pushIn, first - 1, "a big clear doesn't count");
  const rows = game.grid.lowest();
  for (let i = 0; i < first - 1; i++) game.endlessRules(null, 0);
  assert.equal(game.pushed, 1);
  assert.equal(game.grid.lowest(), rows + 1);
  game.pushed = 200;
  assert.equal(game.pushEvery(), CONFIG.endless.pushMin);
});

test("Freeze stops the ceiling and the push for 5 shots", () => {
  const game = endlessGame(4);
  game.tray.push("freeze");
  game.arm(0);
  assert.equal(game.freeze, CONFIG.powers.freezeShots);
  const before = game.pushIn;
  for (let i = 0; i < CONFIG.powers.freezeShots; i++) game.endlessRules(null, 0);
  assert.equal(game.pushIn, before);
  assert.equal(game.freeze, 0);
});

test("powers are collected into a tray of three, and a power shot is free", () => {
  const g = grid(["00000000000"]);
  for (let c = 0; c < 3; c++) g.get(0, c).p = "bomb";
  g.get(0, 3).p = "laser";
  const game = new Game({ mode: "levels", grid: g, colours: 1, seed: 1, goal: { type: "top" }, shots: 10 });
  game.current = 0;
  game.fire(0); game.land(); // pops the whole row: four powers, three fit
  assert.equal(game.tray.length, 3);
  assert.ok(game.events.some((e) => e.type === "power" && !e.kept), "the fourth didn't fit");
  assert.equal(game.status, "won");
  const g2 = grid(["11111111111", "2222222222"]);
  const game2 = new Game({ mode: "levels", grid: g2, colours: 2, seed: 1, goal: { type: "top" }, shots: 10 });
  game2.tray.push("laser"); game2.arm(0); game2.fire(0); game2.land();
  assert.equal(game2.shotsLeft, 10, "a power shot doesn't use a shot");
});

test("Levels: the goal wins, running out of shots loses, +5 shots goes on", () => {
  const g = grid(["01010101010", "1010101010"]);
  g.get(0, 0).crit = true;
  const game = new Game({ mode: "levels", grid: g, colours: 2, seed: 2, goal: { type: "rescue" }, shots: 1 });
  assert.equal(game.goal.n, 1);
  game.current = 1;
  game.fire(0.3); game.land();
  if (game.status === "lost") {
    assert.equal(game.lost, "shots");
    game.addShots(5);
    assert.equal(game.status, "play");
    assert.equal(game.shotsLeft, 5);
  }
  const won = levelGame(makeLevel(1));
  autoplay(won);
  assert.equal(won.status, "won");
  assert.ok(won.stars() >= 1 && won.stars() <= 3);
});

test("level 1 to 60: the stored results match the generator, and the autoplayer finishes each in budget", () => {
  for (let n = 1; n <= 60; n++) {
    const l = makeLevel(n), fresh = solveLevel(n);
    assert.equal(l.salt, fresh.salt, `level ${n}: levels.gen.js is out of date (npm run bubbleworks:levels)`);
    assert.equal(l.botShots, fresh.botShots, `level ${n}: levels.gen.js is out of date (npm run bubbleworks:levels)`);
    assert.ok(l.botShots < l.shots, `level ${n} has room to spare`);
    const g = levelGame(l);
    autoplay(g, l.shots);
    assert.equal(g.status, "won", `level ${n} can be finished in ${l.shots} shots`);
  }
  assert.ok(SOLVED.length >= 300, "300 levels are stored");
});

test("level n is the same board for everyone (frozen fingerprints)", () => {
  const prints = [1, 2, 3, 6, 8, 11, 14, 25, 40, 80].map((n) => fingerprint(makeLevel(n)));
  assert.deepEqual(prints, FROZEN, "a level changed: if that's on purpose, update FROZEN (players' stars point at the old boards)");
});
const FROZEN = JSON.parse(readFileSync(new URL("./fingerprints.json", import.meta.url), "utf8"));

test("levels introduce things in order, with no stone in the top row", () => {
  for (let n = 1; n <= 60; n++) {
    const l = makeLevel(n);
    const kinds = new Set(l.grid.all().map(([, , b]) => b.k));
    if (n < 8) assert.ok(!kinds.has(STONE), `level ${n} has no stones yet`);
    if (n < 14) assert.ok(!kinds.has(ICE), `level ${n} has no ice yet`);
    if (n < 3) assert.ok(!l.grid.all().some(([, , b]) => b.p), `level ${n} has no powers yet`);
    assert.ok(!l.grid.all().some(([r, , b]) => r === 0 && b.k === STONE), `level ${n}: no stone on the ceiling`);
    assert.ok(!l.grid.all().some(([, , b]) => b.p === "freeze"), "no Freeze in Levels");
  }
  assert.equal(makeLevel(6).goal.type, "rescue");
  assert.equal(makeLevel(11).goal.type, "collect");
  assert.equal(tierOf(15), "easy"); assert.equal(tierOf(16), "medium"); assert.equal(tierOf(81), "expert");
});

test("a scrolled level never hides a gap a shot could fly into", () => {
  for (let n = 1; n <= 80; n++) {
    const g = levelGame(makeLevel(n));
    if (!g.scroll) continue;
    for (let i = 0; i <= 40; i++) {
      const tr = g.aim(-CONFIG.maxAngle + (2 * CONFIG.maxAngle * i) / 40);
      const cell = snap(g.grid, tr.x, tr.y);
      assert.ok(cell[0] >= g.scroll, `level ${n}: a shot can stick in row ${cell[0]}, above the view (scroll ${g.scroll})`);
    }
  }
});

test("the daily level is the same on the same date and different on another", () => {
  assert.equal(fingerprint(makeDaily("2026-11-27")), fingerprint(makeDaily("2026-11-27")));
  assert.notEqual(fingerprint(makeDaily("2026-11-27")), fingerprint(makeDaily("2026-11-28")));
});

test("the autoplayer survives Classic and Endless for a while (the modes can be played)", () => {
  const c = autoplay(classicGame(11), 200, 6);
  assert.ok(c.stage >= 4, `Classic reached stage ${c.stage}`);
  const e = autoplay(endlessGame(11), 150);
  assert.ok(e.pushed >= 20, `Endless lasted ${e.pushed} rows`);
});

test("stardust follows the arcade's rules (economy.js)", () => {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL("../../shared/js/economy.js", import.meta.url), "utf8"), ctx);
  vm.runInContext(readFileSync(new URL("../../games/bubbleworks/economy.js", import.meta.url), "utf8"), ctx);
  const E = ctx.Economy.games.bubbleworks;
  assert.equal(E.reward("easy"), 20);
  assert.equal(E.price("aim", "medium"), 18, "Aim+ is a peek: half a level");
  assert.equal(E.price("shots", "medium", 1), 140, "a second +5 in one level costs double");
  assert.equal(E.start, 70);
  const src = readFileSync(new URL("../../games/bubbleworks/game.js", import.meta.url), "utf8");
  assert.ok(!/purchase|in-app|checkout|price\s*=\s*\d/i.test(src), "nothing is for sale");
});
