// The player's profile: balance, level, settings, stats, missions, achievements and the economy
// rules around coins (play money only, ECO-*). Plain data in, plain data out: no DOM, no storage.
import { SAVE_VERSION } from "./save.js";
import { Rng } from "../engine/rng.js";
import { tierOf, tierAtLeast } from "../engine/tiers.js";

export const DEFAULT_SETTINGS = {
  musicVolume: 0.6, sfxVolume: 0.8, muted: false, haptics: true, turbo: false,
  reducedMotion: false, reminderMinutes: 60, bonusReminder: false,
};

export function newProfile(game, now = Date.now()) {
  return {
    v: SAVE_VERSION, createdAt: now,
    balance: game.startingBalance, xp: 0,
    settings: { ...DEFAULT_SETTINGS, reminderMinutes: game.sessionReminder.defaultMinutes },
    machines: {}, last: null,
    refill: { since: null }, timedBonus: { nextAt: 0 },
    missions: { day: null, progress: {}, done: [] },
    achievements: {},
    totals: { wagered: 0, won: 0, spins: 0 },
    acknowledged: false,
  };
}

/** Fill in anything a save from an older minor change lacks. */
export function normaliseProfile(p, game) {
  const base = newProfile(game, p.createdAt || Date.now());
  const out = { ...base, ...p };
  out.settings = { ...base.settings, ...(p.settings || {}) };
  out.totals = { ...base.totals, ...(p.totals || {}) };
  out.missions = { ...base.missions, ...(p.missions || {}) };
  out.refill = { ...base.refill, ...(p.refill || {}) };
  out.timedBonus = { ...base.timedBonus, ...(p.timedBonus || {}) };
  return out;
}

export function machineEntry(profile, id) {
  if (!profile.machines[id]) profile.machines[id] = { state: null, stats: { spins: 0, biggestWin: 0, features: 0, jackpots: 0, wagered: 0, won: 0 } };
  return profile.machines[id];
}

// ---- XP and levels (PROG-01) -----------------------------------------------------------------

export function levelForXp(game, xp) {
  const t = game.xp.thresholds;
  let level = 1;
  for (let i = 1; i < t.length; i++) if (xp >= t[i]) level = i + 1;
  return level;
}

export function xpProgress(game, xp) {
  const t = game.xp.thresholds;
  const level = levelForXp(game, xp);
  if (level >= t.length) return { level, into: 0, needed: 0, fraction: 1, max: true };
  const from = t[level - 1], to = t[level];
  return { level, into: xp - from, needed: to - from, fraction: (xp - from) / (to - from), max: false };
}

/** XP is proportional to the bet. Level-up rewards are paid out here. */
export function grantXp(profile, game, bet) {
  const before = levelForXp(game, profile.xp);
  profile.xp += bet * game.xp.perCoinBet;
  const after = levelForXp(game, profile.xp);
  const levelUps = [];
  for (let l = before + 1; l <= after; l++) {
    const coins = (game.xp.rewards[String(l)] || {}).coins || 0;
    profile.balance += coins;
    levelUps.push({ level: l, coins });
  }
  return levelUps;
}

export function playerLevel(game, profile) { return levelForXp(game, profile.xp); }

export function unlockedBets(cfg, level) {
  return cfg.betLevels.filter((_, i) => cfg.betUnlockLevels[i] <= level);
}

export function machineUnlocked(game, profile, id) {
  const m = game.machines.find((x) => x.id === id);
  return !!m && playerLevel(game, profile) >= m.unlockLevel;
}

// ---- days, missions (PROG-04) ----------------------------------------------------------------

export function localDay(now = Date.now()) {
  const d = new Date(now);
  const two = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** The pool in today's order: a seeded shuffle, so the set rotates daily and is the same all day. */
export function missionOrder(game, day) {
  const pool = game.missions.pool.map((m) => m.id);
  const rng = new Rng("missions:" + day);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function ensureDay(profile, day) {
  if (profile.missions.day !== day) profile.missions = { day, progress: {}, done: [] };
}

/** Three active missions: the first three of today's order that are not done yet. */
export function activeMissions(profile, game, day) {
  ensureDay(profile, day);
  const byId = Object.fromEntries(game.missions.pool.map((m) => [m.id, m]));
  return missionOrder(game, day).filter((id) => !profile.missions.done.includes(id)).slice(0, game.missions.active)
    .map((id) => ({ ...byId[id], progress: profile.missions.progress[id] || 0 }));
}

/** Add progress to every active mission measuring this metric. Returns the missions that just completed. */
export function trackMetric(profile, game, metric, amount, day) {
  if (!amount) return [];
  const completed = [];
  for (const m of activeMissions(profile, game, day)) {
    if (m.metric !== metric) continue;
    const now = Math.min(m.target, (profile.missions.progress[m.id] || 0) + amount);
    profile.missions.progress[m.id] = now;
    if (now >= m.target) {
      profile.missions.done.push(m.id);
      profile.balance += m.reward;
      completed.push({ id: m.id, reward: m.reward });
    }
  }
  return completed;
}

// ---- achievements and stats (PROG-05) --------------------------------------------------------

function unlock(profile, id, now, events) {
  if (profile.achievements[id]) return;
  profile.achievements[id] = new Date(now).toISOString();
  events.push({ type: "achievement", id });
}

function checkAchievements(profile, game, ctx, now, events) {
  for (const a of game.achievements) {
    if (profile.achievements[a.id]) continue;
    switch (a.metric) {
      case "firstWin": if (ctx.win > 0) unlock(profile, a.id, now, events); break;
      case "firstFeature": if (ctx.features > 0 || machinesFeatureCount(profile) > 0) unlock(profile, a.id, now, events); break;
      case "tier": if (ctx.tier && tierAtLeast(ctx.tier, a.tier)) unlock(profile, a.id, now, events); break;
      case "jackpot": if (ctx.jackpots && ctx.jackpots.length) unlock(profile, a.id, now, events); break;
      case "grand": if (ctx.jackpots && ctx.jackpots.includes("grand")) unlock(profile, a.id, now, events); break;
      case "totalSpins": if (profile.totals.spins >= a.target) unlock(profile, a.id, now, events); break;
      case "allMachines": if (game.machines.every((m) => playerLevel(game, profile) >= m.unlockLevel)) unlock(profile, a.id, now, events); break;
    }
  }
}

function machinesFeatureCount(profile) {
  return Object.values(profile.machines).reduce((n, m) => n + (m.stats ? m.stats.features : 0), 0);
}

/**
 * Bookkeeping when a spin is committed (bet taken): stats, XP, missions that count spins and symbols.
 * @returns events: levelUp / mission / achievement
 */
export function recordSpin(profile, game, machineId, cfg, outcome, now = Date.now()) {
  const events = [];
  const stats = machineEntry(profile, machineId).stats;
  stats.spins++; stats.wagered += outcome.bet;
  profile.totals.spins++; profile.totals.wagered += outcome.bet;
  for (const l of grantXp(profile, game, outcome.bet)) events.push({ type: "levelUp", ...l });
  const day = localDay(now);
  let wilds = 0, collects = 0;
  for (const col of outcome.gridStart) for (const id of col) {
    if (cfg.symbols[id].kind === "wild") wilds++;
    if (cfg.symbols[id].kind === "collect") collects++;
  }
  const done = [
    ...trackMetric(profile, game, "spins", 1, day),
    ...trackMetric(profile, game, "wilds", wilds, day),
    ...trackMetric(profile, game, "collects", collects, day),
    ...trackMetric(profile, game, "scatters", outcome.scatterCount || 0, day),
  ];
  for (const m of done) events.push({ type: "mission", ...m });
  checkAchievements(profile, game, { win: 0, features: 0 }, now, events);
  return events;
}

/**
 * Bookkeeping when a round (a spin plus the features it started) has been paid out.
 * `win` is the total of the round; `features` and `jackpots` describe what happened in it.
 */
export function recordRound(profile, game, machineId, cfg, round, now = Date.now()) {
  const events = [];
  const stats = machineEntry(profile, machineId).stats;
  stats.won += round.win; profile.totals.won += round.win;
  if (round.win > stats.biggestWin) stats.biggestWin = round.win;
  stats.features += round.features;
  stats.jackpots += (round.jackpots || []).length;
  const day = localDay(now);
  const tier = tierOf(cfg, round.win / round.bet);
  const done = [];
  if (round.win > 0) done.push(...trackMetric(profile, game, "wins", 1, day));
  if (tierAtLeast(tier, "big")) done.push(...trackMetric(profile, game, "bigWins", 1, day));
  done.push(...trackMetric(profile, game, "freeSpins", round.freeSpinFeatures || 0, day));
  done.push(...trackMetric(profile, game, "features", round.features, day));
  for (const m of done) events.push({ type: "mission", ...m });
  checkAchievements(profile, game, { win: round.win, tier, features: round.features, jackpots: round.jackpots }, now, events);
  return events;
}

export function actualReturn(profile) {
  return profile.totals.wagered ? profile.totals.won / profile.totals.wagered : 0;
}

// ---- economy (ECO-04, ECO-05, ECO-06) --------------------------------------------------------

/** Safety net: when the balance cannot cover the lowest bet, a free refill is offered. No purchase is ever involved. */
export function refillStatus(profile, game, lowestBet, now = Date.now()) {
  const needed = profile.balance < lowestBet;
  if (!needed) return { needed: false, ready: false, availableAt: null, amount: game.refill.amount };
  if (profile.refill.since === null) profile.refill.since = now;
  const availableAt = profile.refill.since + game.refill.cooldownMinutes * 60000;
  return { needed: true, ready: now >= availableAt, availableAt, amount: game.refill.amount };
}

export function claimRefill(profile, game, lowestBet, now = Date.now()) {
  const st = refillStatus(profile, game, lowestBet, now);
  if (!st.needed || !st.ready) return 0;
  profile.balance += game.refill.amount;
  profile.refill.since = null;
  return game.refill.amount;
}

export function timedBonusStatus(profile, game, now = Date.now()) {
  if (!game.timedBonus.enabled) return { enabled: false, ready: false, nextAt: null, amount: 0 };
  return { enabled: true, ready: now >= profile.timedBonus.nextAt, nextAt: profile.timedBonus.nextAt, amount: game.timedBonus.amount };
}

export function claimTimedBonus(profile, game, now = Date.now()) {
  const st = timedBonusStatus(profile, game, now);
  if (!st.ready) return 0;
  profile.balance += game.timedBonus.amount;
  profile.timedBonus.nextAt = now + game.timedBonus.hours * 3600000;
  return game.timedBonus.amount;
}
