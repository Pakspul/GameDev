import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { formatCoins, formatCompact, formatDuration } from "../../games/slots/src/core/format.js";
import { SpinStateMachine, ACCEPTS, STATES } from "../../games/slots/src/core/state-machine.js";
import { SaveStore, SAVE_VERSION, migrate, checksum } from "../../games/slots/src/core/save.js";
import * as P from "../../games/slots/src/core/profile.js";
import { tierOf } from "../../games/slots/src/engine/tiers.js";
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
test("PROG-01: each spin awards XP proportional to the bet; level-ups grant their rewards", () => {
  const p = P.newProfile(game, 1);
  assert.equal(P.playerLevel(game, p), 1);
  const ups = P.grantXp(p, game, 40);
  assert.equal(p.xp, 40 * game.xp.perCoinBet);
  assert.deepEqual(ups, []);
  const p2 = P.newProfile(game, 1);
  P.grantXp(p2, game, 100); P.grantXp(p2, game, 200);
  assert.equal(p2.xp, 15); // proportional
  const before = p.balance;
  p.xp = game.xp.thresholds[1] - 1;
  const up = P.grantXp(p, game, 40);
  assert.equal(up.length, 1);
  assert.equal(up[0].level, 2);
  assert.equal(p.balance, before + game.xp.rewards["2"].coins);
  assert.ok(P.xpProgress(game, p.xp).fraction >= 0);
  assert.ok(game.xp.thresholds.every((t, i, a) => i === 0 || t > a[i - 1]), "thresholds ascend");
});

test("PROG-01/ECO-02: higher bet levels and machines unlock with the player level", () => {
  const cfg = loadMachine("crystal-fortune");
  assert.deepEqual(P.unlockedBets(cfg, 1), [20, 40, 100]);
  assert.equal(P.unlockedBets(cfg, 99).length, cfg.betLevels.length);
  const p = P.newProfile(game, 1);
  assert.equal(P.machineUnlocked(game, p, "crystal-fortune"), true);
  assert.equal(P.machineUnlocked(game, p, "neon-tumble"), false);
  p.xp = game.xp.thresholds[game.machines[1].unlockLevel - 1];
  assert.equal(P.machineUnlocked(game, p, "neon-tumble"), true);
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
