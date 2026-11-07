// Seeded randomness for everything that shapes a board: the start pile, drop jitter, gold coins,
// prize drops, coin showers and the anti-stall picks. Integer maths only (Math.imul, shifts), so a
// seed gives the same numbers on every device. Math.random is never used for any of it.
//
// The generator's state is one 32-bit number, so it goes into the save with the board and a
// restored board carries on with the same sequence.

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

/** mulberry32 with its state exposed, so it can be saved and restored. */
export class Rng {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  /** [0, 1) */
  float() { return this.next() / 4294967296; }
  /** [a, b) */
  range(a, b) { return a + (b - a) * this.float(); }
  /** integer in [0, n) */
  int(n) { return n <= 1 ? 0 : this.next() % n; }
  /** true with probability p */
  chance(p) { return this.float() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  /** Index into an array of weights. */
  weighted(weights) {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    let x = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i]);
      if (x < w) return i;
      x -= w;
    }
    return weights.length - 1;
  }
}

/** A fresh seed for a new board (not predictable; the seed itself makes the board reproducible). */
export function freshSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  return (Date.now() * 2654435761) >>> 0;
}
