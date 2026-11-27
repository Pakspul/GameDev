// Trees, rocks, bushes and grass, placed per chunk from the seed: the same chunk always gets the
// same things, so nothing has to be saved. Pure maths (no three.js), also used for collisions.
//
//   chunkItems(cx, cz)   [{ k, x, y, z, s, rot, tint, r }] — kind, position, scale, rotation,
//                        colour variation (0..1), collision radius (0 = walk through)
//   tuftsOf(cx, cz)      grass tufts, a separate, denser list (only drawn close by)
import { CONFIG } from "../config.js";
import { hash01 } from "./noise.js";
import { height, slope, ground } from "./terrain.js";
import { PLACES } from "./places.js";

const C = CONFIG.world.chunk;
const SEED = CONFIG.seed + 0x5ca7;
const CELL = 4;               // one candidate spot per 4 × 4 m
const TUFT_CELL = 2.2;

// Kinds and their collision radius per unit of scale.
export const ITEM_KINDS = ["pine", "birch", "rock", "bush", "deadtree"];
const RADIUS = { pine: 0.42, birch: 0.32, rock: 0.95, bush: 0, deadtree: 0.3 };

const CLEARS = PLACES.filter((p) => p.clear).map((p) => ({ x: p.x, z: p.z, r2: p.clear * p.clear }));
const cleared = (x, z) => CLEARS.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r2);

/** What grows at a spot, by the ground there and a die roll (0..1). Null for nothing. */
function pick(g, roll, roll2) {
  switch (g.kind) {
    case "forest": return roll < 0.5 ? (roll2 < 0.62 ? "pine" : "birch") : roll < 0.56 ? "bush" : roll < 0.58 ? "rock" : null;
    case "grass": return roll < 0.018 ? (roll2 < 0.5 ? "birch" : "pine") : roll < 0.05 ? "bush" : roll < 0.064 ? "rock" : null;
    case "bog": return roll < 0.05 ? "deadtree" : roll < 0.1 ? "bush" : null;
    case "scree": return roll < 0.06 ? "rock" : roll < 0.09 ? "pine" : null;
    case "rock": return roll < 0.07 ? "rock" : null;
    case "sand": return roll < 0.008 ? "rock" : null;
    default: return null;
  }
}

const cache = new Map();
/** Everything in chunk (cx, cz), cached. */
export function chunkItems(cx, cz) {
  const key = cx + "," + cz;
  let list = cache.get(key);
  if (list) return list;
  list = [];
  const n = C / CELL;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = cx * n + i, gz = cz * n + j;
    const roll = hash01(gx, gz, SEED);
    if (roll > 0.6) continue; // nothing ever grows at 40% of spots: saves the ground lookups
    const x = (gx + 0.15 + hash01(gx, gz, SEED + 1) * 0.7) * CELL;
    const z = (gz + 0.15 + hash01(gx, gz, SEED + 2) * 0.7) * CELL;
    if (cleared(x, z)) continue;
    const h = height(x, z);
    if (h < 0.4) continue;
    const g = ground(x, z, h, slope(x, z));
    const k = pick(g, roll, hash01(gx, gz, SEED + 3));
    if (!k) continue;
    if (k !== "rock" && g.slope > 0.8) continue;
    const r3 = hash01(gx, gz, SEED + 4);
    const s = k === "rock" ? 0.5 + r3 * r3 * 1.9 : k === "bush" ? 0.7 + r3 * 0.6 : 0.75 + r3 * 0.6;
    list.push({
      k, x, z,
      y: k === "rock" ? h - 0.25 * s : h - 0.1,
      s, rot: hash01(gx, gz, SEED + 5) * 6.2832, tint: hash01(gx, gz, SEED + 6),
      r: RADIUS[k] * s,
    });
  }
  cache.set(key, list);
  if (cache.size > 600) cache.delete(cache.keys().next().value);
  return list;
}

const tuftCache = new Map();
/** Grass tufts in chunk (cx, cz): [{ x, y, z, s, rot }]. */
export function tuftsOf(cx, cz) {
  const key = cx + "," + cz;
  let list = tuftCache.get(key);
  if (list) return list;
  list = [];
  const n = Math.floor(C / TUFT_CELL);
  const step = C / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = cx * n + i, gz = cz * n + j;
    if (hash01(gx, gz, SEED + 7) > 0.45) continue;
    const x = cx * C + (i + hash01(gx, gz, SEED + 8)) * step;
    const z = cz * C + (j + hash01(gx, gz, SEED + 9)) * step;
    const h = height(x, z);
    if (h < 1.2) continue;
    const g = ground(x, z, h, 0);
    if (g.kind !== "grass" && g.kind !== "forest" && g.kind !== "bog") continue;
    list.push({ x, z, y: h - 0.05, s: 0.6 + hash01(gx, gz, SEED + 10) * 0.7, rot: hash01(gx, gz, SEED + 11) * 6.2832, bog: g.kind === "bog" });
  }
  tuftCache.set(key, list);
  if (tuftCache.size > 120) tuftCache.delete(tuftCache.keys().next().value);
  return list;
}

export const chunkOf = (v) => Math.floor(v / C);
