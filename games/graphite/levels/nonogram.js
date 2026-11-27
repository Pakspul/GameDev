// Graphite: Nonogram (also known as Hanjie, Griddlers or paint by numbers) generator and
// logical solver.
//
// Rules: colour cells so that every row and column shows the blocks its clue lists, in that
// order, with at least one empty cell between blocks. "3 1" means a block of three, a gap,
// then a single cell. "0" means the line stays empty.
//
// Puzzles are little pictures: random noise, smoothed into blobs and often mirrored, so they
// read as shapes rather than static. A picture is only kept if the line solver finishes it:
// that proves it has exactly one solution and never needs guessing. The line solver looks at
// one row or column at a time and keeps what every way to fit its clue agrees on. Harder
// tiers keep the picture that needs the most sweeps over the grid.
(function (root) {
  "use strict";
  const C = root.GraphiteCommon;

  const TIERS = {
    easy:   { n: 5,  density: 0.62, depth: 3, tries: 3, hardest: false },
    medium: { n: 8,  density: 0.58, depth: 4, tries: 2, hardest: true },
    hard:   { n: 10, density: 0.55, depth: 4, tries: 5, hardest: true },
    expert: { n: 12, density: 0.52, depth: 5, tries: 8, hardest: true },
  };

  /** The clue of a line: the lengths of its runs of filled cells ([] for an empty line). */
  function runs(cells) {
    const out = [];
    let k = 0;
    for (const v of cells) {
      if (v === 1) k++;
      else if (k) { out.push(k); k = 0; }
    }
    if (k) out.push(k);
    return out;
  }

  // ---- lines: li < n is row li, otherwise column li - n ----
  const LINES = {};
  function linesOf(n) {
    if (!LINES[n]) {
      LINES[n] = [];
      for (let li = 0; li < 2 * n; li++) {
        const a = [];
        for (let k = 0; k < n; k++) a.push(li < n ? li * n + k : k * n + (li - n));
        LINES[n].push(a);
      }
    }
    return LINES[n];
  }
  function cluesOf(n, grid) {
    const all = linesOf(n);
    const clue = (li) => runs(all[li].map((i) => grid[i]));
    return { rows: C.range(n).map((r) => clue(r)), cols: C.range(n).map((c) => clue(n + c)) };
  }

  /**
   * Everything one line's clue says about it. `line` holds -1 (unknown), 0 (empty), 1 (filled).
   * Returns the line with every cell that all valid placements agree on filled in, or null
   * when no placement fits. Two tables do the work: pre[i][j] says the first i cells can hold
   * the first j blocks, suf[i][j] says cells i.. can hold blocks j...
   */
  function lineSolve(clue, line) {
    const n = line.length, k = clue.length;
    // emptyBefore[i]: how many known-empty cells among the first i
    const emptyBefore = new Array(n + 1).fill(0);
    for (let i = 0; i < n; i++) emptyBefore[i + 1] = emptyBefore[i] + (line[i] === 0 ? 1 : 0);
    const fits = (s, e) => emptyBefore[e] - emptyBefore[s] === 0; // no known-empty cell in [s, e)
    const pre = [], suf = [];
    for (let i = 0; i <= n; i++) { pre.push(new Array(k + 1).fill(false)); suf.push(new Array(k + 1).fill(false)); }
    pre[0][0] = true;
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j <= k; j++) {
        let ok = line[i - 1] !== 1 && pre[i - 1][j]; // cell i-1 empty
        if (!ok && j > 0) { // block j-1 ends at cell i-1
          const s = i - clue[j - 1];
          if (s >= 0 && fits(s, i)) ok = s === 0 ? j === 1 : line[s - 1] !== 1 && pre[s - 1][j - 1];
        }
        pre[i][j] = ok;
      }
    }
    suf[n][k] = true;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = k; j >= 0; j--) {
        let ok = line[i] !== 1 && suf[i + 1][j]; // cell i empty
        if (!ok && j < k) { // block j starts at cell i
          const e = i + clue[j];
          if (e <= n && fits(i, e)) ok = e === n ? j === k - 1 : line[e] !== 1 && suf[e + 1][j + 1];
        }
        suf[i][j] = ok;
      }
    }
    if (!pre[n][k]) return null;
    const canEmpty = new Array(n).fill(false);
    for (let x = 0; x < n; x++) {
      if (line[x] === 1) continue;
      for (let j = 0; j <= k && !canEmpty[x]; j++) if (pre[x][j] && suf[x + 1][j]) canEmpty[x] = true;
    }
    const cover = new Array(n + 1).fill(0); // difference array: cells some placement fills
    for (let j = 0; j < k; j++) {
      const len = clue[j];
      for (let s = 0; s + len <= n; s++) {
        const e = s + len;
        if (!fits(s, e)) continue;
        const left = s === 0 ? j === 0 : line[s - 1] !== 1 && pre[s - 1][j];
        if (!left) continue;
        const right = e === n ? j === k - 1 : line[e] !== 1 && suf[e + 1][j + 1];
        if (!right) continue;
        cover[s]++; cover[e]--;
      }
    }
    const out = line.slice();
    let run = 0;
    for (let x = 0; x < n; x++) {
      run += cover[x];
      const canFill = run > 0;
      if (!canFill && !canEmpty[x]) return null;
      if (out[x] === -1) {
        if (canFill && !canEmpty[x]) out[x] = 1;
        else if (!canFill) out[x] = 0;
      }
    }
    return out;
  }

  /**
   * Sweeps every line until nothing changes. `rounds` counts the sweeps that found something:
   * the generator's measure of difficulty.
   */
  function logicSolve(n, rows, cols, start) {
    const g = start ? start.slice() : new Array(n * n).fill(-1);
    const all = linesOf(n);
    const clue = (li) => (li < n ? rows[li] : cols[li - n]);
    let dirty = new Array(2 * n).fill(true), rounds = 0;
    for (;;) {
      const next = new Array(2 * n).fill(false);
      let changed = false;
      for (let li = 0; li < 2 * n; li++) {
        if (!dirty[li]) continue;
        const cells = all[li];
        const res = lineSolve(clue(li), cells.map((i) => g[i]));
        if (!res) return { solved: false, bad: true, rounds, grid: g };
        res.forEach((v, k) => {
          const i = cells[k];
          if (g[i] !== v) {
            g[i] = v; changed = true;
            next[li < n ? n + k : k] = true; // the crossing line
          }
        });
      }
      if (!changed) break;
      rounds++;
      dirty = next;
    }
    return { solved: g.every((v) => v >= 0), bad: false, rounds, grid: g };
  }

  /** A random picture: noise, smoothed into blobs, often mirrored left to right. */
  function picture(n, T, r) {
    const mirror = r() < 0.55;
    let g = new Array(n * n);
    for (let i = 0; i < n * n; i++) g[i] = r() < T.density ? 1 : 0;
    if (mirror) for (let y = 0; y < n; y++) for (let x = 0; x < n / 2; x++) g[y * n + n - 1 - x] = g[y * n + x];
    // one pass of "most neighbours win": a cell with 5+ filled neighbours fills, one with 2 or
    // fewer empties. Cells beyond the edge count as empty, which gives the picture a margin.
    const h = g.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && xx >= 0 && yy < n && xx < n && g[yy * n + xx]) k++;
      }
      if (k >= 5) h[y * n + x] = 1;
      else if (k <= 2) h[y * n + x] = 0;
    }
    return h;
  }

  function generate(tier, seed) {
    const T = TIERS[tier], n = T.n;
    const r = C.rng("nonogram|" + seed);
    let best = null, found = 0;
    for (let attempt = 0; attempt < 5000 && found < T.tries; attempt++) {
      const g = picture(n, T, r);
      const filled = g.reduce((a, b) => a + b, 0);
      if (filled < n * n * 0.3 || filled > n * n * 0.72) continue;
      const { rows, cols } = cluesOf(n, g);
      const lines = rows.concat(cols);
      if (lines.filter((c) => !c.length).length > Math.floor(n / 5)) continue; // too many blank lines
      if (lines.some((c) => c.length > T.depth)) continue; // clues must fit beside a phone-sized board
      const res = logicSolve(n, rows, cols);
      if (!res.solved) continue;
      found++;
      const better = !best || (T.hardest ? res.rounds > best.rounds : res.rounds < best.rounds);
      if (better) best = { g, rows, cols, rounds: res.rounds };
    }
    if (!best) throw new Error("no nonogram found for " + seed);
    return { kind: "nonogram", n, tier, seed, rows: best.rows, cols: best.cols, solution: best.g, rating: best.rounds };
  }

  /** Brute-force count with line solving in between (tests only). */
  function countSolutions(n, rows, cols, limit) {
    let count = 0;
    (function go(g) {
      if (count >= limit) return;
      const res = logicSolve(n, rows, cols, g);
      if (res.bad) return;
      const i = res.grid.indexOf(-1);
      if (i < 0) { count++; return; }
      for (const v of [1, 0]) { const h = res.grid.slice(); h[i] = v; go(h); }
    })(null);
    return count;
  }

  /**
   * The next step for a hint, from the player's board (-1 unknown, 0 crossed, 1 filled).
   * Filling cells comes first, since crosses are optional; among those, the line that
   * fills the most. Only when no line can fill anything: the line that rules out the most.
   * Returns {line, cells, value, why} with why "fill", "empty", "done" (the line has all
   * its blocks) or "zero" (the clue is 0), or null.
   */
  function hint(n, rows, cols, state) {
    const all = linesOf(n);
    let bestFill = null, bestEmpty = null;
    for (let li = 0; li < 2 * n; li++) {
      const clue = li < n ? rows[li] : cols[li - n];
      const before = all[li].map((i) => state[i]);
      const res = lineSolve(clue, before);
      if (!res) continue;
      const fill = [], empty = [];
      res.forEach((v, k) => { if (before[k] === -1) (v === 1 ? fill : v === 0 ? empty : []).push(all[li][k]); });
      if (fill.length && (!bestFill || fill.length > bestFill.cells.length)) bestFill = { line: li, cells: fill, value: 1, why: "fill" };
      if (empty.length) {
        const have = before.filter((v) => v === 1).length, need = clue.reduce((a, b) => a + b, 0);
        const why = !clue.length ? "zero" : have === need ? "done" : "empty";
        const rank = (w) => (w === "empty" ? 0 : 1);
        if (!bestEmpty || rank(why) > rank(bestEmpty.why) || (rank(why) === rank(bestEmpty.why) && empty.length > bestEmpty.cells.length)) {
          bestEmpty = { line: li, cells: empty, value: 0, why };
        }
      }
    }
    return bestFill || bestEmpty;
  }

  root.GraphiteNonogram = { TIERS, generate, logicSolve, lineSolve, countSolutions, hint, runs, linesOf };
})(typeof globalThis !== "undefined" ? globalThis : this);
