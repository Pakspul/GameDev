// Seeded randomness for everything that shapes a level: the generator, capsule drops, Run perk
// offers and the Wild Ball wobble. Integer hashing only (Math.imul, shifts), so the same seed
// gives the same numbers on every device and browser. Math.random is never used for any of it.
//
// FROZEN: changing anything in this file changes every generated level, so players' stars and
// "level 47" would point at a different wall. tests/wallbreaker.mjs fingerprints the first levels.

/** Mix a 32-bit integer (murmur3 finaliser). */
export function mix32(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash any mix of integers and strings into one unsigned 32-bit integer. */
export function hash32(...parts) {
  let h = 0x9e3779b9;
  for (const p of parts) {
    if (typeof p === "string") {
      for (let i = 0; i < p.length; i++) h = mix32((h ^ p.charCodeAt(i)) + 0x632be5ab);
      h = mix32(h ^ p.length);
    } else {
      h = mix32((h ^ (p >>> 0)) + 0x6a09e667);
    }
  }
  return h >>> 0;
}

/** A number in [0, 1) from a hash. The division by 2^32 is exact, so this is deterministic too. */
export function hash01(...parts) { return hash32(...parts) / 4294967296; }

/** mulberry32: a small, fast seeded generator. */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const r = {
    next,
    /** [0, 1) */
    float: () => next() / 4294967296,
    /** integer in [0, n) */
    int: (n) => (n <= 1 ? 0 : next() % n),
    /** integer in [a, b] */
    range: (a, b) => a + (b > a ? next() % (b - a + 1) : 0),
    /** true with probability p */
    chance: (p) => next() / 4294967296 < p,
    pick: (arr) => arr[next() % arr.length],
    /** key of an object of weights { a: 3, b: 1 } */
    weighted: (w) => weighted(w, next() / 4294967296),
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = next() % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return r;
}

/** Pick a key from { key: weight } with a number u in [0, 1). Keys are walked in insertion order. */
export function weighted(w, u) {
  let total = 0;
  for (const k in w) total += w[k];
  let x = u * total;
  let last = null;
  for (const k in w) {
    if (w[k] <= 0) continue;
    last = k;
    if (x < w[k]) return k;
    x -= w[k];
  }
  return last;
}

// ---- Run codes ------------------------------------------------------------------------------------
// A Run's seed is shown as six characters from an alphabet without look-alikes (no 0/O or 1/I),
// so it can be read aloud or typed on a phone. 32^6 = 2^30 seeds.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols: no I, O, 0 or 1

export function seedToCode(seed) {
  let s = (seed >>> 0) & 0x3fffffff;
  let out = "";
  for (let i = 0; i < 6; i++) { out = CODE_ALPHABET[s & 31] + out; s >>>= 5; }
  return out;
}

/** Parse a run code (case, spaces and dashes don't matter). Returns null if it isn't one. */
export function codeToSeed(code) {
  const clean = String(code || "").toUpperCase().replace(/[\s-]/g, "");
  if (clean.length !== 6) return null;
  let s = 0;
  for (const ch of clean) {
    const v = CODE_ALPHABET.indexOf(ch);
    if (v < 0) return null;
    s = (s << 5) | v;
  }
  return s >>> 0;
}

/** A fresh random seed for a new Run (crypto, so not predictable; the code makes it reproducible). */
export function freshSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] & 0x3fffffff;
  return (Date.now() * 2654435761) & 0x3fffffff;
}
