// Graphite: Calcudoku generator and solver.
//
// Rules: fill an n×n grid with 1..n so that no number repeats in a row or column, and the
// numbers in every outlined cage combine to the cage's target with its operation.
// For − and ÷ (always two cells) take the bigger number first.
//
// How a puzzle is made: a random Latin square, cut into random cages, each given an
// operation. The solver counts solutions; if there is more than one, the cages around a
// cell where the solutions differ are redrawn, until exactly one solution is left.
(function (root) {
  "use strict";
  const C = root.GraphiteCommon;

  const TIERS = {
    // sizes: cage sizes to draw from; singles: how many one-cell cages (free numbers) may stay
    easy:   { label: "Easy",   n: 4, sizes: [1, 2, 2, 2, 3, 3], singles: 2 },
    medium: { label: "Medium", n: 5, sizes: [1, 2, 2, 2, 3, 3, 3], singles: 2 },
    hard:   { label: "Hard",   n: 6, sizes: [2, 2, 2, 3, 3, 3, 4], singles: 1 },
    expert: { label: "Expert", n: 7, sizes: [2, 2, 3, 3, 3, 4, 4], singles: 0 },
  };

  function latin(n, r) {
    const g = new Array(n * n).fill(0);
    const rm = new Array(n).fill(0), cm = new Array(n).fill(0);
    const orders = [];
    for (let i = 0; i < n * n; i++) orders.push(C.shuffle(r, C.range(n).map((x) => x + 1)));
    (function go(i) {
      if (i === n * n) return true;
      const ro = (i / n) | 0, co = i % n;
      for (const v of orders[i]) {
        const b = 1 << v;
        if ((rm[ro] | cm[co]) & b) continue;
        g[i] = v; rm[ro] |= b; cm[co] |= b;
        if (go(i + 1)) return true;
        rm[ro] &= ~b; cm[co] &= ~b;
      }
      return false;
    })(0);
    return g;
  }

  const nbrs4 = (n, i) => {
    const r = (i / n) | 0, c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  };

  function applyOp(op, vals) {
    if (op === "+") return vals.reduce((a, b) => a + b, 0);
    if (op === "×") return vals.reduce((a, b) => a * b, 1);
    const hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
    if (op === "−") return hi - lo;
    return hi % lo === 0 ? hi / lo : -1; // ÷
  }

  function makeCage(cells, sol, r) {
    const vals = cells.map((i) => sol[i]);
    let op;
    if (cells.length === 1) op = "";
    else if (cells.length === 2) {
      const hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
      const x = r();
      if (hi % lo === 0 && x < 0.45) op = "÷";
      else if (x < 0.75) op = "−";
      else op = r() < 0.5 ? "+" : "×";
    } else op = r() < 0.55 ? "+" : "×";
    return { cells, op, target: op ? applyOp(op, vals) : vals[0] };
  }

  /** Cut the cells in `free` (a Set) into cages; returns list of cell lists. */
  function cutCages(n, free, sizes, r) {
    const out = [];
    const order = C.shuffle(r, [...free]);
    const taken = new Set();
    for (const start of order) {
      if (taken.has(start)) continue;
      const want = sizes[C.randInt(r, sizes.length)];
      const cells = [start];
      taken.add(start);
      while (cells.length < want) {
        const opts = [];
        for (const c of cells) for (const j of nbrs4(n, c)) if (free.has(j) && !taken.has(j) && opts.indexOf(j) < 0) opts.push(j);
        if (!opts.length) break;
        const j = opts[C.randInt(r, opts.length)];
        cells.push(j); taken.add(j);
      }
      out.push(cells.sort((a, b) => a - b));
    }
    return out;
  }

  /** Merge one-cell cages into a small neighbouring cage until at most `allow` are left. */
  function mergeSingles(n, cages, allow, r) {
    for (;;) {
      const singles = cages.filter((c) => c.length === 1);
      if (singles.length <= allow) return cages;
      const s = singles[C.randInt(r, singles.length)];
      const near = cages.filter((c) => c !== s && c.some((i) => nbrs4(n, s[0]).indexOf(i) >= 0));
      let opts = near.filter((c) => c.length < 4);
      if (!opts.length) opts = near.filter((c) => c.length < 5);
      if (!opts.length) return cages; // boxed in by big cages: let it be
      const into = opts[C.randInt(r, opts.length)];
      into.push(s[0]); into.sort((a, b) => a - b);
      cages = cages.filter((c) => c !== s);
    }
  }

  // ---- solver ----
  /** All value tuples for a cage, respecting the operation and row/column clashes inside the cage. */
  function cageTuples(n, cage) {
    const k = cage.cells.length, out = [], cur = [];
    const rows = cage.cells.map((i) => (i / n) | 0), cols = cage.cells.map((i) => i % n);
    (function go(d) {
      if (d === k) {
        if ((cage.op ? applyOp(cage.op, cur) : cur[0]) === cage.target) out.push(cur.slice());
        return;
      }
      for (let v = 1; v <= n; v++) {
        let clash = false;
        for (let e = 0; e < d && !clash; e++) if (cur[e] === v && (rows[e] === rows[d] || cols[e] === cols[d])) clash = true;
        if (clash) continue;
        cur.push(v); go(d + 1); cur.pop();
      }
    })(0);
    return out;
  }

  /**
   * Counts solutions (up to `limit`). Optional `fixed` pins values (0 = free).
   * Returns {count, solutions, domains} where domains are the candidate masks after the
   * first round of propagation (used for hints).
   */
  function solve(n, cages, limit, fixed) {
    const N = n * n;
    const cageOf = new Array(N);
    const tuples = cages.map((cg, k) => { cg.cells.forEach((i) => (cageOf[i] = k)); return cageTuples(n, cg); });
    const full = ((1 << n) - 1) << 1;
    const sols = [];
    let firstDomains = null;

    function propagate(dom) {
      for (let changed = true; changed;) {
        changed = false;
        // row/column: solved cells remove their value from peers; hidden singles
        for (let i = 0; i < N; i++) {
          const d = dom[i];
          if (!d) return false;
          if (d & (d - 1)) continue;
          const r = (i / n) | 0, c = i % n;
          for (let k = 0; k < n; k++) {
            const a = r * n + k, b = k * n + c;
            if (a !== i && dom[a] & d) { dom[a] &= ~d; changed = true; if (!dom[a]) return false; }
            if (b !== i && dom[b] & d) { dom[b] &= ~d; changed = true; if (!dom[b]) return false; }
          }
        }
        // cages: keep only values that appear in some consistent tuple
        for (let k = 0; k < cages.length; k++) {
          const cells = cages[k].cells;
          const union = new Array(cells.length).fill(0);
          let any = false;
          for (const t of tuples[k]) {
            let ok = true;
            for (let e = 0; e < cells.length; e++) if (!(dom[cells[e]] & (1 << t[e]))) { ok = false; break; }
            if (!ok) continue;
            any = true;
            for (let e = 0; e < cells.length; e++) union[e] |= 1 << t[e];
          }
          if (!any) return false;
          for (let e = 0; e < cells.length; e++) {
            const nd = dom[cells[e]] & union[e];
            if (nd !== dom[cells[e]]) { dom[cells[e]] = nd; changed = true; }
          }
        }
      }
      return true;
    }

    (function go(dom) {
      if (sols.length >= limit) return;
      if (!propagate(dom)) return;
      if (!firstDomains) firstDomains = dom.slice();
      let best = -1, bestN = 99;
      for (let i = 0; i < N; i++) {
        const c = C.popcount(dom[i]);
        if (c > 1 && c < bestN) { best = i; bestN = c; }
      }
      if (best < 0) { sols.push(dom.map((d) => C.bitIndex(d))); return; }
      let m = dom[best];
      while (m && sols.length < limit) {
        const b = m & -m; m &= m - 1;
        const d2 = dom.slice(); d2[best] = b;
        go(d2);
      }
    })(new Array(N).fill(0).map((_, i) => (fixed && fixed[i] ? 1 << fixed[i] : full)));
    return { count: sols.length, solutions: sols, domains: firstDomains };
  }

  function generate(tier, seed) {
    const T = TIERS[tier], n = T.n;
    const r = C.rng("calcudoku|" + seed);
    for (let attempt = 0; attempt < 60; attempt++) {
      const sol = latin(n, r);
      let cages = mergeSingles(n, cutCages(n, new Set(C.range(n * n)), T.sizes, r), T.singles, r).map((cells) => makeCage(cells, sol, r));
      for (let iter = 0; iter < 80; iter++) {
        const res = solve(n, cages, 2);
        if (res.count === 1) {
          cages.sort((a, b) => a.cells[0] - b.cells[0]);
          return { kind: "calcudoku", n, tier, seed, cages, solution: sol };
        }
        // redraw the cages around a cell where the two solutions disagree
        const other = res.solutions.find((s) => s.some((v, i) => v !== sol[i]));
        const diffs = C.range(n * n).filter((i) => other[i] !== sol[i]);
        const x = diffs[C.randInt(r, diffs.length)];
        const hit = new Set([x, ...nbrs4(n, x)]);
        const keep = [], free = new Set();
        for (const cg of cages) {
          if (cg.cells.some((i) => hit.has(i))) cg.cells.forEach((i) => free.add(i));
          else keep.push(cg);
        }
        const allow = Math.max(0, T.singles - keep.filter((c) => c.cells.length === 1).length);
        cages = keep.concat(mergeSingles(n, cutCages(n, free, T.sizes, r), allow, r).map((cells) => makeCage(cells, sol, r)));
      }
    }
    throw new Error("Calcudoku generator gave up on " + seed);
  }

  root.GraphiteCalcudoku = { TIERS, generate, solve, applyOp };
})(typeof globalThis !== "undefined" ? globalThis : this);
