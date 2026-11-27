// Seeded noise for the island. Only integer hashing, + - × ÷ and Math.sqrt (all exact in IEEE),
// so the island comes out the same on every device. No Math.sin/exp here: their last bits may
// differ between browsers, and the world must not.
// (Emberholm's own copy: each game keeps its own generator, see docs/ARCHITECTURE.md.)

/** A 32-bit hash of two integers and a seed. */
export function hash(ix, iz, seed) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** [0, 1) from two integers and a seed. */
export const hash01 = (ix, iz, seed) => hash(ix, iz, seed) / 4294967296;

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise in [0, 1], smooth, one cell per unit. */
export function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = fade(x - ix), fz = fade(z - iz);
  const a = hash01(ix, iz, seed), b = hash01(ix + 1, iz, seed);
  const c = hash01(ix, iz + 1, seed), d = hash01(ix + 1, iz + 1, seed);
  const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
  return top + (bottom - top) * fz;
}

/** Fractal noise in [0, 1]: `octaves` layers, each twice as fine and half as strong. */
export function fbm(x, z, octaves, seed) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    // Each octave is shifted so the lattices don't line up.
    sum += amp * noise(x * f + o * 17.31, z * f - o * 9.73, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Ridged fractal noise in [0, 1]: sharp crests, for mountains. */
export function ridged(x, z, octaves, seed) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(2 * noise(x * f + o * 5.17, z * f + o * 3.11, seed + o * 131) - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Smoothstep from e0 to e1 (e0 > e1 runs it backwards). */
export function smooth(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
export const lerp = (a, b, t) => a + (b - a) * t;
