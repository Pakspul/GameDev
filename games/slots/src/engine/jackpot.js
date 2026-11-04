// Jackpots (JP-01..03): fixed tiers and local progressives, always stored as a multiple of the
// bet so they scale with bet changes. The value shown is exactly the value paid.
import { JACKPOT_TIERS } from "./config.js";

const round6 = (x) => Math.round(x * 1e6) / 1e6;

export function initialPools(cfg) {
  const pools = {};
  for (const tier of JACKPOT_TIERS) {
    const j = cfg.jackpots && cfg.jackpots[tier];
    if (j && j.type === "progressive") pools[tier] = j.seed;
  }
  return pools;
}

/** The tier's value as a multiple of the bet. */
export function jackpotMultiple(cfg, pools, tier) {
  const j = cfg.jackpots[tier];
  return j.type === "fixed" ? j.value : pools[tier];
}

/** The tier's value in coins at this bet: what the display shows and what a win pays. */
export function jackpotAmount(cfg, pools, tier, bet) {
  return Math.floor(jackpotMultiple(cfg, pools, tier) * bet + 1e-9);
}

/** All four amounts at once. */
export function jackpotAmounts(cfg, pools, bet) {
  const out = {};
  if (!cfg.jackpots) return out;
  for (const tier of JACKPOT_TIERS) out[tier] = jackpotAmount(cfg, pools, tier, bet);
  return out;
}

/** Each paid spin feeds the progressives. */
export function addContribution(cfg, pools) {
  for (const tier of Object.keys(pools)) pools[tier] = round6(pools[tier] + cfg.jackpots[tier].contribution);
}

/** After a win the progressive starts again at its seed (plus the winning spin's own contribution). */
export function resetTier(cfg, pools, tier) {
  const j = cfg.jackpots[tier];
  if (j.type === "progressive") pools[tier] = round6(j.seed + j.contribution);
}

/** Expected contribution to the RTP from all progressives (a fixed part of the long-run return). */
export function contributionPerSpin(cfg) {
  let c = 0;
  for (const tier of JACKPOT_TIERS) {
    const j = cfg.jackpots && cfg.jackpots[tier];
    if (j && j.type === "progressive") c += j.contribution;
  }
  return c;
}
