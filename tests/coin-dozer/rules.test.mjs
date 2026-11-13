// Coin Dozer: the acceptance criteria from docs/COIN-DOZER.md that can be checked without a browser,
// on the real physics (Rapier) and rules. Each test names the criterion it covers (AC n).
// Run: node --test tests/coin-dozer/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { CONFIG } from "../../games/coin-dozer/src/config.js";
import { initPhysics, pusherFront, isCoin } from "../../games/coin-dozer/src/board.js";
import { Machine } from "../../games/coin-dozer/src/machine.js";
import * as Eco from "../../games/coin-dozer/src/economy.js";
import { SAVE_KEY, SAVE_VERSION, freshSave, migrate, loadSave, writeSave, makeStorage } from "../../games/coin-dozer/src/save.js";
import { THEMES, FIGURES, THEME_IDS } from "../../games/coin-dozer/src/themes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GAME = join(ROOT, "games/coin-dozer");
const B = CONFIG.board, HZ = CONFIG.physics.hz;
await initPhysics();

/** A machine with its events recorded. */
function machine(o = {}) {
  const events = [];
  const m = new Machine({ cfg: o.cfg || CONFIG, progress: o.progress || Eco.freshProgress(), onEvent: (t, d) => events.push([t, d]), date: () => "2026-11-07" });
  m.events = events;
  m.count = (t) => events.filter((e) => e[0] === t).length;
  return m;
}
/** A machine with an empty shelf and no machine drops, for controlled experiments. */
function empty(o = {}) {
  const m = machine(o);
  for (const it of [...m.board.items.values()]) m.board.remove(it);
  m.replenishT = -1e9; m.luckyAt = Infinity; m.figureT = -1e9;
  return m;
}
const run = (m, seconds) => { for (let i = 0; i < Math.round(seconds * HZ); i++) m.step(); };
const cfgWith = (patch) => { const c = JSON.parse(JSON.stringify(CONFIG)); patch(c); return c; };
/** Put a coin just past the front edge, so it falls into the tray on the next steps. */
const overEdge = (m, kind = "coin", x = 0, sub) => m.board.add(kind, { x, y: 0.3, z: B.depth / 2 + 0.6, sub });

// ---- Core play ------------------------------------------------------------------------------------------------
test("AC1: a new game opens with a pre-placed pile of about 60 coins, 3 prizes and a bank of 50", () => {
  const m = machine();
  m.newBoard(1234);
  const coins = m.board.count((it) => isCoin(it.kind));
  assert.ok(coins >= 50 && coins <= CONFIG.start.coins, `coins on a new board: ${coins}`);
  assert.equal(m.board.count((it) => it.kind === "gem"), 2);
  assert.equal(m.board.count((it) => it.kind === "figure"), 1);
  assert.equal(m.bank, 50);
});

test("AC2: the aim clamps to the shelf width", () => {
  const m = empty();
  const lim = B.width / 2 - B.aimMargin;
  m.setAim(99); assert.equal(m.aim, lim);
  m.setAim(-99); assert.equal(m.aim, -lim);
  m.setAim(1.25); assert.equal(m.aim, 1.25);
});

test("AC3: a drop costs exactly 1 coin; a second drop within 0.25 s is ignored", () => {
  const m = empty();
  assert.equal(m.drop(0), true);
  assert.equal(m.bank, 49);
  assert.equal(m.board.count((it) => isCoin(it.kind)), 1);
  run(m, 0.2);
  assert.equal(m.drop(0), false, "second drop after 0.2 s");
  assert.equal(m.bank, 49);
  run(m, 0.06);
  assert.equal(m.drop(0), true, "a drop after 0.26 s");
  assert.equal(m.bank, 48);
  m.bank = 0; m.lastDrop = -1;
  assert.equal(m.drop(0), false, "no drop with an empty bank");
});

test("AC4: the pusher runs a 2.4 s cycle over a 3-diameter stroke at constant speed", () => {
  const m = empty();
  const fronts = [];
  for (let i = 0; i < Math.round(B.cycle * HZ) + 1; i++) { m.step(); fronts.push(m.board.pusherFrontZ); }
  assert.equal(m.board.cycles, 1);
  assert.ok(Math.abs(Math.max(...fronts) - Math.min(...fronts) - B.stroke) < 0.05);
  const speeds = fronts.slice(1).map((f, i) => Math.abs(f - fronts[i]) * HZ).filter((s) => s > 0.1);
  for (const s of speeds) assert.ok(Math.abs(s - (2 * B.stroke) / B.cycle) < 0.15, `speed ${s}`);
  assert.equal(pusherFront(0.5), -B.depth / 2 + B.stroke);
});

/** Coins whose centre is inside the pusher block. */
function insidePusher(m) {
  const front = m.board.pusherFrontZ;
  return [...m.board.items.values()].filter((it) => isCoin(it.kind) && it.y < B.pusherHeight - 0.08 && Math.abs(it.x) < B.width / 2 && it.z < front - 0.35 && it.z > front - m.board.pusherLen);
}

test("AC4 + AC7: a squeezed pile never passes through the pusher, tunnels or explodes", () => {
  const m = empty();
  // Three dense layers right in front of the pusher's forward stop.
  let n = 0;
  for (let layer = 0; layer < 3; layer++) for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    m.board.add("coin", { x: -2.6 + c * 1.04 + (r % 2) * 0.3, y: 0.07 + layer * 0.13, z: -1.9 + r * 1.03, q: [0, 0, 0, 1] }); n++;
  }
  let fastest = 0;
  for (let i = 0; i < 10 * B.cycle * HZ; i++) {
    m.step();
    const inside = insidePusher(m);
    assert.deepEqual(inside.map((it) => [it.id, +it.x.toFixed(2), +it.y.toFixed(2), +it.z.toFixed(2), +m.board.pusherFrontZ.toFixed(2)]), [], `coin inside the pusher at step ${i}`);
    for (const it of m.board.items.values()) {
      // sideways and upward speed (a coin falling freely is fine; one shot out of the pile is not)
      if (it.y > -0.2 && it.z < B.depth / 2 - 0.5) fastest = Math.max(fastest, Math.hypot(it.x - it.px, Math.max(0, it.y - it.py), it.z - it.pz) * HZ);
    }
  }
  assert.ok(fastest < 8, `fastest coin on the shelf: ${fastest.toFixed(1)} diameters/s`);
  for (const it of m.board.items.values()) assert.ok(it.y > -1 && it.y < 2, "no coin thrown up or through the shelf");
});

test("AC7: coins at rest go to sleep and don't drift; stacks hold shape", () => {
  const m = empty();
  m.board.speed = 0;                        // pusher parked: nothing disturbs the pile
  for (let i = 0; i < 4; i++) m.board.add("coin", { x: 0, y: 0.07 + i * 0.125, z: 1, q: [0, 0, 0, 1] }); // a stack of 4
  for (let i = 0; i < 12; i++) m.board.add("coin", { x: -2.5 + (i % 6) * 1.02, y: 0.07, z: 3 + Math.floor(i / 6) * 1.02, q: [0, 0, 0, 1] });
  run(m, 5);
  const before = [...m.board.items.values()].map((it) => [it.x, it.y, it.z]);
  const asleep = [...m.board.items.values()].filter((it) => it.asleep).length;
  assert.ok(asleep >= m.board.items.size - 1, `asleep: ${asleep} of ${m.board.items.size}`);
  run(m, 3);
  const after = [...m.board.items.values()].map((it) => [it.x, it.y, it.z]);
  for (let i = 0; i < before.length; i++) assert.ok(Math.hypot(...before[i].map((v, k) => v - after[i][k])) < 0.002, "a resting coin moved");
  const stack = [...m.board.items.values()].slice(0, 4);
  for (const it of stack) assert.ok(Math.hypot(it.x, it.z - 1) < 0.1, "the stack held its shape");
});

test("AC5: a coin over the front edge is paid by type and removed; AC6: a coin off the side is lost", () => {
  const m = empty();
  overEdge(m, "coin", -1); overEdge(m, "gold", 1);
  run(m, 0.6);
  assert.equal(m.bank, 50 + 1 + 5);
  assert.equal(m.board.items.size, 0);
  const won = m.events.filter((e) => e[0] === "won").map((e) => e[1].value).sort();
  assert.deepEqual(won, [1, 5]);
  m.board.add("coin", { x: B.width / 2 + 0.5, y: 0.3, z: 4 });
  m.board.add("gold", { x: -B.width / 2 - 0.5, y: 0.3, z: 4 });
  run(m, 0.6);
  assert.equal(m.bank, 56, "side losses don't change the bank");
  assert.equal(m.count("lost"), 2);
  assert.equal(m.board.items.size, 0);
});

// ---- Prizes and bonuses -----------------------------------------------------------------------------------------
test("AC9: gold coins about 1 in 25; 2–4 gems and one figure kept on the board", () => {
  const m = machine();
  m.newBoard(77);
  let gold = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) if (m.rng.chance(Eco.goldChance(m.progress))) gold++;
  assert.ok(gold / n > 0.025 && gold / n < 0.055, `gold share ${gold / n}`);
  // Win every prize on the board; the machine drops new ones at the back.
  for (const it of [...m.board.items.values()]) if (!isCoin(it.kind)) m.board.remove(it);
  m.figureT = 0;
  run(m, 40);
  const gems = m.board.count((it) => it.kind === "gem"), figs = m.board.count((it) => it.kind === "figure");
  assert.ok(gems >= 2 && gems <= 4, `gems: ${gems}`);
  assert.equal(figs, 1);
});

test("AC10: gem +10 credits and one entry; figure +25 and one entry; duplicates pay credits, no second entry", () => {
  const m = empty();
  overEdge(m, "gem", 0, "blue");
  run(m, 0.6);
  assert.equal(m.progress.credits, 10);
  assert.deepEqual(Object.keys(m.progress.collection.classic), ["1"]);
  overEdge(m, "figure", 0, 3);
  run(m, 0.8);
  assert.equal(m.progress.credits, 35);
  assert.deepEqual(Object.keys(m.progress.collection.classic).sort(), ["1", "7"]);
  overEdge(m, "gem", 0, "blue");
  run(m, 0.6);
  assert.equal(m.progress.credits, 45, "a duplicate pays again");
  assert.equal(Object.keys(m.progress.collection.classic).length, 2, "no duplicate entry");
  assert.equal(m.progress.collection.classic[1], "2026-11-07", "the day it was won");
});

test("AC11: a lucky coin starts a coin shower of 30–40 coins over about 6 s", () => {
  const m = empty();
  overEdge(m, "lucky");
  run(m, 0.6);
  assert.equal(m.rain && m.rain.type, "shower");
  const before = m.board.count((it) => isCoin(it.kind));
  run(m, CONFIG.events.shower.seconds + 0.2);
  assert.equal(m.rain, null);
  const spawned = m.board.count((it) => isCoin(it.kind)) + m.count("won") - 1 + m.count("lost") - before;
  assert.ok(spawned >= 30 && spawned <= 40, `shower coins: ${spawned}`);
});

test("AC11: 15 coins in one advance start a coin shower", () => {
  const m = empty();
  for (let i = 0; i < 15; i++) m.board.add("coin", { x: -3 + (i % 7) * 0.95, y: 0.3 + Math.floor(i / 7) * 0.3, z: B.depth / 2 + 0.6 });
  run(m, 0.8);
  assert.equal(m.cascade, 15);
  assert.ok(m.events.some((e) => e[0] === "eventStart" && e[1].type === "shower"));
  assert.ok(m.events.some((e) => e[0] === "cascade" && e[1].n === 5), "the cascade feedback starts at 5");
});

test("AC11: 3 gems within 60 s start fever: pusher +25%, coins ×2, for 15 s", () => {
  const m = empty();
  for (const c of ["red", "green"]) { overEdge(m, "gem", 0, c); run(m, 0.6); }
  assert.equal(m.fever, 0);
  run(m, 20);
  overEdge(m, "gem", 0, "yellow");
  run(m, 0.6);
  assert.ok(m.fever > 14 && m.fever <= 15, `fever ${m.fever}`);
  assert.equal(m.board.speed, 1.25);
  const bank = m.bank;
  overEdge(m, "coin"); overEdge(m, "gold", 1);
  run(m, 0.6);
  assert.equal(m.bank - bank, 2 + 10);
  run(m, 15);
  assert.equal(m.fever, 0);
  assert.equal(m.board.speed, 1);
  // Gems further apart than 60 s don't count.
  const m2 = empty();
  for (const c of ["red", "green", "blue"]) { overEdge(m2, "gem", 0, c); run(m2, 31); }
  assert.equal(m2.fever, 0);
});

test("AC11: a lucky coin during fever drops a jackpot coin worth 50", () => {
  const m = empty();
  m.trigger("fever");
  overEdge(m, "lucky");
  run(m, 0.6);
  assert.equal(m.rain && m.rain.type, "jackpot");
  run(m, 3);
  const jp = [...m.board.items.values()].find((it) => it.kind === "jackpot");
  assert.ok(jp, "the jackpot coin is on the board");
  m.board.remove(jp);
  const bank = m.bank;
  overEdge(m, "jackpot");
  run(m, 0.8);
  assert.equal(m.bank - bank, 50);
  assert.ok(m.progress.milestones.jackpot);
});

test("AC11: a figure won closes the gutters for the next 10 drops", () => {
  const m = empty();
  overEdge(m, "figure", 0, 0);
  run(m, 0.8);
  assert.equal(m.board.guttersClosed, true);
  for (let i = 0; i < 9; i++) { m.drop(0); run(m, 0.26); }
  assert.equal(m.board.guttersClosed, true);
  m.drop(0);
  assert.equal(m.board.guttersClosed, false);
  // While closed, a coin pushed toward the gutter stays on the shelf.
  const m2 = empty();
  m2.trigger("wide");
  const c = m2.board.add("coin", { x: B.width / 2 - 0.6, y: 0.07, z: 3.5, v: [6, 0, 0] });
  run(m2, 1);
  assert.ok(m2.board.items.has(c.id), "the coin bounced off the closed gutter");
});

test("AC12: one rain-type event at a time, at most 2 queued", () => {
  const m = empty();
  assert.equal(m.trigger("shower"), true);
  assert.equal(m.trigger("jackpot"), true);
  assert.equal(m.trigger("shower"), true);
  assert.equal(m.trigger("shower"), false, "a fourth is dropped");
  assert.equal(m.queue.length, 2);
  let overlap = 0;
  for (let i = 0; i < 20 * HZ; i++) { m.step(); if (m.rain && m.queue.length > 2) overlap++; }
  const starts = m.events.filter((e) => e[0] === "eventStart").map((e) => e[1].type);
  assert.deepEqual(starts, ["shower", "jackpot", "shower"]);
  assert.equal(overlap, 0);
});

test("AC13: anti-stall runs in order (settle, free coins, prize push) with no message", () => {
  const m = empty();
  for (let i = 0; i < 6; i++) m.board.add("coin", { x: -1.5 + i * 0.6, y: 0.07, z: 0.5, q: [0, 0, 0, 1] });
  m.board.add("figure", { x: 1.5, y: CONFIG.prizes.figure.height / 2, z: 1.5, sub: 0 });
  const typesBefore = new Set(m.events.map((e) => e[0]));
  run(m, B.cycle * 5 + 0.1);
  const steps = m.antiStallLog.map((e) => e[1]);
  assert.deepEqual(steps.filter((s) => s !== 3).slice(0, 2), [1, 2], `anti-stall order: ${JSON.stringify(m.antiStallLog)}`);
  assert.equal(m.antiStallLog.find((e) => e[1] === 1)[0], 3, "settle after 3 stalled cycles");
  assert.equal(m.antiStallLog.find((e) => e[1] === 2)[0], 5, "free coins 2 cycles later");
  assert.ok(steps.includes(3), "the still figure got a sideways push after 5 cycles");
  const newTypes = m.events.map((e) => e[0]).filter((t) => !typesBefore.has(t));
  for (const t of newTypes) assert.ok(["advance", "retract", "land"].includes(t), `anti-stall made itself known: ${t}`);
  // Something over the edge resets the count.
  const m2 = empty();
  run(m2, B.cycle * 2 + 0.1);
  overEdge(m2);
  run(m2, B.cycle * 2);
  assert.equal(m2.antiStallLog.length, 0);
});

// ---- Economy and progression ------------------------------------------------------------------------------------
test("AC14: bank 0 with nothing in flight → 10 coins at once, every time (no wait, ad or limit)", () => {
  assert.equal(Eco.lifeline(0, 0), 10);
  assert.equal(Eco.lifeline(0, 1), 0, "waits for a coin in flight");
  assert.equal(Eco.lifeline(4, 0), 0);
  const m = empty();
  for (let round = 0; round < 5; round++) {
    m.bank = 1;
    m.lastDrop = -1;
    m.drop(0);
    assert.equal(m.bank, 0);
    m.step();
    assert.equal(m.bank, 0, "not while the coin is still falling");
    run(m, 1);
    assert.equal(m.bank, 10, `round ${round}`);
  }
  assert.equal(m.count("lifeline"), 5);
});

test("AC15: Workshop purchases deduct credits, apply at once and are blocked without enough credits", () => {
  const p = Eco.freshProgress();
  assert.deepEqual(Eco.buyUpgrade(p, "nudges"), { ok: false, reason: "credits", need: 40 });
  p.credits = 2000;
  const costs = { startBank: [40, 80, 160], goldChance: [50, 100, 200], nudges: [40, 80, 160], luckyRate: [60, 120, 240] };
  for (const id in costs) for (const c of costs[id]) { assert.equal(Eco.upgradeCost(p, id), c); assert.equal(Eco.buyUpgrade(p, id).ok, true); }
  assert.equal(p.credits, 2000 - 1330);
  assert.deepEqual(Eco.buyUpgrade(p, "nudges"), { ok: false, reason: "max" });
  assert.equal(Eco.startBank(p), 50 + 75);
  assert.ok(Math.abs(Eco.goldChance(p) - 0.07) < 1e-9);
  assert.equal(Eco.maxNudges(p), 6);
  assert.ok(Math.abs(Eco.luckyInterval(p) - 180 / 1.45) < 1e-9);
  const m = machine({ progress: p });
  m.newBoard(5);
  assert.equal(m.bank, 125, "a new board starts with the upgraded bank");
  assert.equal(m.nudges, 6);
});

test("AC15: credits never go negative from a purchase", () => {
  const p = Eco.freshProgress();
  p.credits = 39;
  assert.equal(Eco.buyUpgrade(p, "startBank").ok, false);
  assert.equal(p.credits, 39);
  assert.equal(p.workshop.startBank, 0);
});

test("AC16: themes unlock for their credit cost; changing theme doesn't change the physics", () => {
  const p = Eco.freshProgress();
  assert.deepEqual(Object.fromEntries(THEME_IDS.map((t) => [t, Eco.themeCost(t)])), { classic: 0, space: 150, candy: 300, ocean: 500 });
  assert.equal(Eco.selectTheme(p, "space"), false, "a locked theme can't be used");
  assert.deepEqual(Eco.buyTheme(p, "space"), { ok: false, reason: "credits", need: 150 });
  p.credits = 160;
  assert.equal(Eco.buyTheme(p, "space").ok, true);
  assert.equal(p.credits, 10);
  assert.equal(Eco.selectTheme(p, "space"), true);
  // Same seed and input, two themes: the same board.
  const snap = (theme) => {
    const q = Eco.freshProgress(); q.themes[theme] = true; q.theme = theme;
    const m = machine({ progress: q });
    m.newBoard(99);
    m.setAuto(true);
    run(m, 6);
    return JSON.stringify(m.board.snapshot());
  };
  assert.equal(snap("classic"), snap("ocean"));
  for (const t of THEME_IDS) {
    assert.equal(FIGURES[t].length, 8, `${t} has 8 figures`);
    assert.ok(THEMES[t].sound && THEMES[t].gems, `${t} has a sound palette and gem colours`);
  }
});

test("AC17: each milestone grants its credits exactly once", () => {
  const p = Eco.freshProgress();
  const want = { won100: 20, cascade10: 20, fever: 30, jackpot: 50, fullSet: 100 };
  for (const id in want) { assert.equal(Eco.reachMilestone(p, id), want[id]); assert.equal(Eco.reachMilestone(p, id), 0); }
  assert.equal(p.credits, 220);
  // Through play: the first 100 coins won, and a full set.
  const m = empty();
  m.progress.stats.coinsWon = 99;
  overEdge(m); overEdge(m, "coin", 1);
  run(m, 0.6);
  assert.equal(m.progress.credits, 20);
  for (let i = 0; i < 4; i++) m.progress.collection.classic[i] = "2026-11-01";
  for (let i = 0; i < 7; i++) m.progress.collection.classic[4 + i] = "2026-11-01";
  overEdge(m, "figure", 0, 7);
  run(m, 0.8);
  assert.equal(m.progress.credits, 20 + 25 + 100);
  assert.equal(m.count("milestone"), 2);
});

// ---- Controls --------------------------------------------------------------------------------------------------
test("AC18: auto-drop drops every 0.8 s at the aim and stops when the bank is empty", () => {
  const m = empty();
  m.setAim(1.5);
  m.setAuto(true);
  run(m, 4.0 + 1 / HZ);
  assert.equal(m.count("drop"), 5);
  for (const e of m.events.filter((x) => x[0] === "drop")) assert.ok(Math.abs(e[1].x - 1.5) <= B.dropJitter + 1e-9);
  m.bank = 2;
  run(m, 3);
  assert.equal(m.auto, false, "auto-drop switched itself off");
  assert.equal(m.count("autoOff"), 1);
});

test("AC19: nudge has 3 charges, recharges 1 per 60 s of play, and wakes sleeping coins", () => {
  const m = empty();
  m.board.speed = 0;
  for (let i = 0; i < 5; i++) m.board.add("coin", { x: -2 + i, y: 0.06, z: 2, q: [0, 0, 0, 1], sleeping: true });
  m.step();
  assert.ok([...m.board.items.values()].every((it) => it.asleep));
  assert.equal(m.nudge(), true);
  m.step();
  assert.ok([...m.board.items.values()].every((it) => !it.asleep), "the nudge woke every coin");
  assert.equal(m.nudge(), true);
  assert.equal(m.nudge(), true);
  assert.equal(m.nudge(), false, "no fourth charge");
  run(m, 59);
  assert.equal(m.nudges, 0);
  run(m, 1.1);
  assert.equal(m.nudges, 1);
  run(m, 300);
  assert.equal(m.nudges, 3, "recharges stop at the maximum");
});

// ---- Performance and persistence -----------------------------------------------------------------------------------
test("AC24: beyond the cap the oldest settled coin farthest from the edge fades out, and nothing else is affected", () => {
  const cfg = cfgWith((c) => { c.board.maxCoins = 40; });
  const m = empty({ cfg });
  m.board.speed = 0;
  for (let i = 0; i < 40; i++) m.board.add("coin", { x: -3 + (i % 7) * 1.0, y: 0.07, z: -1 + Math.floor(i / 7) * 1.02, q: [0, 0, 0, 1], born: i });
  run(m, 4);
  const bank = m.bank, back = Math.min(...[...m.board.items.values()].map((it) => it.z));
  m.drop(0);
  assert.equal(m.board.count((it) => isCoin(it.kind)), 40);
  const fade = m.events.find((e) => e[0] === "fade");
  assert.ok(fade, "a coin faded out");
  assert.ok(fade[1].item.z < back + 0.5, "it was in the back row");
  assert.equal(m.bank, bank - 1, "the removed coin isn't paid");
  // A coin shower never takes the board over the cap.
  m.trigger("shower");
  let most = 0;
  for (let i = 0; i < 8 * HZ; i++) { m.step(); most = Math.max(most, m.board.count((it) => isCoin(it.kind))); }
  assert.ok(most <= 40, `coins during a shower: ${most}`);
});

test("AC25: snapshot and restore bring back the bank, timers and every body", () => {
  const m = machine();
  m.newBoard(4242);
  m.setAuto(true);
  run(m, 10);
  m.trigger("wide");
  const snap = JSON.parse(JSON.stringify(m.snapshot()));
  const m2 = machine({ progress: m.progress });
  m2.restore(snap);
  assert.equal(m2.bank, m.bank);
  assert.equal(m2.board.items.size, m.board.items.size);
  assert.equal(m2.wide, 10);
  assert.equal(m2.board.guttersClosed, true);
  assert.equal(m2.nudges, m.nudges);
  assert.ok(Math.abs(m2.board.phase - m.board.phase) < 1e-3);
  const a = [...m.board.items.values()], b = [...m2.board.items.values()];
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].kind, b[i].kind);
    assert.ok(Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, a[i].z - b[i].z) < 1e-3);
  }
  run(m2, 2);                                          // and it plays on
  assert.ok(m2.board.items.size > 0);
  assert.throws(() => m2.restore({ nonsense: true }));
});

test("AC26: corrupt or missing saved data falls back to a fresh start; old versions migrate", () => {
  const mem = (raw) => ({ getItem: () => raw, setItem() {}, removeItem() {} });
  for (const raw of [null, "", "{not json", "[]", "42", '{"v":1,"progress":"x","board":7}']) {
    const s = loadSave(mem(raw));
    assert.equal(s.v, SAVE_VERSION);
    assert.equal(s.progress.credits, 0);
    assert.equal(s.board, null);
  }
  // v0 (progress at the top level) keeps credits, upgrades, collections and settings.
  const v0 = { credits: 120, workshop: { nudges: 2, goldChance: 9 }, collection: { classic: { 0: "2026-10-01", 99: "x" } }, theme: "space", themes: { space: true }, settings: { sound: false } };
  const s0 = migrate(v0);
  assert.equal(s0.progress.credits, 120);
  assert.equal(s0.progress.workshop.nudges, 2);
  assert.equal(s0.progress.workshop.goldChance, 3, "levels are capped");
  assert.deepEqual(s0.progress.collection.classic, { 0: "2026-10-01" });
  assert.equal(s0.progress.theme, "space");
  assert.equal(s0.settings.sound, false);
  assert.equal(s0.board, null, "an old board isn't trusted");
  // Another config version: fresh board, credits and collections kept.
  const cur = freshSave();
  cur.progress.credits = 77; cur.progress.collection.candy = { 3: "2026-11-02" };
  cur.board = { board: { items: [] } }; cur.config = CONFIG.version + 1;
  const s1 = migrate(JSON.parse(JSON.stringify(cur)));
  assert.equal(s1.board, null);
  assert.equal(s1.progress.credits, 77);
  assert.deepEqual(s1.progress.collection.candy, { 3: "2026-11-02" });
  // A good save round-trips.
  cur.config = CONFIG.version;
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(cur))).board, cur.board);
  // Bad numbers are cleaned, not trusted.
  assert.equal(migrate({ v: 1, progress: { credits: -50 } }).progress.credits, 0);
  // A restore of a broken board snapshot throws, so the game starts a new board instead.
  const m = machine();
  assert.throws(() => m.restore({ board: { items: "x" } }));
});

test("Storage: without localStorage the game keeps playing in memory and says it can't save", () => {
  const st = makeStorage();                 // Node has no localStorage
  assert.equal(st.volatile, true);
  const s = freshSave();
  assert.equal(writeSave(st, s), false, "writeSave reports that nothing is kept");
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).v, SAVE_VERSION);
  const full = { getItem: () => null, setItem() { throw new Error("QuotaExceededError"); }, removeItem() {} };
  assert.equal(writeSave(full, s), false);
});

test("Determinism: a seed and the same input reproduce a board exactly", () => {
  const play = () => {
    const m = machine();
    m.newBoard(31337);
    for (let i = 0; i < 6 * HZ; i++) { if (i % 20 === 0) m.drop(-2 + (i % 100) / 25); m.step(); }
    return JSON.stringify(m.snapshot());
  };
  assert.equal(play(), play());
});

// ---- The pin wall machine ----------------------------------------------------------------------------------------
const PW = CONFIG.pinWall;

test("Pin wall: the aim picks one of the three slots, and a drop enters the wall there, never dead centre", () => {
  const m = empty({}); m.setType("pins");
  m.replenishT = -1e9; m.luckyAt = Infinity; m.figureT = -1e9;
  for (const [x, slot] of [[-9, PW.slots[0]], [-0.4, PW.slots[1]], [1.2, PW.slots[2]], [9, PW.slots[2]]]) {
    m.setAim(x);
    assert.equal(m.aim, slot);
  }
  m.bank = 10;
  m.setAim(0);
  assert.ok(m.drop());
  const [c] = [...m.board.inWall];
  assert.ok(c && c.wall && c.player, "the coin is in the wall");
  const off = Math.abs(c.x - PW.slots[1]);
  assert.ok(off >= PW.jitter[0] - 1e-9 && off <= PW.jitter[1] + 1e-9, `${off} from the slot's centre`);
  assert.ok(Math.abs(c.z - PW.z) < 1e-6 && Math.abs(c.y - PW.top) < 1e-6);
  assert.equal(m.bank, 9);
});

test("Pin wall: every coin comes out at the bottom within a few seconds, spread over the width, and none leaves the board", () => {
  const m = empty({}); m.setType("pins");
  m.bank = 1000;
  const out = [];
  m.emit = (t, d) => { if (t === "leaveWall") out.push(d.item); };
  // As fast as the rate limit allows, cycling through the slots.
  for (let i = 0; i < 40 * HZ; i++) {
    if (i % 15 === 0) { m.setAim(PW.slots[(i / 15) % 3]); m.drop(); }
    m.step();
    for (const it of m.board.inWall) {
      assert.ok(it.wallT < 6, `coin #${it.id} has been in the wall ${it.wallT.toFixed(1)} s`);
      assert.ok(Math.abs(it.z - PW.z) < 1e-3, "held in the wall's plane");
    }
  }
  run(m, 6);
  assert.equal(m.board.inWall.size, 0);
  assert.equal(m.slots.length, 0);
  assert.equal(out.filter((it) => it.player).length, m.progress.stats.dropped);   // (anti-stall sends free coins through the wall too)
  for (const it of m.board.items.values()) {
    assert.ok([it.x, it.y, it.z].every(Number.isFinite) && Math.abs(it.x) < B.width / 2 + 1.5 && it.y < 12, `${it.kind} #${it.id} at ${it.x}, ${it.y}, ${it.z}`);
  }
  // Where they come out: every part of the width, not just under the three slots.
  const bins = new Set(out.map((it) => Math.floor(it.x + B.width / 2)));
  assert.ok(bins.size >= 6, `coins left the wall over ${bins.size} of 7 coin-widths`);
});

test("Pin wall: a coin waits in its slot until the one before has fallen clear", () => {
  const m = empty({}); m.setType("pins");
  m.bank = 10; m.setAim(0);
  m.drop();
  m.time += 1;                                          // past the rate limit, but the first coin is still at the top
  m.drop();
  assert.equal(m.board.inWall.size, 1);
  assert.equal(m.slots.length, 1);
  assert.equal(m.inFlight(), 2, "the lifeline waits for a queued coin too");
  run(m, 1);
  assert.equal(m.slots.length, 0);
});

test("Pin wall: a board saved with coins in the wall and in the slot queue restores exactly", () => {
  const m = machine(); m.setType("pins");
  m.newBoard(99);
  m.bank = 20;
  m.setAim(PW.slots[0]); m.drop();
  m.time += 1; m.drop();
  run(m, 0.3);
  const snap = JSON.parse(JSON.stringify(m.snapshot()));
  assert.equal(snap.board.type, "pins");
  const m2 = machine();                                 // a classic machine: the snapshot switches it
  m2.restore(snap);
  assert.equal(m2.type, "pins");
  assert.equal(m2.board.inWall.size, m.board.inWall.size);
  assert.deepEqual(m2.slots, snap.slots);
  run(m2, 4);
  assert.equal(m2.board.inWall.size, 0, "restored coins fall on through the wall");
});

test("Save: an old save keeps playing the classic machine; a new one starts on the pin wall; a parked board survives", () => {
  assert.equal(freshSave().machine, CONFIG.defaultMachine);
  const old = freshSave(); delete old.machine; delete old.parked;
  old.board = { board: { items: [] } };
  assert.equal(migrate(JSON.parse(JSON.stringify(old))).machine, "classic");
  const s = freshSave();
  s.machine = "pins";
  s.board = { board: { type: "pins", items: [] } };
  s.parked = { classic: { board: { items: [] } }, pins: { board: { items: [] } }, bogus: 1 };
  const out = migrate(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(Object.keys(out.parked), ["classic"], "only the other machine's board is parked");
  assert.equal(migrate({ ...freshSave(), machine: "pachinko" }).machine, CONFIG.defaultMachine);
});

// ---- Honesty, config and text ------------------------------------------------------------------------------------
const sources = () => {
  const out = [];
  const walk = (dir) => { for (const f of readdirSync(dir, { withFileTypes: true })) f.isDirectory() ? walk(join(dir, f.name)) : /\.(js|html|css)$/.test(f.name) && out.push([f.name, readFileSync(join(dir, f.name), "utf8")]); };
  walk(GAME);
  return out;
};

test("AC27: no ads, trackers, network requests or real-money purchases in the game's code", () => {
  for (const [name, code] of sources()) {
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(name === "sw.js" ? "" : code), `${name} makes a network request`);
    assert.ok(!/https?:\/\//.test(code), `${name} links outside the app`);
    assert.ok(!/\b(adsense|admob|analytics|gtag|purchase\(|paymentrequest|in-app)\b/i.test(code), `${name} mentions ads, tracking or payments`);
  }
});

test("Pillar 5: game logic takes its numbers from the config", () => {
  const C = CONFIG;
  assert.equal(C.board.width, 7); assert.equal(C.board.depth, 10); assert.equal(C.board.stroke, 3); assert.equal(C.board.cycle, 2.4);
  assert.equal(C.coin.thickness, 0.12); assert.equal(C.start.coins, 60); assert.equal(C.board.maxCoins, 250);
  assert.equal(C.drop.minInterval, 0.25); assert.equal(C.drop.autoInterval, 0.8); assert.equal(C.drop.lifeline, 10);
  assert.equal(C.physics.hz, 60);
  // The rule files have no tuning literals for the values the spec names.
  for (const f of ["machine.js", "economy.js"]) {
    const code = readFileSync(join(GAME, "src", f), "utf8");
    for (const lit of ["0.25", "2.4", "250", "180", "0.04"]) assert.ok(!code.includes(lit), `${f} hard-codes ${lit}`);
  }
});

test("Text: every string exists in English and Dutch, and every prize has a name", () => {
  const dict = {};
  const I18n = { add: (d) => Object.assign(dict, d), apply() {} };
  vm.runInNewContext(readFileSync(join(GAME, "strings.js"), "utf8"), { I18n });
  assert.deepEqual(Object.keys(dict.en).sort(), Object.keys(dict.nl).sort());
  for (const t of THEME_IDS) {
    for (const c of ["red", "blue", "green", "yellow"]) assert.ok(dict.en[`gem.${t}.${c}`]);
    for (let i = 0; i < 8; i++) assert.ok(dict.en[`fig.${t}.${i}`]);
  }
  const used = new Set();
  for (const [, code] of sources()) for (const m of code.matchAll(/_t\("([\w.]+)"\s*[,)]/g)) used.add(m[1]);
  used.delete("key");                       // the example in the strings.js comment
  for (const k of used) assert.ok(k in dict.en, `missing text: ${k}`);
});
