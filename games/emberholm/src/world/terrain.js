// The island's ground: height and surface everywhere, from the seed plus the hand-placed places.
// Pure maths, no three.js, so Node tests and the minimap use exactly what the 3D world uses.
//
//   height(x, z)        ground height in metres (sea level is 0)
//   ground(x, z)        { h, slope, kind, shade } — what the ground is there, for colours and scatter
//   KINDS               the surface kinds and their colours
import { CONFIG } from "../config.js";
import { fbm, ridged, noise, smooth, lerp, clamp01 } from "./noise.js";
import { PLACES } from "./places.js";

const W = CONFIG.world;
const S = CONFIG.seed;
const HALF = W.size / 2;

/** The island without places: coast, rolling hills, the Fells in the north. */
export function baseHeight(x, z) {
  // Coast: distance from the middle, the outline wobbled by slow noise.
  const wob = (fbm(x / 300 + 11.3, z / 300 - 7.1, 4, S + 1) - 0.5) * 0.62 + (noise(x / 85, z / 85, S + 4) - 0.5) * 0.1;
  const r = Math.sqrt(x * x * 0.9 + z * z * 1.0) / W.islandRadius + wob;
  const land = 1 - smooth(0.8, 1.04, r);
  // Lowlands: gentle, with the odd real hill.
  const hills = fbm(x / 210, z / 210, 4, S + 2);
  let h = 2.5 + hills * hills * 52 + (fbm(x / 41, z / 41, 2, S + 7) - 0.5) * 2.4;
  // The Fells: a mountain wall across the north, with ridges.
  const north = smooth(-250, -390, z);
  if (north > 0) h += north * (34 + ridged(x / 120, z / 120, 4, S + 3) * 100);
  // Under the sea the land drops to the floor; just above it the beach stays low and flat.
  h = W.seaFloor + land * (h - W.seaFloor);
  if (h > 0 && h < 3) h = h * h / 3;
  return h;
}

// Each place's level, measured once from the island without places.
const STAMPS = PLACES.map((p) => {
  const s = { p, level: 0 };
  if (p.flat) s.level = Math.max(3.2, baseHeight(p.x, p.z) + (p.hill ? p.hill.h : 0));
  return s;
});

/** Height of the ground. */
export function height(x, z) {
  let h = baseHeight(x, z);
  for (const { p, level } of STAMPS) {
    const dx = x - p.x, dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (p.hill && d2 < p.hill.r * p.hill.r) {
      const t = 1 - Math.sqrt(d2) / p.hill.r;
      h += p.hill.h * t * t * (3 - 2 * t);
    }
    if (p.bog && d2 < p.bog * p.bog) {
      // The Blackmire: lowered to just above the water, with pools where the noise dips.
      const w = smooth(p.bog, p.bog * 0.55, Math.sqrt(d2) * bogWarp(x, z));
      const bogH = 0.35 + fbm(x / 23, z / 23, 3, S + 11) * 2.4;
      h = lerp(h, bogH, w);
    }
    if (p.flat) {
      const lim = p.flat * 1.7;
      if (d2 < lim * lim) h = lerp(h, level, smooth(lim, p.flat, Math.sqrt(d2)));
    }
    if (p.mounds) for (const m of p.mounds) {
      const mx = x - (p.x + m.x), mz = z - (p.z + m.z);
      const md2 = mx * mx + mz * mz;
      if (md2 < m.r * m.r) { const t = 1 - md2 / (m.r * m.r); h += m.h * t * Math.sqrt(t); }
    }
  }
  return h;
}

/** Rise per metre at (x, z). */
export function slope(x, z, e = 0.6) {
  const dx = height(x + e, z) - height(x - e, z);
  const dz = height(x, z + e) - height(x, z - e);
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
}

// The Blackmire's edge isn't a circle.
const bogWarp = (x, z) => 0.75 + noise(x / 45, z / 45, S + 12) * 0.5;

/** How much of the Blackmire is here (0..1). */
export function bogAt(x, z) {
  let w = 0;
  for (const { p } of STAMPS) if (p.bog) {
    const dx = x - p.x, dz = z - p.z;
    w = Math.max(w, smooth(p.bog, p.bog * 0.55, Math.sqrt(dx * dx + dz * dz) * bogWarp(x, z)));
  }
  return w;
}

/** Woods: patches of forest across the lowlands (0..1, above ~0.5 is forest). */
export const forestAt = (x, z) => fbm(x / 150 + 40.7, z / 150 - 12.9, 3, S + 5) + (noise(x / 37, z / 37, S + 6) - 0.5) * 0.18;

// Surface kinds and their colours (sRGB). `shade` (0..1) picks between the two for variation.
export const KINDS = {
  seabed: ["#5b6a62", "#4a5953"],
  sand: ["#d9cfa9", "#c9bd92"],
  grass: ["#7f9c4d", "#97ad5a"],
  forest: ["#55713a", "#62803f"],
  bog: ["#5d6339", "#6f6a3e"],
  rock: ["#7c7e7a", "#8f8f88"],
  scree: ["#8d8a74", "#9a9682"],
  snow: ["#e9eef0", "#d8e2e6"],
  path: ["#9a8a62", "#8b7c57"],
};

/** What the ground is at (x, z). Pass h and sl if you already have them. */
export function ground(x, z, h = height(x, z), sl = slope(x, z)) {
  const shade = noise(x / 9, z / 9, S + 9) * 0.6 + noise(x / 53, z / 53, S + 10) * 0.4;
  let kind;
  if (h < -0.6) kind = "seabed";
  else if (h > -0.3 && h < 9 && bogAt(x, z) > 0.55) kind = "bog";
  else if (h < 1.5 + shade * 0.8) kind = "sand";
  else if (h > 92 + shade * 14) kind = "snow";
  else if (sl > 0.85 || h > 62 + shade * 10) kind = sl > 0.6 ? "rock" : "scree";
  else if (forestAt(x, z) > 0.57 && h < 55) kind = "forest";
  else kind = "grass";
  return { h, slope: sl, kind, shade };
}

/** Is (x, z) inside the square the world is built for? */
export const inWorld = (x, z) => x > -HALF && x < HALF && z > -HALF && z < HALF;
export { clamp01 };
