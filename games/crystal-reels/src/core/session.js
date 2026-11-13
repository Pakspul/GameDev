// Session: the headless game core for one machine. The screen, the simulator and the replay
// tool all drive this same class, so there is exactly one implementation of the rules (TOOL-01).
//
//   idle ──spin()──▶ pending outcome ──settle()──▶ idle
//                          └─ features queued ──nextFeature()/chooseOption()──▶ feature ──finishFeature()──▶ idle
//
// All state is plain JSON (`state`), so it can be saved and resumed after an interruption (PERS-02).
import { prepare } from "../engine/config.js";
import { resolveSpin } from "../engine/spin.js";
import { planFreeSpins, planHoldSpin, planPick, choiceSpins } from "../engine/features.js";
import { initialPools, jackpotAmounts, addContribution, resetTier } from "../engine/jackpot.js";
import { Rng } from "../engine/rng.js";

export class Session {
  /**
   * @param cfg machine config
   * @param opts { rng, wallet: {balance}, state }  state is the saved machine state, if any
   */
  constructor(cfg, opts = {}) {
    this.cfg = cfg;
    this.prep = prepare(cfg);
    this.rng = opts.rng || new Rng();
    this.wallet = opts.wallet || { balance: 0 };
    this.state = opts.state || Session.newState(cfg);
    // Replay log (TOOL-04): seed + inputs reproduce this session exactly.
    this.record = opts.record !== false;
    this.log = { machine: cfg.id, version: cfg.version, seed: this.rng.seed.slice(), balance: this.wallet.balance, state: JSON.parse(JSON.stringify(this.state)), inputs: [] };
  }

  static newState(cfg) {
    return { bet: cfg.defaultBet, pools: initialPools(cfg), meter: { count: 0, betSum: 0 }, pending: null, queue: [], feature: null };
  }

  _log(entry) { if (this.record) this.log.inputs.push(entry); }
  get bet() { return this.state.bet; }
  get balance() { return this.wallet.balance; }
  isIdle() { return !this.state.pending && !this.state.feature && this.state.queue.length === 0; }
  hasFeature() { return !!this.state.feature || this.state.queue.length > 0; }
  jackpots(bet = this.state.bet) { return jackpotAmounts(this.cfg, this.state.pools, bet); }
  canSpin(bet = this.state.bet) { return this.isIdle() && this.wallet.balance >= bet && this.cfg.betLevels.includes(bet); }

  setBet(bet) {
    if (!this.isIdle()) throw new Error("The bet can only change when idle");
    if (!this.cfg.betLevels.includes(bet)) throw new Error("Unknown bet level " + bet);
    this._log({ t: "bet", v: bet });
    this.state.bet = bet;
  }

  /** Tap Spin: deducts the bet and decides the whole outcome at once (MATH-01). */
  spin(bet = this.state.bet) {
    if (!this.canSpin(bet)) throw new Error("Cannot spin now");
    this._log({ t: "spin", bet });
    const { cfg, prep, state } = this;
    this.wallet.balance -= bet;
    state.bet = bet;
    const poolsSnap = { ...state.pools };
    const outcome = resolveSpin(prep, this.rng, { bet, mode: "base" });
    if (cfg.jackpots) addContribution(cfg, state.pools);
    state.pending = { bet, outcome };
    state.queue = outcome.features.map((f) => ({ ...f, bet, poolsSnap }));
    if (cfg.meter && outcome.collect > 0) this._fillMeter(outcome.collect, bet, poolsSnap);
    return outcome;
  }

  _fillMeter(count, bet, poolsSnap) {
    const m = this.state.meter, conf = this.cfg.meter;
    m.count += count;
    m.betSum += count * bet;
    if (m.count < conf.target) return;
    // The reward is scaled to the average bet while the meter was filling (PROG-03)
    const avg = m.betSum / m.count;
    const levels = this.cfg.betLevels;
    let rewardBet = levels[0];
    for (const l of levels) if (Math.abs(l - avg) < Math.abs(rewardBet - avg)) rewardBet = l;
    this.state.queue.push({
      type: conf.reward.type, source: "meter", bet: rewardBet, spins: conf.reward.spins || 0,
      multiplier: conf.reward.multiplier || 1, scatterCount: 0, poolsSnap,
    });
    m.count = 0; m.betSum = 0;
  }

  /** The win's count-up has ended (or was skipped): credit the balance. */
  settle() {
    const p = this.state.pending;
    if (!p) return 0;
    this._log({ t: "settle" });
    this.wallet.balance += p.outcome.totalWin;
    this.state.pending = null;
    return p.outcome.totalWin;
  }

  /**
   * A free-spin voucher: a short free-spins run at a fixed bet, started by the player when the machine is idle.
   * It is queued like a feature a spin would have triggered, so it is planned in full, saved, resumed and paid
   * the same way. The coins it wins are the only thing it adds; it costs nothing and changes no odds.
   */
  queueVoucher({ spins, bet }) {
    if (!this.isIdle()) throw new Error("A voucher can only be used when idle");
    if (!this.cfg.betLevels.includes(bet)) throw new Error("Unknown bet level " + bet);
    this._log({ t: "voucher", spins, bet });
    this.state.queue.push({ type: "freeSpins", source: "voucher", bet, spins, multiplier: 1, scatterCount: 0, poolsSnap: { ...this.state.pools } });
  }

  /**
   * Double or collect (opt-in, see the settings): a fair 50/50 on a small base-game win. The player picks a
   * side (0 or 1); a hit doubles the pending win, a miss loses it. The coin is flipped with its own generator
   * derived from the session's state, so the spins that follow are unaffected and a replay gives the same flip.
   */
  canGamble() {
    const p = this.state.pending;
    return !!p && p.outcome.totalWin > 0 && p.outcome.features.length === 0 && !p.outcome.capped;
  }

  gamble(pick) {
    if (!this.canGamble()) throw new Error("Nothing to double");
    if (pick !== 0 && pick !== 1) throw new Error("Pick 0 or 1");
    this._log({ t: "gamble", pick });
    const p = this.state.pending;
    p.gambles = (p.gambles || 0) + 1;
    const flip = new Rng("gamble:" + this.rng.state().join(",") + ":" + p.gambles).int(2);
    const won = flip === pick;
    p.outcome.totalWin = won ? p.outcome.totalWin * 2 : 0;
    return { won, flip, total: p.outcome.totalWin };
  }

  /** Start the next queued feature. Free spins with a choice stop at phase "choice". */
  nextFeature() {
    if (this.state.feature) return this.state.feature;
    const entry = this.state.queue.shift();
    if (!entry) return null;
    this._log({ t: "feature" });
    const { cfg, prep } = this;
    const jackpots = jackpotAmounts(cfg, entry.poolsSnap, entry.bet);
    let feature;
    if (entry.type === "freeSpins") {
      const fs = prep.features.freeSpins;
      if (fs.choice && entry.source !== "meter" && entry.source !== "voucher") {
        const options = fs.choice.map((o) => ({ id: o.id, spins: choiceSpins(prep, o, entry.scatterCount), multiplier: o.multiplier }));
        feature = { type: "freeSpins", phase: "choice", bet: entry.bet, source: entry.source, scatterCount: entry.scatterCount, options, entry, cursor: 0 };
      } else {
        const plan = planFreeSpins(prep, this.rng, { bet: entry.bet, spins: entry.spins, multiplier: entry.multiplier || 1, scatterCount: entry.scatterCount, source: entry.source });
        feature = { type: "freeSpins", phase: "play", bet: entry.bet, source: entry.source, plan, cursor: 0 };
      }
    } else if (entry.type === "holdSpin") {
      const plan = planHoldSpin(prep, this.rng, { bet: entry.bet, coins: entry.coins, jackpots });
      feature = { type: "holdSpin", phase: "play", bet: entry.bet, source: entry.source || "base", plan, cursor: 0 };
    } else {
      const plan = planPick(prep, this.rng, { bet: entry.bet, jackpots });
      feature = { type: "pick", phase: "play", bet: entry.bet, source: entry.source || "base", plan, cursor: 0, tiles: {} };
    }
    this.state.feature = feature;
    return feature;
  }

  /** FS-04: the player picked one of the options. */
  chooseOption(id) {
    const f = this.state.feature;
    if (!f || f.phase !== "choice") throw new Error("No choice pending");
    const option = f.options.find((o) => o.id === id);
    if (!option) throw new Error("Unknown option " + id);
    this._log({ t: "choose", id });
    const plan = planFreeSpins(this.prep, this.rng, { bet: f.bet, spins: option.spins, multiplier: option.multiplier, scatterCount: f.scatterCount, source: f.source, option: { id: option.id, spins: option.spins, multiplier: option.multiplier } });
    f.plan = plan;
    f.phase = "play";
    delete f.entry;
    return f;
  }

  /** The screen finished presenting one step (one free spin, one respin, one collected coin). */
  stepDone() {
    const f = this.state.feature;
    if (f) f.cursor++;
  }

  /** Pick bonus: item `tile` was tapped; it shows the next prize of the plan whatever the tile is. */
  pickTile(tile) {
    const f = this.state.feature;
    if (!f || f.type !== "pick" || f.phase !== "play") throw new Error("No pick bonus running");
    if (f.tiles[tile] !== undefined) throw new Error("Item already revealed");
    if (f.cursor >= f.plan.revealsUsed) throw new Error("Bonus is over");
    this._log({ t: "pick", tile });
    const idx = f.cursor;
    f.tiles[tile] = idx;
    f.cursor++;
    return { prize: f.plan.prizes[idx], log: f.plan.log[idx], over: f.cursor >= f.plan.revealsUsed };
  }

  /** The feature's summary closed: credit the total and reset any jackpot that was won (FS-06, HS-05). */
  finishFeature() {
    const f = this.state.feature;
    if (!f || !f.plan) throw new Error("No finished feature");
    this._log({ t: "finish" });
    const total = f.plan.totalWin;
    this.wallet.balance += total;
    for (const tier of f.plan.jackpotsWon || []) resetTier(this.cfg, this.state.pools, tier);
    this.state.feature = null;
    return { type: f.type, source: f.source, bet: f.bet, total, capped: f.plan.capped, plan: f.plan };
  }

  /** Replay a recorded session on a fresh state: same seed, same inputs, same result (TOOL-04). */
  static replay(cfg, log) {
    const s = new Session(cfg, {
      rng: new Rng(log.seed),
      wallet: { balance: log.balance },
      state: JSON.parse(JSON.stringify(log.state)),
    });
    for (const i of log.inputs) {
      if (i.t === "bet") s.setBet(i.v);
      else if (i.t === "spin") s.spin(i.bet);
      else if (i.t === "settle") s.settle();
      else if (i.t === "voucher") s.queueVoucher({ spins: i.spins, bet: i.bet });
      else if (i.t === "gamble") s.gamble(i.pick);
      else if (i.t === "feature") s.nextFeature();
      else if (i.t === "choose") s.chooseOption(i.id);
      else if (i.t === "pick") s.pickTile(i.tile);
      else if (i.t === "finish") s.finishFeature();
    }
    return s;
  }
}
