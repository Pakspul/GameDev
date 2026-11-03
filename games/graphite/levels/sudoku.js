// Graphite: Sudoku generator, logical solver and grader.
//
// How a puzzle is made:
//   1. Fill a complete 9×9 grid with seeded random backtracking.
//   2. Remove clues in symmetric pairs, in random order. A removal is kept only if the
//      puzzle is still solvable by a *human-style* logical solver that is limited to the
//      techniques allowed for the tier. No guessing is ever needed, and the solution is
//      therefore unique.
//   3. Try a few seeds-in-a-row and keep the one that really needs the tier's hardest
//      technique, so "Expert" doesn't accidentally hand out an easy one.
(function (root) {
  "use strict";
  const C = root.GraphiteCommon;
  const ALL = 0x1ff; // candidates 1..9 as bits 0..8

  // ---- geometry ----
  const ROW = [], COL = [], BOX = [];
  for (let i = 0; i < 81; i++) { ROW[i] = (i / 9) | 0; COL[i] = i % 9; BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0); }
  const UNITS = []; // 0..8 rows, 9..17 cols, 18..26 boxes
  for (let u = 0; u < 27; u++) UNITS.push([]);
  for (let i = 0; i < 81; i++) { UNITS[ROW[i]].push(i); UNITS[9 + COL[i]].push(i); UNITS[18 + BOX[i]].push(i); }
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const s = new Set();
    for (const u of [ROW[i], 9 + COL[i], 18 + BOX[i]]) for (const j of UNITS[u]) if (j !== i) s.add(j);
    PEERS.push([...s]);
  }
  const UNIT_NAME = (u) => (u < 9 ? "row" : u < 18 ? "column" : "box");

  // Technique levels. The tier's `max` caps which ones the generator may rely on.
  const LEVEL = { single: 1, locked: 2, subset: 3, wing: 4 };
  const TIERS = {
    easy:   { label: "Easy",   max: 1, floor: 36, want: 1, tries: 1 },
    medium: { label: "Medium", max: 2, floor: 28, want: 2, tries: 30 },
    hard:   { label: "Hard",   max: 3, floor: 22, want: 3, tries: 40 },
    expert: { label: "Expert", max: 4, floor: 17, want: 4, tries: 40 },
  };

  // ---- full grid ----
  function fullGrid(r) {
    const g = new Array(81).fill(0);
    const rm = new Array(9).fill(0), cm = new Array(9).fill(0), bm = new Array(9).fill(0);
    const orders = [];
    for (let i = 0; i < 81; i++) orders.push(C.shuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]));
    (function go(i) {
      if (i === 81) return true;
      const ro = ROW[i], co = COL[i], bo = BOX[i];
      for (const v of orders[i]) {
        const b = 1 << (v - 1);
        if ((rm[ro] | cm[co] | bm[bo]) & b) continue;
        g[i] = v; rm[ro] |= b; cm[co] |= b; bm[bo] |= b;
        if (go(i + 1)) return true;
        rm[ro] &= ~b; cm[co] &= ~b; bm[bo] &= ~b;
      }
      g[i] = 0;
      return false;
    })(0);
    return g;
  }

  // ---- brute-force counter (used by the tests and as a safety net) ----
  function countSolutions(grid, limit) {
    const g = grid.slice();
    const rm = new Array(9).fill(0), cm = new Array(9).fill(0), bm = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << (g[i] - 1); rm[ROW[i]] |= b; cm[COL[i]] |= b; bm[BOX[i]] |= b; }
    let count = 0;
    (function go() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = ALL & ~(rm[ROW[i]] | cm[COL[i]] | bm[BOX[i]]);
        const n = C.popcount(m);
        if (n < bestN) { best = i; bestMask = m; bestN = n; if (n <= 1) break; }
      }
      if (best < 0) { count++; return; }
      let m = bestMask;
      while (m && count < limit) {
        const b = m & -m; m &= m - 1;
        g[best] = C.bitIndex(b) + 1; rm[ROW[best]] |= b; cm[COL[best]] |= b; bm[BOX[best]] |= b;
        go();
        rm[ROW[best]] &= ~b; cm[COL[best]] &= ~b; bm[BOX[best]] &= ~b; g[best] = 0;
      }
    })();
    return count;
  }

  // ---- logical solver ----
  // State: values g[81] and candidate masks c[81] (0 for filled cells).
  function makeState(grid) {
    const g = grid.slice(), c = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let m = ALL;
      for (const j of PEERS[i]) if (g[j]) m &= ~(1 << (g[j] - 1));
      c[i] = m;
    }
    return { g, c };
  }
  function place(s, i, v) {
    s.g[i] = v; s.c[i] = 0;
    const b = ~(1 << (v - 1));
    for (const j of PEERS[i]) s.c[j] &= b;
  }

  /** Finds one single (naked or hidden). Returns {cell, value, how, unit} or null; {bad:true} on contradiction. */
  function findSingle(s) {
    for (let i = 0; i < 81; i++) {
      if (s.g[i]) continue;
      if (!s.c[i]) return { bad: true };
    }
    // Hidden singles first: they're what people spot first when scanning a box.
    for (const order of [[18, 27], [0, 18]]) {
      for (let u = order[0]; u < order[1]; u++) {
        const cells = UNITS[u];
        for (let v = 0; v < 9; v++) {
          const b = 1 << v;
          let where = -1, n = 0, placed = false;
          for (const i of cells) {
            if (s.g[i] === v + 1) { placed = true; break; }
            if (s.c[i] & b) { n++; where = i; }
          }
          if (placed) continue;
          if (n === 0) return { bad: true };
          if (n === 1) return { cell: where, value: v + 1, how: "hidden", unit: u };
        }
      }
    }
    for (let i = 0; i < 81; i++) {
      if (!s.g[i] && C.popcount(s.c[i]) === 1) return { cell: i, value: C.bitIndex(s.c[i]) + 1, how: "naked" };
    }
    return null;
  }

  function lockedCandidates(s) {
    let changed = false;
    for (let v = 0; v < 9; v++) {
      const b = 1 << v;
      // pointing: box -> line
      for (let bx = 0; bx < 9; bx++) {
        let rows = 0, cols = 0, any = false;
        for (const i of UNITS[18 + bx]) if (s.c[i] & b) { rows |= 1 << ROW[i]; cols |= 1 << COL[i]; any = true; }
        if (!any) continue;
        if (C.popcount(rows) === 1) {
          for (const i of UNITS[C.bitIndex(rows)]) if (BOX[i] !== bx && (s.c[i] & b)) { s.c[i] &= ~b; changed = true; }
        }
        if (C.popcount(cols) === 1) {
          for (const i of UNITS[9 + C.bitIndex(cols)]) if (BOX[i] !== bx && (s.c[i] & b)) { s.c[i] &= ~b; changed = true; }
        }
      }
      // claiming: line -> box
      for (let u = 0; u < 18; u++) {
        let boxes = 0, any = false;
        for (const i of UNITS[u]) if (s.c[i] & b) { boxes |= 1 << BOX[i]; any = true; }
        if (!any || C.popcount(boxes) !== 1) continue;
        for (const i of UNITS[18 + C.bitIndex(boxes)]) {
          const inLine = u < 9 ? ROW[i] === u : COL[i] === u - 9;
          if (!inLine && (s.c[i] & b)) { s.c[i] &= ~b; changed = true; }
        }
      }
    }
    return changed;
  }

  function subsets(s) {
    let changed = false;
    for (let u = 0; u < 27; u++) {
      const empty = UNITS[u].filter((i) => !s.g[i]);
      const n = empty.length;
      // naked pairs / triples
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        const m2 = s.c[empty[a]] | s.c[empty[b]];
        if (C.popcount(m2) === 2) {
          for (const i of empty) if (i !== empty[a] && i !== empty[b] && (s.c[i] & m2)) { s.c[i] &= ~m2; changed = true; }
        }
        for (let d = b + 1; d < n; d++) {
          const m3 = m2 | s.c[empty[d]];
          if (C.popcount(m3) !== 3) continue;
          for (const i of empty) if (i !== empty[a] && i !== empty[b] && i !== empty[d] && (s.c[i] & m3)) { s.c[i] &= ~m3; changed = true; }
        }
      }
      // hidden pairs
      const pos = new Array(9).fill(0);
      UNITS[u].forEach((i, k) => { for (let v = 0; v < 9; v++) if (s.c[i] & (1 << v)) pos[v] |= 1 << k; });
      for (let v1 = 0; v1 < 9; v1++) for (let v2 = v1 + 1; v2 < 9; v2++) {
        if (!pos[v1] || !pos[v2]) continue;
        const p = pos[v1] | pos[v2];
        if (C.popcount(p) !== 2 || C.popcount(pos[v1]) !== 2 || C.popcount(pos[v2]) !== 2) continue;
        const keep = (1 << v1) | (1 << v2);
        UNITS[u].forEach((i, k) => { if ((p >> k) & 1 && (s.c[i] & ~keep)) { s.c[i] &= keep; changed = true; } });
      }
    }
    return changed;
  }

  function wings(s) {
    let changed = false;
    // X-wing on rows and on columns
    for (let v = 0; v < 9; v++) {
      const b = 1 << v;
      for (const byRow of [true, false]) {
        const lines = [];
        for (let l = 0; l < 9; l++) {
          let m = 0;
          for (const i of UNITS[byRow ? l : 9 + l]) if (s.c[i] & b) m |= 1 << (byRow ? COL[i] : ROW[i]);
          lines.push(m);
        }
        for (let a = 0; a < 9; a++) {
          if (C.popcount(lines[a]) !== 2) continue;
          for (let d = a + 1; d < 9; d++) {
            if (lines[d] !== lines[a]) continue;
            let m = lines[a];
            while (m) {
              const x = C.bitIndex(m); m &= m - 1;
              for (const i of UNITS[byRow ? 9 + x : x]) {
                const l = byRow ? ROW[i] : COL[i];
                if (l !== a && l !== d && (s.c[i] & b)) { s.c[i] &= ~b; changed = true; }
              }
            }
          }
        }
      }
    }
    if (changed) return true;
    // XY-wing
    for (let p = 0; p < 81; p++) {
      if (C.popcount(s.c[p]) !== 2) continue;
      const pv = s.c[p];
      const pins = PEERS[p].filter((i) => C.popcount(s.c[i]) === 2 && C.popcount(s.c[i] & pv) === 1);
      for (let a = 0; a < pins.length; a++) for (let d = a + 1; d < pins.length; d++) {
        const A = s.c[pins[a]], B = s.c[pins[d]];
        const z = A & B & ~pv;
        if (!z || C.popcount(z) !== 1 || (A & pv) === (B & pv)) continue;
        for (const i of PEERS[pins[a]]) {
          if (i === p || i === pins[d] || !(s.c[i] & z)) continue;
          if (PEERS[pins[d]].indexOf(i) >= 0) { s.c[i] &= ~z; changed = true; }
        }
      }
    }
    return changed;
  }

  /** Solve as far as the allowed techniques go. Returns {solved, level, bad}. */
  function logicSolve(grid, max) {
    const s = makeState(grid);
    let level = 0;
    for (;;) {
      const hit = findSingle(s);
      if (hit && hit.bad) return { solved: false, bad: true, level };
      if (hit) { place(s, hit.cell, hit.value); level = Math.max(level, 1); continue; }
      if (s.g.every((v) => v)) return { solved: true, level, grid: s.g };
      if (max >= 2 && lockedCandidates(s)) { level = Math.max(level, 2); continue; }
      if (max >= 3 && subsets(s)) { level = Math.max(level, 3); continue; }
      if (max >= 4 && wings(s)) { level = Math.max(level, 4); continue; }
      return { solved: false, level };
    }
  }

  function generate(tier, seed) {
    const T = TIERS[tier];
    const r = C.rng("sudoku|" + seed);
    let best = null;
    for (let attempt = 0; attempt < T.tries; attempt++) {
      const sol = fullGrid(r);
      const g = sol.slice();
      const order = C.shuffle(r, C.range(41)); // 40 symmetric pairs + the centre
      let clues = 81;
      for (const k of order) {
        if (clues <= T.floor) break;
        const a = k, b = 80 - k;
        const sa = g[a], sb = g[b];
        g[a] = 0; g[b] = 0;
        const res = logicSolve(g, T.max);
        if (res.solved) clues -= a === b ? 1 : 2;
        else { g[a] = sa; g[b] = sb; }
      }
      const level = logicSolve(g, T.max).level;
      const cand = { givens: g, solution: sol, level, clues };
      if (!best || level > best.level || (level === best.level && clues < best.clues)) best = cand;
      if (level >= T.want) break;
    }
    return { kind: "sudoku", n: 9, box: [3, 3], tier, seed, givens: best.givens, solution: best.solution, rating: best.level, clues: best.clues };
  }

  /**
   * Next logical step for a hint, from the player's current (correct) values.
   * Returns {cell, value, text}.
   */
  function hint(values) {
    const s = makeState(values);
    for (let pass = 0; pass < 40; pass++) {
      const hit = findSingle(s);
      if (hit && !hit.bad) {
        const v = hit.value;
        let text;
        if (hit.how === "hidden") text = pass ? `After ruling out a few candidates, this is the only spot left for ${v} in its ${UNIT_NAME(hit.unit)}.` : `This is the only spot left for ${v} in its ${UNIT_NAME(hit.unit)}.`;
        else text = pass ? `After ruling out a few candidates, only ${v} fits here.` : `Every other number already appears in this cell's row, column or box. Only ${v} fits.`;
        return { cell: hit.cell, value: v, text };
      }
      if (!(lockedCandidates(s) || subsets(s) || wings(s))) break;
    }
    return null;
  }

  root.GraphiteSudoku = { TIERS, generate, logicSolve, countSolutions, hint, ROW, COL, BOX, UNITS, PEERS };
})(typeof globalThis !== "undefined" ? globalThis : this);
