// Win evaluation (PAY-01..04, WILD-01/04): a pure function of the grid and the config.
// grid[reel][row] holds symbol ids. Nothing here touches the RNG or any player state.

const floorCoins = (x) => Math.floor(x + 1e-9);

/** Coins that one "unit" of the paytable is worth at this bet (line bet for lines, bet / divisor for ways). */
export function unitValue(prep, bet) {
  return bet / prep.divisor;
}

function wildMultiplier(prep, syms, count) {
  // syms: symbols of the counted positions; combine the multiplier wilds among them
  let mult = prep.combine === "add" ? 0 : 1, any = false;
  for (let i = 0; i < count; i++) {
    const w = prep.wild[syms[i]];
    if (w && w.multiplier > 1) {
      any = true;
      if (prep.combine === "add") mult += w.multiplier; else mult *= w.multiplier;
    }
  }
  return any ? mult : 1;
}

function evaluateLines(prep, grid, bet) {
  const wins = [];
  const unit = unitValue(prep, bet);
  const n = prep.reels;
  const syms = new Array(n);
  for (let li = 0; li < prep.lines.length; li++) {
    const line = prep.lines[li];
    for (let r = 0; r < n; r++) syms[r] = grid[r][line[r]];
    // run of wilds from the left
    let w = 0;
    while (w < n && prep.wild[syms[w]]) w++;
    let best = null;
    // (a) the line as a run of its first regular symbol, wilds substituting
    if (w < n && prep.kindOf[syms[w]] === "regular") {
      const s = syms[w];
      let c = w + 1;
      while (c < n && (syms[c] === s || prep.wild[syms[c]])) c++;
      const table = prep.payByCount[s];
      if (c >= prep.minCount[s] && table[c]) {
        const mult = wildMultiplier(prep, syms, c);
        best = { symbol: s, count: c, base: table[c], mult };
      }
    }
    // (b) the line as wilds only, paid by the wild's own entry
    if (w >= 1 && prep.wildPayKey && w >= prep.minCount[prep.wildPayKey]) {
      const table = prep.payByCount[prep.wildPayKey];
      const mult = wildMultiplier(prep, syms, w);
      const cand = { symbol: prep.wildPayKey, count: w, base: table[w], mult };
      if (!best || cand.base * cand.mult > best.base * best.mult) best = cand; // only the highest win per line
    }
    if (best) {
      const positions = [];
      for (let r = 0; r < best.count; r++) positions.push([r, line[r]]);
      wins.push({
        type: "line", line: li, symbol: best.symbol, count: best.count, multiplier: best.mult,
        amount: floorCoins(best.base * best.mult * unit), positions,
      });
    }
  }
  return wins;
}

function evaluateWays(prep, grid, bet) {
  const wins = [];
  const unit = unitValue(prep, bet);
  const n = prep.reels, rows = prep.rows;
  for (const s of prep.regularIds) {
    if (!prep.payByCount[s]) continue;
    let ways = 1, multSum = 1, k = 0;
    const positions = [];
    for (let r = 0; r < n; r++) {
      let c = 0, m = 0;
      const col = grid[r];
      for (let row = 0; row < rows; row++) {
        const id = col[row];
        if (id === s) { c++; m += 1; positions.push([r, row]); }
        else if (prep.wild[id]) { c++; m += prep.wild[id].multiplier; positions.push([r, row]); }
      }
      if (!c) break;
      ways *= c; multSum *= m; k++;
    }
    if (k >= prep.minCount[s]) {
      const table = prep.payByCount[s];
      // positions of reels beyond k were never reached; trim them
      const used = positions.filter((p) => p[0] < k);
      wins.push({
        type: "ways", symbol: s, count: k, ways, multiplier: multSum / ways,
        amount: floorCoins(table[k] * unit * multSum), positions: used,
      });
    }
  }
  return wins;
}

/** Line or ways wins on one grid, before any cascade or feature multiplier. */
export function evaluateGrid(prep, grid, bet) {
  const wins = prep.mode === "lines" ? evaluateLines(prep, grid, bet) : evaluateWays(prep, grid, bet);
  let amount = 0;
  for (const w of wins) amount += w.amount;
  return { wins, amount };
}

/** Scatter pays (a multiple of the total bet) wherever the scatters land. */
export function evaluateScatter(prep, grid, bet, symbol) {
  const positions = [];
  for (let r = 0; r < prep.reels; r++) {
    for (let row = 0; row < prep.rows; row++) if (grid[r][row] === symbol) positions.push([r, row]);
  }
  const count = positions.length;
  const table = prep.payByCount[symbol];
  const mult = table && count >= prep.minCount[symbol] ? table[count] : 0;
  return { symbol, count, positions, amount: floorCoins(mult * bet) };
}

/** Positions of every cell holding a symbol of the given id. */
export function findSymbol(prep, grid, id) {
  const out = [];
  for (let r = 0; r < prep.reels; r++) for (let row = 0; row < prep.rows; row++) if (grid[r][row] === id) out.push([r, row]);
  return out;
}

export function countKind(prep, grid, kind) {
  let n = 0;
  for (let r = 0; r < prep.reels; r++) for (let row = 0; row < prep.rows; row++) if (prep.kindOf[grid[r][row]] === kind) n++;
  return n;
}
