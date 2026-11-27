// Seeded randomness for everything that shapes a level or a deal. Integer hashing only (Math.imul and
// shifts), so the same seed gives the same numbers on every device. Math.random is never used for it.
//
// FROZEN: changing anything here changes every level, so "level 47" would become another board.
// tests/bubbleworks/rules.test.mjs fingerprints the first levels.

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
    } else h = mix32((h ^ (p >>> 0)) + 0x6a09e667);
  }
  return h >>> 0;
}

/** mulberry32. The generator's whole state is one integer (`state`), so a game can be saved and copied. */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next,
    get state() { return s; },
    set state(v) { s = v >>> 0; },
    float: () => next() / 4294967296,
    int: (n) => (n <= 1 ? 0 : next() % n),
    range: (a, b) => a + (b > a ? next() % (b - a + 1) : 0),
    chance: (p) => next() / 4294967296 < p,
    pick: (arr) => arr[next() % arr.length],
    weighted(w) {
      let total = 0;
      for (const k in w) total += w[k];
      let x = (next() / 4294967296) * total;
      for (const k in w) { x -= w[k]; if (x < 0) return k; }
      return Object.keys(w).pop();
    },
  };
}
