// Loopline's rules (games/loopline/src/engine.js) and levels (src/levels.js), checked in Node:
// what a mover sees and takes, parking, losing, undo, the car park and the lanes, and that every
// level can be solved and stays the same level.
import test from "node:test";
import assert from "node:assert/strict";
import { Game, makeTrack, takeAlong, lap, YARD, BAY, DONE } from "../../games/loopline/src/engine.js";
import { makeLevel, replay, MODES } from "../../games/loopline/src/levels.js";
import { solve } from "../../games/loopline/src/solver.js";

const R = 1, B = 2, Y = 3;
/** A level from rows of digits (0 empty), movers [[color, cap]], lanes or a lot. */
function level(rows, movers, extra = {}) {
  const h = rows.length, w = rows[0].length;
  const cells = Uint8Array.from(rows.join("").split("").map(Number));
  return { w, h, cells, movers: movers.map(([color, cap]) => ({ color, cap })), bays: 2, belt: 4, spacing: 2, lanes: [movers.map((_, i) => i)], ...extra };
}
const play = (g, m) => { const r = g.launch(m); g.settle(); return r; };

test("the loop: corners, then each side looking straight in, nearest cell first", () => {
  const T = makeTrack(3, 2);
  assert.equal(T.length, 4 + 2 * 3 + 2 * 2);
  assert.deepEqual(T[1].line, [3, 4, 5]); // left side, bottom row first, looking right
  assert.deepEqual(T[2].line, [0, 1, 2]);
  assert.equal(T[3].line, null);           // top-left corner
  assert.deepEqual(T[4].line, [0, 3]);     // top side, first column, looking down
  assert.deepEqual(T[8].line, [2, 1, 0]);  // right side, top row, looking left
  assert.deepEqual(T[13].line, [3, 0]);    // bottom side, last step: first column looking up
});

test("a mover takes the first cell it sees, only if it has its colour", () => {
  const cells = Uint8Array.from([0, R, R, B]);
  assert.equal(takeAlong(cells, [0, 1, 2, 3], R), 1, "looks past the empty cell");
  assert.deepEqual([...cells], [0, 0, R, B], "one cell per look");
  assert.equal(takeAlong(cells, [3, 2, 1, 0], R), -1, "blue in front: nothing");
});

test("one lap: a mover takes what shows, cells behind others show up for later", () => {
  // R B R   A red mover sees the left red from the left and top; the right red from the right and top.
  const g = new Game(level(["121"], [[R, 9], [B, 1]]));
  play(g, 0);
  assert.deepEqual([...g.cells], [0, B, 0]);
  assert.equal(g.left[0], 7);
  assert.equal(g.where[0], BAY, "room left: it parks");
  play(g, 1);
  assert.equal(g.status, "won");
});

test("a mover that is full is done; one with room and no free bay loses the level", () => {
  const g = new Game(level(["11", "22"], [[B, 5], [B, 5], [R, 2], [R, 2]], { bays: 1 }));
  play(g, 0); // blue sees the bottom row from the bottom and the sides: takes 2, parks
  assert.equal(g.left[0], 3);
  assert.equal(g.where[0], BAY);
  play(g, 1); // nothing blue left: parks with room... but the one bay is taken
  assert.equal(g.status, "lost");
  assert.equal(g.lostBy, 1);
});

test("undo goes back to just before the last send", () => {
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

test("lanes: only the front of a lane can go", () => {
  const g = new Game(level(["1"], [[B, 1], [R, 1]], { lanes: [[0, 1]], bays: 2 }));
  assert.equal(g.launch(1), "blocked");
  assert.equal(play(g, 0), "ok");
  assert.equal(g.where[0], BAY);
  assert.equal(play(g, 1), "ok");
  assert.equal(g.status, "won");
});

test("the car park: a car leaves only when nothing stands in front of its nose", () => {
  // Car 0 at (0,0) facing right, car 1 at (1,0) facing down: car 0 is stuck behind car 1.
  const lot = { w: 2, h: 2, cars: [{ m: 0, x: 0, y: 0, len: 1, dir: "right" }, { m: 1, x: 1, y: 0, len: 1, dir: "down" }] };
  const g = new Game(level(["21"], [[R, 1], [B, 1]], { lanes: undefined, lot }));
  assert.equal(g.launch(0), "blocked");
  assert.deepEqual(g.ready(), [1]);
  play(g, 1);
  assert.equal(g.launch(0), "ok");
  g.settle();
  assert.equal(g.status, "won");
});

test("the loop holds a few movers at once, spaced out, the front one acting first", () => {
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

test("stuck: nothing that can go takes a cell, and no yard mover can be parked", () => {
  // Red walled in by blue, and no blue mover at all: hopeless once the bay is used.
  const g = new Game(level(["222", "212", "222"], [[R, 1], [Y, 1]], { lanes: [[0], [1]], bays: 1 }));
  assert.equal(g.stuck(), false, "a yard mover can still be parked in the free bay");
  play(g, 0);
  assert.equal(g.where[0], BAY, "red sees only blue: takes nothing, parks");
  assert.equal(g.stuck(), true);
  // With a blue mover waiting, it's not stuck.
  const g2 = new Game(level(["222", "212", "222"], [[R, 1], [B, 8]], { lanes: [[0, 1]], bays: 1 }));
  play(g2, 0);
  assert.equal(g2.stuck(), false);
  play(g2, 1);
  play(g2, 0);
  assert.equal(g2.status, "won");
});

test("every level up to 60 in both modes is solvable with its own solution, and the solver finds one", () => {
  for (const mode of MODES) for (let n = 1; n <= 60; n++) {
    const L = makeLevel(mode, n);
    assert.ok(replay(L), `${mode} ${n}: the made solution wins`);
    // Capacity per colour matches the picture exactly.
    const need = new Map(), have = new Map();
    for (const c of L.cells) if (c) need.set(c, (need.get(c) || 0) + 1);
    for (const m of L.movers) have.set(m.color, (have.get(m.color) || 0) + m.cap);
    assert.deepEqual([...have].sort(), [...need].sort(), `${mode} ${n}: capacities add up to the picture`);
    if (n <= 30) {
      const s = solve(new Game(L), { budget: 30000 });
      assert.ok(s && replay(L, s), `${mode} ${n}: the solver finds a way`);
    }
  }
});

test("levels stay the same levels (saved stars point at them)", () => {
  const fp = (L) => {
    let h = 0x811c9dc5;
    const s = JSON.stringify({ w: L.w, h: L.h, c: [...L.cells], m: L.movers, l: L.lanes, p: L.lot, b: L.bays });
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  };
  const want = {
    depot: ["7bca0ba6", "ba8e27ee", "d55a436d", "d73ff884", "6a28fee1", "e7f8c28d"],
    critters: ["998bf0a7", "df4b171a", "3284782f", "a2591576", "e96e4bd1", "71daa03f"],
  };
  for (const mode of MODES) assert.deepEqual([1, 2, 3, 10, 25, 40].map((n) => fp(makeLevel(mode, n))), want[mode], `${mode}: if you changed the generator on purpose, bump the save key and update these`);
});

test("one lap of a lone mover is what the engine does with it", () => {
  const L = makeLevel("critters", 7);
  const g = new Game(L);
  const m = L.lanes[0][0];
  const cells = g.cells.slice();
  const want = lap(cells, g.track, L.movers[m].color, L.movers[m].cap);
  play(g, m);
  assert.equal(L.movers[m].cap - g.left[m], want);
});
