// Loopline's rules (games/loopline/src/engine.js for Critters, src/orbit.js for Orbit, src/depot.js for
// Depot) and levels (src/levels.js), checked in Node: what a critter sees and takes, parking, losing,
// undo, lanes; the depot's doors, stop, docks and car park; the powers bought with coins; that Hard is
// harder; and that every level of every track can be solved and stays the same level.
import test from "node:test";
import assert from "node:assert/strict";
import { Game, makeTrack, takeAlong, lap, YARD, BAY, DONE } from "../../games/loopline/src/engine.js";
import { Depot, feedsOf, ringShape, DRIVING, DOCKED } from "../../games/loopline/src/depot.js";
import { makeLevel, replay, newGame, params, MODES, DIFFS, MODELS, modelView, makeTestLevel } from "../../games/loopline/src/levels.js";
import { solve } from "../../games/loopline/src/solver.js";
import { Orbit, look3, lap3 } from "../../games/loopline/src/orbit.js";
import { playThrough } from "../../games/loopline/src/judge.js";
import { Rng } from "../../games/loopline/src/rng.js";
import { SCULPTS, sculptFor, countOf } from "../../games/loopline/src/sculptures.js";

const R = 1, B = 2, Y = 3;
const cellsOf = (rows) => Uint8Array.from(rows.join("").split("").map(Number));
/** A Critters level from rows of digits (0 empty), movers [[color, cap]] and lanes. */
function level(rows, movers, extra = {}) {
  const h = rows.length, w = rows[0].length;
  return { mode: "critters", w, h, cells: cellsOf(rows), movers: movers.map(([color, cap]) => ({ color, cap })), bays: 2, belt: 4, spacing: 2, lanes: [movers.map((_, i) => i)], ...extra };
}
/** A Depot level: rows, buses [[color, cap]], an optional car park. */
function depot(rows, buses, extra = {}) {
  const h = rows.length, w = rows[0].length;
  return { mode: "depot", w, h, cells: cellsOf(rows), movers: buses.map(([color, cap]) => ({ color, cap })), ring: 12, docks: 2, transit: 2, lot: null, ...extra };
}
const play = (g, m) => { const r = g.launch(m); g.settle(); return r; };

// ---- Critters --------------------------------------------------------------------------------------------
test("critters: the loop has corners, then each side looking straight in, nearest cell first", () => {
  const T = makeTrack(3, 2);
  assert.equal(T.length, 4 + 2 * 3 + 2 * 2);
  assert.deepEqual(T[1].line, [3, 4, 5]); // left side, bottom row first, looking right
  assert.deepEqual(T[2].line, [0, 1, 2]);
  assert.equal(T[3].line, null);           // top-left corner
  assert.deepEqual(T[4].line, [0, 3]);     // top side, first column, looking down
  assert.deepEqual(T[8].line, [2, 1, 0]);  // right side, top row, looking left
  assert.deepEqual(T[13].line, [3, 0]);    // bottom side, last step: first column looking up
});

test("critters: a critter takes the first cell it sees, only if it has its colour", () => {
  const cells = Uint8Array.from([0, R, R, B]);
  assert.equal(takeAlong(cells, [0, 1, 2, 3], R), 1, "looks past the empty cell");
  assert.deepEqual([...cells], [0, 0, R, B], "one cell per look");
  assert.equal(takeAlong(cells, [3, 2, 1, 0], R), -1, "blue in front: nothing");
});

test("critters: one lap takes what shows; cells behind others show up for later", () => {
  const g = new Game(level(["121"], [[R, 9], [B, 1]]));
  play(g, 0);
  assert.deepEqual([...g.cells], [0, B, 0]);
  assert.equal(g.left[0], 7);
  assert.equal(g.where[0], BAY, "room left: it parks");
  play(g, 1);
  assert.equal(g.status, "won");
});

test("critters: one that is full is done; one with room and no free bay loses the level", () => {
  const g = new Game(level(["11", "22"], [[B, 5], [B, 5], [R, 2], [R, 2]], { bays: 1 }));
  play(g, 0);
  assert.equal(g.left[0], 3);
  assert.equal(g.where[0], BAY);
  play(g, 1);
  assert.equal(g.status, "lost");
  assert.equal(g.lostBy, 1);
});

test("critters: undo goes back to just before the last send", () => {
  const g = new Game(level(["121"], [[R, 9], [B, 1]]));
  play(g, 0);
  const after = g.snapshot();
  play(g, 1);
  assert.equal(g.status, "won");
  assert.ok(g.undo());
  assert.deepEqual([...g.cells], [...after.cells]);
  assert.equal(g.status, "play");
  assert.equal(g.where[1], YARD);
  assert.ok(g.undo());
  assert.equal(g.remaining, 3);
  assert.ok(!g.undo(), "nothing more to undo");
});

test("critters: only the front of a lane can go", () => {
  const g = new Game(level(["1"], [[B, 1], [R, 1]], { lanes: [[0, 1]], bays: 2 }));
  assert.equal(g.launch(1), "blocked");
  assert.equal(play(g, 0), "ok");
  assert.equal(g.where[0], BAY);
  assert.equal(play(g, 1), "ok");
  assert.equal(g.status, "won");
});

test("critters: the loop holds a few at once, spaced out, the front one acting first", () => {
  const g = new Game(level(["1111"], [[R, 1], [R, 1], [R, 1], [R, 1], [R, 1]], { lanes: [[0], [1], [2], [3], [4]], belt: 4, bays: 3 }));
  for (const m of [0, 1, 2, 3]) assert.equal(g.launch(m), "ok");
  assert.equal(g.launch(4), "full");
  assert.equal(g.belt.length, 1);
  g.tick(); g.tick();
  assert.equal(g.belt.length, 2, "the next one gets on once the first is two steps ahead");
  g.settle();
  assert.equal(g.status, "won");
  assert.ok(g.where.slice(0, 4).every((w) => w === DONE));
});

test("critters: stuck when nothing that can go takes a cell and no lane critter can be parked", () => {
  const g = new Game(level(["222", "212", "222"], [[R, 1], [Y, 1]], { lanes: [[0], [1]], bays: 1 }));
  assert.equal(g.stuck(), false, "a lane critter can still be parked in the free bay");
  play(g, 0);
  assert.equal(g.where[0], BAY, "red sees only blue: takes nothing, parks");
  assert.equal(g.stuck(), true);
  const g2 = new Game(level(["222", "212", "222"], [[R, 1], [B, 8]], { lanes: [[0, 1]], bays: 1 }));
  play(g2, 0);
  assert.equal(g2.stuck(), false);
  play(g2, 1);
  play(g2, 0);
  assert.equal(g2.status, "won");
});

test("critters: one lap of a lone critter is what the engine does with it", () => {
  const L = makeLevel("critters", "medium", 7);
  const g = new Game(L);
  const m = L.lanes[0][0];
  const want = lap(g.cells.slice(), g.track, L.movers[m].color, L.movers[m].cap);
  play(g, m);
  assert.equal(L.movers[m].cap - g.left[m], want);
});

// ---- Depot -----------------------------------------------------------------------------------------------
test("depot: the left half leaves by the left door, the right half by the right, outside columns first, top down", () => {
  // 1 2 | 3 0
  // 2 1 | 0 3
  const [l, r] = feedsOf(4, 2, cellsOf(["1230", "2103"]));
  assert.deepEqual(l, [0, 4, 1, 5]);
  assert.deepEqual(r, [7, 2], "empty cells don't queue");
  assert.deepEqual(feedsOf(3, 1, cellsOf(["123"])), [[0, 1], [2]], "an odd middle column goes left");
  const s = ringShape(4, 2);
  assert.ok(s.stop > 0.5 && s.stop < 0.75, "the stop is on the bottom side");
  assert.ok(s.doors[0] > 0.75 && s.doors[1] < 0.5, "doors on the left and right sides");
});

test("depot: the loop fills from both doors and stops when nothing can happen", () => {
  const g = new Depot(depot(["1122"], [[R, 2], [B, 2]]));
  assert.equal(g.idle, false, "pixels are waiting to get on");
  g.settle();
  assert.equal(g.filled, 4, "all four pixels ride the loop");
  assert.equal(g.cells.every((c) => c === 0), true, "the picture is empty");
  assert.equal(g.remaining, 4, "but nobody is on a bus yet");
  assert.equal(g.idle, true);
  assert.equal(g.status, "play", "a free dock: not lost");
});

test("depot: pixels get on a docked bus of their colour at the stop; a full bus leaves and frees its dock", () => {
  const g = new Depot(depot(["1122"], [[R, 2], [B, 2]]));
  g.settle();
  assert.equal(play(g, 0), "ok");
  assert.equal(g.where[0], 4, "red bus full and gone");
  assert.deepEqual(g.docks, [-1, -1]);
  assert.equal(g.remaining, 2);
  assert.equal(g.onRing[R], 0);
  assert.equal(g.onRing[B], 2, "blue rides on: no bus for it");
  play(g, 1);
  assert.equal(g.status, "won");
});

test("depot: a bus drives a few ticks to its dock before anyone gets on", () => {
  const g = new Depot(depot(["11"], [[R, 2]], { transit: 3 }));
  g.settle();
  g.launch(0);
  assert.equal(g.where[0], DRIVING);
  assert.equal(g.docks[0], 0, "its dock is taken at once");
  g.tick(); g.tick();
  assert.equal(g.where[0], DRIVING);
  g.tick();
  assert.equal(g.where[0], DOCKED);
  g.settle();
  assert.equal(g.status, "won");
});

test("depot: a bus with seats left waits at its dock; every dock taken and nothing to board loses", () => {
  // Two red and two blue pixels. A red bus with three seats takes both reds and waits with one left.
  const h = new Depot(depot(["1122"], [[R, 3], [B, 2], [R, 1]], { docks: 2 }));
  h.settle();
  play(h, 0);
  assert.equal(h.where[0], DOCKED, "two of three seats taken: it waits");
  assert.equal(h.left[0], 1);
  assert.equal(h.status, "play", "one dock is still free");
  assert.equal(h.launch(2), "ok", "another red bus takes the second dock");
  h.settle();
  assert.equal(h.status, "lost", "both docks hold red buses, only blue rides the loop");
  assert.ok(h.undo());
  assert.equal(h.status, "play", "undo brings it back");
  play(h, 1);
  assert.equal(h.remaining, 0);
  assert.equal(h.status, "won", "the blue bus clears the loop");
});

test("depot: no free dock means the bus stays put", () => {
  const g = new Depot(depot(["1122"], [[R, 3], [B, 3], [Y, 1]], { docks: 2 }));
  g.settle();
  g.launch(0); g.launch(1);
  assert.equal(g.launch(2), "full");
  assert.equal(g.where[2], 0);
});

test("depot: a bus leaves the car park only when nothing stands in front of its nose", () => {
  // Bus 0 at (0,0) facing right, bus 1 at (1,0) facing down: bus 0 is stuck behind bus 1.
  const lot = { w: 2, h: 2, cars: [{ m: 0, x: 0, y: 0, len: 1, dir: "right" }, { m: 1, x: 1, y: 0, len: 1, dir: "down" }] };
  const g = new Depot(depot(["1122"], [[R, 2], [B, 2]], { lot }));
  g.settle();
  assert.equal(g.launch(0), "blocked");
  assert.deepEqual(g.ready(), [1]);
  play(g, 1);
  assert.equal(play(g, 0), "ok");
  assert.equal(g.status, "won");
});

// ---- Orbit (Critters in 3D) -----------------------------------------------------------------------------
/** An Orbit level from layers (bottom first), each rows of digits (back row first). */
function orbit(layers, movers, extra = {}) {
  const h = layers.length, d = layers[0].length, w = layers[0][0].length;
  return { mode: "orbit", w, h, d, cells: cellsOf(layers.flat()), movers: movers.map(([color, cap]) => ({ color, cap })), bays: 2, belt: 4, spacing: 2, lanes: [movers.map((_, i) => i)], ...extra };
}

test("orbit: one step looks in on every layer, bottom first, and pops the first block it sees if it has its colour", () => {
  // 2 wide, 1 deep, 3 high; looking along a row from the left.
  const cells = cellsOf(["11", "21", "01"]);
  const got = [];
  assert.equal(look3(cells, [0, 1], 3, 2, R, 9, got), 2, "layer 0 and layer 2 (past the gap); blue hides layer 1");
  assert.deepEqual(got, [0, 5]);
  assert.deepEqual([...cells], [0, R, B, R, 0, 0]);
  assert.equal(look3(cellsOf(["11", "11"]), [0, 1], 2, 2, R, 1), 1, "no more than it has room for");
});

test("orbit: a lap peels the outside; what was inside shows for later", () => {
  // One layer, 3 × 3, a blue block in the middle under red.
  const g = new Orbit(orbit([["111", "121", "111"]], [[R, 8], [B, 1]]));
  assert.equal(g.L, 4 + 2 * 3 + 2 * 3);
  assert.equal(lap3(g.cells.slice(), g.track, 1, 9, B, 9), 0, "blue can't be seen yet");
  play(g, 0);
  assert.equal(g.left[0], 0, "red took all eight it could see");
  assert.equal(g.where[0], 4, "done");
  assert.equal(g.lapFrom(B, 1), 1, "now blue shows");
  play(g, 1);
  assert.equal(g.status, "won");
});

test("orbit: no free bay loses, and undo brings it back", () => {
  const g = new Orbit(orbit([["12"], ["12"]], [[R, 4], [R, 4], [B, 2]], { bays: 1 }));
  play(g, 0);
  assert.equal(g.where[0], BAY, "red took two of four: it parks");
  play(g, 1);
  assert.equal(g.status, "lost");
  assert.ok(g.undo());
  assert.equal(g.status, "play");
  assert.ok(g.clone() instanceof Orbit, "the solver's copies follow Orbit's rules");
});

test("orbit: every sculpture has ten thousand blocks or more on Easy, more on Medium and Hard", () => {
  for (const def of SCULPTS) assert.ok(countOf(sculptFor(def, 10000)) >= 10000, def.id);
  for (const [diff, min] of [["easy", 10000], ["medium", 12000], ["hard", 14000]]) {
    for (let n = 1; n <= 30; n++) {
      const L = makeLevel("orbit", diff, n), blocks = countOf(L);
      assert.ok(blocks >= min, `orbit ${diff} ${n}: ${blocks} blocks`);
    }
  }
});

test("orbit: the second batch of models comes after the first on every track, and each has a test level", () => {
  for (const id of ["burger", "turtle", "strawberry", "cupcake", "ladybug", "frog", "castle", "balloon", "gift", "bee"]) {
    assert.ok(MODELS.includes(id), id);
    const v = modelView(id, "easy");
    assert.ok(v.view && countOf(v) >= 10000 && v.movers.length === 0, `${id}: a view without critters`);
    const L = makeTestLevel(id, "easy");
    assert.ok(L.test && L.picture === id && replay(L), `${id}: a solvable test level`);
  }
  assert.equal(makeLevel("orbit", "easy", 23).picture, "strawberry", "right after the 22 first models");
  assert.equal(makeLevel("orbit", "medium", 18).picture, "burger");
  assert.equal(makeLevel("orbit", "hard", 16).picture, "castle");
  assert.equal(makeTestLevel("frog", "hard").bays, params("orbit", "hard", 1).bays, "a test is like level 1 of its difficulty");
});

// ---- A sure win finishes itself ---------------------------------------------------------------------------
test("sure win: when every critter left would find a free bay, playing it out always wins", () => {
  let seen = 0;
  for (const [mode, diff, ns] of [["critters", "easy", [1, 3, 6]], ["critters", "hard", [1, 4, 7]], ["orbit", "easy", [1]], ["orbit", "hard", [4]]]) {
    for (const n of ns) {
      const L = makeLevel(mode, diff, n), g = newGame(L, { history: false });
      for (const m of L.solution) {
        if (g.sureWin()) { seen++; const c = g.clone(); assert.ok(c.playOut(), `${mode} ${diff} ${n}: playing out wins`); assert.equal(c.remaining, 0); }
        g.launch(m); g.settle();
      }
      assert.equal(g.sureWin(), false, "not once it's won");
    }
  }
  assert.ok(seen > 10);
  // Three critters left and three free bays: sure. Three critters and two bays: not (yet).
  const g = new Game(level(["123"], [[R, 1], [Y, 1], [B, 1]], { bays: 3, lanes: [[0, 1, 2]] }));
  assert.ok(g.sureWin());
  const h = new Game(level(["123"], [[R, 1], [Y, 1], [B, 1]], { bays: 2, lanes: [[0, 1, 2]] }));
  assert.ok(!h.sureWin());
});

// ---- Powers (bought with coins in the game) --------------------------------------------------------------
test("powers: an extra bay stays for the rest of the level, undo included", () => {
  const g = new Game(level(["11", "22"], [[B, 5], [B, 5], [R, 2], [R, 2]], { bays: 1 }));
  play(g, 0);
  g.addBay();
  assert.equal(g.bays.length, 2);
  play(g, 1);
  assert.equal(g.status, "play", "the second blue critter parks in the extra bay instead of losing");
  g.undo();
  assert.equal(g.bays.length, 2, "undo doesn't take the bay away");
  const d = new Depot(depot(["1122"], [[R, 3], [B, 3], [Y, 1]], { docks: 2 }));
  d.settle(); d.launch(0); d.launch(1);
  assert.equal(d.launch(2), "full");
  d.addBay();
  assert.equal(d.launch(2), "ok", "an extra dock");
});

test("powers: Pick sends any critter from a lane, and undo hands back what it cost", () => {
  const g = new Game(level(["1"], [[B, 1], [R, 1]], { lanes: [[0, 1]], bays: 2 }));
  assert.equal(g.launch(1), "blocked");
  assert.equal(g.launch(1, { any: true, power: { item: "pick", cost: 40 } }), "ok");
  g.settle();
  assert.equal(g.status, "won");
  assert.ok(g.undo());
  assert.deepEqual(g.undone, { item: "pick", cost: 40 });
  assert.deepEqual(g.lanes, [[0, 1]], "back in its place in the lane");
  play(g, 0);
  assert.ok(g.undo());
  assert.equal(g.undone, null, "a plain send used no power");
});

test("powers: Laser pops its colour through other colours, for one lap", () => {
  // Red behind blue on every side: a red critter sees nothing, a zapping one sees through.
  const rows = ["222", "212", "222"];
  const g = new Game(level(rows, [[R, 1], [B, 8]], { lanes: [[0], [1]], bays: 2 }));
  g.launch(0, { zap: true });
  g.settle();
  assert.equal(g.where[0], DONE, "the red block in the middle is popped");
  assert.equal(g.zap[0], 0, "only for that lap");
  const o = new Orbit(orbit([["212"], ["212"]], [[R, 2], [B, 4]], { lanes: [[0], [1]] }));
  o.launch(0, { zap: true });
  o.settle();
  assert.equal(o.left[0], 0, "Orbit: on every layer");
});

test("powers: Tow takes any bus out of the car park; Magnet fills a bus straight from the loop and the picture", () => {
  const lot = { w: 2, h: 2, cars: [{ m: 0, x: 0, y: 0, len: 1, dir: "right" }, { m: 1, x: 1, y: 0, len: 1, dir: "down" }] };
  const g = new Depot(depot(["1122"], [[R, 2], [B, 2]], { lot }));
  g.settle();
  assert.equal(g.launch(0), "blocked");
  assert.equal(g.launch(0, { any: true }), "ok", "towed out past the blue bus");
  // Six red pixels in a tall picture: most still wait inside when a magnet bus docks.
  const m = new Depot(depot(["1", "1", "1", "1", "1", "1"], [[R, 6]], { ring: 12, transit: 1 }));
  m.launch(0, { magnet: true });
  m.tick();
  assert.equal(m.where[0], 4, "full at once, and gone");
  assert.equal(m.remaining, 0);
  m.settle();
  assert.equal(m.status, "won");
});

// ---- Levels ----------------------------------------------------------------------------------------------
test("difficulty: the stand-in players (judge.js) win Hard levels much less often than Medium ones", () => {
  for (const mode of ["depot", "critters"]) {
    const rate = (diff) => {
      let won = 0, n = 0;
      for (let lv = 1; lv <= 12; lv++) for (let i = 0; i < 4; i++, n++) won += playThrough(newGame(makeLevel(mode, diff, lv), { history: false }), new Rng(lv * 31 + i), i ? 0.25 : 0);
      return won / n;
    };
    const med = rate("medium"), hard = rate("hard");
    assert.ok(hard < 0.65 && hard < med - 0.2, `${mode}: Medium ${(med * 100).toFixed(0)}%, Hard ${(hard * 100).toFixed(0)}%`);
  }
});

test("difficulty: Hard has fewer bays and docks than Easy", () => {
  assert.ok(params("critters", "hard", 1).bays < params("critters", "easy", 1).bays);
  assert.ok(params("depot", "hard", 1).docks < params("depot", "easy", 1).docks);
  assert.ok(params("depot", "hard", 1).density < params("depot", "easy", 1).density);
  assert.ok(params("orbit", "hard", 1).bays < params("orbit", "easy", 1).bays);
  assert.ok(params("orbit", "hard", 1).target > params("orbit", "easy", 1).target);
});

test("every level up to 30 of every track is solvable with its own solution, and the solver finds one", () => {
  for (const mode of MODES) for (const diff of DIFFS) for (let n = 1; n <= 30; n++) {
    const L = makeLevel(mode, diff, n);
    assert.ok(replay(L), `${mode} ${diff} ${n}: the made solution wins`);
    // Capacity per colour matches the picture exactly.
    const need = new Map(), have = new Map();
    for (const c of L.cells) if (c) need.set(c, (need.get(c) || 0) + 1);
    for (const m of L.movers) have.set(m.color, (have.get(m.color) || 0) + m.cap);
    assert.deepEqual([...have].sort(), [...need].sort(), `${mode} ${diff} ${n}: capacities add up to the picture`);
    // The solver on its own, without the shortcut of the made solution.
    if (n <= 10) {
      const s = solve(newGame(L), { budget: 30000, known: false });
      assert.ok(s && replay(L, s), `${mode} ${diff} ${n}: the solver finds a way`);
    }
  }
});

test("hints: from a position off the made solution, the solver finds a way quickly", () => {
  for (const [mode, diff, N] of [["critters", "hard", 12], ["depot", "hard", 12], ["orbit", "hard", 4]]) {
    let found = 0, tried = 0;
    for (let n = 1; n <= N; n++) {
      const L = makeLevel(mode, diff, n), g = newGame(L, { history: false }), rng = new Rng(n);
      g.settle();
      // Two sends the made solution doesn't start with, if they don't lose.
      for (let k = 0; k < 2 && g.status === "play"; k++) {
        const r = g.ready().filter((m) => m !== L.solution[k]);
        if (!r.length) break;
        const s = g.snapshot();
        g.launch(r[rng.int(r.length)]); g.settle();
        if (g.status !== "play") { g.restore(s); break; }
      }
      // Random sends can make a Hard level unwinnable: only count positions a long search can win from.
      if (mode !== "orbit" && !solve(g, { budget: 300000 })) continue;
      const t = performance.now(), sol = solve(g, { budget: mode === "orbit" ? 8000 : 30000, ms: 2500 });
      tried++;
      if (sol) { found++; assert.equal((() => { const h = g.clone(); for (const m of sol) { h.launch(m); h.settle(); } return h.status; })(), "won", `${mode} ${diff} ${n}: the hint's way wins`); }
      assert.ok(performance.now() - t < 3000, `${mode} ${diff} ${n}: a hint within the time limit`);
    }
    assert.ok(found >= tried - 1, `${mode} ${diff}: hints found ${found}/${tried}`);
  }
});

test("levels stay the same levels (saved stars point at them)", () => {
  const fp = (L) => {
    let h = 0x811c9dc5;
    const s = JSON.stringify({ w: L.w, h: L.h, c: [...L.cells], m: L.movers, l: L.lanes, p: L.lot, b: L.bays, d: L.docks, r: L.ring });
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  };
  const want = {
    "depot:easy": ["aabe4b75", "66019d1c", "53e93992", "76119aa5"],
    "depot:medium": ["12371afd", "7da66449", "64535801", "8a6b4df4"],
    "depot:hard": ["521ccff4", "e032dc7", "86c81c70", "1f4636ab"],
    "critters:easy": ["8d5ceb05", "74b8ea80", "d849cec1", "22607ff5"],
    "critters:medium": ["46a3cda8", "325166e7", "a06015bc", "8c55f97"],
    "critters:hard": ["18443bb2", "dd8479fd", "1e6e6c56", "bf68121e"],
    "orbit:easy": ["3b03779a", "2c47a3c7", "47f732f7", "30f4506b"],
    "orbit:medium": ["fb59ff2b", "d1ce73e0", "b20bafa1", "2435fded"],
    "orbit:hard": ["56ae8aad", "bda6458d", "a52e96a0", "b1bc4c33"],
  };
  const got = {};
  for (const mode of MODES) for (const diff of DIFFS) got[`${mode}:${diff}`] = [1, 2, 10, 25].map((n) => fp(makeLevel(mode, diff, n)));
  assert.deepEqual(got, want, "if you changed the generator on purpose, bump the save key (loopline.v3) and update these (Orbit level 25 changed on purpose in Nov 2026: new models)");
});
