// Quests: the things a player can DO besides pressing Spin. No DOM, no storage, no clock of its own
// (every function takes `now`), so it is all testable.
//
//   live challenges   a short goal the player starts on a machine ("win 4 spins in the next 10")
//   weekly chain      three linked goals that unlock one after the other, with a prize at the end
//   gems              six gems per machine, each earned by one accomplishment; the full set pays out
//   level chests      every few levels of a machine: three boxes, pick one
//   lucky wheel       one free spin for every daily mission that is finished
//   free-spin vouchers, reel-frame cosmetics: the prizes that are not coins
//
// Everything here is play money and cosmetics. None of it touches the machine's odds (FAIR-03): the engine
// never sees any of this, and nothing is lost by ignoring it: a challenge that runs out costs nothing.
import * as P from "./profile.js";
import { tierAtLeast } from "../engine/tiers.js";
import { Rng } from "../engine/rng.js";

export function questDefaults() {
  return {
    challenge: null, challengeCount: 0,
    chests: [], vouchers: 0, wheel: { spins: 0 },
    cosmetics: { frames: [], frame: null },
    chain: { week: null, step: 0, progress: 0, done: false },
  };
}

/** Fill in anything an older save lacks. */
export function normaliseQuests(out, p) {
  const base = questDefaults();
  out.challenge = p.challenge || null;
  out.challengeCount = p.challengeCount || 0;
  out.chests = Array.isArray(p.chests) ? p.chests : [];
  out.vouchers = p.vouchers || 0;
  out.wheel = { ...base.wheel, ...(p.wheel || {}) };
  out.cosmetics = { ...base.cosmetics, ...(p.cosmetics || {}) };
  out.chain = { ...base.chain, ...(p.chain || {}) };
}

/** "2026-W46": the local ISO week. */
export function localWeek(now = Date.now()) {
  const d = new Date(now);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const week = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---- prizes: coins, free-spin vouchers, reel frames ----------------------------------------------------------

/** Pay a prize out. `coins` is already scaled when it was rolled. Returns what was given (for the screen). */
export function applyPrize(profile, prize) {
  if (prize.type === "coins") profile.balance += prize.amount;
  else if (prize.type === "voucher") profile.vouchers += prize.count;
  else if (prize.type === "frame") { if (!profile.cosmetics.frames.includes(prize.id)) profile.cosmetics.frames.push(prize.id); }
  return prize;
}

export function ownedFrames(profile) { return profile.cosmetics.frames; }
export function equipFrame(profile, game, id) {
  if (id === null || (profile.cosmetics.frames.includes(id) && game.frames.some((f) => f.id === id))) { profile.cosmetics.frame = id; return true; }
  return false;
}
export function frameStyle(profile, game) {
  const f = game.frames.find((x) => x.id === profile.cosmetics.frame);
  return f ? { color: f.color, glow: f.glow } : null;
}

// ---- level chests ------------------------------------------------------------------------------------------------

/** A chest waits in the profile until the player opens it (no rush, nothing expires). */
export function addChest(profile, source, info = {}) { profile.chests.push({ source, ...info }); }

/** Roll the three boxes of the first chest: three different prizes, a frame only while some are left to win. */
export function rollChest(game, profile, rng) {
  const conf = game.chests;
  const left = game.frames.filter((f) => !profile.cosmetics.frames.includes(f.id)).map((f) => f.id);
  const prizes = [];
  for (let i = 0; i < conf.boxes; i++) {
    const weights = conf.prizes.map((p) => (p.type === "frame" && left.length === 0 ? 0 : p.weight));
    const def = conf.prizes[rng.weighted(weights)];
    if (def.type === "coins") prizes.push({ type: "coins", amount: P.scaledReward(game, profile, def.base) });
    else if (def.type === "voucher") prizes.push({ type: "voucher", count: def.count });
    else { const id = left.splice(rng.int(left.length), 1)[0]; prizes.push({ type: "frame", id }); }
  }
  return prizes;
}

/** The player picked a box: it is theirs, and the chest is gone. */
export function openChest(game, profile, prizes, pick) {
  if (!profile.chests.length) return null;
  profile.chests.shift();
  return applyPrize(profile, prizes[pick]);
}

// ---- lucky wheel ------------------------------------------------------------------------------------------------------

export function wheelSliceWeights(game) { return game.wheel.slices.map((s) => s.weight); }

/** Spend one wheel spin. Returns { index, prize } or null when there is none. */
export function spinWheel(game, profile, rng) {
  if (profile.wheel.spins < 1) return null;
  profile.wheel.spins--;
  const index = rng.weighted(wheelSliceWeights(game));
  return { index, prize: applyPrize(profile, slicePrize(game, profile, game.wheel.slices[index])) };
}
export function slicePrize(game, profile, slice) {
  return slice.coins ? { type: "coins", amount: P.scaledReward(game, profile, slice.coins) } : { type: "voucher", count: slice.voucher };
}

// ---- live challenges ---------------------------------------------------------------------------------------------

/** A challenge can be offered when the machine has it and the player can afford what it asks for. */
function challengeFits(game, profile, cfg, c) {
  if (c.machines && !c.machines.includes(cfg.id)) return false;
  const unlocked = P.unlockedBets(cfg, P.machineLevel(game, profile, cfg.id));
  const calm = (b) => b <= profile.balance * game.economy.riskyBetShare || b === cfg.betLevels[0];
  if (c.metric === "highBet") { const b = cfg.betLevels[c.minStep]; return b !== undefined && unlocked.includes(b) && calm(b); }
  if (c.metric === "variety") return unlocked.filter(calm).length >= c.target;
  return true;
}

export const isBetQuest = (c) => c.metric === "highBet" || c.metric === "variety";

/**
 * Three offers for a machine: the same until the player starts or drops one, then a new set.
 * At least one asks the player to work the bet buttons, when the machine and the balance allow it.
 */
export function challengeOffers(game, profile, cfg, now = Date.now()) {
  const pool = game.challenges.pool.filter((c) => challengeFits(game, profile, cfg, c));
  const rng = new Rng(`challenge:${cfg.id}:${P.localDay(now)}:${profile.challengeCount}`);
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const n = game.challenges.offers;
  const picked = pool.slice(0, n);
  if (picked.length === n && !picked.some(isBetQuest)) {
    const bet = pool.slice(n).find(isBetQuest);
    if (bet) picked[n - 1] = bet;
  }
  return picked.map((c) => ({ ...c, reward: describeReward(game, profile, c.reward), step: c.minStep === undefined ? null : c.minStep, bet: c.minStep === undefined ? null : cfg.betLevels[c.minStep] }));
}

export function describeReward(game, profile, reward) {
  return reward.coins ? { type: "coins", amount: P.scaledReward(game, profile, reward.coins) } : { type: "voucher", count: reward.voucher };
}

export function startChallenge(game, profile, cfg, id) {
  if (profile.challenge) return null;
  const def = game.challenges.pool.find((c) => c.id === id);
  if (!def || !challengeFits(game, profile, cfg, def)) return null;
  profile.challenge = { id, machine: cfg.id, metric: def.metric, target: def.target, spins: def.spins, left: def.spins, progress: 0, minStep: def.minStep === undefined ? null : def.minStep, bets: [] };
  profile.challengeCount++;
  return profile.challenge;
}

/** Dropping a challenge costs nothing. */
export function abandonChallenge(profile) { profile.challenge = null; profile.challengeCount++; }

/** A spin was started (the bet is taken): the window shrinks and everything the grid shows is counted. */
export function challengeSpin(profile, ctx) {
  const c = profile.challenge;
  if (!c || c.machine !== ctx.machine) return;
  c.left = Math.max(0, c.left - 1);
  switch (c.metric) {
    case "wilds": c.progress += ctx.wilds; break;
    case "scatters": c.progress += ctx.scatters; break;
    case "collects": c.progress += ctx.collects; break;
    case "cascades": c.progress += ctx.cascades; break;
    case "expanded": c.progress += ctx.expanded; break;
    case "highBet": if (ctx.betStep >= c.minStep) c.progress++; break;
    case "variety": if (!c.bets.includes(ctx.bet)) c.bets.push(ctx.bet); c.progress = c.bets.length; break;
  }
}

/**
 * A round was paid: win-based goals count, then the challenge is won or, when the window is used up,
 * simply over. Returns nothing; the outcome goes to `events`.
 */
export function challengeRound(game, profile, ctx, events) {
  const c = profile.challenge;
  if (!c || c.machine !== ctx.machine) return;
  switch (c.metric) {
    case "wins": if (ctx.win > 0) c.progress++; break;
    case "winsX2": if (ctx.win >= 2 * ctx.bet) c.progress++; break;
    case "bigWin": if (tierAtLeast(ctx.tier, "big")) c.progress++; break;
  }
  if (c.progress >= c.target) {
    const def = game.challenges.pool.find((x) => x.id === c.id);
    const prize = applyPrize(profile, describeReward(game, profile, def.reward));
    profile.challenge = null; profile.challengeCount++;
    events.push({ type: "challenge", ok: true, id: c.id, metric: c.metric, prize });
  } else if (c.left <= 0) {
    profile.challenge = null; profile.challengeCount++;
    events.push({ type: "challenge", ok: false, id: c.id, metric: c.metric });
  }
}

// ---- the weekly chain ------------------------------------------------------------------------------------------------

export function chainFor(game, week) { return game.chains[new Rng("chain:" + week).int(game.chains.length)]; }

/** This week's chain and where the player is in it (a new week starts a fresh one; missing a week costs nothing). */
export function chainStatus(profile, game, now = Date.now()) {
  const week = localWeek(now);
  if (profile.chain.week !== week) profile.chain = { week, step: 0, progress: 0, done: false };
  const def = chainFor(game, week), ch = profile.chain;
  const cur = def.steps[ch.step];
  return {
    def, week, done: ch.done, step: ch.step, steps: def.steps.length, progress: ch.progress,
    current: cur ? { ...cur, reward: P.scaledReward(game, profile, cur.reward) } : null,
    final: { coins: P.scaledReward(game, profile, def.final.coins), chest: !!def.final.chest },
  };
}

/** Add to the current step when it measures this metric. A finished step pays and opens the next. */
export function trackChain(profile, game, metric, amount, now, events) {
  if (!amount) return;
  const st = chainStatus(profile, game, now);
  if (st.done || !st.current || st.current.metric !== metric) return;
  const ch = profile.chain;
  ch.progress = Math.min(st.current.target, ch.progress + amount);
  if (ch.progress < st.current.target) return;
  profile.balance += st.current.reward;
  events.push({ type: "chainStep", step: ch.step + 1, steps: st.steps, coins: st.current.reward });
  ch.step++; ch.progress = 0;
  if (ch.step >= st.steps) {
    ch.done = true;
    profile.balance += st.final.coins;
    if (st.final.chest) addChest(profile, "chain");
    events.push({ type: "chainDone", coins: st.final.coins, chest: st.final.chest });
  }
}

// ---- gems -------------------------------------------------------------------------------------------------------------------

export function gemsOf(profile, id) { const m = profile.machines[id]; return m && Array.isArray(m.gems) ? m.gems : []; }
export function gemSetComplete(game, profile, id) { return game.gems.list.every((g) => gemsOf(profile, id).includes(g.id)); }

function gemEarned(game, profile, machineId, g, ctx) {
  switch (g.metric) {
    case "winMultiple": return ctx.bet > 0 && ctx.win >= g.target * ctx.bet;
    case "feature": return (ctx.features || 0) >= g.target;
    case "wildsOneSpin": return (ctx.wilds || 0) >= g.target;
    case "spins": return P.machineEntry(profile, machineId).stats.spins >= g.target;
    case "level": return P.machineLevel(game, profile, machineId) >= g.target;
  }
  return false;
}

/** Called after a spin and after a round, with whatever the call knows (`ctx` fields that are not there count as 0). */
export function checkGems(game, profile, machineId, ctx, events) {
  const entry = P.machineEntry(profile, machineId);
  if (!Array.isArray(entry.gems)) entry.gems = [];
  for (const g of game.gems.list) {
    if (entry.gems.includes(g.id) || !gemEarned(game, profile, machineId, g, ctx)) continue;
    entry.gems.push(g.id);
    events.push({ type: "gem", machine: machineId, id: g.id });
  }
  if (!entry.gemSet && gemSetComplete(game, profile, machineId)) {
    entry.gemSet = true;
    const coins = P.scaledReward(game, profile, game.gems.reward.coins);
    profile.balance += coins;
    if (game.gems.reward.chest) addChest(profile, "gems", { machine: machineId });
    events.push({ type: "gemSet", machine: machineId, coins, chest: !!game.gems.reward.chest });
  }
}
