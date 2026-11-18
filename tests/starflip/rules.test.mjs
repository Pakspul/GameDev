// Starflip's physics and rules, checked in Node: the ball stays on the table, the plunger and the
// flippers reach every shot, missions start, advance, fail and open the wormhole, bonus tables
// come back to the main table, ball save and game over, lanes and multiplier, the Mothership.
import test from "node:test";
import assert from "node:assert/strict";
import { Game, DT } from "../../games/starflip/src/rules.js";
import { World } from "../../games/starflip/src/physics.js";
import { buildTable, MINIS } from "../../games/starflip/src/tables.js";
import { MISSIONS, MOTHERSHIP_SHOTS } from "../../games/starflip/src/missions.js";
import { CONFIG } from "../../games/starflip/src/config.js";
import { autoplay } from "./autoplay.mjs";

const seeded = (s) => () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
const run = (g, secs) => { for (let t = 0; t < secs; t += 1 / 60) g.update(1 / 60); };
/** Let the current game's ball drain (and the end-of-ball pause pass). */
function drainAll(g) { for (const b of [...g.main.balls]) { g.main.removeBall(b); g.onDrain(b); } }

test("every plunge leaves the lane; soft ones drop into the top lanes, harder ones further left", () => {
  const firstLane = (power) => {
    const w = new World(buildTable("main"));
    const b = w.addBall(w.table.plunger.x, w.table.plunger.y);
    b.vy = -(CONFIG.plunger.min + (CONFIG.plunger.max - CONFIG.plunger.min) * power);
    let lane = null, left = false;
    for (let t = 0; t < 3; t += DT) {
      w.step(DT);
      if (b.y < 300) left = true;
      if (left) assert.ok(!(b.x > 500 && b.y > 320), "nothing comes back down the plunger lane");
      const e = w.events.find((e) => e.type === "sensor" && /lane/.test(e.id));
      w.events.length = 0;
      if (e && !lane) lane = e.id;
    }
    assert.ok(left, `a plunge at ${power} leaves the lane`);
    return lane;
  };
  const hits = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(firstLane);
  assert.ok(new Set(hits.filter(Boolean)).size >= 2, `plunges reach more than one top lane: ${hits}`);
});

test("the flippers can make every mission shot", () => {
  const reached = new Set();
  for (const side of ["L", "R"]) for (let k = 0; k <= 20; k++) {
    const w = new World(buildTable("main"));
    const f = w.flippers.find((q) => q.side === side);
    const b = w.addBall(side === "L" ? 80 : 440, 700);
    let flipped = false;
    for (let t = 0; t < 2.5 && w.balls.length; t += DT) {
      const along = ((b.x - f.x) * Math.cos(f.a) + (b.y - f.y) * Math.sin(f.a)) / f.len;
      if (!flipped && t > 0.05 && along >= k / 20 && Math.abs(b.y - f.y) < 60) { w.flip(side, true); flipped = true; }
      w.step(DT);
      for (const e of w.events) if (e.id) reached.add(e.id.replace(/\d$/, ""));
      w.events.length = 0;
    }
  }
  for (const id of ["orbitL", "orbitR", "pad", "wormhole", "drop", "sat", "bumper", "spinner"]) assert.ok(reached.has(id), `no flipper shot reaches ${id}: ${[...reached]}`);
});

test("balls never leave the table, on any table, over many games", () => {
  const rand = seeded(7);
  const inside = (g) => g.world.balls.every((b) => b.x > 0 && b.x < CONFIG.W && b.y > 0);
  for (let i = 0; i < 4; i++) {
    const g = new Game({ seed: 100 + i });
    for (let t = 0; t < 400 && g.phase !== "over"; t += 0.5) {
      autoplay(g, 0.5, { rand });
      assert.ok(inside(g), `game ${i}: a ball escaped at t=${g.t.toFixed(1)}: ${g.world.balls.map((b) => `${b.x | 0},${b.y | 0}`)}`);
    }
  }
  for (const id of MINIS) {
    const g = new Game({ seed: 3, practice: id });
    for (let t = 0; t < 35 && g.phase !== "over"; t += 0.5) { autoplay(g, 0.5, { rand }); assert.ok(inside(g), `${id}: a ball escaped`); }
    assert.equal(g.phase, "over", `${id}: the bonus round ends`);
  }
});

test("the same seed and the same play give the same game", () => {
  const play = () => { const g = new Game({ seed: 42 }); autoplay(g, 60, { rand: seeded(9) }); return [g.score, g.ballNo, g.t.toFixed(3)]; };
  assert.deepEqual(play(), play());
});

test("the launch pad starts the next mission, shots advance it, and finishing opens the wormhole", () => {
  const g = new Game({ seed: 1 });
  g.launch(0.5);
  assert.deepEqual([...g.litShots()], [["pad", "start"]], "before a mission only the launch pad is lit");
  g.onPad(g.main.balls[0]);
  assert.equal(g.active.def.id, "liftoff");
  assert.equal(g.target(), "bumpers");
  assert.equal(g.litShots().get("bumpers"), "mission");
  const before = g.score;
  for (let i = 0; i < 7; i++) g.shot("bumpers");
  assert.equal(g.active.count, 7);
  g.shot("leftOrbit");
  assert.equal(g.active.step, 0, "the wrong shot does nothing");
  g.shot("bumpers");
  assert.equal(g.active.step, 1);
  assert.equal(g.target(), "rightOrbit");
  g.shot("rightOrbit");
  assert.equal(g.active, null);
  assert.ok(g.done.has("liftoff"));
  assert.equal(g.wormhole, "asteroids");
  assert.ok(g.score - before >= CONFIG.score.mission, "a mission pays at least its reward");
  assert.ok(g.fx.some((f) => f.type === "missionDone" && f.mini === "asteroids"));
  assert.equal(g.nextMission().id, "storm", "the next one is offered");
});

test("a mission fails only when its clock runs out, and can be started again; it carries over to the next ball", () => {
  const g = new Game({ seed: 1 });
  g.launch(0.5);
  g.startMission();
  g.active.time = 0.01;
  run(g, 0.1);
  assert.equal(g.active, null);
  assert.ok(g.fx.some((f) => f.type === "missionFail" && f.why === "time"));
  assert.equal(g.nextMission().id, "liftoff", "the failed mission is offered again");
  g.startMission();
  g.shot("bumpers");
  g.ballSave = 0;
  drainAll(g);
  run(g, 3);
  assert.equal(g.ballNo, 2);
  assert.equal(g.active?.def.id, "liftoff", "still on the mission with the next ball");
  assert.equal(g.active.count, 1, "with its progress");
  const left = g.active.time;
  run(g, 2);
  assert.equal(g.active.time, left, "the clock waits while the ball sits in the plunger lane");
});

test("the comet moves between shots and only counts where it is", () => {
  const g = new Game({ seed: 5 });
  g.next = MISSIONS.findIndex((m) => m.id === "comet");
  g.startMission();
  const first = g.target();
  assert.ok(MISSIONS.find((m) => m.id === "comet").steps[0].pool.includes(first));
  g.launch(0.5);
  run(g, 0.3);
  g.active.cometT = 0.001;
  run(g, 0.05);
  assert.notEqual(g.target(), first, "the comet moved");
  for (let i = 0; i < 3; i++) g.shot(g.target());
  assert.ok(g.done.has("comet"));
});

test("the open wormhole warps to its bonus table, which hands the ball back when time is up", () => {
  const g = new Game({ seed: 2 });
  g.launch(0.5);
  g.wormhole = "ufo";
  const b = g.main.balls[0];
  g.main.hold(b, g.main.holes.find((h) => h.id === "wormhole"));
  g.onWormhole(b);
  run(g, 1);
  assert.equal(g.phase, "mini");
  assert.equal(g.world.table.id, "ufo");
  assert.equal(g.wormhole, null, "the wormhole closes behind you");
  const score = g.score;
  g.onEvent({ type: "hit", kind: "ufo", id: "ufo", x: 0, y: 0, speed: 300, ball: g.world.balls[0] });
  assert.equal(g.score - score, CONFIG.score.ufoHit);
  g.mini.time = 0.01;
  run(g, 0.1);
  assert.equal(g.phase, "play");
  assert.equal(g.world, g.main);
  assert.equal(g.main.balls.length, 1, "the ball comes back out of the wormhole");
  assert.equal(g.ballNo, 1, "a bonus round never costs a ball");
  assert.ok(g.fx.some((f) => f.type === "miniEnd" && f.mini === "ufo" && f.score >= CONFIG.score.ufoHit));
});

test("the wormhole without a bonus waiting just kicks the ball out", () => {
  const g = new Game({ seed: 2 });
  g.launch(0.5);
  const b = g.main.balls[0];
  g.main.hold(b, g.main.holes.find((h) => h.id === "wormhole"));
  g.onWormhole(b);
  run(g, 1.2);
  assert.equal(g.phase, "play");
  assert.equal(b.held, null);
});

test("each bonus table scores its own way", () => {
  const g = new Game({ seed: 4, practice: "asteroids" });
  const rock = g.world.circles.find((c) => c.kind === "rock" && c.active);
  const hp = rock.hp;
  for (let i = 0; i < hp; i++) g.onEvent({ type: "hit", kind: "rock", id: rock.id, x: 0, y: 0, speed: 200 });
  assert.equal(rock.active, false, "a rock breaks after its hits");
  assert.equal(g.mini.count, 1);
  run(g, 1);
  assert.equal(g.world.circles.filter((c) => c.kind === "rock" && c.active).length, 5, "another rock appears");

  const s = new Game({ seed: 4, practice: "gravity" });
  const lit = s.mini.lit;
  s.onEvent({ type: "hit", kind: "star", id: "star" + lit, x: 0, y: 0, speed: 200 });
  assert.equal(s.score, CONFIG.score.starLit);
  assert.notEqual(s.mini.lit, lit, "the next star lights");

  const u = new Game({ seed: 4, practice: "ufo" });
  for (let i = 0; i < 3; i++) u.onEvent({ type: "hit", kind: "ufo", id: "ufo", x: 0, y: 0, speed: 200 });
  assert.equal(u.score, 3 * CONFIG.score.ufoHit + CONFIG.score.ufoDown);
  assert.equal(u.world.get("ufo").active, false, "three hits bring the UFO down");
});

test("ball save gives the ball back once; three lost balls end the game", () => {
  const g = new Game({ seed: 3 });
  g.launch(0.5);
  assert.equal(g.ballSave, CONFIG.ballSave);
  drainAll(g);
  assert.ok(g.fx.some((f) => f.type === "saved"));
  assert.equal(g.ballNo, 1);
  assert.equal(g.main.balls.length, 1, "a new ball, launched by itself");
  run(g, 1);
  drainAll(g);
  assert.equal(g.phase, "between", "no second save in the same ball");
  for (let n = 2; n <= 3; n++) {
    run(g, 3);
    assert.equal(g.ballNo, n);
    g.launch(0.5);
    g.ballSave = 0;
    drainAll(g);
  }
  run(g, 3);
  assert.equal(g.phase, "over");
});

test("all three top lanes raise the multiplier; the lit lane right after a launch is a skill shot", () => {
  const g = new Game({ seed: 8 });
  const lane = g.skill.lane;
  g.launch(0.5);
  const s0 = g.score;
  g.laneRoll(lane);
  assert.ok(g.score - s0 >= CONFIG.score.skill);
  assert.equal(g.skill, null);
  for (let i = 0; i < 3; i++) if (!g.lanes[i]) g.laneRoll(i);
  assert.equal(g.mult, 2);
  assert.deepEqual(g.lanes, [false, false, false]);
  g.lanes = [true, false, false];
  g.flip("R", true);
  assert.deepEqual(g.lanes, [false, true, false], "a flip moves the lit lanes");
});

test("all six missions bring the Mothership: three balls and a jackpot on every lit shot", () => {
  const g = new Game({ seed: 6 });
  g.launch(0.5);
  for (const m of MISSIONS) g.done.add(m.id);
  g.onPad(g.main.balls[0]);
  assert.ok(g.mothership);
  for (const s of MOTHERSHIP_SHOTS) assert.equal(g.litShots().get(s), "jackpot");
  run(g, 4);
  assert.equal(g.main.balls.length, 3);
  g.mothership.lit = new Set(MOTHERSHIP_SHOTS); // the balls may have scored some already while running
  const s0 = g.score;
  for (const s of MOTHERSHIP_SHOTS) g.shot(s);
  assert.equal(g.score - s0, MOTHERSHIP_SHOTS.length * CONFIG.score.jackpot + CONFIG.score.superJackpot);
  assert.equal(g.mothership.lit.size, MOTHERSHIP_SHOTS.length, "the shots light again");
  g.ballSave = 0;
  for (const b of g.main.balls.slice(0, 2)) { g.main.removeBall(b); g.onDrain(b); }
  assert.equal(g.mothership, null, "multiball ends with one ball left");
  assert.equal(g.round, 2);
  assert.equal(g.done.size, 0, "the missions start over, worth more");
});
