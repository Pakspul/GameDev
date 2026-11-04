// Feature plans: free spins (FS-01..06), Hold & Spin (HS-01..05) and the pick bonus (PICK-01..04).
// A plan is decided completely when the feature starts and is plain JSON. The screen then only
// reveals it step by step, which is also what makes an interrupted feature resumable (PERS-02).
import { resolveSpin, drawCoinValue, maxWinCoins } from "./spin.js";

const floorCoins = (x) => Math.floor(x + 1e-9);

// ---- free spins -----------------------------------------------------------------------------

/** Spins awarded for an option and scatter count (FS-04: the options share one factor per count). */
export function choiceSpins(prep, option, scatterCount) {
  const fs = prep.features.freeSpins;
  const keys = Object.keys(fs.choiceScale).map(Number);
  const top = Math.max(...keys);
  const factor = fs.choiceScale[Math.min(Math.max(scatterCount, Math.min(...keys)), top)];
  return Math.max(1, Math.round(option.spins * factor));
}

/**
 * Play a whole free-spins feature.
 * opts: { bet, spins, multiplier = 1 (from the chosen option), scatterCount, source, option }
 */
export function planFreeSpins(prep, rng, opts) {
  const fs = prep.features.freeSpins;
  const mod = fs.modifiers || {};
  const bet = opts.bet;
  const cap = maxWinCoins(prep, bet);
  const optionMult = opts.multiplier || 1;
  const globalMult = (mod.multiplier || 1) * optionMult;
  const prog = mod.progressive || null;
  const retrig = fs.retrigger && fs.retrigger.enabled ? fs.retrigger : null;

  let left = opts.spins, awarded = opts.spins, played = 0, total = 0, capped = false;
  let progMult = prog ? prog.start : 1;
  let sticky = mod.stickyWilds ? {} : null;
  const list = [];
  while (left > 0) {
    const mult = globalMult * progMult;
    const o = resolveSpin(prep, rng, { bet, mode: "free", multiplier: mult, sticky });
    let win = o.totalWin;
    if (total + win >= cap) { win = cap - total; capped = true; o.totalWin = win; o.capped = true; }
    total += win; played++; left--;
    let added = 0;
    if (retrig && !capped && o.scatterCount >= fs.trigger.minCount && awarded < retrig.cap) {
      added = Math.min(retrig.spins, retrig.cap - awarded);
      awarded += added; left += added;
    }
    list.push({ n: played, outcome: o, win, multiplier: mult, retrigger: added, spinsLeft: capped ? 0 : left, total });
    if (prog) {
      if (prog.per === "spin" || (prog.per === "win" && o.totalWin > 0)) progMult = Math.min(prog.max, progMult + prog.step);
    }
    if (sticky) sticky = o.sticky;
    if (capped) break;
  }
  return {
    type: "freeSpins", bet, source: opts.source || "scatter", option: opts.option || null,
    spinsAwarded: awarded, spinsPlayed: played, spins: list, totalWin: total, capped,
  };
}

// ---- Hold & Spin ----------------------------------------------------------------------------

/**
 * Play a whole Hold & Spin feature.
 * opts: { bet, coins: [{reel,row,value|jackpot}], jackpots: { mini, minor, major, grand } in coins }
 */
export function planHoldSpin(prep, rng, opts) {
  const hs = prep.features.holdSpin;
  const { reels, rows } = prep;
  const bet = opts.bet;
  const cells = reels * rows;
  const held = opts.coins.map((c) => ({ ...c }));
  const taken = new Set(held.map((c) => c.reel * rows + c.row));
  const steps = [];
  let respins = hs.respins;
  while (respins > 0 && taken.size < cells) {
    const fresh = [];
    for (let r = 0; r < reels; r++) for (let row = 0; row < rows; row++) {
      if (taken.has(r * rows + row)) continue;
      if (rng.float() < hs.landChance) fresh.push({ reel: r, row, ...drawCoinValue(prep, rng) });
    }
    for (const c of fresh) { taken.add(c.reel * rows + c.row); held.push(c); }
    respins = fresh.length ? hs.respins : respins - 1;
    steps.push({ fresh, respinsLeft: respins, reset: fresh.length > 0, filled: taken.size });
  }
  const full = taken.size === cells && hs.gridFullGrand !== false;
  // collection order: left to right, top to bottom (HS-05)
  const collect = held.slice().sort((a, b) => a.reel - b.reel || a.row - b.row).map((c) => {
    const amount = c.jackpot ? opts.jackpots[c.jackpot] : c.value * bet;
    return { ...c, amount };
  });
  if (full) collect.push({ reel: -1, row: -1, jackpot: "grand", amount: opts.jackpots.grand, grand: true });
  const cap = maxWinCoins(prep, bet);
  let total = 0, capped = false;
  for (const c of collect) {
    if (total + c.amount >= cap) { c.amount = cap - total; capped = true; }
    total += c.amount;
    c.running = total;
    if (capped) break;
  }
  const paid = collect.filter((c) => c.running !== undefined);
  return {
    type: "holdSpin", bet, startCoins: opts.coins.map((c) => ({ ...c })), steps, collect: paid,
    totalWin: total, capped, full, jackpotsWon: paid.filter((c) => c.jackpot).map((c) => c.jackpot),
  };
}

// ---- pick bonus -----------------------------------------------------------------------------

/** Draw one prize from the configured pool. */
function drawPrize(prep, rng, allowCollect) {
  const pool = prep.features.pick.pool.filter((p) => allowCollect || p.type !== "collect");
  return pool[rng.weighted(pool.map((p) => p.weight))];
}

/**
 * Play a whole pick bonus. The k-th reveal always shows prizes[k] whichever item is tapped, so the
 * expected value cannot depend on the player's choices (PICK-03); items left at the end show the
 * next real draws from the same pool.
 * opts: { bet, jackpots }
 */
export function planPick(prep, rng, opts) {
  const pk = prep.features.pick;
  const bet = opts.bet;
  const prizes = [];
  for (let i = 0; i < pk.items; i++) {
    const p = drawPrize(prep, rng, !(i === 0 && pk.firstRevealNoCollect));
    prizes.push(p.type === "jackpot" ? { type: "jackpot", tier: p.tier, amount: opts.jackpots[p.tier] }
      : { type: p.type, value: p.value || 0 });
  }
  // play it out to know the result and which reveals are used
  let picks = pk.startPicks, coins = 0, mult = 1, jackpot = 0, used = 0, ended = false;
  const log = [];
  while (!ended && picks > 0 && used < prizes.length) {
    const p = prizes[used++];
    if (p.type === "coins") { coins += p.value; picks--; }
    else if (p.type === "extraPick") picks += p.value;
    else if (p.type === "multiplier") { mult *= p.value; picks--; }
    else if (p.type === "jackpot") { jackpot += p.amount; picks--; }
    else if (p.type === "collect") ended = true;
    log.push({ picksLeft: picks, coins, multiplier: mult, jackpot });
  }
  const cap = maxWinCoins(prep, bet);
  let total = coins * bet * mult + jackpot, capped = false;
  if (total >= cap) { total = cap; capped = true; }
  return {
    type: "pick", bet, items: pk.items, startPicks: pk.startPicks, prizes, revealsUsed: used, log,
    coins, multiplier: mult, jackpot, totalWin: total, capped,
    jackpotsWon: prizes.slice(0, used).filter((p) => p.type === "jackpot").map((p) => p.tier),
  };
}

