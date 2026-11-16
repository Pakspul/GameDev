// Seeded randomness: spawn spots, bot plans and bot mistakes all come from one seed, so a match
// can be replayed exactly (the tests rely on it). Integer maths only, the same on every device.
// (Inkfield's own copy: each game keeps its own generator, see docs/ARCHITECTURE.md.)

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

/** A fresh seed for a new match. */
export function freshSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  return (Date.now() * 2654435761) >>> 0;
}
