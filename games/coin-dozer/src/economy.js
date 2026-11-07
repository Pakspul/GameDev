// The economy as pure functions over the config and the player's progress: the bank's lifeline,
// credits, milestones, the collection, Workshop upgrades and machine themes. No DOM, no physics,
// so tests/coin-dozer/ checks every rule directly.
//
// Two currencies, both earned by playing and never for sale: coins (the bank, played with) and
// credits (spent in the Workshop). Credits belong to Coin Dozer only, as in every arcade game.
import { CONFIG } from "./config.js";

export const UPGRADES = ["startBank", "goldChance", "nudges", "luckyRate"];
export const THEMES = ["classic", "space", "candy", "ocean"];

export function freshProgress(cfg = CONFIG) {
  const workshop = {};
  for (const id of UPGRADES) workshop[id] = 0;
  const collection = {};
  for (const t of THEMES) collection[t] = {};
  return {
    credits: 0,
    workshop,
    themes: { classic: true },
    theme: "classic",
    collection,           // theme → { itemIndex: "YYYY-MM-DD" (the day it was first won) }
    milestones: {},       // id → true
    stats: { coinsWon: 0, dropped: 0, bestCascade: 0, prizes: 0 },
  };
}

// ---- Coins ------------------------------------------------------------------------------------------------
/** The bank at the start of a new game (a new board), with the Starting bank upgrade. */
export function startBank(progress, cfg = CONFIG) {
  return cfg.start.bank + cfg.economy.workshop.startBank.per * (progress.workshop.startBank || 0);
}

/** Lifeline: an empty bank with nothing in flight gets coins at once. No timer, no ad, no limit. */
export function lifeline(bank, inFlight, cfg = CONFIG) {
  return bank <= 0 && inFlight <= 0 ? cfg.drop.lifeline : 0;
}

/** What an item is worth to the bank when it crosses the front edge. */
export function coinValue(kind, fever, cfg = CONFIG) {
  const V = cfg.values;
  const base = kind === "coin" ? V.coin : kind === "gold" ? V.gold : kind === "lucky" ? V.lucky : kind === "jackpot" ? V.jackpot : 0;
  if (kind === "jackpot") return base;            // the jackpot is a fixed 50
  return base * (fever ? cfg.events.fever.multiplier : 1);
}

export function goldChance(progress, cfg = CONFIG) {
  return cfg.drop.goldChance + cfg.economy.workshop.goldChance.per * (progress.workshop.goldChance || 0);
}

export function maxNudges(progress, cfg = CONFIG) {
  return cfg.nudge.charges + cfg.economy.workshop.nudges.per * (progress.workshop.nudges || 0);
}

/** Seconds between lucky coins on average: "15% more often" per level. */
export function luckyInterval(progress, cfg = CONFIG) {
  return cfg.prizes.luckyEvery / (1 + cfg.economy.workshop.luckyRate.per * (progress.workshop.luckyRate || 0));
}

// ---- Credits ----------------------------------------------------------------------------------------------
export function addCredits(progress, n) {
  if (n > 0) progress.credits += n;
  return n;
}

/** Grant a milestone once. Returns its credits, or 0 if it was already reached. */
export function reachMilestone(progress, id, cfg = CONFIG) {
  const m = cfg.economy.milestones.find((x) => x.id === id);
  if (!m || progress.milestones[id]) return 0;
  progress.milestones[id] = true;
  return addCredits(progress, m.credits);
}

/**
 * A prize won: credits always, a collection entry only the first time.
 * index: 0–3 are the four gems, 4–11 the eight figures of the theme.
 */
export function collect(progress, theme, index, date, cfg = CONFIG) {
  const set = progress.collection[theme] || (progress.collection[theme] = {});
  const isNew = !(index in set);
  if (isNew) set[index] = date;
  const credits = addCredits(progress, index < 4 ? cfg.economy.credits.gem : cfg.economy.credits.figure);
  progress.stats.prizes++;
  return { isNew, credits, complete: Object.keys(set).length >= cfg.economy.setSize };
}

export function collectionCount(progress, theme) {
  return Object.keys(progress.collection[theme] || {}).length;
}

// ---- Workshop ---------------------------------------------------------------------------------------------
/** Price of the next level of an upgrade, or null when it's at its last level. */
export function upgradeCost(progress, id, cfg = CONFIG) {
  const u = cfg.economy.workshop[id];
  const lvl = progress.workshop[id] || 0;
  return u && lvl < u.costs.length ? u.costs[lvl] : null;
}

/** Buy the next level of an upgrade. { ok, reason?, cost?, need? }; reason: "max" | "credits" | "unknown". */
export function buyUpgrade(progress, id, cfg = CONFIG) {
  if (!cfg.economy.workshop[id]) return { ok: false, reason: "unknown" };
  const cost = upgradeCost(progress, id, cfg);
  if (cost == null) return { ok: false, reason: "max" };
  if (progress.credits < cost) return { ok: false, reason: "credits", need: cost - progress.credits };
  progress.credits -= cost;
  progress.workshop[id] = (progress.workshop[id] || 0) + 1;
  return { ok: true, cost };
}

export function themeCost(id, cfg = CONFIG) { return cfg.economy.themes[id]; }

/** Unlock a theme. { ok, reason?, need? }; reason: "owned" | "credits" | "unknown". */
export function buyTheme(progress, id, cfg = CONFIG) {
  const cost = themeCost(id, cfg);
  if (cost == null) return { ok: false, reason: "unknown" };
  if (progress.themes[id]) return { ok: false, reason: "owned" };
  if (progress.credits < cost) return { ok: false, reason: "credits", need: cost - progress.credits };
  progress.credits -= cost;
  progress.themes[id] = true;
  return { ok: true, cost };
}

export function selectTheme(progress, id) {
  if (!progress.themes[id]) return false;
  progress.theme = id;
  return true;
}
