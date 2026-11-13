// Math simulator (TOOL-01): runs many spins through the very same Session code the game uses
// and reports RTP per component, hit frequency, trigger rates, win distribution and volatility.
import { Session } from "../core/session.js";
import { Rng } from "./rng.js";
import { prepare } from "./config.js";
import { planFreeSpins, choiceSpins } from "./features.js";
import { tierOf } from "./tiers.js";

export { tierOf };

/** Volatility class from the standard deviation of one round's return, in bets (documented in docs/SLOTS.md). */
export function volatilityClass(sd) {
  return sd < 4 ? "low" : sd < 12 ? "medium" : "high";
}

/**
 * @param cfg machine config
 * @param opts { spins, seed, bet, fsOption (id or index, default 0), onProgress }
 */
export function simulate(cfg, opts = {}) {
  const spins = opts.spins ?? 100000;
  const prep = prepare(cfg);
  const rng = new Rng(opts.seed ?? 12345);
  const bet = opts.bet ?? cfg.defaultBet;
  const wallet = { balance: bet * 10 };
  const s = new Session(cfg, { rng, wallet, record: false });
  const fsChoice = opts.fsOption ?? 0;
  const poolsStart = { ...s.state.pools };

  const parts = { baseLines: 0, baseScatter: 0, freeSpins: 0, holdSpin: 0, pick: 0, meterFreeSpins: 0, meterPick: 0 };
  const jackpotWon = { mini: 0, minor: 0, major: 0, grand: 0 };
  const jackpotPaid = { mini: 0, minor: 0, major: 0, grand: 0 };
  const triggers = { freeSpins: 0, holdSpin: 0, pick: 0, meter: 0 };
  const tiers = { none: 0, below: 0, win: 0, big: 0, mega: 0, epic: 0 };
  let hits = 0, anyHits = 0, maxMult = 0, maxEvent = 0, capHits = 0, sum = 0, sumSq = 0, totalBet = 0, totalWin = 0;
  let fsSpinsPlayed = 0, cascadeSteps = 0, expansions = 0;

  for (let i = 0; i < spins; i++) {
    wallet.balance = bet * 10; // the simulator is not limited by the balance (the odds never depend on it, FAIR-03)
    const o = s.spin(bet);
    totalBet += bet;
    let round = o.totalWin;
    parts.baseLines += o.lineWin; parts.baseScatter += o.scatterWin;
    if (o.totalWin > 0) hits++;
    maxEvent = Math.max(maxEvent, o.totalWin / bet);
    cascadeSteps += o.steps.length - 1; expansions += o.expanded.length;
    s.settle();
    let any = o.totalWin > 0;
    while (s.hasFeature()) {
      let f = s.nextFeature();
      if (f.phase === "choice") {
        const opt = typeof fsChoice === "number" ? f.options[fsChoice] : f.options.find((x) => x.id === fsChoice);
        f = s.chooseOption(opt.id);
      }
      const r = s.finishFeature();
      const key = r.source === "meter" ? (r.type === "freeSpins" ? "meterFreeSpins" : "meterPick") : r.type;
      // a meter reward is played at the average bet, so scale it back to this simulation's bet
      const scaled = r.total * (bet / r.bet);
      parts[key] += scaled;
      maxEvent = Math.max(maxEvent, scaled / bet);
      round += scaled;
      if (r.source === "meter") triggers.meter++; else triggers[r.type]++;
      if (r.capped) capHits++;
      if (r.type === "freeSpins") fsSpinsPlayed += r.plan.spinsPlayed;
      if (scaled > 0) any = true;
      for (const c of r.plan.collect || []) if (c.jackpot) { jackpotWon[c.jackpot]++; jackpotPaid[c.jackpot] += c.amount * (bet / r.bet); }
      if (r.type === "pick") for (const p of r.plan.prizes.slice(0, r.plan.revealsUsed)) if (p.type === "jackpot") { jackpotWon[p.tier]++; jackpotPaid[p.tier] += p.amount * (bet / r.bet); }
    }
    if (any) anyHits++;
    if (o.capped) capHits++;
    totalWin += round;
    const m = round / bet;
    sum += m; sumSq += m * m;
    if (m > maxMult) maxMult = m;
    tiers[tierOf(cfg, m)]++;
    if (opts.onProgress && (i + 1) % 1000000 === 0) opts.onProgress(i + 1, totalWin / totalBet);
  }
  // Progressives that have not been won yet still count as returned to players: they will be paid
  // eventually (JP-03). Without this a rare Grand makes a finite simulation look too stingy.
  let accrued = 0;
  for (const tier of Object.keys(poolsStart)) accrued += (s.state.pools[tier] - poolsStart[tier]) * bet;
  const mean = sum / spins;
  const sd = Math.sqrt(Math.max(0, sumSq / spins - mean * mean));
  const per = (x) => x / totalBet;
  return {
    machine: cfg.id, version: cfg.version, spins, bet, seed: rng.seed,
    rtp: (totalWin + accrued) / totalBet,
    rtpPaid: totalWin / totalBet,
    rtpStdError: sd / Math.sqrt(spins),
    rtpBreakdown: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, per(v)])),
    hitFrequency: hits / spins,
    anyWinFrequency: anyHits / spins,
    triggerRates: Object.fromEntries(Object.entries(triggers).map(([k, v]) => [k, v ? { count: v, oneIn: spins / v } : { count: 0, oneIn: Infinity }])),
    avgFreeSpinsPerFeature: triggers.freeSpins + triggers.meter ? fsSpinsPlayed / Math.max(1, triggers.freeSpins) : 0,
    winTiers: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, { count: v, share: v / spins }])),
    maxWinMultiple: maxMult,
    maxEventMultiple: maxEvent, // the cap applies to one spin or one feature, so this is what it limits
    capHits,
    jackpots: { won: jackpotWon, paid: jackpotPaid, rtp: Object.fromEntries(Object.entries(jackpotPaid).map(([k, v]) => [k, per(v)])) },
    volatilityIndex: sd,
    volatility: volatilityClass(sd),
    cascadeStepsPerSpin: cascadeSteps / spins,
    expansionsPerSpin: expansions / spins,
  };
}

/**
 * FS-04: the expected value of one free-spins option, measured by playing the feature many times.
 * Returns the mean total win in bets and its standard error.
 */
export function simulateFreeSpinsOption(cfg, optionId, runs, seed = 7, scatterCount = null) {
  const prep = prepare(cfg);
  const fs = prep.features.freeSpins;
  const rng = new Rng(seed);
  const option = fs.choice.find((o) => o.id === optionId);
  const bet = cfg.defaultBet;
  const count = scatterCount ?? fs.trigger.minCount;
  const spins = choiceSpins(prep, option, count);
  let sum = 0, sumSq = 0;
  for (let i = 0; i < runs; i++) {
    const p = planFreeSpins(prep, rng, { bet, spins, multiplier: option.multiplier, scatterCount: count });
    const m = p.totalWin / bet;
    sum += m; sumSq += m * m;
  }
  const mean = sum / runs;
  const sd = Math.sqrt(Math.max(0, sumSq / runs - mean * mean));
  return { option: optionId, spins, mean, stdError: sd / Math.sqrt(runs), runs };
}

/** Format a report as readable text. */
export function formatReport(r, cfg) {
  const pct = (x, d = 2) => (x * 100).toFixed(d) + "%";
  const oneIn = (x) => (isFinite(x) ? "1 in " + x.toFixed(0) : "never");
  const lines = [];
  lines.push(`${r.machine} v${r.version}: ${r.spins.toLocaleString("en")} spins at bet ${r.bet}, seed ${r.seed.join(",")}`);
  lines.push(`  RTP total        ${pct(r.rtp)}  (cash paid ${pct(r.rtpPaid)} + progressive accrual; target ${pct(cfg.targets.rtp)} ± ${pct(cfg.targets.rtpTolerance)}, std. error ${pct(r.rtpStdError)})`);
  for (const [k, v] of Object.entries(r.rtpBreakdown)) if (v) lines.push(`    ${k.padEnd(15)}${pct(v)}`);
  const jp = Object.entries(r.jackpots.rtp).filter(([, v]) => v);
  if (jp.length) lines.push(`    (of which jackpots: ${jp.map(([k, v]) => `${k} ${pct(v)}`).join(", ")})`);
  lines.push(`  Hit frequency    ${pct(r.hitFrequency)}  (base game; target ${pct(cfg.targets.hitFrequency[0], 0)}-${pct(cfg.targets.hitFrequency[1], 0)}; any win incl. features ${pct(r.anyWinFrequency)})`);
  for (const [k, v] of Object.entries(r.triggerRates)) if (v.count) lines.push(`  Trigger ${k.padEnd(10)} ${oneIn(v.oneIn)}  (${v.count}x)`);
  lines.push(`  Win tiers        ` + Object.entries(r.winTiers).map(([k, v]) => `${k} ${pct(v.share)}`).join("  "));
  lines.push(`  Max win seen     ${r.maxWinMultiple.toFixed(1)}x bet in a round, ${r.maxEventMultiple.toFixed(1)}x in one spin or feature (cap ${cfg.maxWin}x, cap reached ${r.capHits}x)`);
  const jw = Object.entries(r.jackpots.won).filter(([, v]) => v);
  lines.push(`  Jackpots won     ${jw.length ? jw.map(([k, v]) => `${k} ${v}x (${oneIn(r.spins / v)})`).join(", ") : "none"}`);
  lines.push(`  Volatility       index ${r.volatilityIndex.toFixed(2)} -> ${r.volatility}  (declared ${cfg.targets.volatility})`);
  return lines.join("\n");
}
