// Credits: what clearing a level pays, and what things cost. Pure functions over CONFIG, so the
// sums are tested in Node and every number comes from the config file.
//
// Credits belong to Wallbreaker alone (they are never shared with other games in the arcade),
// never expire, and can never be bought. There is no purchase path of any kind.
import { CONFIG } from "./config.js";
import { MEDALS } from "./modes.js";

const K = CONFIG.credits;

/** Base pay for clearing level n: 10 + 2 × √n (level 100 pays 30). */
export function basePay(n) { return K.base + K.perSqrtLevel * Math.sqrt(Math.max(1, n)); }

/** +5 for the second star, +5 for the third. */
export function starPay(stars) { return (stars >= 2 ? K.star2 : 0) + (stars >= 3 ? K.star3 : 0); }

/** Brick-credit multiplier for a set of active risky capsules: bonuses add above ×1, capped at ×4. */
export function riskyMultiplier(ids) {
  let m = 1;
  for (const id of new Set(ids)) m += CONFIG.risky[id].bonus;
  return Math.min(CONFIG.multiplierCap, m);
}

/**
 * Pay for a cleared level.
 *   mode          classic | zen | descent | run | puzzle
 *   level         level number (Puzzle: wall number)
 *   brickCredits  credits from bricks, the risky multiplier already applied per brick
 *   stars         stars this time; prevStars: best before this clear
 *   creditMul     Scavenger (and Run's Haul perk): applies to everything
 * The level-clear bonus (base and stars) is never multiplied by risky capsules.
 */
export function levelPay({ mode, level, brickCredits = 0, stars = 1, prevStars = 0, creditMul = 1 }) {
  const base = basePay(level);
  const bricks = brickCredits;
  const st = starPay(stars);
  let factor = 1;
  if (mode === "zen") factor *= K.zen;
  if (mode === "puzzle") { if (prevStars > 0) factor *= K.puzzleRepeat; }
  else if (prevStars >= 3) factor *= K.replay3Star;
  const total = Math.round((base + bricks + st) * factor * creditMul);
  return { base, bricks, stars: st, factor, creditMul, total };
}

/** The Daily pays a fixed amount, once per date. */
export function dailyPay(alreadyPaidToday) { return alreadyPaidToday ? 0 : K.daily; }

/** Time Attack: a medal pays once, the difference when you improve to a better one. */
export function medalPay(prev, next) {
  const v = (m) => (m ? K.timeAttack[m] : 0);
  return MEDALS.indexOf(next) > MEDALS.indexOf(prev) ? v(next) - v(prev) : 0;
}

/** Round to the nearest 5. */
export function round5(x) { return Math.round(x / 5) * 5; }

/** Price of Workshop level `lvl` (1-based) of an upgrade: base × 1.6^(lvl−1), rounded to 5. Null past the max. */
export function workshopPrice(id, lvl) {
  const it = CONFIG.workshop.items[id];
  if (!it || lvl < 1 || lvl > it.max) return null;
  return round5(it.base * Math.pow(CONFIG.workshop.growth, lvl - 1));
}

export function boostPrice(id) { return CONFIG.boosts.items[id].price; }

/** Every cosmetic as { id, shelf, price, tier }. */
export function cosmetics() {
  const out = [];
  for (const shelf in CONFIG.cosmetics) {
    for (const [id, price] of CONFIG.cosmetics[shelf]) {
      out.push({ id, shelf, price, tier: price === 0 ? 0 : price <= 300 ? 1 : price <= 800 ? 2 : 3 });
    }
  }
  return out;
}
export function cosmeticPrice(id) {
  const c = cosmetics().find((x) => x.id === id);
  return c ? c.price : null;
}
