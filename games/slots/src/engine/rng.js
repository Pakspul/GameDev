// RNG (MATH-02): a small, well-known PRNG (sfc32) seeded from a cryptographic source.
// The same seed always gives the same sequence, so a session can be replayed (TOOL-04).

/** Four random 32-bit words from the platform's cryptographic RNG. */
export function cryptoSeed() {
  const words = new Uint32Array(4);
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) throw new Error("No cryptographic random source available");
  c.getRandomValues(words);
  return Array.from(words);
}

function hashString(str) {
  // FNV-1a, enough to spread a human-typed seed over 4 words
  const out = [];
  for (let k = 0; k < 4; k++) {
    let h = (0x811c9dc5 ^ (k * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out.push(h >>> 0);
  }
  return out;
}

function normaliseSeed(seed) {
  if (Array.isArray(seed) && seed.length === 4) return seed.map((x) => x >>> 0);
  if (typeof seed === "number") {
    let s = seed >>> 0;
    const out = [];
    for (let i = 0; i < 4; i++) { // splitmix32
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      out.push((z ^ (z >>> 16)) >>> 0);
    }
    return out;
  }
  if (typeof seed === "string") return hashString(seed);
  throw new Error("Unsupported seed");
}

export class Rng {
  /** @param seed number | string | [4 x uint32]; omitted = fresh cryptographic seed */
  constructor(seed) {
    this.setSeed(seed === undefined ? cryptoSeed() : seed);
  }
  setSeed(seed) {
    const [a, b, c, d] = normaliseSeed(seed);
    this.seed = [a, b, c, d];
    this.a = a; this.b = b; this.c = c; this.d = d;
    for (let i = 0; i < 12; i++) this.next32();
  }
  /** Next uniform 32-bit unsigned integer (sfc32). */
  next32() {
    let a = this.a, b = this.b, c = this.c, d = this.d;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t >>> 0;
  }
  /** Uniform float in [0, 1). */
  float() { return this.next32() / 4294967296; }
  /** Uniform integer in [0, n), without modulo bias. */
  int(n) {
    if (!(n > 0) || n > 4294967296) throw new RangeError("int(n) needs 0 < n <= 2^32");
    const limit = 4294967296 - (4294967296 % n);
    let x;
    do { x = this.next32(); } while (x >= limit);
    return x % n;
  }
  /** Index chosen with the given non-negative weights. */
  weighted(weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0 && weights[i] > 0) return i;
    }
    for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
    throw new Error("weighted(): no positive weight");
  }
  /** Full internal state, to continue the sequence later. */
  state() { return [this.a, this.b, this.c, this.d]; }
  restore(state) { [this.a, this.b, this.c, this.d] = state; }
}
