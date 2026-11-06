// Run: a roguelite on a random seed. The seed is shown as a six-character run code; entering the
// code plays the same levels and is offered the same power-ups.
import { CONFIG } from "./config.js";
import { generate } from "./levels.js";
import { rng, hash32 } from "./rng.js";

/** Level n of a run (level 1 is the fixed wall in every mode). */
export function runLevel(seed, n) { return generate(seed >>> 0, n); }

/** The 3 power-ups offered after clearing level n: seeded, skipping ones already at their maximum. */
export function perkOffer(seed, n, perks = {}) {
  const r = rng(hash32(seed >>> 0, n, "perks"));
  const ids = Object.keys(CONFIG.run.perks).filter((id) => (perks[id] || 0) < CONFIG.run.perks[id].max);
  return r.shuffle(ids).slice(0, CONFIG.run.offers);
}

/** Starting options unlocked by what the player has done in runs. */
export function unlockedStarts(best, bosses) {
  return CONFIG.run.starts.filter(([, kind, v]) => (kind === "level" ? best >= v : bosses >= v)).map(([id]) => id);
}
