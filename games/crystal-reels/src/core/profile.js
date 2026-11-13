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
  out.machines = { ...(p.machines || {}) };
  migrateMachineXp(out, game, p.xp || 0);
  return out;
}

/**
 * Levels used to be one pool for the whole game; each machine now has its own XP. A save without per-machine
 * XP is upgraded here: every machine the player has played starts with what they had earned in total (so no
 * bet size or machine is ever taken away), machines never played start at 0. Runs only for entries that
 * have no `xp` yet, so it is safe to run on every load.
 */
function migrateMachineXp(profile, game, oldTotal) {
  for (const entry of Object.values(profile.machines)) {
    if (typeof entry.xp === "number") continue;
    const st = entry.stats || {};
    entry.xp = st.spins > 0 ? Math.max(oldTotal, (st.wagered || 0) * game.xp.perCoinBet) : 0;
  }
  profile.xp = totalXp(profile);
}

export function machineEntry(profile, id) {
  if (!profile.machines[id]) profile.machines[id] = { state: null, xp: 0, stats: { spins: 0, biggestWin: 0, features: 0, jackpots: 0, wagered: 0, won: 0 } };
  return profile.machines[id];
}

// ---- XP and levels (PROG-01) -----------------------------------------------------------------
// Every machine has its own XP and its own level, and the levels never end. `xp.thresholds` lists the XP
// needed for levels 1..N (a hand-tuned start); beyond level N each level costs `xp.beyondStep` more than
// the one before it, so the curve keeps rising smoothly and has a closed form (no loop over levels).

/** The total XP at which a level starts (level 1 = 0). */
export function xpForLevel(game, level) {
  const t = game.xp.thresholds, n = t.length;
  if (level <= 1) return 0;
  if (level <= n) return t[level - 1];
  const k = level - n;                                  // levels past the table
  const last = t[n - 1] - t[n - 2], step = game.xp.beyondStep;
  return t[n - 1] + last * k + (step * k * (k + 1)) / 2;
}

export function levelForXp(game, xp) {
  const t = game.xp.thresholds, n = t.length;
  if (xp < t[n - 1]) {
    let level = 1;
    for (let i = 1; i < n; i++) if (xp >= t[i]) level = i + 1;
    return level;
  }
  // past the table: solve step/2·k² + (last + step/2)·k ≤ xp − t[n−1] for the largest whole k
  const last = t[n - 1] - t[n - 2], step = game.xp.beyondStep, r = xp - t[n - 1];
  const a = step / 2, b = last + step / 2;
  let k = Math.max(0, Math.floor((-b + Math.sqrt(b * b + 4 * a * r)) / (2 * a)));
  while (xpForLevel(game, n + k + 1) <= xp) k++;        // guard against rounding at the edges
  while (k > 0 && xpForLevel(game, n + k) > xp) k--;
  return n + k;
}

export function xpProgress(game, xp) {
  const level = levelForXp(game, xp);
  const from = xpForLevel(game, level), to = xpForLevel(game, level + 1);
  return { level, from, to, into: xp - from, needed: to - from, fraction: (xp - from) / (to - from) };
}

/** XP and level of one machine, and the XP earned across all of them (shown in the profile). */
export function machineXp(profile, id) { const m = profile.machines[id]; return m && typeof m.xp === "number" ? m.xp : 0; }
export function machineLevel(game, profile, id) { return levelForXp(game, machineXp(profile, id)); }
export function totalXp(profile) { return Object.values(profile.machines).reduce((n, m) => n + (m.xp || 0), 0); }
/** The highest level reached on any machine: what the profile-wide rewards (missions, bonus, refill) follow. */
export function bestLevel(game, profile) {
  let best = 1;
  for (const id of Object.keys(profile.machines)) best = Math.max(best, machineLevel(game, profile, id));
  return best;
}

// ---- ranks: what a level earns besides coins ---------------------------------------------------------
// Coins are only paid for the levels in `xp.rewards`. Beyond those a level earns recognition: a rank (title
// and badge colour) that changes every few levels, and after the last listed rank it keeps going with a
// Roman numeral every `ranks.repeatEvery` levels (Legend, Legend II, Legend III, ...). Never a coin inflation.

/** The rank at a level: `index` is the position in the list (it picks the badge colour), `tier` counts repeats of the last rank. */
export function rankFor(game, level) {
  const { list, repeatEvery } = game.xp.ranks;
  let index = 0;
  for (let i = 0; i < list.length; i++) if (level >= list[i].level) index = i;
  const last = list[list.length - 1];
  const tier = index === list.length - 1 ? Math.floor((level - last.level) / repeatEvery) : 0;
  return { index, id: list[index].id, tier, startsAt: tier ? last.level + tier * repeatEvery : list[index].level };
}

export function toRoman(n) {
  if (!(n > 0) || n >= 4000) return String(n);
  const map = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, sym] of map) while (n >= v) { out += sym; n -= v; }
  return out;
}

// ---- rewards that grow with the level (ECO-07) ----------------------------------------------------
// The bets a player can place grow with the level (up to 125 times the first one). Rewards that stayed
// flat would shrink to nothing next to them, so level-ups, missions, the timed bonus and the refill grow too,
// up to `economy.rewardLevelCap`: past it the levels keep coming but the coin rewards stop growing.

/** What one coin of a base reward is worth at this level: 1 at level 1, then +rewardPerLevel per level, up to the cap. */
export function rewardScale(game, level) {
  const per = (game.economy && game.economy.rewardPerLevel) || 0;
  const cap = (game.economy && game.economy.rewardLevelCap) || Infinity;
  return 1 + per * Math.max(0, Math.min(level, cap) - 1);
}

/** A base reward from game.json at a level (the best machine level when none is given), in whole tens of coins. */
export function scaledReward(game, profile, base, level = bestLevel(game, profile)) {
  return Math.round((base * rewardScale(game, level)) / 10) * 10;
}

/**
 * XP is proportional to the bet and goes to the machine it was bet on. A level-up pays the coins listed for
 * that level (if any) and reports its rank when the level starts a new one.
 */
export function grantXp(profile, game, machineId, bet) {
  const entry = machineEntry(profile, machineId);
  const before = levelForXp(game, entry.xp);
  const gained = bet * game.xp.perCoinBet;
  entry.xp += gained;
  profile.xp = totalXp(profile);
  const after = levelForXp(game, entry.xp);
  const levelUps = [];
  for (let l = before + 1; l <= after; l++) {
    const coins = scaledReward(game, profile, (game.xp.rewards[String(l)] || {}).coins || 0, l);
    profile.balance += coins;
    const rank = rankFor(game, l);
    levelUps.push({ machine: machineId, level: l, coins, rank: rank.startsAt === l ? { id: rank.id, tier: rank.tier } : null });
  }
  return levelUps;
}

export function unlockedBets(cfg, level) {
  return cfg.betLevels.filter((_, i) => cfg.betUnlockLevels[i] <= level);
}

/**
 * The bet "Max bet" picks: the highest unlocked bet that is at most economy.maxBetShare of the balance,
 * so one tap never puts a large part of the balance on a single spin. When the balance is too small for
 * any bet inside that share, the lowest unlocked bet. `capped` says the cap held back a higher bet.
 */
export function maxBetFor(game, cfg, profile) {
  const allowed = unlockedBets(cfg, machineLevel(game, profile, cfg.id));
  const share = (game.economy && game.economy.maxBetShare) || 0;
  const affordable = allowed.filter((b) => b <= profile.balance);
  const within = share ? allowed.filter((b) => b <= profile.balance * share) : affordable;
  const bet = within.length ? within[within.length - 1] : allowed[0];
  const top = affordable.length ? affordable[affordable.length - 1] : allowed[0];
  return { bet, capped: bet < top, share };
}

/** A bet that is a large part of the balance (more than economy.riskyBetShare), and not already the lowest. */
export function betIsRisky(game, cfg, bet, balance) {
  const share = (game.economy && game.economy.riskyBetShare) || 0;
  return !!share && bet > cfg.betLevels[0] && bet > balance * share;
}

/** A machine opens once another machine reaches a level (`unlock: {machine, level}`); the first one is open from the start. */
export function machineUnlocked(game, profile, id) {
  const m = game.machines.find((x) => x.id === id);
  if (!m) return false;
  return !m.unlock || machineLevel(game, profile, m.unlock.machine) >= m.unlock.level;
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
    .map((id) => ({ ...byId[id], reward: scaledReward(game, profile, byId[id].reward), progress: profile.missions.progress[id] || 0 }));
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
      case "allMachines": if (game.machines.every((m) => machineUnlocked(game, profile, m.id))) unlock(profile, a.id, now, events); break;
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
  for (const l of grantXp(profile, game, machineId, outcome.bet)) events.push({ type: "levelUp", ...l });
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

/**
 * The profile as one JSON-friendly object, for the "Export profile" button: a short summary first (level,
 * balance, totals, the return so far) and then the profile itself. A machine's saved state is cut down to
 * its bet, jackpot pools and meter; the outcome of an unfinished spin is left out.
 */
export function exportProfile(profile, game, now = Date.now()) {
  const machines = {};
  for (const [id, m] of Object.entries(profile.machines)) {
    const st = m.state || {};
    machines[id] = { xp: Math.round(m.xp || 0), level: machineLevel(game, profile, id), stats: m.stats, state: { bet: st.bet, pools: st.pools, meter: st.meter } };
  }
  const won = profile.totals.won, wagered = profile.totals.wagered;
  return {
    game: "Crystal Reels",
    exportedAt: new Date(now).toISOString(),
    summary: {
      xp: Math.round(totalXp(profile)), balance: profile.balance,
      levels: Object.fromEntries(game.machines.map((m) => [m.id, machineLevel(game, profile, m.id)])),
      spins: profile.totals.spins, wagered, won, net: won - wagered,
      returnPercent: wagered ? Math.round((won / wagered) * 10000) / 100 : null,
    },
    profile: { ...profile, machines },
  };
}

// ---- economy (ECO-04, ECO-05, ECO-06) --------------------------------------------------------

/** Safety net: when the balance cannot cover the lowest bet, a free refill is offered. No purchase is ever involved. */
export function refillStatus(profile, game, lowestBet, now = Date.now()) {
  const needed = profile.balance < lowestBet;
  const amount = scaledReward(game, profile, game.refill.amount);
  if (!needed) return { needed: false, ready: false, availableAt: null, amount };
  if (profile.refill.since === null) profile.refill.since = now;
  const availableAt = profile.refill.since + game.refill.cooldownMinutes * 60000;
  return { needed: true, ready: now >= availableAt, availableAt, amount };
}

export function claimRefill(profile, game, lowestBet, now = Date.now()) {
  const st = refillStatus(profile, game, lowestBet, now);
  if (!st.needed || !st.ready) return 0;
  profile.balance += st.amount;
  profile.refill.since = null;
  return st.amount;
}

export function timedBonusStatus(profile, game, now = Date.now()) {
  if (!game.timedBonus.enabled) return { enabled: false, ready: false, nextAt: null, amount: 0 };
  return { enabled: true, ready: now >= profile.timedBonus.nextAt, nextAt: profile.timedBonus.nextAt, amount: scaledReward(game, profile, game.timedBonus.amount) };
}

export function claimTimedBonus(profile, game, now = Date.now()) {
  const st = timedBonusStatus(profile, game, now);
  if (!st.ready) return 0;
  profile.balance += st.amount;
  profile.timedBonus.nextAt = now + game.timedBonus.hours * 3600000;
  return st.amount;
}
