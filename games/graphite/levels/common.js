// Graphite: shared helpers for the puzzle generators (pure logic, no DOM).
// Loaded as a classic script in the page AND in the generator worker (importScripts),
// and by Node in the benchmark/consistency checks, so it only touches `globalThis`.
//
// Every puzzle is computed from a seed string like "sudoku:hard:37". Change anything here
// and every level changes, so treat these functions as frozen (see docs/ARCHITECTURE.md).
(function (root) {
  "use strict";

  /** 32-bit FNV-1a with a final avalanche, so similar strings give unrelated seeds. */
  function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** Small, fast seeded PRNG. Returns a function giving floats in [0, 1). */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rng(seedStr) { return mulberry32(hashStr(seedStr)); }
  function randInt(r, n) { return Math.floor(r() * n); }
  function shuffle(r, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function range(n) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; }

  const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  /** Lowest set bit's index (for one-hot masks: the value). */
  const bitIndex = (m) => 31 - Math.clz32(m & -m);

  root.GraphiteCommon = { hashStr, mulberry32, rng, randInt, shuffle, range, popcount, bitIndex };
})(typeof globalThis !== "undefined" ? globalThis : this);
