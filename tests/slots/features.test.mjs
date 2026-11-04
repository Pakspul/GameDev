import test from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../../games/slots/src/engine/rng.js";
import { prepare } from "../../games/slots/src/engine/config.js";
import { resolveSpin } from "../../games/slots/src/engine/spin.js";
import { planFreeSpins, planHoldSpin, planPick, choiceSpins } from "../../games/slots/src/engine/features.js";
import { jackpotAmounts, initialPools, addContribution, resetTier } from "../../games/slots/src/engine/jackpot.js";
import { Session } from "../../games/slots/src/core/session.js";
import { MACHINE_IDS, loadMachine, clone, rigged, gridMachine } from "./helpers.mjs";

const G = "G"; // non-paying filler (a collect symbol) for feature fixtures
const jackpots = { mini: { type: "fixed", value: 20 }, minor: { type: "fixed", value: 50 }, major: { type: "progressive", seed: 250, contribution: 0.01 }, grand: { type: "progressive", seed: 1000, contribution: 0.02 } };
const awards = { 3: 10, 4: 15, 5: 20 };
const fsFeature = (extra = {}) => ({ freeSpins: { trigger: { symbol: "S", minCount: 3, awards }, retrigger: { enabled: true, spins: 5, cap: 20 }, modifiers: {}, ...extra } });
const hsFeature = (extra = {}) => ({ holdSpin: { trigger: { symbol: "K", count: 6 }, respins: 3, landChance: 0.5, gridFullGrand: true, coinValues: [{ value: 1, weight: 1 }], ...extra } });
const col = (...r) => r;
const empty = col(G, G, G);

// ---- free spins ---------------------------------------------------------------------------------
test("FS-01: 3, 4 or 5 scatters award 10, 15 or 20 free spins (config)", () => {
  for (const [count, spins] of [[3, 10], [4, 15], [5, 20]]) {
    const cols = Array.from({ length: 5 }, (_, r) => (r < count ? col("S", G, G) : empty));
    const cfg = gridMachine(cols, { features: fsFeature(), featureOrder: ["freeSpins"] }, G);
    const o = resolveSpin(prepare(cfg), rigged([0, 0, 0, 0, 0]), { bet: 3 });
    assert.deepEqual(o.features.map((f) => [f.type, f.spins, f.scatterCount]), [["freeSpins", spins, count]]);
  }
  const two = gridMachine(Array.from({ length: 5 }, (_, r) => (r < 2 ? col("S", G, G) : empty)), { features: fsFeature(), featureOrder: ["freeSpins"] }, G);
  assert.deepEqual(resolveSpin(prepare(two), rigged([0, 0, 0, 0, 0]), { bet: 3 }).features, []);
});

function fsMachine(patchFeature = {}, cfgPatch = {}) {
  // free strips: scatters on reels 1-3 every spin (9 per spin), plain filler elsewhere, so spins never pay lines
  const sFree = Array.from({ length: 12 }, () => "S");
  const fFree = Array.from({ length: 12 }, () => "C");
  const cols = Array.from({ length: 5 }, (_, r) => (r < 3 ? col("S", G, G) : empty));
  const cfg = gridMachine(cols, { features: fsFeature(patchFeature), featureOrder: ["freeSpins"], ...cfgPatch }, G);
  cfg.strips.free = [sFree, sFree, sFree, fFree, fFree];
  return cfg;
}

test("FS-03: retrigger adds spins, total spins are capped, and the max win cap ends the feature", () => {
  const cfg = fsMachine();
  const plan = planFreeSpins(prepare(cfg), new Rng(1), { bet: 3, spins: 10 });
  assert.equal(plan.spinsAwarded, 20); // 10 + 5 + 5, capped at 20
  assert.equal(plan.spinsPlayed, 20);
  assert.ok(plan.spins.some((s) => s.retrigger === 5));
  const capped = planFreeSpins(prepare(fsMachine({}, { maxWin: 100 })), new Rng(1), { bet: 3, spins: 10 });
  assert.equal(capped.capped, true);
  assert.equal(capped.totalWin, 300);
  assert.ok(capped.spinsPlayed < 10);
});

test("FS-02/06: free spins cost nothing and the total is credited only when the summary closes", () => {
  const cfg = fsMachine({ retrigger: { enabled: false } });
  const wallet = { balance: 1000 };
  const s = new Session(cfg, { rng: new Rng(5), wallet });
  s.state.queue.push({ type: "freeSpins", bet: 3, source: "scatter", spins: 4, scatterCount: 3, poolsSnap: {} });
  const f = s.nextFeature();
  assert.equal(f.plan.spinsAwarded, 4);
  assert.equal(wallet.balance, 1000); // nothing deducted
  const r = s.finishFeature();
  assert.equal(wallet.balance, 1000 + r.total);
  assert.equal(r.total, f.plan.spins.reduce((a, x) => a + x.win, 0));
  assert.equal(r.bet, 3); // played at the triggering bet
});

test("FS-05: global and progressive multipliers apply to every free spin", () => {
  const cfg = fsMachine({ retrigger: { enabled: false }, modifiers: { multiplier: 2, progressive: { per: "spin", start: 1, step: 1, max: 3 } } });
  const plan = planFreeSpins(prepare(cfg), new Rng(1), { bet: 3, spins: 5 });
  assert.deepEqual(plan.spins.map((s) => s.multiplier), [2, 4, 6, 6, 6]);
  const base = planFreeSpins(prepare(fsMachine({ retrigger: { enabled: false } })), new Rng(1), { bet: 3, spins: 1 });
  assert.equal(plan.spins[1].win, base.spins[0].win * 4);
});

test("FS-05: sticky wilds from earlier spins are kept for the whole feature and cleared when it ends", () => {
  const wildFree = [["W", ...Array(11).fill("C")], Array(12).fill("C"), Array(12).fill("C"), Array(12).fill("C"), Array(12).fill("C")];
  const cfg = fsMachine({ retrigger: { enabled: false }, modifiers: { stickyWilds: true } });
  cfg.strips.free = wildFree.map((s) => s.slice());
  const plan = planFreeSpins(prepare(cfg), new Rng(3), { bet: 3, spins: 6 });
  const counts = plan.spins.map((s) => Object.keys(s.outcome.sticky).length);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], "sticky wilds only accumulate");
  assert.ok(counts[counts.length - 1] >= 1);
  // a plan is a closed feature: the next one starts with no sticky wilds
  const next = planFreeSpins(prepare(cfg), new Rng(4), { bet: 3, spins: 1 });
  assert.ok(Object.keys(next.spins[0].outcome.sticky).length <= 1);
});

test("FS-04: a choice of options; options differ in spins and multiplier, scaled by the scatter count", () => {
  const choice = [{ id: "a", spins: 20, multiplier: 1 }, { id: "b", spins: 10, multiplier: 2 }, { id: "c", spins: 5, multiplier: 4 }];
  const cfg = fsMachine({ choice, choiceScale: { 3: 1, 4: 1.5, 5: 2 } });
  const prep = prepare(cfg);
  assert.deepEqual(choice.map((o) => choiceSpins(prep, o, 3)), [20, 10, 5]);
  assert.deepEqual(choice.map((o) => choiceSpins(prep, o, 5)), [40, 20, 10]);
  const s = new Session(cfg, { rng: new Rng(2), wallet: { balance: 100 } });
  s.state.queue.push({ type: "freeSpins", bet: 3, source: "scatter", spins: 10, scatterCount: 4, poolsSnap: {} });
  const f = s.nextFeature();
  assert.equal(f.phase, "choice");
  assert.deepEqual(f.options.map((o) => o.spins), [30, 15, 8]);
  s.chooseOption("b");
  assert.equal(s.state.feature.phase, "play");
  assert.equal(s.state.feature.plan.option.multiplier, 2);
  assert.ok(s.state.feature.plan.spins.every((x) => x.multiplier === 2));
});

// ---- Hold & Spin --------------------------------------------------------------------------------
function hsCols(count) {
  const cols = Array.from({ length: 5 }, () => [G, G, G]);
  for (let i = 0; i < count; i++) cols[Math.floor(i / 2)][i % 2] = "K";
  return cols;
}
const hsMachine = (count = 6, extra = {}) => gridMachine(hsCols(count), { features: hsFeature(extra), featureOrder: ["holdSpin"], jackpots }, G);

test("HS-01: 6 or more coin symbols trigger Hold & Spin and lock in place", () => {
  const prep = prepare(hsMachine(6));
  const o = resolveSpin(prep, rigged([0, 0, 0, 0, 0]), { bet: 3 });
  assert.equal(o.features[0].type, "holdSpin");
  assert.equal(o.features[0].coins.length, 6);
  assert.equal(resolveSpin(prepare(hsMachine(5)), rigged([0, 0, 0, 0, 0]), { bet: 3 }).features.length, 0);
});

const jp = { mini: 60, minor: 150, major: 750, grand: 3000 };
const startCoins = (n) => Array.from({ length: n }, (_, i) => ({ reel: Math.floor(i / 2), row: i % 2, value: 1 }));

test("HS-02: 3 respins; a new coin locks in and resets the respins to 3; only empty positions spin", () => {
  const prep = prepare(hsMachine());
  // exactly one coin lands on the first respin (the first empty cell), then nothing ever again
  const plan = planHoldSpin(prep, rigged([], [0, ...Array(200).fill(0.9)]), { bet: 3, coins: startCoins(6), jackpots: jp });
  assert.deepEqual(plan.steps.map((s) => s.respinsLeft), [3, 2, 1, 0]);
  assert.equal(plan.steps[0].reset, true);
  assert.equal(plan.steps[0].fresh.length, 1);
  assert.ok(!plan.steps[0].fresh.some((c) => c.reel < 3 && c.row < 2), "held positions never respin");
  assert.equal(plan.totalWin, 7 * 3);
});

test("HS-04: the feature ends when respins reach 0 or every position is filled; filling the grid pays the Grand", () => {
  const prep = prepare(hsMachine());
  const none = planHoldSpin(prep, rigged([], Array(200).fill(0.9)), { bet: 3, coins: startCoins(6), jackpots: jp });
  assert.equal(none.steps.length, 3);
  assert.equal(none.full, false);
  const full = planHoldSpin(prep, rigged([], Array(200).fill(0)), { bet: 3, coins: startCoins(6), jackpots: jp });
  assert.equal(full.full, true);
  assert.equal(full.steps.length, 1);
  assert.equal(full.collect[full.collect.length - 1].jackpot, "grand");
  assert.equal(full.totalWin, 15 * 3 + 3000); // every coin plus the Grand, in addition
  assert.deepEqual(full.jackpotsWon, ["grand"]);
});

test("HS-03/05: coins show values or jackpot labels; collection is one by one with a running total", () => {
  const prep = prepare(hsMachine(6, { coinValues: [{ value: 2, weight: 1 }, { jackpot: "mini", weight: 1 }] }));
  const coins = [{ reel: 0, row: 0, value: 2 }, { reel: 0, row: 1, jackpot: "mini" }, ...startCoins(6).slice(2)];
  const plan = planHoldSpin(prep, rigged([], Array(200).fill(0.9)), { bet: 3, coins, jackpots: jp });
  assert.equal(plan.collect[0].amount, 6); // 2 x bet
  assert.equal(plan.collect[1].amount, 60); // the Mini at this bet
  assert.equal(plan.collect[plan.collect.length - 1].running, plan.totalWin);
  assert.deepEqual(plan.jackpotsWon, ["mini"]);
});

test("JP-01/02/03: jackpots scale with the bet, progressives grow per spin, reset to the seed after a win, and the value shown is the value paid", () => {
  const cfg = hsMachine();
  const pools = initialPools(cfg);
  assert.deepEqual(pools, { major: 250, grand: 1000 });
  assert.deepEqual(jackpotAmounts(cfg, pools, 40), { mini: 800, minor: 2000, major: 10000, grand: 40000 });
  assert.deepEqual(jackpotAmounts(cfg, pools, 100), { mini: 2000, minor: 5000, major: 25000, grand: 100000 });
  addContribution(cfg, pools);
  assert.deepEqual(pools, { major: 250.01, grand: 1000.02 });
  const shown = jackpotAmounts(cfg, pools, 40).major;
  const prep = prepare(cfg);
  const plan = planHoldSpin(prep, rigged([], Array(200).fill(0.9)), { bet: 40, coins: [{ reel: 0, row: 0, jackpot: "major" }, ...startCoins(6).slice(1)], jackpots: jackpotAmounts(cfg, pools, 40) });
  assert.equal(plan.collect.find((c) => c.jackpot === "major").amount, shown);
  resetTier(cfg, pools, "major");
  assert.equal(pools.major, 250.01); // seed + the winning spin's own contribution
  assert.equal(pools.grand, 1000.02);
});

test("JP-03: a progressive is stored as a multiple of the bet, so changing the bet changes the display but not the pool", () => {
  const cfg = hsMachine();
  const s = new Session(cfg, { rng: new Rng(1), wallet: { balance: 1e6 } });
  const before = { ...s.state.pools };
  assert.equal(s.jackpots(30).major * 1, Math.floor(before.major * 30));
  s.setBet(30);
  assert.deepEqual(s.state.pools, before);
});

// ---- pick bonus -------------------------------------------------------------------------------------
const pick = () => loadMachine("neon-tumble");

test("PICK-01..03: prizes come from the configured pool, the first reveal is never Collect, and unpicked items show real draws", () => {
  const cfg = pick(), prep = prepare(cfg), rng = new Rng(11);
  const types = new Set(cfg.features.pick.pool.map((p) => p.type));
  for (let i = 0; i < 2000; i++) {
    const plan = planPick(prep, rng, { bet: 50, jackpots: jackpotAmounts(cfg, initialPools(cfg), 50) });
    assert.equal(plan.prizes.length, cfg.features.pick.items);
    assert.notEqual(plan.prizes[0].type, "collect");
    assert.ok(plan.prizes.every((p) => types.has(p.type)));
    assert.ok(plan.revealsUsed >= 1 && plan.revealsUsed <= plan.items);
    assert.equal(plan.totalWin, Math.min(cfg.maxWin * 50, plan.coins * 50 * plan.multiplier + plan.jackpot));
  }
});

test("PICK-03: expected value does not depend on which items the player taps", () => {
  const cfg = pick();
  const run = (order) => {
    const s = new Session(cfg, { rng: new Rng(77), wallet: { balance: 1e6 } });
    s.state.queue.push({ type: "pick", bet: 50, source: "scatter", poolsSnap: { ...s.state.pools } });
    const f = s.nextFeature();
    let i = 0;
    while (f.cursor < f.plan.revealsUsed) s.pickTile(order[i++]);
    return s.finishFeature().total;
  };
  const a = run([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const b = run([11, 4, 7, 0, 9, 2, 10, 1, 5, 3, 8, 6]);
  assert.equal(a, b);
  const s = new Session(cfg, { rng: new Rng(77), wallet: { balance: 1e6 } });
  s.state.queue.push({ type: "pick", bet: 50, source: "scatter", poolsSnap: { ...s.state.pools } });
  s.nextFeature();
  s.pickTile(3);
  assert.throws(() => s.pickTile(3), /already revealed/);
});

test("PICK-02: extra picks and multipliers work; Collect ends the bonus", () => {
  const cfg = pick(), prep = prepare(cfg);
  let seen = { extra: false, mult: false, collect: false };
  const rng = new Rng(5);
  for (let i = 0; i < 3000; i++) {
    const p = planPick(prep, rng, { bet: 50, jackpots: { mini: 1, minor: 1, major: 1, grand: 1 } });
    const used = p.prizes.slice(0, p.revealsUsed);
    if (used.some((x) => x.type === "extraPick")) seen.extra = true;
    if (used.some((x) => x.type === "multiplier")) seen.mult = true;
    if (used[used.length - 1].type === "collect") { seen.collect = true; assert.ok(p.revealsUsed <= p.items); }
  }
  assert.deepEqual(seen, { extra: true, mult: true, collect: true });
});

// ---- collection meter (PROG-03) -------------------------------------------------------------------------
function meterMachine(patch = {}) {
  const plain = col("C", "C", "C");
  const cols = [col("G", "K", "K"), plain, plain, plain, col("S", "K", "K")];
  return gridMachine(cols, { features: fsFeature(), featureOrder: ["freeSpins"], meter: { symbol: "G", target: 3, reward: { type: "freeSpins", spins: 6 } }, ...patch }, "K");
}

test("PROG-03: a full meter triggers its reward, scaled to the average bet while it was filling", () => {
  const spinAt = (s, bet) => { s.spin(bet); s.settle(); };
  // fill at the low bet, collect at the max bet: the reward is still played at the low bet
  const low = new Session(meterMachine(), { rng: rigged(Array(50).fill(0)), wallet: { balance: 1e5 } });
  spinAt(low, 3); spinAt(low, 3);
  assert.equal(low.state.meter.count, 2);
  low.spin(30);
  assert.equal(low.state.queue.length, 1);
  assert.equal(low.state.queue[0].source, "meter");
  assert.equal(low.state.queue[0].bet, 3);
  assert.deepEqual(low.state.meter, { count: 0, betSum: 0 });
  // the other way round: a high average pays at the high bet
  const high = new Session(meterMachine(), { rng: rigged(Array(50).fill(0)), wallet: { balance: 1e5 } });
  spinAt(high, 30); spinAt(high, 30);
  high.spin(3);
  assert.equal(high.state.queue[0].bet, 30);
  const f = (high.settle(), high.nextFeature());
  assert.equal(f.plan.spinsAwarded, 6);
});

test("PROG-03: meter progress is part of the saved state", () => {
  const s = new Session(meterMachine(), { rng: rigged(Array(10).fill(0)), wallet: { balance: 1e5 } });
  s.spin(3);
  const saved = JSON.parse(JSON.stringify(s.state));
  assert.equal(saved.meter.count, 1);
  assert.equal(saved.meter.betSum, 3);
});

// ---- session flow, interruption and replay -------------------------------------------------------------
test("REEL-01: tapping Spin deducts the bet; a spin cannot start without the balance or while one is running", () => {
  const cfg = loadMachine("crystal-fortune");
  const s = new Session(cfg, { rng: new Rng(1), wallet: { balance: 100 } });
  assert.equal(s.canSpin(40), true);
  const o = s.spin(40);
  assert.equal(s.balance, 60);
  assert.throws(() => s.spin(40), /Cannot spin/);
  assert.equal(s.settle(), o.totalWin);
  assert.equal(s.balance, 60 + o.totalWin);
  s.state.queue.length = 0;
  s.wallet.balance = 39;
  assert.equal(s.canSpin(40), false);
  assert.throws(() => s.spin(40));
  assert.throws(() => s.setBet(41), /Unknown bet/);
});

test("ECO-02: the bet can only change when idle", () => {
  const s = new Session(loadMachine("crystal-fortune"), { rng: new Rng(1), wallet: { balance: 1000 } });
  s.spin(40);
  assert.throws(() => s.setBet(100), /idle/);
});

test("PERS-02: a spin interrupted after the tap resolves with the same outcome (no re-roll)", () => {
  const cfg = loadMachine("crystal-fortune");
  const wallet = { balance: 1000 };
  const s = new Session(cfg, { rng: new Rng(1234), wallet });
  const o = s.spin(40);
  // the app is killed here: only the JSON of the profile survives
  const saved = JSON.parse(JSON.stringify({ wallet, state: s.state }));
  const resumed = new Session(cfg, { rng: new Rng(), wallet: saved.wallet, state: saved.state }); // a new random seed on launch
  assert.deepEqual(resumed.state.pending.outcome, o);
  assert.equal(resumed.balance, 1000 - 40);
  assert.equal(resumed.settle(), o.totalWin);
  assert.equal(resumed.balance, 1000 - 40 + o.totalWin);
});

test("PERS-02: a feature interrupted mid-way resumes at the same step with the same remaining spins and totals", () => {
  const cfg = loadMachine("crystal-fortune");
  const wallet = { balance: 1e6 };
  const s = new Session(cfg, { rng: new Rng(99), wallet });
  let f = null;
  for (let i = 0; i < 5000 && !f; i++) {
    s.spin(40); s.settle();
    if (s.hasFeature()) f = s.nextFeature();
  }
  assert.ok(f, "found a feature");
  s.stepDone(); s.stepDone();
  const saved = JSON.parse(JSON.stringify({ wallet, state: s.state }));
  const r = new Session(cfg, { rng: new Rng(), wallet: saved.wallet, state: saved.state });
  assert.equal(r.state.feature.cursor, 2);
  assert.deepEqual(r.state.feature.plan, f.plan);
  assert.equal(r.nextFeature(), r.state.feature); // continues the running feature rather than starting another
  const before = r.balance;
  assert.equal(r.finishFeature().total, f.plan.totalWin);
  assert.equal(r.balance, before + f.plan.totalWin);
});

for (const id of MACHINE_IDS) {
  test(`TOOL-04: a recorded ${id} session replays exactly from its seed and input log`, () => {
    const cfg = loadMachine(id);
    const s = new Session(cfg, { rng: new Rng("replay:" + id), wallet: { balance: 1e7 } });
    for (let i = 0; i < 3000; i++) {
      s.spin(s.cfg.betLevels[i % 3]); s.settle();
      while (s.hasFeature()) {
        const f = s.nextFeature();
        if (f.phase === "choice") s.chooseOption(f.options[i % f.options.length].id);
        if (f.type === "pick") while (f.cursor < f.plan.revealsUsed) s.pickTile(Object.keys(f.tiles).length);
        s.finishFeature();
      }
    }
    const copy = Session.replay(cfg, JSON.parse(JSON.stringify(s.log)));
    assert.equal(copy.balance, s.balance);
    assert.deepEqual(copy.state, s.state);
  });
}

// ---- fairness (FAIR-03) --------------------------------------------------------------------------------
test("FAIR-03: outcomes depend only on the machine config, the bet and the RNG, never on the player's state", () => {
  const cfg = loadMachine("crystal-fortune");
  const rich = new Session(cfg, { rng: new Rng(2026), wallet: { balance: 1e9 } });
  const poor = new Session(cfg, { rng: new Rng(2026), wallet: { balance: 40 * 600 } });
  for (let i = 0; i < 500; i++) {
    const a = rich.spin(40), b = poor.spin(40);
    assert.deepEqual(a, b);
    rich.settle(); poor.settle();
    while (rich.hasFeature()) { rich.nextFeature(); rich.finishFeature(); }
    while (poor.hasFeature()) { poor.nextFeature(); poor.finishFeature(); }
    poor.wallet.balance = 40 * 600 - (i % 7) * 40; // wildly different balances and histories along the way
  }
});
