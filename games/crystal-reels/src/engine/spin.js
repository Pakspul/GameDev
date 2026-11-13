// Outcome before animation (MATH-01): one call decides everything about a spin: the stops,
// every win (including expanding wilds and cascades), and which features it triggers.
// The presentation layer only receives this object; it can never change it.
import { evaluateGrid, evaluateScatter, findSymbol } from "./evaluate.js";

const MAX_CASCADES = 40;
const floorCoins = (x) => Math.floor(x + 1e-9);

function cloneGrid(g) { return g.map((col) => col.slice()); }

/** Pick one coin value (a multiple of the bet) or a jackpot label from the machine's weights. */
export function drawCoinValue(prep, rng) {
  const table = prep.features.holdSpin.coinValues;
  const c = table[rng.weighted(table.map((x) => x.weight))];
  return c.jackpot ? { jackpot: c.jackpot } : { value: c.value };
}

/** Maximum win in coins for this bet (MATH-05). */
export function maxWinCoins(prep, bet) {
  return floorCoins(prep.maxWin * bet);
}

/**
 * Decide one spin.
 * ctx: { bet, mode: "base" | "free", multiplier = 1, sticky = null (free spins with sticky wilds) }
 */
export function resolveSpin(prep, rng, ctx) {
  const { bet } = ctx;
  const mode = ctx.mode || "base";
  const globalMult = ctx.multiplier || 1;
  const strips = mode === "free" ? prep.strips.free : prep.strips.base;
  const { reels, rows } = prep;

  // 1. one stop per reel; the visible symbols are the real strip at those stops (FAIR-05)
  const stops = strips.map((s) => rng.int(s.length));
  const grid = stops.map((stop, r) => {
    const col = new Array(rows);
    const L = strips[r].length;
    for (let row = 0; row < rows; row++) col[row] = strips[r][(stop + row) % L];
    return col;
  });
  const gridStart = cloneGrid(grid);

  // 2. coin values are decided when the coins land, so what the player sees is what Hold & Spin uses
  let coins = [];
  if (mode === "base" && prep.features.holdSpin) {
    for (let r = 0; r < reels; r++) for (let row = 0; row < rows; row++) {
      if (prep.kindOf[grid[r][row]] === "coin") coins.push({ reel: r, row, ...drawCoinValue(prep, rng) });
    }
  }

  // 3. sticky wilds from earlier free spins stay where they were
  const stickyMode = !!ctx.sticky;
  const stickyBefore = stickyMode ? { ...ctx.sticky } : null;
  const newSticky = [];
  if (stickyMode) {
    for (let r = 0; r < reels; r++) for (let row = 0; row < rows; row++) {
      if (prep.wild[grid[r][row]] && !stickyBefore[r + "," + row]) newSticky.push({ reel: r, row, symbol: grid[r][row] });
    }
    for (const key of Object.keys(stickyBefore)) {
      const [r, row] = key.split(",").map(Number);
      grid[r][row] = stickyBefore[key];
    }
  }

  // 4. expanding wilds take over their reel before wins are evaluated (WILD-02); special symbols stay
  const expanded = [];
  for (let r = 0; r < reels; r++) {
    let sym = null;
    for (let row = 0; row < rows; row++) {
      const w = prep.wild[grid[r][row]];
      if (w && w.expanding) { sym = grid[r][row]; break; }
    }
    if (sym) {
      expanded.push({ reel: r, symbol: sym });
      for (let row = 0; row < rows; row++) {
        const k = prep.kindOf[grid[r][row]];
        if (k === "regular" || k === "wild") grid[r][row] = sym;
      }
    }
  }

  // 5. evaluate, then cascade while there are wins (CASC-01); refills come from the strips (FAIR-05)
  const steps = [];
  let cur = cloneGrid(grid);
  const cursors = stops.map((s, r) => (s - 1 + strips[r].length) % strips[r].length);
  let lineWin = 0;
  for (let k = 0; ; k++) {
    const ev = evaluateGrid(prep, cur, bet);
    const cm = prep.cascade ? prep.cascade[Math.min(k, prep.cascade.length - 1)] : 1;
    const step = { grid: cloneGrid(cur), wins: ev.wins, baseAmount: ev.amount, cascadeMultiplier: cm, amount: ev.amount * cm * globalMult, removed: null, refill: null };
    steps.push(step);
    lineWin += step.amount;
    if (!prep.cascade || ev.amount === 0 || k >= MAX_CASCADES - 1) break;
    const gone = new Set();
    for (const w of ev.wins) for (const [r, row] of w.positions) gone.add(r * rows + row);
    step.removed = [...gone].map((x) => [Math.floor(x / rows), x % rows]);
    const next = [], refill = [];
    for (let r = 0; r < reels; r++) {
      const keep = [];
      for (let row = 0; row < rows; row++) if (!gone.has(r * rows + row)) keep.push(cur[r][row]);
      const n = rows - keep.length;
      const fresh = [];
      const L = strips[r].length;
      for (let j = 0; j < n; j++) fresh.push(strips[r][(((cursors[r] - n + 1 + j) % L) + L) % L]);
      cursors[r] = (((cursors[r] - n) % L) + L) % L;
      next.push(fresh.concat(keep));
      refill.push(fresh);
    }
    step.refill = refill;
    cur = next;
  }

  // 6. scatter pays and feature triggers are read from the grid as it landed
  const fsCfg = prep.features.freeSpins;
  const scatterSym = fsCfg ? fsCfg.trigger.symbol : Object.keys(prep.kindOf).find((id) => prep.kindOf[id] === "scatter");
  const scatter = scatterSym ? evaluateScatter(prep, grid, bet, scatterSym) : { symbol: null, count: 0, positions: [], amount: 0 };
  scatter.amount *= globalMult;

  let totalWin = lineWin + scatter.amount;
  const cap = maxWinCoins(prep, bet);
  const capped = totalWin >= cap;
  if (capped) totalWin = cap;

  const features = [];
  let collect = 0;
  if (mode === "base") {
    for (const type of prep.featureOrder) {
      if (type === "freeSpins" && fsCfg && scatter.count >= fsCfg.trigger.minCount) {
        const awards = fsCfg.trigger.awards;
        const top = Math.max(...Object.keys(awards).map(Number));
        features.push({ type: "freeSpins", scatterCount: scatter.count, spins: awards[Math.min(scatter.count, top)], positions: scatter.positions });
      } else if (type === "holdSpin" && prep.features.holdSpin) {
        const hs = prep.features.holdSpin;
        const own = coins.filter((c) => prep.kindOf[grid[c.reel][c.row]] === "coin");
        if (own.length >= hs.trigger.count) features.push({ type: "holdSpin", coins: own.map((c) => ({ ...c })) });
      } else if (type === "pick" && prep.features.pick) {
        const pk = prep.features.pick;
        const hit = pk.trigger.reels.every((r) => grid[r].some((id) => id === pk.trigger.symbol));
        if (hit) features.push({ type: "pick", positions: findSymbol(prep, grid, pk.trigger.symbol).filter((p) => pk.trigger.reels.includes(p[0])) });
      }
    }
    if (prep.cfg.meter) collect = findSymbol(prep, grid, prep.cfg.meter.symbol).length;
  }

  return {
    mode, bet, stops, gridStart, grid, expanded, steps, scatter,
    coins, collect, features,
    lineWin, scatterWin: scatter.amount, totalWin, capped,
    scatterCount: scatter.count,
    multiplier: globalMult,
    sticky: stickyMode ? Object.fromEntries([...Object.entries(stickyBefore), ...newSticky.map((s) => [s.reel + "," + s.row, s.symbol])]) : null,
    newSticky,
  };
}

