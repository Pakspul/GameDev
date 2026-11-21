// Seeded randomness: every level is built from a seed made of its mode and number, so level 12 is
// the same level on every device and after every update (the tests pin it). Integer maths only.
// Loopline's own copy: each game keeps its own generator, see docs/ARCHITECTURE.md. Never change
// it without bumping the save version: every level would change.

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
  chance(p) { return this.float() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
}

/** A seed from text, e.g. "depot:12:0" (FNV-1a). */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** A fresh seed for a new match. */
export function freshSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  return (Date.now() * 2654435761) >>> 0;
}
