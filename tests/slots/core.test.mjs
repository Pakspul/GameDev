import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { formatCoins, formatCompact, formatDuration } from "../../games/crystal-reels/src/core/format.js";
import { SpinStateMachine, ACCEPTS, STATES } from "../../games/crystal-reels/src/core/state-machine.js";
import { SaveStore, SAVE_VERSION, migrate, checksum } from "../../games/crystal-reels/src/core/save.js";
import * as P from "../../games/crystal-reels/src/core/profile.js";
import { tierOf } from "../../games/crystal-reels/src/engine/tiers.js";
import { loadGame, loadMachine, SLOTS, MACHINE_IDS } from "./helpers.mjs";

const game = loadGame();

// ---- formatting (WIN-04) ----------------------------------------------------------------------------
test("WIN-04: numbers follow the locale (1.000 in Dutch, 1,000 in English)", () => {
  assert.equal(formatCoins(1000, "en"), "1,000");
  assert.equal(formatCoins(1234567, "nl"), "1.234.567");
  assert.equal(formatCoins(1234567, "en"), "1,234,567");
});

test("WIN-04: amounts from 1,000,000 are abbreviated in compact fields and shown in full otherwise", () => {
  assert.equal(formatCompact(1250000, "en"), "1.25M");
  assert.equal(formatCompact(1250000, "nl"), "1,25M");
  assert.equal(formatCompact(999999, "en"), "999,999");
  assert.equal(formatCompact(3000000, "en"), "3M");
  assert.equal(formatCompact(2500000000, "en"), "2.5B");
  assert.equal(formatDuration(65000), "1:05");
  assert.equal(formatDuration(3725000), "1:02:05");
});

// ---- celebration tiers (WIN-01) --------------------------------------------------------------------------
test("WIN-01: tiers follow the win divided by the bet, using the config thresholds", () => {
  const cfg = loadMachine("crystal-fortune");
  const t = (x) => tierOf(cfg, x);
  assert.deepEqual([0, 0.5, 0.99, 1, 9.99, 10, 24.9, 25, 49.9, 50, 4000].map(t),
    ["none", "below", "below", "win", "win", "big", "big", "mega", "mega", "epic", "epic"]);
});

// ---- spin state machine (REEL-06) --------------------------------------------------------------------------
test("REEL-06: each state accepts a defined set of inputs, everything else is ignored", () => {
  const m = new SpinStateMachine();
  assert.ok(m.accepts("spin") && m.accepts("bet") && m.accepts("nav") && m.accepts("autoplay"));
  assert.equal(m.accepts("slam"), false);
  m.to("spinning");
  // REEL-01: while reels spin, bet controls, lobby navigation and menus are disabled
  for (const blocked of ["bet", "nav", "menu", "autoplay", "info"]) assert.equal(m.accepts(blocked), false, blocked);
  assert.ok(m.accepts("slam") && m.accepts("spin"));
  assert.equal(m.handle("bet"), false);
  assert.equal(m.state, "spinning"); // an ignored input changes nothing and is not queued
});

test("REEL-06: the only legal path is Idle -> Spinning -> Stopping -> Evaluating -> Presenting -> (Feature) -> Idle", () => {
  const m = new SpinStateMachine();
  assert.throws(() => m.to("presenting"));
  for (const s of ["spinning", "stopping", "evaluating", "presenting", "feature", "idle"]) m.to(s);
  m.to("spinning"); m.to("stopping"); m.to("evaluating"); m.to("presenting"); m.to("idle");
  assert.throws(() => m.to("stopping"));
  assert.deepEqual(Object.keys(ACCEPTS), STATES);
});

test("REEL-06: the state can be persisted and restored; an unknown state falls back to idle", () => {
  const m = new SpinStateMachine("presenting");
  assert.equal(SpinStateMachine.from(JSON.parse(JSON.stringify(m))).state, "presenting");
  assert.equal(SpinStateMachine.from({ state: "bogus" }).state, "idle");
  const seen = [];
  m.onChange((to, from) => seen.push([from, to]));
  m.reset();
  assert.deepEqual(seen, [["presenting", "idle"]]);
});

// ---- saving (PERS-01, PERS-05) ----------------------------------------------------------------------------
class FakeStorage {
  constructor() { this.map = new Map(); this.failNext = false; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (this.failNext) { this.failNext = false; throw new Error("quota"); } this.map.set(k, v); }
  removeItem(k) { this.map.delete(k); }
}

test("PERS-01: a save round-trips, and a fresh store has nothing", () => {
  const st = new FakeStorage(), store = new SaveStore(st);
  assert.deepEqual(store.load(), { profile: null, recovered: false, corrupt: false, migrated: false });
  const p = P.newProfile(game, 1);
  p.balance = 777;
  assert.equal(store.save(p), true);
  assert.equal(new SaveStore(st).load().profile.balance, 777);
});

test("PERS-01: saves are atomic: a crash during a save leaves the previous save intact", () => {
  const st = new FakeStorage(), store = new SaveStore(st);
  const p = P.newProfile(game, 1);
  p.balance = 100; store.save(p);
  p.balance = 200; store.save(p);
  // a save that dies half way: the slot it was writing holds a truncated string
  const store2 = new SaveStore(st); store2.load();
  const slot = store2._slotKey(store2._next);
  st.setItem(slot, '{"v":1,"seq":99,"sum":"deadbeef","data":"{\\"balan');
  const r = new SaveStore(st).load();
  assert.equal(r.profile.balance, 200);
  assert.equal(r.recovered, true); // the game tells the player
  // and a failed write (storage full) reports false without damaging anything
  st.failNext = true;
  assert.equal(store.save(p), false);
  assert.equal(new SaveStore(st).load().profile.balance, 200);
});

test("PERS-05: a corrupted newest save falls back to the previous valid backup", () => {
  const st = new FakeStorage(), store = new SaveStore(st);
  const p = P.newProfile(game, 1);
  for (const b of [1, 2, 3]) { p.balance = b; store.save(p); }
  const newest = [0, 1].map((i) => ({ i, raw: st.getItem(store._slotKey(i)) })).sort((a, b) => JSON.parse(b.raw).seq - JSON.parse(a.raw).seq)[0];
  st.setItem(store._slotKey(newest.i), newest.raw.replace(/balance/, "balanc3")); // flips content, checksum no longer matches
  const r = new SaveStore(st).load();
  assert.equal(r.profile.balance, 2);
  assert.equal(r.recovered, true);
  // both broken: start fresh and say so
  st.setItem(store._slotKey(0), "garbage"); st.setItem(store._slotKey(1), "{}");
  const none = new SaveStore(st).load();
  assert.equal(none.profile, null);
  assert.equal(none.corrupt, true);
});

test("PERS-05: the save carries a version, and every older version migrates", () => {
  const st = new FakeStorage(), store = new SaveStore(st);
  store.save(P.newProfile(game, 1));
  assert.equal(JSON.parse(JSON.parse(st.getItem(store._slotKey(0))).data).v, SAVE_VERSION);
  const old = { coins: 4321, settings: { musicVolume: 0.3 } }; // the version-0 prototype format
  const up = migrate(old);
  assert.equal(up.v, SAVE_VERSION);
  assert.equal(up.balance, 4321);
  assert.equal(up.coins, undefined);
  assert.equal(up.settings.musicVolume, 0.3);
  assert.deepEqual(up.totals, { wagered: 0, won: 0, spins: 0 });
  // an old save in storage is migrated on load
  const data = JSON.stringify(old);
  st.setItem(store._slotKey(1), JSON.stringify({ v: 0, seq: 50, sum: checksum(data), data }));
  const r = new SaveStore(st).load();
  assert.equal(r.migrated, true);
  assert.equal(r.profile.balance, 4321);
  assert.equal(P.normaliseProfile(r.profile, game).missions.done.length, 0);
  // a save from a NEWER game is never half-understood
  assert.equal(migrate({ v: SAVE_VERSION + 1 }), null);
});

test("PERS-04: resetting progress removes the saves", () => {
  const st = new FakeStorage(), store = new SaveStore(st);
  store.save(P.newProfile(game, 1));
  store.clear();
  assert.equal(new SaveStore(st).load().profile, null);
});

// ---- levels and XP (PROG-01) -----------------------------------------------------------------------------
const CF = "crystal-fortune", NT = "neon-tumble";
const setXp = (p, id, xp) => { P.machineEntry(p, id).xp = xp; p.xp = P.totalXp(p); };
const setLevel = (p, id, level) => setXp(p, id, P.xpForLevel(game, level));

test("PROG-01: each spin awards XP to its own machine, proportional to the bet; level-ups grant their rewards", () => {
  const p = P.newProfile(game, 1);
  assert.equal(P.machineLevel(game, p, CF), 1);
  const ups = P.grantXp(p, game, CF, 40);
  assert.equal(P.machineXp(p, CF), 40 * game.xp.perCoinBet);
  assert.deepEqual(ups, []);
  const p2 = P.newProfile(game, 1);
  P.grantXp(p2, game, CF, 100); P.grantXp(p2, game, CF, 200);
  assert.equal(P.machineXp(p2, CF), 15); // proportional
  const before = p.balance;
  setXp(p, CF, game.xp.thresholds[1] - 1);
  const up = P.grantXp(p, game, CF, 40);
  assert.equal(up.length, 1);
  assert.equal(up[0].level, 2);
  assert.equal(up[0].machine, CF);
  assert.equal(p.balance, before + P.scaledReward(game, p, game.xp.rewards["2"].coins, 2)); // ECO-07: scaled by the level reached
  assert.ok(P.xpProgress(game, P.machineXp(p, CF)).fraction >= 0);
  assert.ok(game.xp.thresholds.every((t, i, a) => i === 0 || t > a[i - 1]), "thresholds ascend");
});

test("PROG-01: every machine has its own level; XP on one machine never moves another", () => {
  const p = P.newProfile(game, 1);
  setLevel(p, CF, 12);
  assert.equal(P.machineLevel(game, p, CF), 12);
  assert.equal(P.machineLevel(game, p, NT), 1, "Neon Tumble is still level 1");
  P.grantXp(p, game, NT, 100);
  assert.equal(P.machineXp(p, NT), 100 * game.xp.perCoinBet);
  assert.equal(P.machineLevel(game, p, CF), 12);
  assert.equal(p.xp, P.totalXp(p), "the profile total is the sum over the machines");
  assert.equal(p.xp, P.xpForLevel(game, 12) + 100 * game.xp.perCoinBet);
  assert.equal(P.bestLevel(game, p), 12);
  // bet sizes follow the machine's own level
  const cf = loadMachine(CF), nt = loadMachine(NT);
  assert.equal(P.unlockedBets(cf, P.machineLevel(game, p, CF)).length, cf.betUnlockLevels.filter((l) => l <= 12).length);
  assert.deepEqual(P.unlockedBets(nt, P.machineLevel(game, p, NT)), nt.betLevels.filter((_, i) => nt.betUnlockLevels[i] <= 1));
});

test("PROG-01: levels never end, the curve keeps rising and the formula agrees with itself", () => {
  const n = game.xp.thresholds.length;
  // the table and the formula meet without a seam
  for (let l = 1; l <= n; l++) assert.equal(P.xpForLevel(game, l), game.xp.thresholds[l - 1], "table level " + l);
  let prev = P.xpForLevel(game, n), prevCost = prev - P.xpForLevel(game, n - 1);
  for (let l = n + 1; l <= 3000; l++) {
    const at = P.xpForLevel(game, l), cost = at - prev;
    assert.ok(cost > prevCost, `level ${l} costs more than the one before`);
    assert.equal(P.levelForXp(game, at), l, `exactly at the start of level ${l}`);
    assert.equal(P.levelForXp(game, at - 1), l - 1, `one XP short of level ${l}`);
    prev = at; prevCost = cost;
  }
  // very large XP still gives a sane level and progress inside [0, 1)
  for (const xp of [1e8, 1e9, 1e12]) {
    const pr = P.xpProgress(game, xp);
    assert.ok(pr.level > 1000 && pr.fraction >= 0 && pr.fraction < 1 && Number.isFinite(pr.level), `xp ${xp}`);
  }
  // a big jump pays every level on the way, once
  const p = P.newProfile(game, 1);
  const ups = P.grantXp(p, game, CF, 2000000);
  assert.equal(ups.length, P.machineLevel(game, p, CF) - 1);
  assert.deepEqual(ups.map((u) => u.level), Array.from({ length: ups.length }, (_, i) => i + 2));
});

test("PROG-01: past the listed levels a level earns a rank instead of coins, and coin rewards stop growing", () => {
  const last = Math.max(...Object.keys(game.xp.rewards).map(Number));
  assert.ok(last >= 30 && P.rankFor(game, 1).id === game.xp.ranks.list[0].id);
  const p = P.newProfile(game, 1);
  setXp(p, CF, P.xpForLevel(game, last + 1) - 1);
  const before = p.balance;
  const [up] = P.grantXp(p, game, CF, 100);
  assert.equal(up.level, last + 1);
  assert.equal(up.coins, 0, "no coin reward beyond the table");
  assert.equal(p.balance, before);
  assert.equal(P.rewardScale(game, 500), P.rewardScale(game, game.economy.rewardLevelCap), "the scale stops at the cap");
  // ranks: names change on the listed levels, then repeat with a numeral
  const list = game.xp.ranks.list, tail = list[list.length - 1], every = game.xp.ranks.repeatEvery;
  for (let i = 0; i < list.length; i++) {
    assert.equal(P.rankFor(game, list[i].level).id, list[i].id);
    assert.equal(P.rankFor(game, list[i].level).index, i);
    if (list[i].level > 1) assert.equal(P.rankFor(game, list[i].level - 1).index, i - 1);
  }
  assert.equal(P.rankFor(game, tail.level + every - 1).tier, 0);
  assert.equal(P.rankFor(game, tail.level + every).tier, 1);
  assert.equal(P.rankFor(game, tail.level + 7 * every).tier, 7);
  assert.equal(P.rankFor(game, tail.level + 7 * every).id, tail.id);
  assert.equal(P.toRoman(8), "VIII"); assert.equal(P.toRoman(49), "XLIX"); assert.equal(P.toRoman(0), "0");
  // the level-up that starts a rank says so; the others do not
  const ups = P.grantXp(P.newProfile(game, 1), game, CF, 1e6);
  for (const u of ups) assert.equal(!!u.rank, P.rankFor(game, u.level).startsAt === u.level, "level " + u.level);
  assert.ok(ups.some((u) => u.rank && u.rank.tier >= 1), "repeat ranks are announced too");
});

test("PROG-01/ECO-02: higher bet levels unlock with the machine's level, and a machine opens at a level of another", () => {
  const cfg = loadMachine(CF);
  assert.deepEqual(P.unlockedBets(cfg, 1), [20, 40, 100]);
  assert.equal(P.unlockedBets(cfg, 99).length, cfg.betLevels.length);
  const p = P.newProfile(game, 1);
  const nt = game.machines.find((m) => m.id === NT);
  assert.equal(P.machineUnlocked(game, p, CF), true);
  assert.equal(P.machineUnlocked(game, p, NT), false);
  setLevel(p, NT, 30);
  assert.equal(P.machineUnlocked(game, p, NT), false, "levels on Neon Tumble itself do not open it");
  setLevel(p, nt.unlock.machine, nt.unlock.level - 1);
  assert.equal(P.machineUnlocked(game, p, NT), false);
  setLevel(p, nt.unlock.machine, nt.unlock.level);
  assert.equal(P.machineUnlocked(game, p, NT), true);
});

test("PROG-01: a save from before per-machine levels keeps what the player had earned", () => {
  const old = P.newProfile(game, 1);
  old.xp = game.xp.thresholds[11];                        // level 12 in the old, shared pool
  old.machines = { [CF]: { state: { bet: 1000 }, stats: { spins: 900, wagered: 20000, won: 0, biggestWin: 0, features: 0, jackpots: 0 } },
                   [NT]: { state: null, stats: { spins: 0, wagered: 0, won: 0, biggestWin: 0, features: 0, jackpots: 0 } } };
  for (const m of Object.values(old.machines)) delete m.xp;
  const p = P.normaliseProfile(JSON.parse(JSON.stringify(old)), game);
  assert.equal(P.machineLevel(game, p, CF), 12, "a machine that was played keeps the level");
  assert.equal(P.machineLevel(game, p, NT), 1, "a machine never played starts over");
  assert.equal(P.machineUnlocked(game, p, NT), true, "and nothing that was open is closed");
  assert.equal(p.xp, P.totalXp(p));
  // loading it again changes nothing
  const again = P.normaliseProfile(JSON.parse(JSON.stringify(p)), game);
  assert.equal(P.machineXp(again, CF), P.machineXp(p, CF));
  // a player who bet a lot on a machine keeps at least what those bets were worth
  old.machines[CF].stats.wagered = 4000000; old.machines[CF].xp = undefined; delete old.machines[CF].xp;
  assert.equal(P.machineXp(P.normaliseProfile(JSON.parse(JSON.stringify(old)), game), CF), 4000000 * game.xp.perCoinBet);
});

// ---- missions (PROG-04) ----------------------------------------------------------------------------------
test("PROG-04: three missions are active; progress updates live; a completed mission pays and is replaced", () => {
  const p = P.newProfile(game, 1);
  const day = "2026-11-04";
  const first = P.activeMissions(p, game, day);
  assert.equal(first.length, 3);
  const m = first[0];
  const done = P.trackMetric(p, game, m.metric, m.target, day);
  assert.ok(done.some((d) => d.id === m.id));
  assert.equal(p.balance, game.startingBalance + done.reduce((a, d) => a + d.reward, 0));
  const next = P.activeMissions(p, game, day);
  assert.equal(next.length, 3);
  assert.ok(!next.some((x) => x.id === m.id), "the completed mission is replaced");
});

test("PROG-04: the set is stable during a day and rotates daily", () => {
  const ids = (d) => P.missionOrder(game, d).slice(0, 3).join();
  assert.equal(ids("2026-11-04"), ids("2026-11-04"));
  const days = Array.from({ length: 10 }, (_, i) => ids(`2026-11-${10 + i}`));
  assert.ok(new Set(days).size > 3, "different days give different mission sets");
  const p = P.newProfile(game, 1);
  P.activeMissions(p, game, "2026-11-04");
  P.trackMetric(p, game, "spins", 3, "2026-11-04");
  P.ensureDay(p, "2026-11-05");
  assert.deepEqual(p.missions.progress, {});
});

// ---- achievements and stats (PROG-05) ----------------------------------------------------------------------
test("PROG-05: achievements unlock once with a date; per-machine stats and overall return are tracked", () => {
  const cfg = loadMachine("crystal-fortune");
  const p = P.newProfile(game, 1);
  const fakeOutcome = (bet) => ({ bet, gridStart: [["WILD", "TEN", "TEN"], ["TEN", "TEN", "TEN"], ["TEN", "TEN", "TEN"], ["TEN", "TEN", "COLLECT"], ["TEN", "TEN", "TEN"]], scatterCount: 0 });
  const now = Date.UTC(2026, 10, 4, 12);
  P.recordSpin(p, game, "crystal-fortune", cfg, fakeOutcome(40), now);
  const ev = P.recordRound(p, game, "crystal-fortune", cfg, { bet: 40, win: 2200, features: 1, freeSpinFeatures: 1, jackpots: ["major"] }, now);
  const ids = ev.filter((e) => e.type === "achievement").map((e) => e.id);
  for (const id of ["firstWin", "firstFeature", "firstBigWin", "firstMegaWin", "firstEpicWin", "firstJackpot"]) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes("firstGrand"));
  assert.equal(p.achievements.firstMegaWin, new Date(now).toISOString());
  const again = P.recordRound(p, game, "crystal-fortune", cfg, { bet: 40, win: 4000, features: 0, jackpots: [] }, now + 1000);
  assert.equal(again.filter((e) => e.type === "achievement").length, 0);
  const grand = P.recordRound(p, game, "crystal-fortune", cfg, { bet: 40, win: 40000, features: 1, jackpots: ["grand"] }, now);
  assert.ok(grand.some((e) => e.id === "firstGrand"));
  const stats = p.machines["crystal-fortune"].stats;
  assert.equal(stats.spins, 1);
  assert.equal(stats.biggestWin, 40000);
  assert.equal(stats.features, 2);
  assert.equal(stats.jackpots, 2);
  assert.equal(p.totals.wagered, 40);
  assert.equal(p.totals.won, 2200 + 4000 + 40000);
  assert.equal(P.actualReturn(p), 46200 / 40);
});

// ---- economy (ECO-04..06) ---------------------------------------------------------------------------------
test("ECO-04: with too little balance a free refill is offered; the player is never blocked longer than the cooldown", () => {
  const p = P.newProfile(game, 1);
  const now = 1_000_000;
  assert.equal(P.refillStatus(p, game, 20, now).needed, false);
  p.balance = 10;
  const st = P.refillStatus(p, game, 20, now);
  assert.equal(st.needed, true);
  assert.equal(st.amount, game.refill.amount);
  const wait = game.refill.cooldownMinutes * 60000;
  assert.equal(P.refillStatus(p, game, 20, now + wait).ready, true);
  assert.equal(P.claimRefill(p, game, 20, now + wait), game.refill.amount);
  assert.equal(p.balance, 10 + game.refill.amount);
  assert.ok(game.refill.cooldownMinutes <= 10, "never blocked longer than the 10 minute default");
  assert.equal(P.refillStatus(p, game, 20, now + wait).needed, false);
  // with a cooldown the refill really waits
  const slow = { ...game, refill: { ...game.refill, cooldownMinutes: 10 } };
  const q = P.newProfile(slow, 1); q.balance = 0;
  assert.equal(P.refillStatus(q, slow, 20, now).ready, false);
  assert.equal(P.claimRefill(q, slow, 20, now + 9 * 60000), 0);
  assert.equal(P.claimRefill(q, slow, 20, now + 10 * 60000), slow.refill.amount);
});

test("ECO-05: a free coin bonus every 4 hours, collected with a tap; reminders are off by default", () => {
  const p = P.newProfile(game, 1);
  const now = 5_000_000;
  assert.equal(game.timedBonus.hours, 4);
  assert.equal(P.timedBonusStatus(p, game, now).ready, true);
  assert.equal(P.claimTimedBonus(p, game, now), game.timedBonus.amount);
  assert.equal(P.timedBonusStatus(p, game, now + 3.9 * 3600000).ready, false);
  assert.equal(P.claimTimedBonus(p, game, now + 3.9 * 3600000), 0);
  assert.equal(P.timedBonusStatus(p, game, now + 4 * 3600000).ready, true);
  assert.equal(p.settings.bonusReminder, false);
});

// ---- source scans: FAIR-03 / MATH-03 / FAIR-01 / ECO-06 ---------------------------------------------------
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
// simulate.js is the test harness that drives a Session with a scripted player; it is not part of the odds.
const engineFiles = readdirSync(join(SLOTS, "src/engine")).filter((f) => f.endsWith(".js") && f !== "simulate.js");

test("FAIR-03: the math engine never reads the balance, level, history, clock or Math.random", () => {
  for (const f of engineFiles) {
    const code = stripComments(readFileSync(join(SLOTS, "src/engine", f), "utf8"));
    for (const word of ["balance", "wallet", "profile", "xp", "streak", "history", "Date.now", "Math.random", "localStorage", "sinceLastWin"]) {
      assert.ok(!new RegExp(`\\b${word.replace(".", "\\.")}\\b`).test(code), `${f} mentions "${word}"`);
    }
  }
});

test("MATH-03: the engine holds no machine-specific symbol names or numbers", () => {
  const symbols = new Set(MACHINE_IDS.flatMap((id) => Object.keys(loadMachine(id).symbols)));
  for (const f of engineFiles) {
    const code = stripComments(readFileSync(join(SLOTS, "src/engine", f), "utf8"));
    for (const s of symbols) assert.ok(!new RegExp(`["'\`]${s}["'\`]`).test(code), `${f} hard-codes the symbol ${s}`);
  }
});

test("FAIR-01/02/ECO-06: no ads, no purchases, no tracking, no network requests anywhere in the game", () => {
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|html|css|json)$/.test(e.name)) files.push(p); } };
  walk(SLOTS);
  const banned = [/\bXMLHttpRequest\b/, /\bsendBeacon\b/, /\bWebSocket\b/, /adsbygoogle|admob|interstitial|rewardedVideo|\bbanner ad/i, /gtag|google-analytics|facebook|appsflyer|firebase/i, /in-?app.?purchase|buyCoins|purchase|stripe|paypal/i];
  for (const f of files) {
    if (f.endsWith("strings.js")) continue; // copy may legitimately say "no purchases"
    const raw = readFileSync(f, "utf8");
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/)/i.test(raw), `${f} contains a web address`); // only the SVG namespace is allowed
    const text = f.endsWith(".json") ? raw : stripComments(raw).replace(/<meta[^>]*>/g, ""); // the meta description may say "no purchases"
    for (const re of banned) assert.ok(!re.test(text), `${f} matches ${re}`);
  }
});

// ---- economy that follows the bets (ECO-07..09) ----------------------------------------------------------
test("ECO-07: rewards grow with the level so they keep pace with the bets", () => {
  assert.equal(P.rewardScale(game, 1), 1);
  assert.ok(P.rewardScale(game, 30) > P.rewardScale(game, 10) && P.rewardScale(game, 10) > P.rewardScale(game, 2));
  const p = P.newProfile(game, 1);
  assert.equal(P.timedBonusStatus(p, game, 5).amount, game.timedBonus.amount, "level 1 pays the base amount");
  setLevel(p, CF, 30);
  assert.equal(P.bestLevel(game, p), 30);
  assert.equal(P.timedBonusStatus(p, game, 5).amount, P.scaledReward(game, p, game.timedBonus.amount));
  assert.ok(P.timedBonusStatus(p, game, 5).amount > 5 * game.timedBonus.amount);
  const before = p.balance;
  assert.equal(P.claimTimedBonus(p, game, 5), P.timedBonusStatus({ ...p, timedBonus: { nextAt: 0 } }, game, 5).amount);
  assert.ok(p.balance > before);
  for (const m of P.activeMissions(p, game, "2026-11-04")) assert.ok(m.reward > game.missions.pool.find((x) => x.id === m.id).reward, m.id);
  p.balance = 0;
  assert.equal(P.refillStatus(p, game, 20, 1).amount, P.scaledReward(game, p, game.refill.amount));
});

test("ECO-07: a level-up pays the reward of the level it reached, scaled", () => {
  const p = P.newProfile(game, 1);
  setXp(p, CF, game.xp.thresholds[9] - 1); // one XP short of level 10
  const before = p.balance;
  const ups = P.grantXp(p, game, CF, 40);
  assert.equal(ups[0].level, 10);
  assert.equal(ups[0].coins, P.scaledReward(game, p, game.xp.rewards["10"].coins, 10));
  assert.equal(p.balance, before + ups[0].coins);
});

test("ECO-08: Max bet stays within a small share of the balance, and is never above what can be paid", () => {
  const cfg = loadMachine("crystal-fortune");
  const share = game.economy.maxBetShare;
  assert.ok(share > 0 && share <= 0.05);
  const p = P.newProfile(game, 1);
  setLevel(p, CF, 30); // level 30: every bet unlocked
  for (const balance of [30, 500, 5000, 29980, 400000, 5000000]) {
    p.balance = balance;
    const r = P.maxBetFor(game, cfg, p);
    assert.ok(cfg.betLevels.includes(r.bet), `${balance}: a real bet level`);
    if (balance >= cfg.betLevels[0]) assert.ok(r.bet <= balance, `${balance}: affordable`);
    if (r.bet > cfg.betLevels[0]) assert.ok(r.bet <= balance * share, `${balance}: ${r.bet} is over ${share * 100}% of the balance`);
  }
  p.balance = 29980;
  assert.deepEqual(P.maxBetFor(game, cfg, p), { bet: 400, capped: true, share });
  p.balance = 400000;
  assert.equal(P.maxBetFor(game, cfg, p).bet, 5000);
  p.balance = 25; // too little for the cap: the lowest bet that can be paid
  assert.equal(P.maxBetFor(game, cfg, p).bet, 20);
  const low = P.newProfile(game, 1); // level 1: only the first three bets are unlocked
  low.balance = 5000000;
  assert.equal(P.maxBetFor(game, cfg, low).bet, 100);
});

test("ECO-09: a bet that is a large share of the balance is flagged, the lowest bet never is", () => {
  const cfg = loadMachine("crystal-fortune");
  assert.equal(P.betIsRisky(game, cfg, 20, 25), false, "the lowest bet is never risky");
  assert.equal(P.betIsRisky(game, cfg, 40, 100000), false);
  assert.equal(P.betIsRisky(game, cfg, 1000, 5000), true);
  assert.equal(P.betIsRisky(game, cfg, 400, 29980), false);
});

test("PERS-06: the profile can be exported as JSON with a summary and without unfinished-spin data", () => {
  const p = P.newProfile(game, 1);
  p.totals = { wagered: 1000, won: 896, spins: 25 };
  P.machineEntry(p, "crystal-fortune").state = { bet: 40, pools: { major: 1 }, meter: { count: 2, betSum: 80 }, pending: { outcome: { big: true } }, queue: [1], feature: null };
  const out = P.exportProfile(p, game, Date.UTC(2026, 10, 13));
  assert.equal(out.summary.returnPercent, 89.6);
  assert.equal(out.summary.net, -104);
  assert.deepEqual(out.summary.levels, { "crystal-fortune": 1, "neon-tumble": 1 });
  assert.equal(out.summary.xp, 0);
  assert.equal(out.profile.machines["crystal-fortune"].level, 1);
  assert.equal(out.exportedAt, "2026-11-13T00:00:00.000Z");
  assert.deepEqual(Object.keys(out.profile.machines["crystal-fortune"].state), ["bet", "pools", "meter"]);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(out)));
  assert.equal(P.exportProfile(P.newProfile(game, 1), game).summary.returnPercent, null, "no spins yet: no return to show");
});

test("ECO-09: autoplay offers an unlimited run and loss limits", () => {
  assert.equal(game.autoplay.infinite, true);
  assert.ok(game.autoplay.lossLimits.includes(0) && game.autoplay.lossLimits.some((x) => x > 0));
  assert.ok(game.economy.sessionLossWarn > 0 && game.economy.sessionLossWarn <= 1);
});
