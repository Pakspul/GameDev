// Loopline's rules (games/loopline/src/engine.js for Critters, src/depot.js for Depot) and levels
// (src/levels.js), checked in Node: what a critter sees and takes, parking, losing, undo, lanes; the
// depot's doors, stop, docks and car park; and that every level of every track can be solved and
// stays the same level.
import test from "node:test";
import assert from "node:assert/strict";
import { Game, makeTrack, takeAlong, lap, YARD, BAY, DONE } from "../../games/loopline/src/engine.js";
import { Depot, feedsOf, ringShape, DRIVING, DOCKED } from "../../games/loopline/src/depot.js";
import { makeLevel, replay, newGame, params, MODES, DIFFS } from "../../games/loopline/src/levels.js";
import { solve } from "../../games/loopline/src/solver.js";

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

// ---- Levels ----------------------------------------------------------------------------------------------
test("difficulty: Hard has fewer bays and docks than Easy", () => {
  assert.ok(params("critters", "hard", 1).bays < params("critters", "easy", 1).bays);
  assert.ok(params("depot", "hard", 1).docks < params("depot", "easy", 1).docks);
  assert.ok(params("depot", "hard", 1).density < params("depot", "easy", 1).density);
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
    if (n <= 15) {
      const s = solve(newGame(L), { budget: 30000 });
      assert.ok(s && replay(L, s), `${mode} ${diff} ${n}: the solver finds a way`);
    }
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
    "depot:hard": ["eef930b5", "cd62d557", "37a0173d", "abf3c7b2"],
    "critters:easy": ["8d5ceb05", "74b8ea80", "d849cec1", "22607ff5"],
    "critters:medium": ["46a3cda8", "325166e7", "a06015bc", "8c55f97"],
    "critters:hard": ["42078370", "4cab8bb9", "dff4520c", "e1b4dea1"],
  };
  const got = {};
  for (const mode of MODES) for (const diff of DIFFS) got[`${mode}:${diff}`] = [1, 2, 10, 25].map((n) => fp(makeLevel(mode, diff, n)));
  assert.deepEqual(got, want, "if you changed the generator on purpose, bump the save key (loopline.v2) and update these");
});
