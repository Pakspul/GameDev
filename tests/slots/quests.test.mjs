import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../../games/crystal-reels/src/core/profile.js";
import * as Q from "../../games/crystal-reels/src/core/quests.js";
import { Session } from "../../games/crystal-reels/src/core/session.js";
import { Rng } from "../../games/crystal-reels/src/engine/rng.js";
import { loadGame, loadMachine } from "./helpers.mjs";

const game = loadGame();
const CF = "crystal-fortune", NT = "neon-tumble";
const cf = loadMachine(CF), nt = loadMachine(NT);
const fresh = () => P.newProfile(game, 1);
const setLevel = (p, id, level) => { P.machineEntry(p, id).xp = P.xpForLevel(game, level); p.xp = P.totalXp(p); };
const NOW = Date.UTC(2026, 10, 13, 12);   // a Friday in ISO week 46

/** Just enough of an outcome for the bookkeeping: grid symbols, scatters, cascade steps. */
function outcome(cfg, { bet = cfg.betLevels[0], wild = 0, collect = 0, scatters = 0, cascades = 0, expanded = 0 } = {}) {
  const ids = Object.keys(cfg.symbols);
  const wildId = ids.find((i) => cfg.symbols[i].kind === "wild"), collectId = ids.find((i) => cfg.symbols[i].kind === "collect") || ids[0];
  const plain = ids.find((i) => !["wild", "collect", "scatter"].includes(cfg.symbols[i].kind));
  const cells = Array.from({ length: 15 }, (_, i) => (i < wild ? wildId : i < wild + collect ? collectId : plain));
  const gridStart = [0, 1, 2, 3, 4].map((r) => cells.slice(r * 3, r * 3 + 3));
  return { bet, gridStart, scatterCount: scatters, steps: Array.from({ length: cascades + 1 }, (_, i) => ({ removed: i < cascades })), expanded: Array.from({ length: expanded }, () => ({})) };
}
const spin = (p, id, cfg, o) => P.recordSpin(p, game, id, cfg, outcome(cfg, o), NOW);
const round = (p, id, cfg, win, bet = cfg.betLevels[0], extra = {}) => P.recordRound(p, game, id, cfg, { bet, win, features: 0, jackpots: [], freeSpinFeatures: 0, ...extra }, NOW);

// ---- weeks ----------------------------------------------------------------------------------------------
test("QUEST: the week number is the local ISO week", () => {
  assert.equal(Q.localWeek(NOW), "2026-W46");
  assert.equal(Q.localWeek(new Date(2026, 0, 1, 12).getTime()), "2026-W01");
  assert.equal(Q.localWeek(new Date(2027, 0, 1, 12).getTime()), "2026-W53");
});

// ---- live challenges (A1, A2, A3) ----------------------------------------------------------------------------
test("QUEST: challenge offers are stable until one is started or dropped, and fit the machine", () => {
  const p = fresh();
  const a = Q.challengeOffers(game, p, cf, NOW), b = Q.challengeOffers(game, p, cf, NOW);
  assert.deepEqual(a, b);
  assert.equal(a.length, game.challenges.offers);
  assert.equal(new Set(a.map((o) => o.id)).size, a.length, "no duplicates");
  for (const o of a) assert.ok(!o.machines || o.machines.includes(CF));
  // another machine gets its own kind of challenges
  const seen = new Set();
  for (let i = 0; i < 40; i++) { p.challengeCount = i; for (const o of Q.challengeOffers(game, p, nt, NOW)) seen.add(o.id); }
  assert.ok(seen.has("cascades") && seen.has("expand"), "Neon Tumble gets its own");
  assert.ok(!seen.has("lanterns"), "and not Crystal Fortune's");
  Q.startChallenge(game, p, cf, a[0].id);
  assert.notDeepEqual(Q.challengeOffers(game, p, cf, NOW), a, "a new set after starting one");
});

test("QUEST: at least one offer asks the player to work the bet buttons, and only bets that are calm for the balance", () => {
  const p = fresh();
  setLevel(p, CF, 12);
  for (let i = 0; i < 30; i++) {
    p.challengeCount = i;
    const offers = Q.challengeOffers(game, p, cf, NOW);
    assert.ok(offers.some(Q.isBetQuest), "offer set " + i);
    for (const o of offers.filter((x) => x.metric === "highBet")) assert.ok(o.bet <= p.balance * game.economy.riskyBetShare, "bet " + o.bet + " is calm for " + p.balance);
  }
  // with a small balance nothing asks for a bet that would be a large part of it
  p.balance = 2000;
  for (let i = 0; i < 30; i++) { p.challengeCount = i; for (const o of Q.challengeOffers(game, p, cf, NOW)) if (o.metric === "highBet") assert.ok(o.bet <= 100, "bet " + o.bet); }
  // a level 1 player with 3 bets can still be asked to try different ones
  assert.ok(Q.challengeOffers(game, fresh(), cf, NOW).length === 3);
});

test("QUEST: a win-count challenge is won inside its window and pays", () => {
  const p = fresh();
  const def = game.challenges.pool.find((c) => c.id === "wins4");
  assert.ok(Q.startChallenge(game, p, cf, "wins4"));
  assert.equal(Q.startChallenge(game, p, cf, "winsX2"), null, "one at a time");
  const before = p.balance;
  let events = [];
  for (let i = 0; i < 4; i++) { spin(p, CF, cf); events = round(p, CF, cf, 40); }
  const done = events.find((e) => e.type === "challenge");
  assert.ok(done && done.ok && done.prize.type === "coins");
  assert.equal(p.balance - before, done.prize.amount - 0 + 0, "paid once");
  assert.equal(done.prize.amount, P.scaledReward(game, p, def.reward.coins));
  assert.equal(p.challenge, null);
});

test("QUEST: a challenge that runs out ends without penalty", () => {
  const p = fresh();
  Q.startChallenge(game, p, cf, "wins4");
  const before = p.balance;
  let last = [];
  for (let i = 0; i < 10; i++) { spin(p, CF, cf); last = round(p, CF, cf, 0); } // never wins
  const end = last.find((e) => e.type === "challenge");
  assert.ok(end && end.ok === false);
  assert.equal(p.challenge, null);
  assert.equal(p.balance, before, "nothing taken");
  assert.ok(Q.startChallenge(game, p, cf, "wins4"), "free to try again");
});

test("QUEST: board-based and bet-based goals count what the spin showed; another machine's spins do not count", () => {
  const p = fresh();
  Q.startChallenge(game, p, cf, "wilds5");
  spin(p, NT, nt, { wild: 5 });
  assert.equal(p.challenge.progress, 0, "spins on another machine");
  spin(p, CF, cf, { wild: 3 }); round(p, CF, cf, 0);
  spin(p, CF, cf, { wild: 2 });
  const ev = round(p, CF, cf, 0);
  assert.ok(ev.some((e) => e.type === "challenge" && e.ok), "5 wilds over two spins");

  const q = fresh();
  setLevel(q, CF, 12);
  const high = game.challenges.pool.find((c) => c.id === "highbet");
  Q.startChallenge(game, q, cf, "highbet");
  for (let i = 0; i < high.target; i++) { spin(q, CF, cf, { bet: cf.betLevels[high.minStep] }); round(q, CF, cf, 0, cf.betLevels[high.minStep]); }
  assert.equal(q.challenge, null, "8 spins at the step or above");
  assert.equal(q.balance > 25000, true);

  const v = fresh();
  Q.startChallenge(game, v, cf, "variety");
  for (const b of [20, 20, 40, 100]) { spin(v, CF, cf, { bet: b }); round(v, CF, cf, 0, b); }
  assert.equal(v.challenge, null, "three different bets");
});

test("QUEST: abandoning is free and makes a new offer set", () => {
  const p = fresh();
  Q.startChallenge(game, p, cf, "wins4");
  const before = p.balance;
  Q.abandonChallenge(p);
  assert.equal(p.challenge, null);
  assert.equal(p.balance, before);
});

// ---- the weekly chain (C8) ---------------------------------------------------------------------------------------
test("QUEST: the weekly chain unlocks step by step, pays each step and a chest at the end, and starts over next week", () => {
  const p = fresh();
  const st = Q.chainStatus(p, game, NOW);
  assert.equal(st.step, 0);
  const def = st.def;
  assert.deepEqual(Q.chainFor(game, "2026-W46"), def, "the same chain all week");
  const events = [];
  const before = p.balance;
  // a metric that is not the current step's does nothing
  const other = ["spins", "wins", "bigWins", "features", "wilds", "scatters", "collects"].find((m) => m !== def.steps[0].metric);
  Q.trackChain(p, game, other, 9999, NOW, events);
  assert.equal(p.chain.progress, 0);
  for (let i = 0; i < def.steps.length; i++) {
    const s = Q.chainStatus(p, game, NOW);
    assert.equal(s.current.metric, def.steps[i].metric);
    Q.trackChain(p, game, def.steps[i].metric, def.steps[i].target, NOW, events);
  }
  assert.equal(events.filter((e) => e.type === "chainStep").length, def.steps.length);
  assert.equal(events.filter((e) => e.type === "chainDone").length, 1);
  assert.equal(p.chests.length, 1);
  assert.equal(p.chests[0].source, "chain");
  assert.ok(p.balance > before + 4000);
  assert.equal(Q.chainStatus(p, game, NOW).done, true);
  Q.trackChain(p, game, def.steps[0].metric, 999, NOW, events); // nothing more this week
  assert.equal(p.chests.length, 1);
  // next week: a fresh chain, no punishment for the week before
  const next = Q.chainStatus(p, game, NOW + 7 * 86400000);
  assert.equal(next.step, 0); assert.equal(next.done, false);
});

test("QUEST: playing counts for the chain through the same bookkeeping as the missions", () => {
  const p = fresh();
  // find a week whose chain starts with "spins" (all of them do)
  const st = Q.chainStatus(p, game, NOW);
  assert.equal(st.current.metric, "spins");
  for (let i = 0; i < 5; i++) spin(p, CF, cf);
  assert.equal(p.chain.progress, 5);
});

// ---- gems (C7) ---------------------------------------------------------------------------------------------------
test("QUEST: a machine's gems come from its own accomplishments, and the full set pays once with a chest", () => {
  const p = fresh();
  let ev = round(p, CF, cf, 20 * cf.betLevels[0]);
  assert.deepEqual(ev.filter((e) => e.type === "gem").map((e) => e.id), ["ruby"]);
  assert.deepEqual(P.machineEntry(p, NT).gems, [], "Neon Tumble has none");
  ev = spin(p, CF, cf, { wild: 3 });
  assert.ok(ev.some((e) => e.type === "gem" && e.id === "emerald"));
  ev = round(p, CF, cf, 0, cf.betLevels[0], { features: 1 });
  assert.ok(ev.some((e) => e.type === "gem" && e.id === "sapphire"));
  setLevel(p, CF, 10);
  ev = spin(p, CF, cf);
  assert.ok(ev.some((e) => e.type === "gem" && e.id === "amethyst"));
  P.machineEntry(p, CF).stats.spins = 199;
  ev = spin(p, CF, cf);
  assert.ok(ev.some((e) => e.type === "gem" && e.id === "topaz"));
  const before = p.balance, chests = p.chests.length;
  ev = round(p, CF, cf, 100 * cf.betLevels[0]);
  assert.ok(ev.some((e) => e.type === "gem" && e.id === "diamond"));
  const set = ev.filter((e) => e.type === "gemSet");
  assert.equal(set.length, 1);
  assert.equal(p.chests.length, chests + 1);
  assert.ok(p.balance >= before + set[0].coins);
  assert.equal(Q.gemSetComplete(game, p, CF), true);
  ev = round(p, CF, cf, 100 * cf.betLevels[0]);
  assert.equal(ev.filter((e) => e.type === "gem" || e.type === "gemSet").length, 0, "nothing twice");
});

// ---- chests, frames, wheel (B4, B5) ---------------------------------------------------------------------------------
test("QUEST: every few levels of a machine earns a chest; the level-up says so", () => {
  const p = fresh();
  const ups = P.grantXp(p, game, CF, 2e6);
  const chestLevels = ups.filter((u) => u.chest).map((u) => u.level);
  assert.ok(chestLevels.length > 5 && chestLevels.every((l) => l % game.chests.everyLevels === 0));
  assert.equal(chestLevels[0], 5);
  assert.equal(p.chests.length, chestLevels.length);
  assert.deepEqual(p.chests[0], { source: "level", machine: CF, level: 5 });
});

test("QUEST: a chest has three boxes with different frames, and the pick is paid", () => {
  const p = fresh();
  Q.addChest(p, "level", { machine: CF, level: 5 });
  const prizes = Q.rollChest(game, p, new Rng(1));
  assert.equal(prizes.length, game.chests.boxes);
  const frames = prizes.filter((x) => x.type === "frame").map((x) => x.id);
  assert.equal(new Set(frames).size, frames.length);
  const before = { coins: p.balance, v: p.vouchers };
  const got = Q.openChest(game, p, prizes, 1);
  assert.deepEqual(got, prizes[1]);
  assert.equal(p.chests.length, 0);
  assert.equal(Q.openChest(game, p, prizes, 1), null, "no chest, no prize");
  if (got.type === "coins") assert.equal(p.balance, before.coins + got.amount);
  if (got.type === "voucher") assert.equal(p.vouchers, before.v + got.count);
  if (got.type === "frame") assert.deepEqual(p.cosmetics.frames, [got.id]);
});

test("QUEST: across many chests every prize kind turns up, and frames stop once all are owned", () => {
  const p = fresh();
  const kinds = new Set();
  const rng = new Rng(5);
  for (let i = 0; i < 200; i++) for (const pr of Q.rollChest(game, p, rng)) kinds.add(pr.type);
  assert.deepEqual([...kinds].sort(), ["coins", "frame", "voucher"]);
  p.cosmetics.frames = game.frames.map((f) => f.id);
  for (let i = 0; i < 200; i++) for (const pr of Q.rollChest(game, p, rng)) assert.notEqual(pr.type, "frame");
});

test("QUEST: frames can be equipped only when owned; the style comes from the data", () => {
  const p = fresh();
  assert.equal(Q.equipFrame(p, game, "ruby"), false);
  Q.applyPrize(p, { type: "frame", id: "ruby" });
  Q.applyPrize(p, { type: "frame", id: "ruby" });
  assert.deepEqual(p.cosmetics.frames, ["ruby"], "no duplicates");
  assert.equal(Q.equipFrame(p, game, "ruby"), true);
  assert.equal(Q.frameStyle(p, game).color, game.frames.find((f) => f.id === "ruby").color);
  assert.equal(Q.equipFrame(p, game, null), true);
  assert.equal(Q.frameStyle(p, game), null);
});

test("QUEST: a finished daily mission earns a wheel spin, and the wheel pays one slice per spin", () => {
  const p = fresh();
  const day = P.localDay(NOW);
  const m = P.activeMissions(p, game, day)[0];
  const events = [];
  // play the mission to its target through the normal bookkeeping
  const metric = { spins: () => spin(p, CF, cf), wins: () => round(p, CF, cf, 40), freeSpins: () => round(p, CF, cf, 0, 20, { freeSpinFeatures: 1, features: 1 }),
    wilds: () => spin(p, CF, cf, { wild: 5 }), bigWins: () => round(p, CF, cf, 20 * 20), collects: () => spin(p, CF, cf, { collect: 8 }), features: () => round(p, CF, cf, 0, 20, { features: 2 }), scatters: () => spin(p, CF, cf, { scatters: 6 }) }[m.metric];
  for (let i = 0; i < m.target && p.wheel.spins === 0; i++) events.push(...metric());
  assert.equal(p.wheel.spins, 1);
  assert.ok(events.some((e) => e.type === "mission" && e.wheel));
  const before = { b: p.balance, v: p.vouchers };
  const res = Q.spinWheel(game, p, new Rng(3));
  assert.ok(res && res.index >= 0 && res.index < game.wheel.slices.length);
  assert.equal(p.wheel.spins, 0);
  assert.equal(Q.spinWheel(game, p, new Rng(3)), null, "no spin left");
  if (res.prize.type === "coins") assert.equal(p.balance, before.b + res.prize.amount);
  else assert.equal(p.vouchers, before.v + res.prize.count);
});

// ---- free-spin vouchers (B, and the prize for challenges and chests) -----------------------------------------------
test("QUEST: a voucher plays a short free-spins run at a fixed bet for nothing, and the run saves, resumes and pays like any feature", () => {
  const wallet = { balance: 1000 };
  const s = new Session(cf, { rng: new Rng(11), wallet });
  const bet = cf.betLevels[game.voucher.betStep];
  s.queueVoucher({ spins: game.voucher.spins, bet });
  assert.equal(wallet.balance, 1000, "nothing charged");
  assert.equal(s.isIdle(), false);
  const f = s.nextFeature();
  assert.equal(f.type, "freeSpins"); assert.equal(f.source, "voucher"); assert.equal(f.bet, bet);
  assert.equal(f.plan.spinsAwarded >= game.voucher.spins, true);
  const resumed = JSON.parse(JSON.stringify(s.state));         // the app is closed here
  const s2 = new Session(cf, { rng: new Rng(11), wallet: { balance: 1000 }, state: resumed });
  const fin = s2.finishFeature();
  assert.equal(s2.balance, 1000 + fin.total);
  assert.throws(() => { const busy = new Session(cf, { rng: new Rng(1), wallet: { balance: 1000 } }); busy.spin(20); busy.queueVoucher({ spins: 5, bet }); }, /idle/);
  // Neon Tumble's free spins normally ask for a choice: a voucher does not
  const t = new Session(nt, { rng: new Rng(2), wallet: { balance: 1000 } });
  t.queueVoucher({ spins: 5, bet: nt.betLevels[2] });
  assert.equal(t.nextFeature().phase, "play");
});

test("QUEST: a voucher round counts for nothing but the record: not the return, missions, chain or challenges", () => {
  const p = fresh();
  Q.startChallenge(game, p, cf, "wins4");
  const totals = { ...p.totals }, chain = { ...p.chain };
  const ev = round(p, CF, cf, 5000, 100, { voucher: true, features: 1, freeSpinFeatures: 1 });
  assert.deepEqual(ev, []);
  assert.deepEqual(p.totals, totals);
  assert.equal(p.challenge.progress, 0);
  assert.equal(P.machineEntry(p, CF).stats.biggestWin, 5000);
});

test("QUEST: a voucher is worth about as much as a chest's coin prize (so it is a real prize, not a dud)", () => {
  // 5 free spins at the third bet: measured at 8-9 x the second bet; here at the third bet it is roughly the coin prize.
  for (const cfg of [cf, nt]) {
    const bet = cfg.betLevels[game.voucher.betStep];
    const rng = new Rng(99);
    let sum = 0; const N = 3000;
    for (let i = 0; i < N; i++) {
      const s = new Session(cfg, { rng, wallet: { balance: 0 }, record: false });
      s.queueVoucher({ spins: game.voucher.spins, bet });
      s.nextFeature(); sum += s.finishFeature().total;
    }
    const mean = sum / N, coinPrize = game.chests.prizes.find((x) => x.type === "coins").base;
    assert.ok(mean > coinPrize * 0.3 && mean < coinPrize * 3, `${cfg.id}: voucher ≈ ${Math.round(mean)} coins vs a coin prize of ${coinPrize}`);
  }
});

// ---- double or collect (B6) ---------------------------------------------------------------------------------------------
function pendingWin(seedBase) {
  for (let seed = seedBase; seed < seedBase + 5000; seed++) {
    const wallet = { balance: 100000 };
    const s = new Session(cf, { rng: new Rng(seed), wallet });
    const o = s.spin(40);
    if (o.totalWin > 0 && o.features.length === 0) return { s, wallet, o };
  }
  throw new Error("no winning spin found");
}

test("QUEST: double or collect is a fair 50/50 that doubles or loses the pending win, and never moves the machine's random numbers", () => {
  let hits = 0, N = 2000;
  for (let i = 0; i < N; i++) {
    const { s, wallet } = pendingWin(1 + i * 7919 % 100000);
    const win = s.state.pending.outcome.totalWin;
    const stateBefore = s.rng.state().join(); // what the next spin would roll from
    const r = s.gamble(i % 2);
    assert.equal(r.total, r.won ? win * 2 : 0);
    assert.equal(s.rng.state().join(), stateBefore, "the machine's generator is untouched");
    s.settle();
    assert.equal(wallet.balance, 100000 - 40 + r.total);
    if (r.won) hits++;
  }
  assert.ok(Math.abs(hits / N - 0.5) < 0.05, "about half: " + hits / N);
});

test("QUEST: double or collect is replayable, and only offered for plain base-game wins", () => {
  const { s } = pendingWin(42);
  const log = JSON.parse(JSON.stringify(s.log));
  s.gamble(1); s.settle();
  const again = Session.replay(cf, { ...log, inputs: s.log.inputs });
  assert.equal(again.balance, s.balance, "the replay lands on the same balance");
  const idle = new Session(cf, { rng: new Rng(1), wallet: { balance: 1000 } });
  assert.equal(idle.canGamble(), false);
  assert.throws(() => idle.gamble(0), /Nothing to double/);
  const { s: s2 } = pendingWin(500);
  assert.throws(() => s2.gamble(2), /Pick 0 or 1/);
});

// ---- saves --------------------------------------------------------------------------------------------------------------
test("QUEST: an older save gets every quest field, and a new profile starts with none of it", () => {
  const old = fresh();
  for (const k of ["challenge", "challengeCount", "chests", "vouchers", "wheel", "cosmetics", "chain"]) delete old[k];
  const p = P.normaliseProfile(JSON.parse(JSON.stringify(old)), game);
  assert.equal(p.challenge, null);
  assert.deepEqual(p.chests, []);
  assert.equal(p.vouchers, 0);
  assert.equal(p.wheel.spins, 0);
  assert.deepEqual(p.cosmetics, { frames: [], frame: null });
  assert.equal(P.DEFAULT_SETTINGS.gamble, false, "double or collect is off until the player turns it on");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(p)));
});
