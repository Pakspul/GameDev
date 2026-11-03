#!/usr/bin/env node
// Checks Graphite's puzzle generators without a browser:
//   1. every generated puzzle has exactly one solution, and it is the stored one;
//   2. generation is deterministic: the same seed gives the same puzzle, forever.
//
// (2) matters because players' progress points at level numbers. If a fingerprint below
// changes, every level of that type changed. Only accept that on purpose, together with
// bumping the save key in games/graphite/game.js ("graphite.v1"); see docs/ARCHITECTURE.md.
//
//   node tests/puzzles.mjs            check
//   node tests/puzzles.mjs --print    print fresh fingerprints (after an intended change)
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "games", "graphite", "levels");
for (const f of ["common.js", "sudoku.js", "takuzu.js", "stars.js", "calcudoku.js"]) require(join(DIR, f));
const { GraphiteSudoku: S, GraphiteTakuzu: T, GraphiteStars: B, GraphiteCalcudoku: K } = globalThis;

const FINGERPRINTS = {
   "sudoku:easy": "905808e97bb123b0",
   "sudoku:medium": "ec173241bfa31ab9",
   "sudoku:hard": "e121e9a1cda77661",
   "sudoku:expert": "d8fb17219459f1f6",
   "takuzu:easy": "4a5347467d23d482",
   "takuzu:medium": "ca9982377b335ab6",
   "takuzu:hard": "e29f1e4e7d8c0c69",
   "takuzu:expert": "53312b4aa8efe655",
   "stars:easy": "1dfe33dd850dc46c",
   "stars:medium": "7b62428630c4cd17",
   "stars:hard": "912a06eea66b2f8d",
   "stars:expert": "8c348c9eb3f7a592",
   "calcudoku:easy": "7e539beda4665e00",
   "calcudoku:medium": "12fdffe238df459b",
   "calcudoku:hard": "d49de817990aa1e4",
   "calcudoku:expert": "d21ad788f900243f"
};

const checks = {
  sudoku(p) {
    if (S.countSolutions(p.givens, 2) !== 1) return "not unique";
    if (p.givens.some((v, i) => v && v !== p.solution[i])) return "givens disagree with solution";
    if (!S.logicSolve(p.givens, S.TIERS[p.tier].max).solved) return "needs guessing";
  },
  takuzu(p) {
    if (T.countSolutions(p.givens, p.n, 2) !== 1) return "not unique";
    if (p.givens.some((v, i) => v >= 0 && v !== p.solution[i])) return "givens disagree with solution";
  },
  stars(p) {
    const sols = B.solve(p.n, p.k, p.regions, 2);
    if (sols.length !== 1) return "not unique";
    const want = p.solution.map((v, i) => (v ? i : -1)).filter((i) => i >= 0).join();
    if (sols[0].slice().sort((a, b) => a - b).join() !== want) return "wrong solution";
  },
  calcudoku(p) {
    const r = K.solve(p.n, p.cages, 2);
    if (r.count !== 1) return "not unique";
    if (r.solutions[0].join() !== p.solution.join()) return "wrong solution";
  },
};
const GEN = { sudoku: S, takuzu: T, stars: B, calcudoku: K };
const print = process.argv.includes("--print");
const seeds = ["1", "2", "3", "50", "999"];
let failures = 0;
const out = {};
for (const kind of Object.keys(GEN)) {
  for (const tier of ["easy", "medium", "hard", "expert"]) {
    const t0 = Date.now();
    const hash = createHash("sha256");
    for (const s of seeds) {
      const p = GEN[kind].generate(tier, tier + ":" + s);
      const again = GEN[kind].generate(tier, tier + ":" + s);
      const err = checks[kind](p) || (JSON.stringify(p) !== JSON.stringify(again) ? "not deterministic" : null);
      if (err) { failures++; console.log(`✗ ${kind} ${tier} level ${s}: ${err}`); }
      hash.update(JSON.stringify(p));
    }
    const fp = hash.digest("hex").slice(0, 16);
    out[kind + ":" + tier] = fp;
    const want = FINGERPRINTS[kind + ":" + tier];
    if (!print && want && want !== fp) { failures++; console.log(`✗ ${kind} ${tier}: levels changed (fingerprint ${fp}, expected ${want})`); }
    else if (!print) console.log(`✓ ${kind.padEnd(9)} ${tier.padEnd(6)} ${seeds.length} puzzles unique, ${Date.now() - t0} ms`);
  }
}
if (print) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(failures ? `\n${failures} problem(s).` : "\nAll Graphite generators OK.");
process.exit(failures ? 1 : 0);
