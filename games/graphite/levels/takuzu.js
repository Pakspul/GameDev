// Graphite: Takuzu (also known as Binairo or binary puzzle) generator and logical solver.
//
// Rules: fill the grid with suns (0) and moons (1) so that
//   - every row and column holds as many suns as moons,
//   - no three of the same sit next to each other in a row or column,
//   - no two rows are the same, and no two columns are the same.
//
// Puzzles are dug from a complete grid; a cell is only emptied if a logical solver limited
// to the tier's techniques can still finish the puzzle, so every puzzle has one solution
// and never needs guessing.
//   level 1: pairs, sandwiches and counting (what you learn in the first minute)
//   level 2: "only one way to finish this line" (checks every valid completion of a line,
//            including the no-identical-lines rule)
(function (root) {
  "use strict";
  const C = root.GraphiteCommon;

  const TIERS = {
    easy:   { label: "Easy",   n: 6,  max: 1, want: 1, tries: 1 },
    medium: { label: "Medium", n: 8,  max: 1, want: 1, tries: 1 },
    hard:   { label: "Hard",   n: 10, max: 2, want: 2, tries: 6 },
    expert: { label: "Expert", n: 12, max: 2, want: 2, tries: 6 },
  };

  const lineCache = {};
  /** Every valid line of length n as a bit pattern (bit k = cell k is a moon). */
  function validLines(n) {
    if (lineCache[n]) return lineCache[n];
    const out = [];
    for (let m = 0; m < 1 << n; m++) {
      if (C.popcount(m) !== n / 2) continue;
      let ok = true;
      for (let k = 0; k + 2 < n && ok; k++) {
        const t = (m >> k) & 7;
        if (t === 0 || t === 7) ok = false;
      }
      if (ok) out.push(m);
    }
    return (lineCache[n] = out);
  }

  function fullGrid(n, r) {
    const lines = C.shuffle(r, validLines(n).slice());
    const rows = [];
    const half = n / 2;
    const colOnes = new Array(n).fill(0);
    let steps = 0;
    function fits(m) {
      const k = rows.length;
      for (let c = 0; c < n; c++) {
        const b = (m >> c) & 1;
        if (colOnes[c] + b > half) return false;
        if (k - colOnes[c] + (1 - b) > half) return false;
        if (k >= 2 && ((rows[k - 1] >> c) & 1) === b && ((rows[k - 2] >> c) & 1) === b) return false;
      }
      return rows.indexOf(m) < 0;
    }
    (function go() {
      if (rows.length === n) {
        // columns must be distinct too
        const cols = new Set();
        for (let c = 0; c < n; c++) { let v = 0; for (let k = 0; k < n; k++) v |= ((rows[k] >> c) & 1) << k; cols.add(v); }
        return cols.size === n;
      }
      if (++steps > 200000) return false;
      const start = C.randInt(r, lines.length);
      for (let t = 0; t < lines.length; t++) {
        const m = lines[(start + t) % lines.length];
        if (!fits(m)) continue;
        rows.push(m);
        for (let c = 0; c < n; c++) colOnes[c] += (m >> c) & 1;
        if (go()) return true;
        rows.pop();
        for (let c = 0; c < n; c++) colOnes[c] -= (m >> c) & 1;
      }
      return false;
    })();
    if (rows.length !== n) return fullGrid(n, r);
    const g = [];
    for (let k = 0; k < n; k++) for (let c = 0; c < n; c++) g.push((rows[k] >> c) & 1);
    return g;
  }

  // ---- line helpers ----
  function lineCells(n, li) { // li < n: row li, else column li - n
    const out = [];
    for (let k = 0; k < n; k++) out.push(li < n ? li * n + k : k * n + (li - n));
    return out;
  }
  const LINES = {};
  function linesOf(n) {
    if (!LINES[n]) { LINES[n] = []; for (let li = 0; li < 2 * n; li++) LINES[n].push(lineCells(n, li)); }
    return LINES[n];
  }

  /** Level-1 deductions on one line. Returns list of [cell, value, why]. */
  function basicLine(g, cells, n) {
    const out = [];
    const half = n / 2;
    let zeros = 0, ones = 0;
    for (const i of cells) { if (g[i] === 0) zeros++; else if (g[i] === 1) ones++; }
    for (let k = 0; k + 2 < n; k++) {
      const a = g[cells[k]], b = g[cells[k + 1]], c = g[cells[k + 2]];
      if (a >= 0 && a === b && c < 0) out.push([cells[k + 2], 1 - a, "pair"]);
      if (b >= 0 && b === c && a < 0) out.push([cells[k], 1 - b, "pair"]);
      if (a >= 0 && a === c && b < 0) out.push([cells[k + 1], 1 - a, "sandwich"]);
    }
    if (zeros === half || ones === half) {
      const v = zeros === half ? 1 : 0;
      for (const i of cells) if (g[i] < 0) out.push([i, v, "count"]);
    }
    return out;
  }

  /** Level-2 deductions on one line: cells that are equal in every valid completion. */
  function fullLine(g, cells, n, li, all) {
    let known = 0, vals = 0;
    cells.forEach((i, k) => { if (g[i] >= 0) { known |= 1 << k; if (g[i]) vals |= 1 << k; } });
    const full = (1 << n) - 1;
    if (known === full) return [];
    // complete lines in the same direction may not be repeated
    const taken = [];
    const base = li < n ? 0 : n;
    for (let o = base; o < base + n; o++) {
      if (o === li) continue;
      let v = 0, ok = true;
      all[o].forEach((i, k) => { if (g[i] < 0) ok = false; else if (g[i]) v |= 1 << k; });
      if (ok) taken.push(v);
    }
    let andM = full, orM = 0, any = false;
    for (const m of validLines(n)) {
      if (((m ^ vals) & known) !== 0 || taken.indexOf(m) >= 0) continue;
      andM &= m; orM |= m; any = true;
    }
    if (!any) return null; // contradiction
    const out = [];
    cells.forEach((i, k) => {
      if ((known >> k) & 1) return;
      if ((andM >> k) & 1) out.push([i, 1, "line"]);
      else if (!((orM >> k) & 1)) out.push([i, 0, "line"]);
    });
    return out;
  }

  function logicSolve(grid, n, max) {
    const g = grid.slice();
    const all = linesOf(n);
    let level = 0;
    for (;;) {
      let changed = false;
      for (const cells of all) {
        for (const [i, v] of basicLine(g, cells, n)) {
          if (g[i] < 0) { g[i] = v; changed = true; }
          else if (g[i] !== v) return { solved: false, bad: true, level };
        }
      }
      if (changed) { level = Math.max(level, 1); continue; }
      if (max >= 2) {
        for (let li = 0; li < 2 * n; li++) {
          const res = fullLine(g, all[li], n, li, all);
          if (res === null) return { solved: false, bad: true, level };
          for (const [i, v] of res) if (g[i] < 0) { g[i] = v; changed = true; }
        }
        if (changed) { level = Math.max(level, 2); continue; }
      }
      return { solved: g.every((v) => v >= 0), level, grid: g };
    }
  }

  function generate(tier, seed) {
    const T = TIERS[tier], n = T.n;
    const r = C.rng("takuzu|" + seed);
    let best = null;
    for (let attempt = 0; attempt < T.tries; attempt++) {
      const sol = fullGrid(n, r);
      const g = sol.slice();
      for (const i of C.shuffle(r, C.range(n * n))) {
        const keep = g[i];
        g[i] = -1;
        if (!logicSolve(g, n, T.max).solved) g[i] = keep;
      }
      const level = logicSolve(g, n, T.max).level;
      const clues = g.filter((v) => v >= 0).length;
      if (!best || level > best.level || (level === best.level && clues < best.clues)) best = { g, sol, level, clues };
      if (level >= T.want) break;
    }
    return { kind: "takuzu", n, tier, seed, givens: best.g, solution: best.sol, rating: best.level, clues: best.clues };
  }

  /** Brute-force count (tests only). */
  function countSolutions(grid, n, limit) {
    const g = grid.slice();
    let count = 0;
    const all = linesOf(n);
    (function go() {
      if (count >= limit) return;
      const res = logicSolve(g, n, 2);
      if (res.bad) return;
      const i = res.grid.indexOf(-1);
      if (i < 0) {
        // verify distinct rows/cols
        const seen = new Set();
        for (const cells of all) seen.add((cells[0] - cells[1] === -1 ? "r" : "c") + cells.map((k) => res.grid[k]).join(""));
        if (seen.size === 2 * n) count++;
        return;
      }
      for (const v of [0, 1]) {
        const saved = g.slice();
        for (let k = 0; k < g.length; k++) g[k] = res.grid[k];
        g[i] = v;
        go();
        for (let k = 0; k < g.length; k++) g[k] = saved[k];
      }
    })();
    return count;
  }

  /** Next logical step for a hint. Returns {cell, value, why, line} or null. */
  function hint(values, n) {
    const all = linesOf(n);
    for (let li = 0; li < 2 * n; li++) {
      const res = basicLine(values, all[li], n);
      if (res.length) return { cell: res[0][0], value: res[0][1], why: res[0][2], line: li };
    }
    for (let li = 0; li < 2 * n; li++) {
      const res = fullLine(values, all[li], n, li, all);
      if (res && res.length) return { cell: res[0][0], value: res[0][1], why: "line", line: li };
    }
    return null;
  }

  root.GraphiteTakuzu = { TIERS, generate, logicSolve, countSolutions, hint, validLines, linesOf };
})(typeof globalThis !== "undefined" ? globalThis : this);
