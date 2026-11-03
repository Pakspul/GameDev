// Graphite: Star Battle generator and solver.
//
// Rules: place stars so that every row, every column and every outlined region holds
// exactly k stars (1 or 2), and no two stars touch, not even diagonally.
//
// How a puzzle is made:
//   1. Place a valid set of stars (the intended solution) with seeded backtracking.
//   2. Grow one "proto-region" from every star until the grid is covered. With 2 stars
//      per region, pair up neighbouring proto-regions (a random perfect matching).
//   3. While the solver finds a second solution, move a cell where that solution differs
//      over to a neighbouring region (never a star cell, never splitting a region).
//      The intended solution stays valid at every step, so this ends with exactly one.
(function (root) {
  "use strict";
  const C = root.GraphiteCommon;

  const TIERS = {
    easy:   { label: "Easy",   n: 6,  k: 1 },
    medium: { label: "Medium", n: 8,  k: 1 },
    hard:   { label: "Hard",   n: 9,  k: 1 },
    expert: { label: "Expert", n: 10, k: 2 },
  };

  // ---- 1. intended solution ----
  function rowChoices(n, k) {
    const out = [];
    for (let m = 0; m < 1 << n; m++) if (C.popcount(m) === k && !(m & (m >> 1))) out.push(m);
    return out;
  }
  function placeStars(n, k, r) {
    const choices = rowChoices(n, k);
    const rows = [], colCount = new Array(n).fill(0);
    (function go() {
      if (rows.length === n) return true;
      const prev = rows.length ? rows[rows.length - 1] : 0;
      const block = prev | (prev << 1) | (prev >> 1);
      for (const m of C.shuffle(r, choices.slice())) {
        if (m & block) continue;
        let ok = true;
        for (let c = 0; c < n && ok; c++) if ((m >> c) & 1 && colCount[c] >= k) ok = false;
        if (!ok) continue;
        rows.push(m);
        for (let c = 0; c < n; c++) colCount[c] += (m >> c) & 1;
        if (go()) return true;
        rows.pop();
        for (let c = 0; c < n; c++) colCount[c] -= (m >> c) & 1;
      }
      return false;
    })();
    const stars = [];
    rows.forEach((m, rr) => { for (let c = 0; c < n; c++) if ((m >> c) & 1) stars.push(rr * n + c); });
    return stars;
  }

  const nbrs4 = (n, i) => {
    const r = (i / n) | 0, c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  };

  // ---- 2. regions ----
  function growRegions(n, seeds, r) {
    const lab = new Array(n * n).fill(-1);
    seeds.forEach((s, k) => (lab[s] = k));
    let left = n * n - seeds.length;
    while (left > 0) {
      // pick a random unassigned cell that touches a region and join one of its neighbours
      const frontier = [];
      for (let i = 0; i < n * n; i++) if (lab[i] < 0 && nbrs4(n, i).some((j) => lab[j] >= 0)) frontier.push(i);
      const i = frontier[C.randInt(r, frontier.length)];
      const opts = nbrs4(n, i).filter((j) => lab[j] >= 0);
      lab[i] = lab[opts[C.randInt(r, opts.length)]];
      left--;
    }
    return lab;
  }

  function pairUp(n, lab, count, r) {
    const adj = [];
    for (let a = 0; a < count; a++) adj.push(new Set());
    for (let i = 0; i < n * n; i++) for (const j of nbrs4(n, i)) if (lab[i] !== lab[j]) adj[lab[i]].add(lab[j]);
    const mate = new Array(count).fill(-1);
    let steps = 0;
    const ok = (function go() {
      if (++steps > 20000) return false;
      let a = -1, best = 1e9;
      for (let x = 0; x < count; x++) {
        if (mate[x] >= 0) continue;
        let free = 0;
        for (const y of adj[x]) if (mate[y] < 0) free++;
        if (free < best) { best = free; a = x; }
      }
      if (a < 0) return true;
      if (!best) return false;
      for (const b of C.shuffle(r, [...adj[a]])) {
        if (mate[b] >= 0) continue;
        mate[a] = b; mate[b] = a;
        if (go()) return true;
        mate[a] = -1; mate[b] = -1;
      }
      return false;
    })();
    if (!ok) return null;
    const id = new Array(count).fill(-1);
    let next = 0;
    for (let a = 0; a < count; a++) if (id[a] < 0) { id[a] = id[mate[a]] = next++; }
    return lab.map((x) => id[x]);
  }

  /** Renumber regions in reading order so region 0 is top-left (nicer colours, stable output). */
  function normalise(lab) {
    const map = new Map();
    return lab.map((x) => { if (!map.has(x)) map.set(x, map.size); return map.get(x); });
  }

  function connectedWithout(n, lab, cell) {
    const reg = lab[cell];
    const cells = [];
    for (let i = 0; i < n * n; i++) if (i !== cell && lab[i] === reg) cells.push(i);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]), stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop();
      for (const j of nbrs4(n, i)) if (j !== cell && lab[j] === reg && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
    return seen.size === cells.length;
  }

  // ---- solver ----
  /** Up to `limit` solutions, each as a sorted list of star cells. */
  function solve(n, k, lab, limit, given) {
    const choices = rowChoices(n, k);
    const regCount = new Array(n).fill(0), colCount = new Array(n).fill(0);
    // the last row each region (and each column, trivially n-1) appears in, for pruning
    const regLast = new Array(n).fill(0), regRowsLeft = [];
    for (let i = 0; i < n * n; i++) regLast[lab[i]] = Math.max(regLast[lab[i]], (i / n) | 0);
    // regRowsLeft[r][g] = number of cells of region g in rows > r
    for (let r = 0; r < n; r++) {
      const a = new Array(n).fill(0);
      for (let i = (r + 1) * n; i < n * n; i++) a[lab[i]]++;
      regRowsLeft.push(a);
    }
    const mustRow = [], banRow = [];
    for (let r = 0; r < n; r++) { mustRow.push(0); banRow.push(0); }
    if (given) given.forEach((v, i) => { const r = (i / n) | 0, c = i % n; if (v === 2) mustRow[r] |= 1 << c; else if (v === 1) banRow[r] |= 1 << c; });
    const sols = [], cur = [];
    (function go(r, prev) {
      if (sols.length >= limit) return;
      if (r === n) { sols.push(cur.slice()); return; }
      const block = prev | (prev << 1) | (prev >> 1);
      for (const m of choices) {
        if (m & block || m & banRow[r] || (m & mustRow[r]) !== mustRow[r]) continue;
        let ok = true;
        for (let c = 0; c < n && ok; c++) {
          if (!((m >> c) & 1)) continue;
          if (colCount[c] >= k || regCount[lab[r * n + c]] >= k) ok = false;
        }
        if (!ok) continue;
        for (let c = 0; c < n; c++) if ((m >> c) & 1) { colCount[c]++; regCount[lab[r * n + c]]++; cur.push(r * n + c); }
        // every region still short of stars must have room below
        let feasible = true;
        for (let g = 0; g < n && feasible; g++) {
          const need = k - regCount[g];
          if (need > 0 && (regLast[g] <= r || regRowsLeft[r][g] < need)) feasible = false;
        }
        for (let c = 0; c < n && feasible; c++) if (k - colCount[c] > Math.ceil((n - 1 - r) / 2)) feasible = false;
        if (feasible) go(r + 1, m);
        for (let c = 0; c < n; c++) if ((m >> c) & 1) { colCount[c]--; regCount[lab[r * n + c]]--; cur.pop(); }
        if (sols.length >= limit) return;
      }
    })(0, 0);
    return sols;
  }

  function generate(tier, seed) {
    const T = TIERS[tier], n = T.n, k = T.k;
    const r = C.rng("stars|" + seed);
    for (let attempt = 0; attempt < 50; attempt++) {
      const stars = placeStars(n, k, r);
      let lab = growRegions(n, C.shuffle(r, stars.slice()), r);
      if (k === 2) { lab = pairUp(n, lab, stars.length, r); if (!lab) continue; }
      const starSet = new Set(stars);
      // Hill climb: score = number of solutions (capped). Keep a move only if it doesn't
      // make things worse, so every step heads towards exactly one solution.
      const CAP = 2;
      let sols = solve(n, k, lab, CAP);
      let unique = sols.length === 1;
      for (let iter = 0; iter < 300 && !unique; iter++) {
        // cells where another solution puts a star but ours doesn't: moving one of them to a
        // neighbouring region breaks that solution
        const cand = [];
        for (const s of sols) for (const x of s) if (!starSet.has(x) && cand.indexOf(x) < 0) cand.push(x);
        const x = cand.length && r() < 0.85 ? cand[C.randInt(r, cand.length)] : C.randInt(r, n * n);
        if (starSet.has(x) || !connectedWithout(n, lab, x)) continue;
        const opts = [...new Set(nbrs4(n, x).map((j) => lab[j]).filter((g) => g !== lab[x]))];
        if (!opts.length) continue;
        const from = lab[x];
        lab[x] = opts[C.randInt(r, opts.length)];
        const next = solve(n, k, lab, CAP);
        if (next.length <= sols.length) { sols = next; unique = next.length === 1; }
        else lab[x] = from;
      }
      if (!unique) continue;
      lab = normalise(lab);
      const solution = new Array(n * n).fill(0);
      for (const s of stars) solution[s] = 1;
      return { kind: "stars", n, k, tier, seed, regions: lab, solution };
    }
    throw new Error("Star Battle generator gave up on " + seed);
  }

  root.GraphiteStars = { TIERS, generate, solve };
})(typeof globalThis !== "undefined" ? globalThis : this);
