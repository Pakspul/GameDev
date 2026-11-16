// Inkfield's rules (games/inkfield/src/sim.js), checked in Node: capturing, cutting, running into
// your own trail, losing all your land, and that a seed replays exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../../games/inkfield/src/sim.js";
import { runMatch } from "./sim.mjs";

const DT = 1 / 60;
/** A small world with players placed by hand (spawning is random, so it's undone first). */
function world(players, config = {}) {
  const w = new World({ seed: 1, players: players.length, config: { N: 80, ...config } });
  w.owner.fill(0); w.trail.fill(0);
  players.forEach(([x, y, angle], k) => {
    const p = w.players[k + 1];
    p.area = 0; p.maxArea = 0; p.bbox = { x0: w.N, y0: w.N, x1: -1, y1: -1 };
    w.spawn(p, x, y, angle);
  });
  w.events.length = 0;
  return w;
}
/** Drive player p along headings for given seconds: [[angle, seconds], ...]. */
function drive(w, p, legs) {
  for (const [a, s] of legs) {
    p.target = a;
    for (let t = 0; t < s && p.alive; t += DT) w.step(DT);
  }
}
const R = 0, D = Math.PI / 2, L = Math.PI, U = -Math.PI / 2;

test("a loop out and back claims the trail and everything inside it", () => {
  const w = world([[40, 40, R]]);
  const p = w.players[1];
  const start = p.area;
  drive(w, p, [[R, 1.2], [D, 1.0], [L, 1.4], [U, 1.2]]);
  assert.ok(p.alive);
  assert.equal(p.trailCells.length, 0, "back home, the trail is gone");
  assert.ok(p.area > start + 60, `area grew from ${start} to ${p.area}`);
  assert.ok(w.events.some((e) => e.type === "capture" && e.id === 1));
  // Everything in the middle of the loop is ours.
  assert.equal(w.owner[w.idx(46, 44)], 1);
});

test("crossing someone's trail puts them out and frees their land", () => {
  const w = world([[20, 40, R], [60, 20, D]]);
  const [a, b] = [w.players[1], w.players[2]];
  // b heads down out of its land, leaving a trail across a's path.
  drive(w, b, [[D, 2.6]]);
  assert.ok(b.trailCells.length > 10);
  b.target = D;
  // a drives right, through b's trail.
  a.target = R;
  for (let t = 0; t < 6 && b.alive; t += DT) { b.target = D; w.step(DT); }
  assert.equal(b.alive, false);
  assert.equal(b.how, "cut");
  assert.equal(b.killedBy, 1);
  assert.equal(a.kills, 1);
  assert.equal(b.area, 0);
  assert.ok(!w.owner.includes(2), "none of b's land is left");
  assert.ok(!w.trail.includes(2), "none of b's trail is left");
});

test("running into your own trail puts you out", () => {
  const w = world([[40, 40, R]]);
  const p = w.players[1];
  drive(w, p, [[R, 1.5], [D, 0.6], [L, 0.6], [U, 1.2]]);
  assert.equal(p.alive, false);
  assert.equal(p.how, "self");
});

test("a player whose last land is taken is out", () => {
  const w = world([[40, 40, R], [40, 40, R]]);
  const [a, b] = [w.players[1], w.players[2]];
  // b's land is a small disc; a's land surrounds it, then a closes a loop around all of it.
  b.x = 10.5; b.y = 10.5;
  a.x = 40.5; a.y = 40.5;
  w.owner.fill(0); a.area = b.area = 0;
  a.bbox = { x0: 80, y0: 80, x1: -1, y1: -1 };
  for (let y = 4; y < 18; y++) for (let x = 4; x < 18; x++) w.setOwner(w.idx(x, y), (x > 7 && x < 14 && y > 7 && y < 14) ? 2 : 1);
  b.cell = w.idx(10, 10); b.inHome = true;
  // a is somewhere else and closes a loop from its land: give a a trail that rings the area and capture.
  for (const i of [w.idx(4, 3), w.idx(5, 3)]) { w.trail[i] = 1; w.trailSeq[i] = ++a.seq; a.trailCells.push(i); }
  w.capture(a);
  assert.equal(b.alive, false);
  assert.equal(b.how, "land");
  assert.equal(a.kills, 1);
});

test("the edge of the board stops you, it doesn't put you out", () => {
  const w = world([[8, 40, L]]);
  const p = w.players[1];
  drive(w, p, [[L, 2]]);
  assert.ok(p.alive);
  assert.ok(p.x >= 0.5);
});

test("the same seed plays the same bot match", () => {
  const a = runMatch(42, "normal", { maxTime: 40 }), b = runMatch(42, "normal", { maxTime: 40 });
  assert.equal(a.time, b.time);
  assert.deepEqual(a.outs, b.outs);
  assert.deepEqual(Array.from(a.world.owner), Array.from(b.world.owner));
});
