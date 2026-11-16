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

  // ---- hints: a small solver that reasons the way a person does ----
  //
  // Board values as in the game: 0 = open, 1 = dot (no star), 2 = star.
  // A unit is a row (0..n-1), a column (n..2n-1) or a region (2n..3n-1).
  //
  // The hint looks for the easiest star to see, from simple to clever:
  //   only     the unit has just enough free cells left (as the player sees the board)
  //   basic    the same after crossing out cells that touch a star, and the rest of any
  //            row, column or region that already has its stars
  //   confined a region whose free cells all lie in one row (or column, or the other way
  //            round) takes that row's star, so the rest of the row stays empty
  //   squeeze  a star in some cells would leave a unit without room, so they stay empty
  //   count    N regions that fit inside N rows take all those rows' stars (same idea as
  //            confined, with more units at once)
  //   trial    a star in some cells leads, after a few forced moves, to a unit without room
  // One step is tried before two, and easy steps before harder ones. If that finds nothing,
  // the easiest kind of step is applied everywhere and the search goes round again. The hint
  // explains the steps the star relied on (up to four, and says so when there were more).
  // Returns null when none of this finds a star; the game then falls back to the solution.
  function hintCtx(n, k, lab) {
    const units = [];
    for (let r = 0; r < n; r++) { const a = []; for (let c = 0; c < n; c++) a.push(r * n + c); units.push(a); }
    for (let c = 0; c < n; c++) { const a = []; for (let r = 0; r < n; r++) a.push(r * n + c); units.push(a); }
    const regs = [];
    for (let g = 0; g < n; g++) regs.push([]);
    for (let i = 0; i < n * n; i++) regs[lab[i]].push(i);
    return { n, k, lab, units: units.concat(regs) };
  }
  const UNIT_TYPES = ["row", "column", "region"];
  const unitType = (ctx, u) => UNIT_TYPES[(u / ctx.n) | 0];
  const unitsOf = (ctx, i) => [(i / ctx.n) | 0, ctx.n + (i % ctx.n), 2 * ctx.n + ctx.lab[i]];
  const touching = (n, a, b) => a !== b && Math.abs(((a / n) | 0) - ((b / n) | 0)) <= 1 && Math.abs((a % n) - (b % n)) <= 1;
  function neighbours8(n, i) {
    const r = (i / n) | 0, c = i % n, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
    }
    return out;
  }
  function needOf(ctx, g, u) { let s = 0; for (const i of ctx.units[u]) if (g[i] === 2) s++; return ctx.k - s; }
  function openOf(ctx, g, u) { return ctx.units[u].filter((i) => g[i] === 0); }
  /** Every way to put `need` non-touching stars on the open cells (need is 1 or 2). */
  function placements(n, open, need) {
    const out = [];
    if (need === 1) for (const a of open) out.push([a]);
    else if (need === 2) {
      for (let x = 0; x < open.length; x++) for (let y = x + 1; y < open.length; y++) if (!touching(n, open[x], open[y])) out.push([open[x], open[y]]);
    }
    return out;
  }
  /** Units in the order a person would look at them: regions first, then rows, then columns. */
  function unitOrder(ctx) {
    const n = ctx.n, out = [];
    for (let u = 2 * n; u < 3 * n; u++) out.push(u);
    for (let u = 0; u < 2 * n; u++) out.push(u);
    return out;
  }

  /** Cross out what's plainly impossible. why: Map cell -> reason ("touch" or "full"). */
  function basicDots(ctx, g, why) {
    const n = ctx.n;
    for (let i = 0; i < n * n; i++) {
      if (g[i] !== 2) continue;
      for (const j of neighbours8(n, i)) if (g[j] === 0) { g[j] = 1; if (!why.has(j)) why.set(j, "touch"); }
    }
    for (let u = 0; u < 3 * n; u++) {
      if (needOf(ctx, g, u) !== 0) continue;
      for (const i of ctx.units[u]) if (g[i] === 0) { g[i] = 1; if (!why.has(i)) why.set(i, "full"); }
    }
  }

  /** A star that is forced inside one unit. Prefers units the player has narrowed down most. */
  function forcedStar(ctx, g, seen) {
    let best = null;
    for (const u of unitOrder(ctx)) {
      const need = needOf(ctx, g, u);
      if (need <= 0) continue;
      const open = openOf(ctx, g, u);
      const P = placements(ctx.n, open, need);
      if (!P.length) continue;
      const cell = open.find((c) => P.every((p) => p.indexOf(c) >= 0));
      if (cell === undefined) continue;
      // how many cells the player still has to rule out themselves
      const left = ctx.units[u].filter((i) => seen[i] === 0).length;
      if (!best || left < best.left) best = { u, cell, need, left, how: open.length === need ? (need === 1 ? "only" : "two") : "fit" };
    }
    return best;
  }

  /** Confined / count: a set of units whose free cells sit inside as many units of another kind. */
  function confinedSteps(ctx, g, maxN) {
    const n = ctx.n, out = [];
    const need = [];
    for (let u = 0; u < 3 * n; u++) need.push(needOf(ctx, g, u));
    const famOf = (f, i) => unitsOf(ctx, i)[f];
    for (const A of [2, 0, 1]) for (const B of [0, 1, 2]) {
      if (A === B) continue;
      const As = [];
      for (let u = A * n; u < A * n + n; u++) if (need[u] > 0) As.push(u);
      const pick = [];
      (function go(start) {
        if (pick.length) {
          const inS = new Set(), cover = new Set();
          let needS = 0;
          for (const u of pick) { needS += need[u]; for (const i of ctx.units[u]) if (g[i] === 0) { inS.add(i); cover.add(famOf(B, i)); } }
          let needC = 0;
          for (const u of cover) needC += need[u];
          if (needS === needC) {
            const dots = [];
            for (const u of cover) for (const i of ctx.units[u]) if (g[i] === 0 && !inS.has(i)) dots.push(i);
            if (dots.length) out.push({ how: pick.length === 1 ? "confined" : "count", a: UNIT_TYPES[A], b: UNIT_TYPES[B], src: pick.slice(), cover: [...cover], dots, need: needS });
          }
        }
        if (pick.length >= maxN) return;
        for (let x = start; x < As.length; x++) { pick.push(As[x]); go(x + 1); pick.pop(); }
      })(0);
    }
    out.sort((p, q) => p.src.length - q.src.length || p.dots.length - q.dots.length);
    return out;
  }

  /** Squeeze: cells where a star would leave some unit without room. Grouped per victim unit. */
  function squeezeSteps(ctx, g) {
    const n = ctx.n, order = unitOrder(ctx), byVictim = new Map();
    for (let x = 0; x < n * n; x++) {
      if (g[x] !== 0) continue;
      const h = g.slice();
      h[x] = 2;
      for (const j of neighbours8(n, x)) if (h[j] === 0) h[j] = 1;
      for (const u of unitsOf(ctx, x)) if (needOf(ctx, h, u) === 0) for (const i of ctx.units[u]) if (h[i] === 0) h[i] = 1;
      for (const u of order) {
        const need = needOf(ctx, h, u);
        if (need > 0 && !placements(n, openOf(ctx, h, u), need).length) {
          if (!byVictim.has(u)) byVictim.set(u, []);
          byVictim.get(u).push(x);
          break;
        }
      }
    }
    const out = [];
    for (const [u, xs] of byVictim) out.push({ how: "squeeze", a: unitType(ctx, u), src: [u], dots: xs, need: needOf(ctx, g, u) });
    out.sort((p, q) => ctx.units[p.src[0]].length - ctx.units[q.src[0]].length);
    return out;
  }

  /** Trial: cells where a star leads, after a few forced moves, to a unit without room. */
  function trialSteps(ctx, g) {
    const n = ctx.n, order = unitOrder(ctx), byVictim = new Map();
    for (let x = 0; x < n * n; x++) {
      if (g[x] !== 0) continue;
      const h = g.slice();
      h[x] = 2;
      let victim = -1;
      for (let round = 0; round < 3 * n && victim < 0; round++) {
        basicDots(ctx, h, new Map());
        let placed = false;
        for (const u of order) {
          const need = needOf(ctx, h, u);
          if (need < 0) { victim = u; break; }
          if (need === 0) continue;
          const open = openOf(ctx, h, u), P = placements(n, open, need);
          if (!P.length) { victim = u; break; }
          const c = open.find((i) => P.every((p) => p.indexOf(i) >= 0));
          if (c !== undefined) { h[c] = 2; placed = true; break; }
        }
        if (!placed) break;
      }
      if (victim < 0) continue;
      if (!byVictim.has(victim)) byVictim.set(victim, []);
      byVictim.get(victim).push(x);
    }
    const out = [];
    for (const [u, xs] of byVictim) out.push({ how: "trial", a: unitType(ctx, u), src: [u], dots: xs });
    out.sort((p, q) => q.dots.length - p.dots.length);
    return out;
  }

  /**
   * The easiest next star, with the reasoning behind it.
   * Returns null, or { cell, how, unit, unitCells, need, basic, basicDots, steps, after, dots } where
   *   how       "only" | "two" | "fit": why the star is forced inside its unit
   *   basic     "touch" | "full" | "both" | null: plain eliminations the player hadn't marked
   *             (basicDots: those cells)
   *   steps     the clever steps that led here, in order: [{how, a, b, n, m, need, cells, dots}]
   *             where cells are the step's units (to light up) and dots the cells it rules out
   *   after     true when more steps were needed than the hint explains
   *   dots      every cell to dot so the player can see the reasoning (all empty in the solution)
   */
  const MAX_EXPLAINED = 4;
  function hint(n, k, lab, cells) {
    const ctx = hintCtx(n, k, lab);
    const g = cells.slice(), why = new Map();
    // Walk back from the star: which dots did it rely on, and which steps made those dots?
    // A step relies on the dots in its own units (the region that is confined, the region
    // that gets squeezed), so those are followed too.
    function finish(s, h, w, key) {
      const dots = new Set(), basic = new Set(), used = [], queue = [];
      let touch = false, full = false;
      const visit = (u) => {
        for (const c of ctx.units[u]) {
          if (cells[c] !== 0 || h[c] !== 1) continue;
          dots.add(c);
          const r = w.get(c);
          if (r === "touch") { touch = true; basic.add(c); }
          else if (r === "full") { full = true; basic.add(c); }
          else if (r && used.indexOf(r) < 0 && queue.indexOf(r) < 0) queue.push(r);
        }
      };
      visit(s.u);
      if (key && queue.indexOf(key) < 0) queue.push(key);
      while (queue.length) {
        const st = queue.shift();
        used.push(st);
        for (const d of st.dots) dots.add(d);
        for (const u of st.src) visit(u);
      }
      used.sort((p, q) => p.depth - q.depth);
      const told = used.slice(-MAX_EXPLAINED);
      const cellsOf = (us) => [].concat(...us.map((u) => ctx.units[u]));
      dots.delete(s.cell);
      return {
        cell: s.cell, how: s.how, unit: unitType(ctx, s.u), unitCells: ctx.units[s.u].slice(), need: s.need,
        basic: touch && full ? "both" : touch ? "touch" : full ? "full" : null, basicDots: [...basic],
        steps: told.map((st) => ({
          how: st.how, a: st.a, b: st.b, n: st.src.length, m: st.cover ? st.cover.length : 0, need: st.need,
          cells: cellsOf(st.src), dots: st.dots.slice(),
        })),
        after: used.length > told.length, dots: [...dots],
        // how hard the explanation is to follow: steps, unexplained ones, and trials
        cost: used.length + (used.length > told.length ? 4 : 0) + used.filter((st) => st.how === "trial").length * 1.5,
      };
    }
    // Candidates: the first star the easy steps reach, and (if it comes first) one that needs
    // a trial step. The one that is quicker to explain wins.
    const cands = [];
    const best = () => (cands.length ? cands.reduce((a, b) => (b.cost < a.cost ? b : a)) : null);
    for (let depth = 0; depth < 80; depth++) {
      basicDots(ctx, g, why);
      const s = forcedStar(ctx, g, cells);
      if (s) { cands.push(finish(s, g, why, null)); return best(); }
      const conf = confinedSteps(ctx, g, 4);
      const tierFns = [() => conf.filter((x) => x.how === "confined"), () => squeezeSteps(ctx, g), () => conf.filter((x) => x.how === "count"), () => trialSteps(ctx, g)];
      const tiers = [];
      const tier = (t) => {
        if (!tiers[t]) { tiers[t] = tierFns[t](); for (const st of tiers[t]) st.depth = depth; }
        return tiers[t];
      };
      const apply = (base, bw, st) => {
        const h = base.slice(), w = new Map(bw);
        for (const d of st.dots) { if (h[d] === 0) h[d] = 1; if (!w.has(d)) w.set(d, st); }
        basicDots(ctx, h, w);
        return { h, w };
      };
      // does one step on its own reveal a star?
      const single = (t) => {
        for (const st of tier(t)) {
          const { h, w } = apply(g, why, st);
          const s2 = forcedStar(ctx, h, cells);
          if (s2) return finish(s2, h, w, st);
        }
        return null;
      };
      // or two easy steps (confined, squeeze), the second one seen after the first?
      const pair = (maxT) => {
        for (let t1 = 0; t1 <= maxT; t1++) for (const st1 of tier(t1)) {
          const a1 = apply(g, why, st1);
          const next = confinedSteps(ctx, a1.h, 1).concat(maxT ? squeezeSteps(ctx, a1.h) : []);
          for (const st2 of next) {
            st2.depth = depth + 0.5;
            const { h, w } = apply(a1.h, a1.w, st2);
            const s2 = forcedStar(ctx, h, cells);
            if (s2) return finish(s2, h, w, st2);
          }
        }
        return null;
      };
      const found = single(0) || pair(0) || single(1) || pair(1) || single(2);
      if (found) { cands.push(found); return best(); }
      if (!cands.length) { const tr = single(3); if (tr) cands.push(tr); }
      // no: take every step of the easiest kind there is, and look again
      let moved = false;
      for (let t = 0; t < tierFns.length && !moved; t++) {
        for (const st of tier(t)) for (const d of st.dots) { if (g[d] === 0) { g[d] = 1; if (!why.has(d)) why.set(d, st); } }
        moved = tier(t).length > 0;
      }
      if (!moved) return best();
    }
    return best();
  }

  root.GraphiteStars = { TIERS, generate, solve, hint };
})(typeof globalThis !== "undefined" ? globalThis : this);
