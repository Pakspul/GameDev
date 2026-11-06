// Wallbreaker: the acceptance criteria from docs/WALLBREAKER.md that can be checked without a
// browser. Each test names the criterion it covers. Run: node --test tests/wallbreaker/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { CONFIG } from "../../games/wallbreaker/src/config.js";
import { Engine, DT } from "../../games/wallbreaker/src/engine.js";
import { generate, generateDescent, level1, validate, dailyLevel, dropFor, allowedTypes, BREAKABLE, CLASSIC_SEED, DESCENT_SEED } from "../../games/wallbreaker/src/levels.js";
import { MODES, MODE_ORDER, buildMods, puzzleStars, checkpointFor } from "../../games/wallbreaker/src/modes.js";
import { basePay, levelPay, riskyMultiplier, workshopPrice, dailyPay, medalPay, cosmetics, starPay } from "../../games/wallbreaker/src/economy.js";
import { seedToCode, codeToSeed, hash32 } from "../../games/wallbreaker/src/rng.js";
import { perkOffer, runLevel } from "../../games/wallbreaker/src/run.js";
import { PUZZLES, puzzleLevel, TIME_ATTACK, timeAttackLevel } from "../../games/wallbreaker/src/walls.js";
import { SOLUTIONS } from "../../games/wallbreaker/src/puzzles.gen.js";
import { playPuzzle, SLACK } from "../../games/wallbreaker/src/puzzle-play.js";
import { SAVE_KEY, freshSave, migrate, exportSave, importSave } from "../../games/wallbreaker/src/save.js";
import { makeEngine, autoplay } from "./autopilot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GAME = join(ROOT, "games/wallbreaker");
const WD = CONFIG.world, P = CONFIG.physics;
const DEG = Math.PI / 180;

/** A level JSON from a few bricks in grid cells. */
function wall(bricks, extra = {}) {
  return { kind: "wall", number: extra.number || 5, seed: 1234, salt: 0, cellH: WD.cellH, groups: extra.groups || [], bricks: bricks.map((b, id) => ({ id, hp: 1, w: 1, h: 1, ...b })) };
}
function engine(level, mode = "classic", o = {}) {
  const events = [];
  const e = new Engine({ level, rules: MODES[mode], mods: o.mods || {}, lives: o.lives, events: (t, d) => events.push([t, d]), puzzle: o.puzzle });
  e.events = events;
  return e;
}
/** Put a single free ball at (x, y) moving at angle a (radians from straight up) with speed s. */
function ball(e, x, y, a, s = e.ballSpeed()) {
  e.state = "play";
  e.balls = [{ x, y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, r: e.ballRadius(), stuck: false, stall: 0, portalCd: 0, age: 0, trail: [] }];
  return e.balls[0];
}
const run = (e, seconds) => { for (let i = 0; i < seconds * P.hz && !e.over; i++) e.step(DT); };
const fingerprint = (o) => hash32(JSON.stringify(o)).toString(16);

// ---- Core --------------------------------------------------------------------------------------------------
test("Core: ball bounce angle depends on the contact point on the paddle", () => {
  const angles = [];
  for (const off of [-30, -15, 0, 15, 30]) {
    const e = engine(wall([{ t: "normal", c: 0, r: 0 }]));
    e.setPaddle(180);
    const b = ball(e, 180 + off, e.paddle.y - 40, 0);
    b.vx = 0; b.vy = 300;
    run(e, 0.2);
    angles.push(Math.atan2(e.balls[0].vx, -e.balls[0].vy) / DEG);
  }
  assert.ok(Math.abs(angles[2]) < 0.5, "centre goes straight up");
  assert.ok(angles[0] < angles[1] && angles[1] < angles[2] && angles[2] < angles[3] && angles[3] < angles[4], "further out = wider angle");
  assert.ok(angles[4] > 45 && angles[4] <= P.maxBounceDeg + 0.01, `edge goes about 60° (got ${angles[4].toFixed(1)})`);
  assert.ok(Math.abs(angles[0] + angles[4]) < 0.5, "symmetric");
});

test("Core: a ball that clips the paddle edge counts as a hit", () => {
  const e = engine(wall([{ t: "normal", c: 0, r: 0 }]));
  e.setPaddle(180);
  const half = e.paddle.w / 2;
  const b = ball(e, 180 + half + P.ballRadius + 1, e.paddle.y - 30, 0);
  b.vx = 0; b.vy = 300;
  run(e, 0.3);
  assert.ok(e.balls.length && e.balls[0].vy < 0, "bounced up");
  assert.equal(e.ballsLost, 0);
});

test("Core: a ball at maximum speed never passes through a brick or a wall", () => {
  // Far faster than the game ever goes (cap × Speed Surge = 756), on a thin brick, from 400 angles.
  const fast = 3000;
  let missed = 0;
  for (let k = 0; k < 400; k++) {
    const a = (-60 + (120 * k) / 399) * DEG;
    const target = { t: "tough", c: 5, r: 8, hp: 99 };
    const e = engine(wall([target, { t: "normal", c: 0, r: 0 }]));
    const bx = WD.left + 5.5 * WD.cellW, by = WD.gridTop + 8.5 * WD.cellH;
    // Start below the brick, aimed so the straight path crosses the brick's centre.
    const d = 120;
    const b = ball(e, bx - Math.sin(a) * d, by + Math.cos(a) * d, a, fast);
    e.ballSpeed = () => fast;
    let hit = false;
    for (let i = 0; i < 60 && !hit; i++) {
      e.step(DT);
      hit = e.events.some(([t, d]) => t === "hit" && d.brick.c === 5);
      const q = e.balls[0];
      if (!q) break;
      assert.ok(q.x >= WD.left + q.r - 0.05 && q.x <= WD.right - q.r + 0.05 && q.y >= WD.top + q.r - 0.05, "inside the walls");
      const inside = q.x > e.bricks[0].x && q.x < e.bricks[0].x + e.bricks[0].w && q.y > e.bricks[0].y && q.y < e.bricks[0].y + e.bricks[0].h;
      assert.ok(!inside, "the ball's centre is never inside the brick");
    }
    if (!hit) missed++;
    void b;
  }
  assert.equal(missed, 0, `${missed} shots went through the brick`);
});

test("Core: a ball moving near-horizontally for more than 2 s is nudged toward vertical", () => {
  const e = engine(wall([{ t: "steel", c: 0, r: 0 }, { t: "normal", c: 11, r: 0 }]));
  const b = ball(e, 180, 400, 87 * DEG);
  run(e, 1.9);
  assert.ok(!e.events.some(([t]) => t === "nudge"), "not before 2 s");
  run(e, 0.3);
  assert.ok(e.events.some(([t]) => t === "nudge"), "nudged after 2 s");
  const q = e.balls[0];
  const fromHorizontal = Math.asin(Math.abs(q.vy) / Math.hypot(q.vx, q.vy)) / DEG;
  assert.ok(fromHorizontal >= P.nudgeDeg - 0.5, `now ${fromHorizontal.toFixed(1)}° from horizontal`);
  void b;
});

test("Core: speed rises per level and stops at the cap", () => {
  const sp = (n) => new Engine({ level: { ...wall([{ t: "normal", c: 0, r: 0 }]), number: n }, rules: MODES.classic }).levelSpeed();
  assert.equal(sp(1), P.baseSpeed);
  assert.ok(sp(10) > sp(2));
  assert.equal(sp(200), P.speedCap);
  assert.equal(sp(1000), P.speedCap);
});

// ---- Levels --------------------------------------------------------------------------------------------------
test("Levels: level 1 is the same fixed wall in every level-based mode", () => {
  const l = level1();
  assert.deepEqual(generate(CLASSIC_SEED, 1), l);
  assert.deepEqual(runLevel(codeToSeed("K7MPQ2"), 1), l);
  assert.deepEqual(runLevel(12345, 1), l);
  assert.equal(l.bricks.filter((b) => b.t === "normal").length, 46);
  assert.equal(l.bricks.filter((b) => b.t === "gift").length, 1);
  assert.equal(new Set(l.bricks.filter((b) => b.t === "normal").map((b) => b.r)).size, 4, "four rows");
  assert.equal(fingerprint(l), "736fe079", "level 1 changed: it must stay the same for everyone");
});

test("Levels: level N in Classic is identical for all players, run after run (frozen fingerprints)", () => {
  const a = [], b = [];
  for (let n = 2; n <= 60; n++) { a.push(generate(CLASSIC_SEED, n)); b.push(generate(CLASSIC_SEED, n)); }
  assert.deepEqual(a, b);
  // If this fails, generated levels changed: every player's "level 47" is now a different wall.
  // Only update the fingerprint on purpose (and say so in HISTORY.md).
  assert.equal(fingerprint(a), "16dd770c");
  assert.equal(fingerprint(generateDescent(DESCENT_SEED, 7)), "104653a7");
});

test("Levels: a run code reproduces the same levels and the same power-up offers", () => {
  for (const seed of [0, 1, 99999, 0x3fffffff, 123456789 & 0x3fffffff]) {
    const code = seedToCode(seed);
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(codeToSeed(code), seed);
    assert.equal(codeToSeed(code.toLowerCase().replace(/(...)/, "$1-")), seed, "case and dashes don't matter");
    for (const n of [2, 7, 10, 23]) assert.deepEqual(runLevel(codeToSeed(code), n), runLevel(seed, n));
    assert.deepEqual(perkOffer(seed, 3, {}), perkOffer(codeToSeed(code), 3, {}));
  }
  assert.equal(codeToSeed("ABC"), null);
  assert.equal(codeToSeed("ABCDE0"), null, "0 is not in the alphabet");
  assert.notDeepEqual(runLevel(5, 2), runLevel(6, 2), "different runs, different walls");
});

test("Levels: every generated level has all breakable bricks reachable and at most 15% steel", () => {
  const worlds = [CLASSIC_SEED, ...Array.from({ length: 20 }, (_, i) => hash32("run", i) & 0x3fffffff)];
  let checked = 0;
  for (const w of worlds) {
    const top = w === CLASSIC_SEED ? 300 : 40;
    for (let n = 1; n <= top; n++) {
      const v = validate(generate(w, n));
      assert.ok(v.ok, `world ${w} level ${n}: ${v.reasons.join(", ")}`);
      assert.ok(v.steelShare <= 0.15);
      checked++;
    }
  }
  for (let n = 1; n <= 60; n++) assert.ok(validate(generateDescent(DESCENT_SEED, n)).ok, `Descent ${n}`);
  assert.ok(checked > 1000);
});

test("Levels: elements appear at the levels in the introduction table, and a boss every 10th level", () => {
  const firstSeen = {};
  for (let n = 1; n <= 120; n++) {
    const l = generate(CLASSIC_SEED, n);
    const allowed = allowedTypes(n);
    for (const b of l.bricks) {
      assert.ok(allowed.has(b.t), `level ${n} has ${b.t} before its introduction`);
      if (!(b.t in firstSeen)) firstSeen[b.t] = n;
    }
    assert.equal(l.kind === "boss", n % 10 === 0, `level ${n} boss?`);
    if (n % 10 === 0) assert.equal(l.bricks.filter((b) => b.t === "core").length, 1, "a boss has one core");
  }
  // Each element shows up soon after its introduction (not just "allowed").
  const I = CONFIG.intro;
  for (const [t, at] of [["tough", I.tough], ["moving", I.moving], ["steel", I.steel], ["explosive", I.explosive], ["portal", I.portal], ["regen", I.regen], ["ghost", I.ghost]]) {
    assert.ok(firstSeen[t] >= at && firstSeen[t] <= at + 8, `${t} first at ${firstSeen[t]}, introduced at ${at}`);
  }
  // Capsules: none from normal bricks before level 4, no risky ones before level 10.
  const ctx = (n, risky) => ({ level: n, goodMul: 1, risky, table: "good" });
  for (let n = 1; n < I.goodDrops; n++) for (const b of generate(CLASSIC_SEED, n).bricks) if (b.t !== "gift") assert.equal(dropFor(generate(CLASSIC_SEED, n), b, ctx(n, true)), null);
  for (let n = 4; n < I.risky; n++) { const l = generate(CLASSIC_SEED, n); for (const b of l.bricks) { const d = dropFor(l, b, ctx(n, true)); assert.ok(!d || !d.risky); } }
  let risky = 0, total = 0;
  for (let n = 10; n < 60; n++) { const l = generate(CLASSIC_SEED, n); for (const b of l.bricks) { const d = dropFor(l, b, ctx(n, true)); if (d) { total++; if (d.risky) risky++; } } }
  assert.ok(risky / total > 0.1 && risky / total < 0.25, `about 1 in 6 drops is risky (got ${risky}/${total})`);
  assert.deepEqual(dropFor(level1(), level1().bricks.find((b) => b.t === "gift"), ctx(1, false)), { id: CONFIG.drops.level1Gift, risky: false }, "level 1's gift brick teaches catching");
});

test("Levels: the generator's walls can actually be cleared (an autopilot clears levels 1–30)", () => {
  for (let n = 1; n <= 30; n++) {
    const e = makeEngine({ level: generate(CLASSIC_SEED, n), rules: MODES.classic, lives: 99 });
    autoplay(e, { limit: 900 });
    assert.ok(e.result && e.result.cleared, `level ${n} not cleared (${e.breakableLeft} left)`);
  }
});

// ---- Modes ---------------------------------------------------------------------------------------------------
test("Modes: seven modes, each with its rules", () => {
  assert.deepEqual(MODE_ORDER, ["classic", "zen", "descent", "run", "daily", "puzzle", "timeattack"]);
  assert.equal(MODES.classic.lives, 3);
  assert.equal(MODES.run.lives, 3);
  assert.equal(MODES.daily.lives, 3);
  assert.equal(MODES.zen.lives, Infinity);
  assert.deepEqual([checkpointFor(1), checkpointFor(4), checkpointFor(5), checkpointFor(9), checkpointFor(10), checkpointFor(47)], [1, 1, 5, 5, 10, 45]);
  const risky = MODE_ORDER.filter((m) => MODES[m].risky);
  assert.deepEqual(risky, ["classic", "run"], "risky capsules only in Classic and Run");
  const boosts = MODE_ORDER.filter((m) => MODES[m].boosts);
  assert.deepEqual(boosts, ["classic", "descent"]);
  const ws = MODE_ORDER.filter((m) => MODES[m].workshop);
  assert.deepEqual(ws, ["classic", "descent", "run"]);
});

test("Modes: Zen has no fail state and pays 25% of Classic", () => {
  const e = engine(wall([{ t: "normal", c: 0, r: 0 }, { t: "normal", c: 11, r: 0 }]), "zen");
  for (let i = 0; i < 6; i++) {
    e.tap();
    e.balls[0].vx = 0; e.balls[0].vy = 600; e.balls[0].y = e.paddle.y + 20;
    run(e, 1);
    assert.notEqual(e.state, "failed");
  }
  assert.equal(e.state, "serve", "the ball comes back to the paddle");
  assert.ok(e.ballsLost >= 6);
  const classic = levelPay({ mode: "classic", level: 12, brickCredits: 20, stars: 3 }).total;
  const zen = levelPay({ mode: "zen", level: 12, brickCredits: 20, stars: 3 }).total;
  assert.equal(zen, Math.round(classic * 0.25));
});

test("Modes: Daily, Puzzle and Time Attack reject boosts, Workshop effects and risky capsules", () => {
  const maxed = { longLasting: 5, luckyCharm: 5, steadyHands: 5, scavenger: 5, secondWind: 1 };
  const all = Object.keys(CONFIG.boosts.items);
  const neutral = buildMods("daily", {});
  for (const m of ["daily", "puzzle", "timeattack", "zen"]) {
    const b = buildMods(m, { workshop: maxed, boosts: all, perks: { wide: 3, net: 1 } });
    assert.deepEqual(b.mods, buildMods(m, {}).mods, `${m}: modifiers ignored`);
    assert.equal(b.creditMul, 1);
    assert.deepEqual(b.equipped, []);
    assert.equal(b.lives, MODES[m].lives);
    assert.equal(MODES[m].risky, false);
  }
  assert.deepEqual(neutral.mods, { durationMul: 1, goodMul: 1, paddleMul: 1, speedMul: 1, startBalls: 1 });
  // And they do apply where they should.
  const c = buildMods("classic", { workshop: maxed, boosts: ["life", "lucky", "netStart", "wideStart"] });
  assert.equal(c.lives, 5, "Second Wind 4 + Extra Life");
  assert.equal(c.equipped.length, 3, "at most 3 boosts");
  assert.ok(c.mods.paddleMul > 1.19 && c.creditMul > 1.24);
  // A risky-free mode never drops a risky capsule, even on late levels.
  const l = generate(CLASSIC_SEED, 37);
  for (const b of l.bricks) { const d = dropFor(l, b, { level: 37, goodMul: 1, risky: false }); assert.ok(!d || !d.risky); }
});

test("Modes: Daily gives every player the same wall and capsule drops on the same date", () => {
  const a = dailyLevel("2026-11-06"), b = dailyLevel("2026-11-06"), c = dailyLevel("2026-11-07");
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.bricks, c.bricks);
  assert.notEqual(a.kind, "boss");
  const drops = (l) => l.bricks.map((q) => JSON.stringify(dropFor(l, q, { level: l.number, goodMul: buildMods("daily").mods.goodMul, risky: MODES.daily.risky })));
  assert.deepEqual(drops(a), drops(b));
  assert.ok(validate(a).ok);
});

test("Modes: Descent drops the bricks one row every 5 shots and ends when they reach the line", () => {
  const lvl = { kind: "descent", number: 3, seed: 7, cellH: CONFIG.descent.rowH, groups: [], bricks: [{ id: 0, t: "normal", hp: 999, c: 4, r: 3, w: 2, h: 1 }] };
  const e = engine(lvl, "descent");
  const y0 = e.bricks[0].y;
  const shoot = () => { e.fire(-40 * DEG); let g = 0; while (e.state === "volley" && g++ < 120 * 30) e.step(DT); };
  for (let s = 1; s <= 4; s++) { shoot(); assert.equal(e.bricks[0].y, y0, `no drop after ${s} shots`); }
  shoot();
  assert.equal(e.bricks[0].y, y0 + CONFIG.descent.rowH, "one row after 5 shots");
  for (let s = 0; s < 200 && !e.over; s++) shoot();
  assert.equal(e.state, "failed");
  assert.equal(e.result.reason, "reached");
  assert.ok(e.bricks[0].y + e.bricks[0].h > CONFIG.descent.failY);
});

test("Modes: Descent +1 ball pickups grow the volley; ball power-ups are collected without a paddle", () => {
  const lvl = { kind: "descent", number: 20, seed: 7, cellH: CONFIG.descent.rowH, groups: [], bricks: [
    { id: 0, t: "plus", hp: 0, c: 5, r: 8, w: 2, h: 1 }, { id: 1, t: "normal", hp: 999, c: 0, r: 0, w: 2, h: 1 }] };
  const e = engine(lvl, "descent");
  assert.equal(e.volley, 1);
  e.fire(0);
  let g = 0; while (e.state === "volley" && g++ < 120 * 30) e.step(DT);
  assert.equal(e.volley, 2);
});

test("Modes: Puzzle walls: 30, all reachable, each cleared by its stored solution within par", () => {
  assert.equal(PUZZLES.length, 30);
  for (let i = 0; i < PUZZLES.length; i++) {
    const lvl = puzzleLevel(i);
    assert.deepEqual(validate(lvl).unreachable, [], `puzzle ${i + 1}`);
    const sol = SOLUTIONS[PUZZLES[i].name];
    assert.ok(sol, `puzzle ${i + 1} has no solution: run npm run wallbreaker:puzzles`);
    const e = playPuzzle(lvl, sol.solution, sol.par + SLACK);
    assert.ok(e.result && e.result.cleared, `puzzle ${i + 1} (${PUZZLES[i].name}) not cleared by its solution`);
    assert.ok(e.shots <= sol.par);
    assert.equal(puzzleStars(e.shots, sol.par), 3);
  }
  assert.deepEqual([puzzleStars(3, 3), puzzleStars(4, 3), puzzleStars(5, 3)], [3, 2, 1]);
  const out = playPuzzle(puzzleLevel(29), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], SOLUTIONS.finale.par + SLACK);
  assert.equal(out.result.reason, "shots", "out of shots ends the level");
});

test("Modes: Time Attack walls are valid; a lost ball adds 5 s and there is no fail state", () => {
  for (let i = 0; i < TIME_ATTACK.length; i++) {
    const w = TIME_ATTACK[i];
    assert.deepEqual(validate(timeAttackLevel(i)).unreachable, [], w.name);
    assert.ok(w.gold < w.silver && w.silver < w.bronze);
  }
  const e = engine(timeAttackLevel(0), "timeattack");
  for (let k = 0; k < 4; k++) { e.tap(); e.balls[0].vx = 0; e.balls[0].vy = 600; e.balls[0].y = e.paddle.y + 20; run(e, 1); }
  assert.equal(e.penalty, 20);
  assert.notEqual(e.state, "failed");
  assert.equal(medalPay(null, "gold"), 15);
  assert.equal(medalPay("bronze", "gold"), 10);
  assert.equal(medalPay("gold", "silver"), 0);
});

// ---- Bricks and power-ups -------------------------------------------------------------------------------------
test("Bricks: normal, tough, steel, gift and boss core behave as described", () => {
  const e = engine(wall([{ t: "tough", hp: 3, c: 2, r: 2 }, { t: "steel", c: 5, r: 2 }, { t: "normal", c: 8, r: 2 }, { t: "gift", c: 10, r: 2 }]));
  const [tough, steel, normal, gift] = e.bricks;
  e.damage(tough, 1); e.damage(tough, 1);
  assert.ok(tough.alive && tough.hp === 1, "tough takes 3 hits");
  e.damage(tough, 1);
  assert.ok(!tough.alive);
  e.damage(steel, 99);
  assert.ok(steel.alive, "steel never breaks");
  e.damage(normal, 1);
  assert.ok(!normal.alive, "normal breaks in one hit");
  e.damage(gift, 1);
  assert.ok(e.events.some(([t]) => t === "drop"), "gift always drops a capsule");
  // Boss core weak spot: a hit from below in the middle counts double.
  const boss = engine(generate(CLASSIC_SEED, 10));
  const core = boss.bricks.find((b) => b.t === "core");
  const hp = core.hp;
  boss.resolve({ x: core.x + core.w / 2, y: core.y + core.h + 6, vx: 0, vy: -300, r: 6 }, { kind: "brick", obj: core, nx: 0, ny: 1, t: 0 }, false);
  assert.equal(core.hp, hp - 2, "weak spot takes double damage");
  boss.resolve({ x: core.x + 4, y: core.y - 6, vx: 0, vy: 300, r: 6 }, { kind: "brick", obj: core, nx: 0, ny: -1, t: 0 }, false);
  assert.equal(core.hp, hp - 3, "elsewhere, one");
});

test("Bricks: explosive breaks its neighbours, chain reactions included", () => {
  const e = engine(wall([
    { t: "explosive", c: 2, r: 3 }, { t: "tough", hp: 3, c: 3, r: 3 }, { t: "explosive", c: 3, r: 4 }, { t: "normal", c: 4, r: 5 },
    { t: "steel", c: 1, r: 3 }, { t: "normal", c: 9, r: 9 },
  ]));
  e.damage(e.bricks[0], 1);
  run(e, 0.5);
  assert.ok(!e.bricks[1].alive, "neighbour broken, whatever its hits");
  assert.ok(!e.bricks[2].alive, "neighbouring explosive set off");
  assert.ok(!e.bricks[3].alive, "the chain reached the second explosive's neighbour");
  assert.ok(e.bricks[4].alive, "steel survives");
  assert.ok(e.bricks[5].alive, "far bricks untouched");
});

test("Bricks: regenerating heals one hit every 6 s unless broken; ghost shows for 1 s after a hit", () => {
  const e = engine(wall([{ t: "regen", hp: 2, c: 2, r: 2 }, { t: "ghost", c: 6, r: 2 }, { t: "normal", c: 9, r: 9 }]));
  const [regen, ghost] = e.bricks;
  e.damage(regen, 1);
  assert.equal(regen.hp, 1);
  run(e, 5.9);
  assert.equal(regen.hp, 1);
  run(e, 0.2);
  assert.equal(regen.hp, 2, "healed after 6 s");
  e.damage(ghost, 0.5);
  assert.ok(e.t - ghost.lastHit < CONFIG.bricks.ghostVisible);
});

test("Bricks: a ball entering a portal comes out of its partner with the same direction; moving bricks move", () => {
  const e = engine(wall([{ t: "portal", c: 5, r: 14, pair: 1 }, { t: "portal", c: 1, r: 0, pair: 1 }, { t: "normal", c: 11, r: 9 }]));
  const [a, bb] = e.bricks;
  const q = ball(e, a.x + a.w / 2, a.y + 60, 0, 300);
  const v0 = [q.vx, q.vy];
  for (let i = 0; i < 60 && !e.events.some(([t]) => t === "portal"); i++) e.step(DT);
  assert.ok(e.events.some(([t]) => t === "portal"));
  assert.ok(Math.abs(e.balls[0].x - (bb.x + bb.w / 2)) < 2 && e.balls[0].y < bb.y + 20, "came out of the other portal");
  const dir = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l].map((x) => Math.round(x * 1000)); };
  assert.deepEqual(dir([e.balls[0].vx, e.balls[0].vy]), dir(v0), "same direction");
  const m = engine(wall([{ t: "moving", c: 2, r: 5, w: 2, g: 1 }, { t: "normal", c: 0, r: 0 }], { groups: [{ id: 1, motion: "bounce", speed: 40 }] }));
  const x0 = m.bricks[0].x;
  run(m, 1);
  assert.ok(Math.abs(m.bricks[0].x - x0 - 40) < 1, "slides along its row");
});

test("Power-ups: every good capsule has its effect and duration; taking it again refreshes, never stacks", () => {
  const lvl = wall([{ t: "normal", c: 0, r: 0 }, { t: "normal", c: 11, r: 0 }]);
  for (const id of Object.keys(CONFIG.capsules)) {
    const e = engine(lvl, "classic", { mods: { durationMul: 1.2 } });
    e.tap();
    const sec = CONFIG.capsules[id].seconds;
    const w0 = e.paddle.w, s0 = e.ballSpeed(), l0 = e.lives, n0 = e.balls.length;
    e.apply(id, false);
    if (sec) {
      assert.ok(e.fx.has(id), `${id} is active`);
      assert.ok(Math.abs(e.fx.get(id).left - sec * 1.2) < 1e-9, `${id} lasts ${sec} s (+ Long Lasting)`);
      run(e, 1);
      e.apply(id, false);
      assert.ok(Math.abs(e.fx.get(id).left - sec * 1.2) < 1e-9, `${id} refreshed`);
    }
    switch (id) {
      case "wide": assert.ok(Math.abs(e.paddle.w - w0 * 1.5) < 1e-9, "wide +50%, not stacked"); break;
      case "slow": assert.ok(Math.abs(e.ballSpeed() - s0 * 0.7) < 1e-9); break;
      case "big": assert.equal(e.ballRadius(), CONFIG.capsules.big.radius); break;
      case "multi2": assert.equal(e.balls.length, n0 * 2); break;
      case "multi3": assert.equal(e.balls.length, n0 * 3); break;
      case "life": assert.equal(e.lives, l0 + 1); break;
      case "net": assert.equal(e.net, 1); break;
      case "bomb": assert.equal(e.bomb, true); break;
      case "sticky": assert.equal(e.fx.get("sticky").catches, 3); break;
      case "twin": assert.equal(e.paddles().length, 2); break;
    }
  }
  // Multiball caps at 12 balls.
  const e = engine(lvl);
  e.tap();
  for (let i = 0; i < 6; i++) e.apply("multi3", false);
  assert.equal(e.balls.length, P.maxBalls);
  // Timers run out.
  const f = engine(lvl);
  f.tap();
  f.apply("wide", false);
  for (let i = 0; i < 120 * 15.2; i++) { f.setPaddle(f.balls[0].x); f.step(DT); } // keep the ball in play
  assert.ok(!f.fx.has("wide") && Math.abs(f.paddle.w - P.paddleWidth) < 1e-9, "wide wears off after 15 s");
});

test("Power-ups: the pity rule guarantees a drop after 15 bricks without one", () => {
  const bricks = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) bricks.push({ t: "normal", c, r });
  const lvl = { ...wall(bricks, { number: 6 }), seed: 99 };
  const ctx = { level: 6, goodMul: 1, risky: false, table: "good" };
  const dry = lvl.bricks.filter((b) => !dropFor(lvl, b, ctx));
  assert.ok(dry.length > 40);
  const e = engine(lvl);
  e.tap();
  let since = 0, maxRun = 0;
  for (const b of dry.slice(0, 40)) {
    const n = e.events.filter(([t]) => t === "drop").length;
    e.damage(e.bricks[b.id], 1);
    if (e.events.filter(([t]) => t === "drop").length > n) since = 0; else since++;
    maxRun = Math.max(maxRun, since);
  }
  assert.equal(maxRun, CONFIG.drops.pity, "never more than 15 bricks in a row without a capsule");
  assert.ok(e.events.some(([t]) => t === "pity"));
});

// ---- Risky capsules -------------------------------------------------------------------------------------------
test("Risky: letting one fall has no effect; catching it applies risk and reward at once", () => {
  const lvl = { ...wall([{ t: "normal", c: 0, r: 0 }, { t: "normal", c: 11, r: 0 }]), number: 12 };
  const e = engine(lvl);
  e.tap();
  e.capsules.push({ id: "surge", risky: true, x: 40, y: 500 });
  e.setPaddle(300);
  run(e, 2);
  assert.equal(e.risky.size, 0, "missed: nothing happens");
  assert.equal(e.multiplier(), 1);
  const s0 = e.ballSpeed();
  e.capsules.push({ id: "surge", risky: true, x: 300, y: e.paddle.y + 2 });
  e.step(DT);
  assert.ok(e.hasRisky("surge"));
  assert.equal(e.multiplier(), 2);
  assert.ok(Math.abs(e.ballSpeed() - s0 * 1.4) < 1e-6, "the risk is on at once");
  e.apply("tiny", true);
  assert.ok(Math.abs(e.paddle.w - P.paddleWidth * 0.5) < 1e-9);
});

test("Risky: the multiplier applies to brick credits only, adds across capsules and caps at ×4", () => {
  assert.equal(riskyMultiplier([]), 1);
  assert.equal(riskyMultiplier(["surge", "armor"]), 3.5, "Speed Surge + Armor Plating = ×3.5");
  assert.equal(riskyMultiplier(["surge", "surge"]), 2, "the same one twice doesn't stack");
  assert.equal(riskyMultiplier(Object.keys(CONFIG.risky)), 4, "capped");
  const e = engine(wall([{ t: "normal", c: 2, r: 2 }, { t: "tough", hp: 1, c: 4, r: 2 }, { t: "normal", c: 9, r: 9 }]));
  e.apply("surge", true); e.apply("armor", true);
  assert.equal(e.multiplier(), 3.5);
  e.damage(e.bricks[0], 2);
  assert.equal(e.brickCredits, 0.25 * 3.5);
  const pay = levelPay({ mode: "classic", level: 25, brickCredits: e.brickCredits, stars: 3 });
  assert.equal(pay.base, basePay(25), "the level-clear bonus is never multiplied");
  assert.equal(pay.stars, 10);
});

test("Risky: All-In removes the Safety Net and ends the level on the next lost ball", () => {
  const e = engine({ ...wall([{ t: "normal", c: 0, r: 0 }, { t: "normal", c: 11, r: 0 }]), number: 15 });
  e.tap();
  e.apply("net", false);
  e.apply("multi2", false);
  assert.equal(e.net, 1);
  e.apply("allin", true);
  assert.equal(e.net, 0, "no Safety Net");
  e.apply("net", false);
  assert.equal(e.net, 0, "and no new one");
  assert.equal(e.balls.length, 2);
  e.balls[0].vx = 0; e.balls[0].vy = 500; e.balls[0].y = 630;
  run(e, 0.2);
  assert.equal(e.state, "failed", "one lost ball, even with another in play");
  assert.equal(e.result.reason, "allin");
});

test("Risky: each one is shown with its effect, in every language", () => {
  const strings = loadStrings();
  for (const lang of ["en", "nl"]) for (const id of Object.keys(CONFIG.risky)) for (const k of ["", ".d", ".short", ".banner"]) {
    assert.ok(strings[lang]["risky." + id + k], `${lang}: risky.${id}${k}`);
  }
});

// ---- Economy --------------------------------------------------------------------------------------------------
test("Economy: credits follow the earning formula", () => {
  assert.equal(basePay(100), 30);
  assert.equal(basePay(1), 12);
  assert.equal(starPay(1), 0); assert.equal(starPay(2), 5); assert.equal(starPay(3), 10);
  const p = levelPay({ mode: "classic", level: 4, brickCredits: 12, stars: 3 });
  assert.equal(p.total, Math.round(10 + 2 * 2 + 12 + 10));
  assert.ok(p.total >= 20 && p.total <= 40, "a fresh early level pays roughly 20–30 (plus up to 10 for stars)");
  assert.equal(levelPay({ mode: "classic", level: 4, brickCredits: 12, stars: 3, creditMul: 1.25 }).total, Math.round(36 * 1.25), "Scavenger applies to everything");
  assert.equal(dailyPay(false), 25);
  assert.equal(dailyPay(true), 0);
});

test("Economy: a 3-star replay pays 50%; Puzzle repeats pay 50%; there is no login bonus", () => {
  const fresh = levelPay({ mode: "classic", level: 9, brickCredits: 14, stars: 3, prevStars: 2 }).total;
  const replay = levelPay({ mode: "classic", level: 9, brickCredits: 14, stars: 3, prevStars: 3 }).total;
  assert.equal(replay, Math.round(fresh / 2));
  assert.equal(levelPay({ mode: "puzzle", level: 3, stars: 2, prevStars: 1 }).factor, 0.5);
  const src = codeFiles().map(([, s]) => s).join("\n");
  assert.ok(!/login|loginBonus|daily ?bonus|welcome ?back/i.test(src), "no login bonus anywhere");
  assert.ok(!("login" in CONFIG.credits));
});

test("Economy: Workshop prices follow the 1.6× curve and stop at their maximum level", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => workshopPrice("longLasting", n)), [150, 240, 385, 615, 985]);
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => workshopPrice("scavenger", n)), [300, 480, 770, 1230, 1965]);
  assert.equal(workshopPrice("longLasting", 6), null);
  assert.equal(workshopPrice("secondWind", 1), 1500);
  assert.equal(workshopPrice("secondWind", 2), null);
  for (const id in CONFIG.workshop.items) {
    const it = CONFIG.workshop.items[id];
    for (let n = 1; n <= it.max; n++) assert.equal(workshopPrice(id, n) % 5, 0, "rounded to 5");
  }
});

test("Economy: 24 cosmetics, 4 per shelf, in the three price tiers; pacing targets hold", () => {
  const forSale = cosmetics().filter((c) => c.price > 0);
  assert.equal(forSale.length, 24);
  for (const shelf of ["ball", "paddle", "trail", "bricks", "theme", "sound"]) assert.equal(forSale.filter((c) => c.shelf === shelf).length, 4, shelf);
  for (const c of forSale) assert.ok((c.price >= 150 && c.price <= 300) || (c.price >= 500 && c.price <= 800) || (c.price >= 1200 && c.price <= 2000), `${c.id}: ${c.price}`);
  // Pacing, with an autopilot playing Classic from level 1.
  let total = 0, levels = 0, firstBoostAt = 0, firstCosmeticAt = 0;
  const cheapestBoost = Math.min(...Object.values(CONFIG.boosts.items).map((b) => b.price));
  const cheapestCos = Math.min(...forSale.map((c) => c.price));
  for (let n = 1; n <= 8; n++) {
    const e = makeEngine({ level: generate(CLASSIC_SEED, n), rules: MODES.classic, lives: 99 });
    autoplay(e, { limit: 900 });
    total += levelPay({ mode: "classic", level: n, brickCredits: e.brickCredits, stars: e.stars() }).total;
    levels++;
    if (!firstBoostAt && total >= cheapestBoost) firstBoostAt = n;
    if (!firstCosmeticAt && total >= cheapestCos) firstCosmeticAt = n;
  }
  assert.ok(firstBoostAt >= 1 && firstBoostAt <= 3, `first boost after ${firstBoostAt} levels (about 3)`);
  assert.ok(firstCosmeticAt && firstCosmeticAt <= 8, `first cosmetic after ${firstCosmeticAt} levels (within a session)`);
  const midBoost = CONFIG.boosts.items.multiStart.price;
  const goodLevel = levelPay({ mode: "classic", level: 30, brickCredits: 25, stars: 3 }).total;
  assert.ok(midBoost / goodLevel > 0.6 && midBoost / goodLevel < 1.6, "a mid-game boost costs about one good level");
  const top = Math.max(...forSale.map((c) => c.price));
  assert.ok(top / goodLevel < 60, "the dearest cosmetic is weeks of casual play, not months");
});

test("Economy: no real-money purchase path exists anywhere in the game", () => {
  for (const [f, s] of codeFiles()) {
    assert.ok(!/PaymentRequest|[Bb]illing|in-?app ?purchase|\bIAP\b|[Cc]heckout\b|\bStripe\b|[Pp]ay[Pp]al|StoreKit/.test(s), `${f} mentions payments`);
    assert.ok(!/https?:\/\//.test(s.replace(/\/\/.*$/gm, "")), `${f} has a URL outside comments`);
  }
  const en = loadStrings().en;
  assert.match(en["shop.never"], /never be bought/);
});

test("Economy: credits are stored per game, under the wallbreaker. namespace", () => {
  assert.equal(SAVE_KEY, "wallbreaker.save");
  for (const [f, s] of codeFiles()) {
    for (const m of s.matchAll(/(?:localStorage|storage)\.(?:get|set|remove)Item\(\s*["'`]([^"'`]+)/g)) assert.ok(m[1].startsWith("wallbreaker."), `${f} uses key ${m[1]}`);
  }
  const s = freshSave();
  s.credits = 1234;
  s.boosts.life = 2;
  const back = importSave(exportSave(s));
  assert.equal(back.credits, 1234);
  assert.equal(back.boosts.life, 2);
  assert.throws(() => importSave("{}"), /not-wallbreaker/);
  assert.throws(() => importSave("nope"), /not-json/);
  assert.equal(migrate({ credits: "12.7", stats: { bricks: 5 } }).stats.bricks, 5, "older saves keep what they have");
  assert.equal(migrate({ credits: -5 }).credits, 0);
});

test("Economy: prices, rewards and rates are read from the config file", () => {
  for (const [f, s] of codeFiles()) {
    if (f.endsWith("config.js") || f.endsWith("puzzles.gen.js") || f.endsWith("walls.js")) continue;
    assert.ok(!/\b(price|cost|reward|pay)\s*[:=]\s*\d/i.test(s), `${f} has a hard-coded price`);
    for (const n of ["0.08", "1.6", "0.25", "150", "1500"]) {
      const re = new RegExp(`[^\\w.]${n.replace(".", "\\.")}[^\\w.]`);
      if (f.endsWith("economy.js") || f.endsWith("modes.js")) assert.ok(!re.test(stripComments(s)), `${f} has ${n} hard-coded`);
    }
  }
  const levels = readFileSync(join(GAME, "src/levels.js"), "utf8");
  for (const k of ["D.chance", "D.riskyShare", "D.pity", "C.drops"]) assert.ok(levels.includes(k) || k === "D.pity", `drop rates come from CONFIG (${k})`);
  assert.ok(readFileSync(join(GAME, "src/engine.js"), "utf8").includes("CONFIG.drops.pity"));
  assert.equal(typeof CONFIG.version, "number");
  assert.ok(Object.isFrozen(CONFIG.boosts.items.life), "the config can't be changed at run time");
});

// ---- Quality -------------------------------------------------------------------------------------------------
test("Quality: the simulation keeps up with 200 bricks and 12 balls (well under a frame per step)", () => {
  const bricks = [];
  for (let r = 0; r < 17; r++) for (let c = 0; c < 12; c++) if (bricks.length < 200) bricks.push({ t: r % 3 ? "normal" : "tough", hp: 2, c, r });
  const e = engine({ ...wall(bricks), number: 30 }, "zen");
  e.tap();
  e.apply("multi3", false); e.apply("multi3", false); e.apply("multi2", false);
  assert.equal(e.balls.length, 12);
  const t0 = performance.now();
  let steps = 0;
  for (; steps < 120 * 10; steps++) e.step(DT);
  const ms = (performance.now() - t0) / steps;
  assert.ok(ms < 1, `${ms.toFixed(3)} ms per 1/120 s step`);
});

test("Quality: every text exists in English and Dutch", () => {
  const s = loadStrings();
  const missing = Object.keys(s.en).filter((k) => !(k in s.nl)).concat(Object.keys(s.nl).filter((k) => !(k in s.en)));
  assert.deepEqual(missing, []);
  // Everything the code looks up exists.
  const used = new Set();
  for (const [, src] of codeFiles()) for (const m of src.matchAll(/_t\("([a-zA-Z0-9.]+)"/g)) used.add(m[1]);
  for (const k of used) if (!k.endsWith(".")) assert.ok(k in s.en, `missing text ${k}`);
  for (const id of Object.keys(CONFIG.capsules)) assert.ok(s.en["cap." + id] && s.en["cap." + id + ".d"], id);
  for (const id of Object.keys(CONFIG.run.perks)) assert.ok(s.en["perk." + id] && s.en["perk." + id + ".d"], id);
  for (const c of cosmetics()) assert.ok(s.en["cos." + c.id], c.id);
  for (const m of MODE_ORDER) for (const k of ["", ".rule", ".long"]) assert.ok(s.en["mode." + m + k], m + k);
  for (const w of TIME_ATTACK) assert.ok(s.en["ta." + w.name], w.name);
  for (const id in CONFIG.workshop.items) assert.ok(s.en["ws." + id] && s.en["ws." + id + ".d"], id);
  for (const id in CONFIG.boosts.items) assert.ok(s.en["boost." + id] && s.en["boost." + id + ".d"], id);
});

test("Quality: the offline service worker stores every file the game needs", () => {
  const sw = readFileSync(join(GAME, "sw.js"), "utf8");
  const listed = new Set(JSON.parse("[" + sw.match(/const FILES = \[([\s\S]*?)\];/)[1].replace(/,\s*$/, "") + "]"));
  const need = ["index.html", "style.css", "strings.js", "game.js", "manifest.webmanifest", "icon.svg", ...readdirSync(join(GAME, "src")).map((f) => "src/" + f)];
  for (const f of need) assert.ok(listed.has(f), `sw.js doesn't cache ${f}`);
  for (const f of listed) if (!f.startsWith("../") && f !== "./") assert.ok(need.includes(f), `sw.js lists ${f}, which doesn't exist`);
  const html = readFileSync(join(GAME, "index.html"), "utf8");
  for (const m of html.matchAll(/src="(\.\.\/\.\.\/shared\/[^"]+)"/g)) assert.ok(listed.has(m[1]), `sw.js doesn't cache ${m[1]}`);
});

// ---- helpers --------------------------------------------------------------------------------------------------
function loadStrings() {
  let got;
  const ctx = vm.createContext({ I18n: { add: (d) => { got = d; }, apply: () => {} } });
  vm.runInContext(readFileSync(join(GAME, "strings.js"), "utf8"), ctx);
  return got;
}
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); }
function codeFiles() {
  const files = ["game.js", "sw.js", ...readdirSync(join(GAME, "src")).map((f) => "src/" + f)];
  return files.map((f) => [f, readFileSync(join(GAME, f), "utf8")]);
}
void BREAKABLE;
