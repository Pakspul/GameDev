// Celebration tiers (WIN-01): chosen from the total win divided by the bet, using the machine's thresholds.
export const TIER_ORDER = ["none", "below", "win", "big", "mega", "epic"];

export function tierOf(cfg, multiple) {
  const t = cfg.winTiers;
  if (multiple >= t.epic) return "epic";
  if (multiple >= t.mega) return "mega";
  if (multiple >= t.big) return "big";
  if (multiple >= t.win) return "win";
  if (multiple > 0) return "below"; // smaller than the bet: no celebration (FAIR-04)
  return "none";
}

export function tierAtLeast(tier, min) {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}
