// Loopline's rules (games/loopline/src/engine.js for Critters, src/orbit.js for Orbit, src/depot.js for
// Depot) and levels (src/levels.js), checked in Node: what a critter sees and takes, parking, losing,
// undo, lanes; the depot's streams, loop, stop, bays and car park; the powers bought with coins; that
// Hard is harder; and that every level of every track can be solved and stays the same level.
import test from "node:test";
import assert from "node:assert/strict";
import { Game, makeTrack, takeAlong, lap, YARD, BAY, DONE } from "../../games/loopline/src/engine.js";
import { Depot, DRIVING, DOCKED } from "../../games/loopline/src/depot.js";
import { blockersOf } from "../../games/loopline/src/lot.js";
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
/** A Depot level: streams of people (colours), vehicles [[color, seats]], an optional car park. */
function depot(streams, buses, extra = {}) {
  return { mode: "depot", streams: streams.map((q) => q.slice()), movers: buses.map(([color, cap]) => ({ color, cap })), loop: 12, docks: 2, transit: 2, lot: null, ...extra };
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
test("depot: the streams take turns at their gates, and wait when the loop is full", () => {
  const g = new Depot(depot([[R, R, R], [B, B, B]], [[R, 3], [B, 3]], { loop: 4 }));
  assert.equal(g.idle, false, "people are waiting to step in");
  g.settle();
  assert.equal(g.filled, 4, "the loop is full");
  assert.deepEqual(g.fed, [2, 2], "two from each stream: they took turns");
  assert.equal(g.onRing[R], 2);
  assert.equal(g.onRing[B], 2);
  assert.equal(g.idle, true, "nothing can happen until a vehicle comes");
  assert.equal(g.status, "play", "a free bay: not lost");
});

test("depot: people get on a parked vehicle of their colour at the stop; that frees spots for the streams; a full one leaves", () => {
  // One stream: red, red, blue, blue, red, red. The loop holds four.
  const g = new Depot(depot([[R, R, B, B, R, R]], [[R, 4], [B, 2]], { loop: 4 }));
  g.settle();
  assert.deepEqual(g.fed, [4], "two reds still wait in the stream");
  assert.equal(play(g, 0), "ok");
  assert.equal(g.where[0], DONE, "the red vehicle filled up, with the two who stepped in after the first two got on");
  assert.deepEqual(g.fed, [6]);
  assert.deepEqual(g.docks, [-1, -1], "and it left, freeing its bay");
  assert.equal(g.onRing[B], 2, "blue walks on: no vehicle for it");
  play(g, 1);
  assert.equal(g.status, "won");
});

test("depot: a vehicle drives a few ticks to its bay before anyone gets on", () => {
  const g = new Depot(depot([[R, R]], [[R, 2]], { transit: 3 }));
  g.settle();
  g.launch(0);
  assert.equal(g.where[0], DRIVING);
  assert.equal(g.docks[0], 0, "its bay is taken at once");
  g.tick(); g.tick();
  assert.equal(g.where[0], DRIVING);
  g.tick();
  assert.equal(g.where[0], DOCKED);
  g.settle();
  assert.equal(g.status, "won");
});

test("depot: a vehicle with seats left waits in its bay; every bay taken and nobody to board loses; undo brings it back", () => {
  const h = new Depot(depot([[R, R, B, B]], [[R, 3], [B, 2], [R, 1]], { loop: 4, docks: 2 }));
  h.settle();
  play(h, 0);
  assert.equal(h.where[0], DOCKED, "two of three seats taken: it waits");
  assert.equal(h.left[0], 1);
  assert.equal(h.status, "play", "one bay is still free");
  assert.equal(h.launch(2), "ok", "another red one takes the second bay");
  h.settle();
  assert.equal(h.status, "lost", "both bays hold red vehicles, only blue walks the loop");
  assert.ok(h.undo());
  assert.equal(h.status, "play", "undo brings it back");
  play(h, 1);
  assert.equal(h.remaining, 0);
  assert.equal(h.status, "won", "the blue one clears the loop");
});

test("depot: no free bay means the vehicle stays put", () => {
  const g = new Depot(depot([[R, R, B, B]], [[R, 3], [B, 3], [Y, 1]], { docks: 2 }));
  g.settle();
  g.launch(0); g.launch(1);
  assert.equal(g.launch(2), "full");
  assert.equal(g.where[2], YARD);
});

test("depot: a vehicle leaves the car park only if nothing stands in the way of its arrow, at any heading", () => {
  // 0: a car facing right, with a car facing up just ahead of it (1). 2: a van facing down-right (45°),
  // with a car on that diagonal (3). 4: a car out of everyone's way.
  const cars = [
    { m: 0, kind: "car", x: 0, y: 0, h: 0 }, { m: 1, kind: "car", x: 1, y: 0, h: 6 },
    { m: 2, kind: "van", x: -1, y: 3, h: 1 }, { m: 3, kind: "car", x: 1.2, y: 5.2, h: 0 },
    { m: 4, kind: "car", x: 4, y: 3, h: 0 },
  ];
  assert.deepEqual(blockersOf(cars), [[1], [], [3], [], []]);
  const g = new Depot(depot([[R, R, B, B, Y, Y, R, R, B, B]], [[R, 2], [B, 2], [Y, 2], [R, 2], [B, 2]], { lot: { cars }, docks: 5 }));
  g.settle();
  assert.equal(g.launch(0), "blocked");
  assert.equal(g.launch(2), "blocked");
  assert.deepEqual(g.ready(), [1, 3, 4]);
  play(g, 1);
  assert.equal(g.free(0), true, "the car in the way has gone");
  play(g, 3);
  assert.equal(g.free(2), true);
});

test("depot: the crowd can walk round while you think; it changes nothing", () => {
  const L = makeLevel("depot", "medium", 3);
  const a = newGame(L, { history: false }), b = newGame(L, { history: false });
  a.settle(); b.settle();
  let k = 1;
  for (const m of L.solution) {
    for (let i = 0; i < (k * 7) % 23; i++) b.tick(); // b waits a while (the loop walks) before each send
    k++;
    assert.equal(a.launch(m), "ok");
    assert.equal(b.launch(m), "ok");
    a.settle(); b.settle();
    assert.equal(b.key(), a.key(), "the same people walk the loop, the same seats are left");
  }
  assert.equal(b.status, "won");
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

// ---- Buddies: two critters that leave the lanes together -------------------------------------------------
test("buddies: both must be at the front of their lanes; tapping either sends both, the lead first", () => {
  // Lanes: [0, 2] and [1]. Critters 1 (lead) and 2 are buddies; 2 waits behind 0.
  const L = level(["12", "12"], [[R, 2], [R, 0], [B, 2]], { lanes: [[0, 2], [1]], pairs: [[1, 2]], bays: 2 });
  const g = new Game(L);
  assert.deepEqual(g.ready(), [0], "the pair can't go while 2 is behind 0");
  assert.equal(g.launch(1), "buddy", "1 is at the front, but its buddy isn't");
  assert.equal(g.launch(2), "blocked", "2 isn't at the front itself");
  assert.equal(g.where[1], YARD);
  play(g, 0);
  assert.deepEqual(g.ready(), [1], "now the pair is ready, once, by its lead");
  assert.equal(g.launch(2), "ok", "tapping the follower sends both");
  assert.deepEqual(g.queue.concat(g.belt.map((b) => b.m)).sort(), [1, 2]);
  assert.equal(g.belt[0].m, 1, "the lead goes first");
  assert.equal(g.history.length, 2, "one send, one undo step");
  g.undo();
  assert.equal(g.where[1], YARD); assert.equal(g.where[2], YARD);
  assert.deepEqual(g.lanes, [[2], [1]], "undo puts both back");
  g.launch(1); g.settle();
  assert.equal(g.status, "won");
});

test("buddies: a pair needs two places on the loop; the Pick power takes both from anywhere", () => {
  const L = level(["1122"], [[R, 2], [B, 2], [R, 0], [B, 0], [R, 0]], { lanes: [[0, 2], [1, 3], [4]], pairs: [[2, 3]], bays: 3, belt: 3 });
  const g = new Game(L);
  assert.equal(g.launch(0), "ok"); assert.equal(g.launch(1), "ok");
  assert.equal(g.launch(2), "full", "one place left, the pair needs two");
  g.settle();
  const h = new Game(L);
  assert.equal(h.launch(3, { any: true }), "ok", "Pick: both buddies, though neither was at the front");
  assert.deepEqual(h.lanes, [[0], [1], [4]]);
});

test("buddies: levels link a few pairs, side by side in the lanes, and stay solvable", () => {
  let seen = 0;
  for (const [mode, diff, ns] of [["critters", "easy", [1, 3, 4, 10, 20]], ["critters", "medium", [1, 5, 9]], ["critters", "hard", [2, 6, 18]], ["orbit", "easy", [1, 3]], ["orbit", "hard", [2]]]) {
    for (const n of ns) {
      const L = makeLevel(mode, diff, n), pairs = L.pairs || [];
      assert.ok(pairs.length <= params(mode, diff, n).buddies, `${mode} ${diff} ${n}: not more pairs than asked`);
      if (mode === "critters" && diff === "easy" && n < 4) assert.equal(pairs.length, 0, "none on the first Easy levels");
      for (const [a, b] of pairs) {
        const la = L.lanes.findIndex((l) => l.includes(a)), lb = L.lanes.findIndex((l) => l.includes(b));
        assert.equal(Math.abs(la - lb), 1, `${mode} ${diff} ${n}: buddies in neighbouring lanes`);
        assert.equal(L.movers[a].color > 0 && L.movers[b].color > 0, true);
      }
      seen += pairs.length;
      assert.ok(replay(L), `${mode} ${diff} ${n}: the made solution, pairs sent as one, still wins`);
      // The solver and the stand-in players cope with pairs too.
      if (mode === "critters") assert.ok(solve(newGame(L), { known: false, budget: 60000 }), `${mode} ${diff} ${n}: the solver finds a way`);
    }
  }
  assert.ok(seen >= 15, `pairs show up (${seen})`);
  // Same picture, critters and lanes as without buddies: only the pairs are new.
  assert.deepEqual(makeLevel("critters", "easy", 4).lanes.flat().sort((a, b) => a - b), makeLevel("critters", "easy", 4).movers.map((_, i) => i));
});

test("a sure win plays out live: sendAll() before every tick is what playOut() does", () => {
  const L = makeLevel("critters", "medium", 5), g = newGame(L, { history: false });
  for (const m of L.solution) { if (g.sureWin()) break; g.launch(m); g.settle(); }
  assert.ok(g.sureWin());
  const sim = g.clone(), t0 = g.ticks;
  assert.ok(sim.playOut());
  for (let k = 0; k < 100000 && !(g.status === "won" && g.idle); k++) { g.sendAll(); g.tick(); g.events.length = 0; }
  assert.equal(g.status, "won");
  assert.equal(g.ticks, sim.ticks, "the same number of ticks as the copy said");
  assert.ok(sim.ticks - t0 > 0);
});

test("depot: once nobody waits in a stream (or every vehicle left fits in the bays), playing it out always wins", () => {
  let seen = 0, streamsEmpty = 0;
  for (const diff of DIFFS) {
    for (const n of [1, 2, 5, 8, 11]) {
      const L = makeLevel("depot", diff, n), g = newGame(L, { history: false });
      for (const m of L.solution) {
        for (let k = 0; k < 400 && g.status === "play"; k++) { // look at every tick, not only when it waits
          if (g.sureWin()) {
            seen++;
            if (!g.streamsLeft()) streamsEmpty++;
            const c = g.clone();
            assert.ok(c.playOut(), `depot ${diff} ${n}: playing out wins`);
            assert.equal(c.remaining, 0);
          }
          if (g.idle) break;
          g.tick();
        }
        g.launch(m);
      }
      g.settle();
      assert.equal(g.status, "won");
      assert.equal(g.sureWin(), false, "not once it's won");
    }
  }
  assert.ok(seen > 100 && streamsEmpty > 10, `${seen} sure positions, ${streamsEmpty} with the streams empty`);
  // A stream still waiting and more vehicles than bays: not sure.
  const L = makeLevel("depot", "hard", 1), g = newGame(L, { history: false });
  assert.ok(g.streamsLeft() && L.movers.length > g.docks.length && !g.sureWin());
});

test("depot: a sure win plays out live, sendAll() before every tick, as playOut() does", () => {
  const L = makeLevel("depot", "medium", 4), g = newGame(L, { history: false });
  for (const m of L.solution) { g.settle(); if (g.sureWin()) break; g.launch(m); }
  assert.ok(g.sureWin());
  const sim = g.clone(), t0 = g.ticks;
  assert.ok(sim.playOut());
  for (let k = 0; k < 100000 && g.status === "play"; k++) { g.sendAll(); g.tick(); g.events.length = 0; }
  assert.equal(g.status, "won");
  assert.equal(g.ticks, sim.ticks);
  assert.ok(sim.ticks - t0 > 0);
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
  const d = new Depot(depot([[R, R, B, B]], [[R, 3], [B, 3], [Y, 1]], { docks: 2 }));
  d.settle(); d.launch(0); d.launch(1);
  assert.equal(d.launch(2), "full");
  d.addBay();
  assert.equal(d.launch(2), "ok", "an extra bay at the stop");
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

test("powers: Tow takes any vehicle out of the car park", () => {
  // A car facing right with a car facing up just ahead of it.
  const cars = [{ m: 0, kind: "car", x: 0, y: 0, h: 0 }, { m: 1, kind: "car", x: 1, y: 0, h: 6 }];
  const g = new Depot(depot([[R, R, B, B]], [[R, 2], [B, 2]], { lot: { cars } }));
  g.settle();
  assert.equal(g.launch(0), "blocked");
  assert.equal(g.launch(0, { any: true, power: { item: "pick", cost: 40 } }), "ok", "towed out past the other car");
  assert.equal(g.events.find((e) => e.type === "launch").tow, true);
  assert.ok(g.undo());
  assert.deepEqual(g.undone, { item: "pick", cost: 40 }, "undo hands back what it cost");
  assert.equal(g.where[0], YARD);
});

test("powers: Magnet fills a vehicle straight from the loop, then from the streams", () => {
  // Six reds, the loop holds four: two still wait in the stream when the magnet vehicle parks.
  const m = new Depot(depot([[R, R, R, R, R, R]], [[R, 6]], { loop: 4, transit: 1 }));
  m.settle();
  assert.deepEqual(m.fed, [4]);
  m.launch(0, { magnet: true });
  m.tick();
  assert.equal(m.where[0], DONE, "full at once, and gone");
  assert.equal(m.remaining, 0);
  assert.equal(m.status, "won");
  // Out of the middle of a stream: the queue closes up behind them.
  const g = new Depot(depot([[B, R, B, R, B]], [[R, 2], [B, 3]], { loop: 2, transit: 1 }));
  g.settle();
  assert.deepEqual(g.fed, [2], "blue and red walk the loop");
  g.launch(0, { magnet: true });
  g.tick();
  assert.equal(g.where[0], DONE, "the red on the loop and the red in the stream");
  assert.equal(g.waiting(0), 2, "two blues still wait");
  assert.equal(play(g, 1), "ok");
  assert.equal(g.status, "won");
  assert.ok(g.undo() && g.undo());
  assert.equal(g.waiting(0), 3, "undo puts them back");
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

test("difficulty: Hard has fewer bays than Easy, and Depot a tighter loop, more streams and more vehicles", () => {
  assert.ok(params("critters", "hard", 1).bays < params("critters", "easy", 1).bays);
  assert.ok(params("depot", "hard", 1).docks < params("depot", "easy", 1).docks);
  assert.ok(params("depot", "hard", 1).loop < params("depot", "easy", 1).loop);
  assert.ok(params("depot", "hard", 2).streams > params("depot", "easy", 2).streams);
  assert.ok(params("depot", "hard", 1).vehicles > params("depot", "easy", 1).vehicles);
  assert.ok(params("orbit", "hard", 1).bays < params("orbit", "easy", 1).bays);
  assert.ok(params("orbit", "hard", 1).target > params("orbit", "easy", 1).target);
});

test("every level up to 30 of every track is solvable with its own solution, and the solver finds one", () => {
  for (const mode of MODES) for (const diff of DIFFS) for (let n = 1; n <= 30; n++) {
    const L = makeLevel(mode, diff, n);
    assert.ok(replay(L), `${mode} ${diff} ${n}: the made solution wins`);
    // Capacity per colour matches the picture (or Depot's crowd) exactly.
    const need = new Map(), have = new Map();
    for (const c of mode === "depot" ? L.streams.flat() : L.cells) if (c) need.set(c, (need.get(c) || 0) + 1);
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
    const s = JSON.stringify({ w: L.w, h: L.h, c: L.cells && [...L.cells], m: L.movers, l: L.lanes, p: L.lot, b: L.bays, d: L.docks, r: L.ring, s: L.streams, o: L.loop });
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  };
  const want = {
    "depot:easy": ["8a71d17a", "a6b0df3e", "6df439f9", "f93350df"],
    "depot:medium": ["54b2ee66", "50854c07", "fe77ec6b", "3546a33f"],
    "depot:hard": ["4981c49f", "63ee199e", "faf4345", "80470cd7"],
    "critters:easy": ["8d5ceb05", "74b8ea80", "d849cec1", "22607ff5"],
    "critters:medium": ["46a3cda8", "325166e7", "a06015bc", "8c55f97"],
    "critters:hard": ["18443bb2", "dd8479fd", "1e6e6c56", "bf68121e"],
    "orbit:easy": ["3b03779a", "2c47a3c7", "47f732f7", "30f4506b"],
    "orbit:medium": ["fb59ff2b", "d1ce73e0", "b20bafa1", "2435fded"],
    "orbit:hard": ["56ae8aad", "bda6458d", "a52e96a0", "b1bc4c33"],
  };
  const got = {};
  for (const mode of MODES) for (const diff of DIFFS) got[`${mode}:${diff}`] = [1, 2, 10, 25].map((n) => fp(makeLevel(mode, diff, n)));
  // Depot's levels changed when it became the crowd and the car park; game.js drops old Depot progress
  // (save.depot = 2) and keeps the rest. Orbit level 25 changed on purpose in Nov 2026 (new models).
  assert.deepEqual(got, want, "if you changed the generator on purpose, drop the changed track's saved progress (see loadSave in game.js) and update these");
});
