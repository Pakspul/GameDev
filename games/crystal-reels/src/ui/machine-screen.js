// The machine screen: controls, the spin flow and the three features.
//
// The flow follows the spin state machine (REEL-06):
//   Idle -> Spinning -> Stopping -> Evaluating -> Presenting -> (Feature) -> Idle
// The outcome is committed by Session.spin() at the tap; everything after that is presentation.
import { h, sleep, nextFrame, icon, symbolSvg, timing, clamp } from "./dom.js";
import { installArt } from "./art.js";
import { Reels } from "./reels.js";
import { countUp, celebrateWin, celebrateJackpot, announce, summary, openModal, ask, toast, fmt, tierName } from "./overlays.js";
import { prepare } from "../engine/config.js";
import { anticipationPlan } from "../engine/anticipation.js";
import { Session } from "../core/session.js";
import { SpinStateMachine } from "../core/state-machine.js";
import { jackpotAmounts } from "../engine/jackpot.js";
import * as P from "../core/profile.js";
import { xpMeter } from "./xp.js";
import * as Q from "../core/quests.js";
import { questStrip, showChallenges, showChest, showWheel, offerGamble } from "./quests.js";

const TIERS = ["below", "win", "big", "mega", "epic"];
const HUD_STRIP = 46; // the room above the reels that the feature HUD (spins left, total, pause) uses; see .stage in style.css

export class MachineScreen {
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg; this.prep = prepare(cfg);
    const entry = P.machineEntry(app.profile, cfg.id);
    if (!entry.state) entry.state = Session.newState(cfg);
    this.session = new Session(cfg, { wallet: app.profile, state: entry.state });
    // a saved bet that this machine's level does not allow (yet) drops to the highest one it does
    const allowed = P.unlockedBets(cfg, P.machineLevel(app.game, app.profile, cfg.id));
    if (!allowed.includes(entry.state.bet)) entry.state.bet = allowed.filter((b) => b <= entry.state.bet).pop() || allowed[0];
    this.sm = new SpinStateMachine();
    this.auto = { active: false, left: 0, stopMult: 0 };
    this.turbo = !!app.profile.settings.turbo;
    this.round = null;
    this.cycleToken = 0;
    this.alive = true;
    this.paused = false;
    this.pendingSpin = false;
    this.lastAction = Date.now();
  }

  get t() { return this.app.t; }
  get bet() { return this.session.bet; }

  // ---- building the screen -----------------------------------------------------------------------
  async open() {
    const { app, cfg } = this;
    const loading = h("div", { class: "loading" }, h("div", { class: "loading-title", text: cfg.name }), h("div", { class: "loading-bar" }, this.loadFill = h("i")));
    app.root.replaceChildren(loading);
    const step = async (p) => { this.loadFill.style.width = p * 100 + "%"; await nextFrame(); };
    await step(0.1);
    installArt(Object.values(cfg.symbols).map((s) => s.art));
    await step(0.45);
    this.build();
    app.root.replaceChildren(this.el);
    await step(0.7);
    this.reels = new Reels(this.reelsEl, this.prep, { audio: app.audio, haptics: app.haptics, fx: app.fx, t: app.t, locale: app.locale });
    this.observe();
    this.reels.showStops(this.cfg.strips.base.map(() => 0));
    this.refresh();
    app.audio.music("base", cfg.musicShift || 0);
    this.bind();
    this.updateControls();
    await this.resume();
  }

  build() {
    const { cfg, t } = this;
    const th = cfg.theme;
    this.el = h("section", { class: "machine", style: { "--accent": th.accent, "--accent2": th.accent2, "--bg-top": th.bgTop, "--bg-bottom": th.bgBottom, "--reel-bg": th.reel, "--frame": th.frame, "--glow": th.glow } });
    this.balanceEl = h("span", { class: "balance-value", text: "0" });
    this.xpMeter = xpMeter(this.app, cfg.id, { text: false });
    // back and the menu drawer are the arcade-wide ones (shared/js/gamenav.js, set up in game.js)
    this.backBtn = this.app.nav.back;
    const top = h("header", { class: "topbar" }, this.backBtn,
      h("div", { class: "topbar-mid" }, h("div", { class: "machine-name", text: cfg.name }),
        this.xpMeter.el),
      h("div", { class: "balance", "aria-live": "polite" }, symbolSvg("coin", "coin-icon"), this.balanceEl),
      this.app.nav.menu);

    this.jpEls = {};
    const jp = h("div", { class: "jackpots", "aria-label": t("jackpots") });
    if (cfg.jackpots) for (const tier of ["mini", "minor", "major", "grand"]) {
      const val = h("b", { text: "0" });
      this.jpEls[tier] = val;
      jp.append(h("div", { class: "jp jp-" + tier }, h("span", { text: t("jp." + tier) }), val));
    }

    this.reelsEl = h("div", { class: "reels" });
    this.hud = h("div", { class: "hud", hidden: true });
    this.stage = h("div", { class: "stage" }, h("div", { class: "frame" }, this.reelsEl), this.hud);

    this.meterFill = h("i");
    this.meterText = h("span", { class: "meter-text" });
    this.meterEl = cfg.meter ? h("div", { class: "meter", "aria-label": t("meter") }, symbolSvg(cfg.symbols[cfg.meter.symbol].art, "meter-icon"), h("div", { class: "meter-bar" }, this.meterFill), this.meterText) : null;

    this.winField = h("div", { class: "winfield", "aria-live": "polite" }, h("span", { class: "win-label", text: t("win") }), h("b", { class: "win-value", text: "0" }), h("span", { class: "win-note" }));

    this.betValue = h("b", { class: "bet-value", text: "0" });
    this.betLabel = h("span", { class: "bet-label", text: t("bet") });
    this.betMinus = h("button", { type: "button", class: "round-btn", "aria-label": t("betDown") }, icon("minus"));
    this.betPlus = h("button", { type: "button", class: "round-btn", "aria-label": t("betUp") }, icon("plus"));
    this.maxBtn = h("button", { type: "button", class: "pill-btn", text: t("maxBet") });
    this.spinBtn = h("button", { type: "button", class: "spin-btn", "aria-label": t("spin") }, icon("spin", 40));
    this.turboBtn = h("button", { type: "button", class: "pill-btn toggle", "aria-pressed": "false" }, icon("turbo", 18), h("span", { text: t("turbo") }));
    this.autoBtn = h("button", { type: "button", class: "pill-btn" }, icon("auto", 18), h("span", { class: "auto-label", text: t("auto") }));
    const controls = h("footer", { class: "controls" },
      h("div", { class: "bet-box" }, this.betMinus, h("div", { class: "bet-mid" }, this.betLabel, this.betValue), this.betPlus),
      h("div", { class: "pill-row" }, this.maxBtn, this.turboBtn, this.autoBtn),
      this.spinBtn);

    this.strip = questStrip(this.app, this);
    this.el.append(top, jp, this.strip.el, this.stage, this.meterEl, this.winField, controls);
    this.applyFrame();
  }

  observe() {
    const apply = () => { const r = this.stage.getBoundingClientRect(); if (r.width > 0) this.reels.layout(r.width - 8, r.height - 8 - HUD_STRIP); };
    this.ro = new ResizeObserver(apply);
    this.ro.observe(this.stage);
    apply();
  }

  bind() {
    const { app } = this;
    app.nav.setBack(() => { if (this.alive && this.sm.accepts("nav")) { app.audio.sfx("tap"); this.leave(); } }, this.t("lobby"));
    this.betMinus.onclick = () => this.stepBet(-1);
    this.betPlus.onclick = () => this.stepBet(1);
    this.maxBtn.onclick = () => this.maxBet();
    this.spinBtn.onclick = () => this.spinPress();
    this.stage.addEventListener("pointerdown", (e) => { if (e.target.closest(".hud button, .pick")) return; this.stagePress(); });
    this.turboBtn.onclick = () => { if (!this.sm.accepts("turbo")) return; this.turbo = !this.turbo; app.profile.settings.turbo = this.turbo; app.persist(); this.updateControls(); };
    this.autoBtn.onclick = () => (this.auto.active ? this.stopAuto() : this.chooseAuto());
    this.keyHandler = (e) => {
      if (e.target.closest && e.target.closest("input,select,textarea,[role=dialog]")) return;
      if (e.code === "Space") { e.preventDefault(); this.spinPress(); }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  leave() {
    this.alive = false;
    this.cycleToken++;
    if (this.ro) this.ro.disconnect();
    window.removeEventListener("keydown", this.keyHandler);
    this.app.openLobby();
  }

  // ---- header, jackpots, bet ----------------------------------------------------------------------------
  refresh() {
    const { app, cfg } = this;
    this.xpMeter.update();
    this.strip.update(this.sm.accepts("quest"));
    this.setBalance(app.profile.balance);
    this.betValue.textContent = fmt(app, this.bet);
    this.refreshBetNote();
    this.refreshJackpots();
    if (cfg.meter) {
      const m = this.session.state.meter;
      this.meterFill.style.width = Math.min(100, (m.count / cfg.meter.target) * 100) + "%";
      this.meterText.textContent = `${m.count}/${cfg.meter.target}`;
    }
  }

  setBalance(n) { this.shownBalance = n; this.balanceEl.textContent = fmt(this.app, n); }

  /** Animate the balance up to its new value (it increases when a count-up ends, ECO-03). */
  async growBalance(to) {
    const from = this.shownBalance ?? to;
    if (to <= from) return this.setBalance(to);
    await countUp(this.app, { from, to, ms: 350, onValue: (v) => this.setBalance(v), onTick: () => {} });
  }

  refreshJackpots() {
    if (!this.cfg.jackpots) return;
    const amounts = jackpotAmounts(this.cfg, this.session.state.pools, this.bet);
    for (const [tier, el] of Object.entries(this.jpEls)) {
      const text = fmt(this.app, amounts[tier]);
      if (el.textContent !== text) { el.textContent = text; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
    }
  }

  /** Under the bet: its name, or a warning when it is a large part of the balance (ECO-09). */
  refreshBetNote() {
    const { app, cfg } = this;
    const risky = P.betIsRisky(app.game, cfg, this.bet, app.profile.balance);
    this.betLabel.classList.toggle("risky", risky);
    this.betLabel.textContent = risky ? this.t("betRisky", { pct: Math.min(999, Math.round((this.bet / Math.max(1, app.profile.balance)) * 100)) }) : this.t("bet");
    this.betValue.classList.toggle("risky", risky);
  }

  allowedBets() { return P.unlockedBets(this.cfg, P.machineLevel(this.app.game, this.app.profile, this.cfg.id)); }

  stepBet(dir) {
    if (!this.sm.accepts("bet")) return;
    const levels = this.cfg.betLevels, allowed = this.allowedBets();
    const i = levels.indexOf(this.bet), n = clamp(i + dir, 0, levels.length - 1);
    if (dir > 0 && !allowed.includes(levels[n])) {
      this.app.audio.sfx("error");
      const need = this.cfg.betUnlockLevels[n];
      return toast(this.app, this.t("betLocked", { level: need }), "info");
    }
    this.setBet(levels[n]);
  }

  maxBet() {
    if (!this.sm.accepts("bet")) return;
    // Max Bet: the highest unlocked bet within a small share of the balance (ECO-09), not the highest the balance can pay
    const { bet, capped, share } = P.maxBetFor(this.app.game, this.cfg, this.app.profile);
    this.setBet(bet);
    if (capped) toast(this.app, this.t("maxBetCapped", { pct: Math.round(share * 100) }), "info", 3800);
  }

  setBet(b) {
    if (b === this.bet) return;
    this.app.audio.sfx("tap");
    this.session.setBet(b);
    this.refresh(); this.updateControls(); this.app.persist();
    if (this.app.infoOpen) this.app.infoOpen.update();
  }

  // ---- controls state ------------------------------------------------------------------------------------
  updateControls() {
    const { sm, app } = this;
    const idle = sm.state === "idle";
    this.betMinus.disabled = !sm.accepts("bet") || this.bet === this.cfg.betLevels[0];
    this.betPlus.disabled = !sm.accepts("bet") || this.bet === this.cfg.betLevels[this.cfg.betLevels.length - 1];
    this.maxBtn.disabled = !sm.accepts("bet");
    this.backBtn.disabled = !sm.accepts("nav");
    this.autoBtn.disabled = !(sm.accepts("autoplay") || this.auto.active);
    this.turboBtn.disabled = !sm.accepts("turbo");
    this.turboBtn.setAttribute("aria-pressed", String(this.turbo));
    this.turboBtn.classList.toggle("on", this.turbo);
    const canSpin = idle && this.session.canSpin(this.bet);
    this.spinBtn.disabled = idle ? !canSpin : !["spinning", "stopping", "presenting"].includes(sm.state);
    this.spinBtn.classList.toggle("busy", !idle);
    this.spinBtn.setAttribute("aria-label", idle ? this.t("spin") : this.t("stopReels"));
    this.autoBtn.querySelector(".auto-label").textContent = this.auto.active ? this.t("autoLeft", { n: this.auto.left === Infinity ? "∞" : this.auto.left }) : this.t("auto");
    this.autoBtn.classList.toggle("on", this.auto.active);
    this.el.dataset.state = sm.state;
    this.strip.update(sm.accepts("quest"));
  }

  go(state) { this.sm.to(state); this.updateControls(); }

  // ---- quests: challenges, vouchers, chests, the wheel ----------------------------------------------------------
  /** The reel frame the player picked in the profile (a cosmetic found in chests). */
  applyFrame() {
    const f = Q.frameStyle(this.app.profile, this.app.game), th = this.cfg.theme;
    this.el.style.setProperty("--frame", f ? f.color : th.frame);
    this.el.style.setProperty("--glow", f ? f.glow : th.glow);
  }

  openQuests() {
    if (!this.sm.accepts("quest")) return;
    showChallenges(this.app, this.cfg, { onChange: (started) => { if (started) this.stopAuto(true); this.refresh(); } });
  }

  openChests() { if (this.sm.accepts("quest")) showChest(this.app, { onChange: () => { this.applyFrame(); this.refresh(); } }); }
  openWheel() { if (this.sm.accepts("quest")) showWheel(this.app, { onChange: () => { this.setBalance(this.app.profile.balance); this.refresh(); } }); }

  /** Play a free-spins voucher: a short free-spins run at a fixed bet, for nothing. */
  async useVoucher() {
    const { app, cfg, session } = this;
    if (!this.sm.accepts("quest") || app.profile.vouchers < 1) return;
    const v = app.game.voucher, bet = cfg.betLevels[Math.min(v.betStep, cfg.betLevels.length - 1)];
    this.stopAuto(true);
    app.profile.vouchers--;
    session.queueVoucher({ spins: v.spins, bet });
    app.persist();
    this.cycleToken++;
    this.round = { bet, win: 0, features: 0, jackpots: [], freeSpinFeatures: 0, voucher: true };
    this.setWin(0, bet);
    this.winField.querySelector(".win-note").textContent = "";
    await this.finishRound();
  }

  // ---- input -------------------------------------------------------------------------------------------------
  spinPress() {
    if (!this.alive) return;
    this.app.audio.unlock();
    this.lastAction = Date.now();
    const st = this.sm.state;
    if (st === "idle") this.startSpin();
    else if ((st === "spinning" || st === "stopping") && this.sm.accepts("slam")) this.reels.doSlam();
    else if (st === "presenting" && this.sm.accepts("skip")) { this.pendingSpin = true; this.app.skipper.fire(); }
  }

  stagePress() {
    this.lastAction = Date.now();
    const st = this.sm.state;
    if ((st === "spinning" || st === "stopping") && this.sm.accepts("slam")) this.reels.doSlam();
    else if (st === "presenting") this.app.skipper.fire();
  }

  // ---- the spin ------------------------------------------------------------------------------------------------
  async startSpin() {
    const { app, session, reels } = this;
    if (!this.sm.accepts("spin")) return;
    const bet = this.bet;
    if (!session.canSpin(bet)) return this.lowBalance();
    this.cycleToken++;
    this.setWin(0, bet);
    this.winField.classList.remove("below", "has");
    this.winField.querySelector(".win-note").textContent = "";
    // the outcome is decided here and now; the reels only show it (MATH-01)
    const outcome = session.spin(bet);
    this.go("spinning");
    reels.startSpin("base");
    app.audio.sfx("spin");
    this.setBalance(app.profile.balance);
    this.round = { bet, win: 0, features: 0, jackpots: [], freeSpinFeatures: 0 };
    const events = P.recordSpin(app.profile, app.game, this.cfg.id, this.cfg, outcome);
    app.persist();
    this.refresh();
    app.handleEvents(events);
    await this.playReels(outcome, { free: false });
    await this.present(outcome);
    await this.finishRound();
  }

  /** Animate the reels onto an outcome, then expanding wilds and cascades (Stopping and Evaluating). */
  async playReels(outcome, { free }) {
    const { reels, prep } = this;
    const turbo = this.turbo;
    const plan = free ? [] : anticipationPlan(prep, outcome.gridStart);
    this.stoppingTimer = setTimeout(() => { if (this.sm.state === "spinning") this.go("stopping"); }, (turbo ? 140 : 620) / timing.speed);
    await reels.stopAll(outcome.stops, { turbo, plan });
    clearTimeout(this.stoppingTimer);
    if (this.sm.state === "spinning") this.go("stopping");
    if (this.sm.state === "stopping") this.go("evaluating");
    if (outcome.coins.length) reels.setCoinTags(outcome.coins, outcome.bet);
    await reels.expand(outcome.expanded, outcome.grid);
    if (this.prep.cascade) await this.playCascade(outcome);
  }

  async playCascade(outcome) {
    const { reels } = this;
    let running = 0;
    for (let k = 0; k < outcome.steps.length; k++) {
      const step = outcome.steps[k];
      if (!step.removed) break;
      reels.highlight(step.wins.flatMap((w) => w.positions));
      running += step.amount;
      this.setWin(running, outcome.bet, true);
      this.app.audio.sfx("win", 0.3 + k * 0.2);
      if (step.cascadeMultiplier > 1) toast(this.app, "×" + step.cascadeMultiplier, "mult", 900);
      await sleep(this.turbo ? 350 : 750);
      await reels.cascade(step, outcome.steps[k + 1].grid);
    }
  }

  setWin(amount, bet, pop = false) {
    this.winField.querySelector(".win-value").textContent = fmt(this.app, amount);
    this.winField.classList.toggle("has", amount > 0);
    if (pop) { this.winField.classList.remove("pop"); void this.winField.offsetWidth; this.winField.classList.add("pop"); }
  }

  /** Presenting: all winning lines together with the total, then the count-up and the credit. */
  async present(outcome, { resumed = false } = {}) {
    const { app, cfg, reels, session } = this;
    if (this.sm.state === "evaluating") this.go("presenting");
    const total = outcome.totalWin, bet = outcome.bet;
    const tier = tierName(cfg, total / bet);
    const turbo = this.turbo && !resumed;
    if (total > 0) {
      if (!this.prep.cascade) {
        reels.highlight(outcome.steps[0].wins.flatMap((w) => w.positions).concat(outcome.scatter.amount ? outcome.scatter.positions : []));
        await sleep(turbo ? 250 : 700);
      }
      if (["big", "mega", "epic"].includes(tier) && !resumed) {
        await celebrateWin(app, { amount: total, bet, cfg, tier, turbo });
        this.setWin(total, bet);
      } else {
        if (tier === "below") app.audio.sfx("tick", 0.2);
        else if (!resumed) app.audio.sfx("win", TIERS.indexOf(tier) / 4);
        await countUp(app, { to: total, ms: (resumed ? 200 : app.game.countUpMs[tier]) / (turbo ? 3 : 1), onValue: (v) => this.setWin(v, bet) });
      }
      // FAIR-04: a win below the bet is shown against the bet, with no celebration
      if (tier === "below") {
        this.winField.classList.add("below");
        this.winField.querySelector(".win-note").textContent = app.t("winVsBet", { bet: fmt(app, bet) });
      }
    }
    let paid = total;
    if (paid > 0 && !resumed && this.gambleOffered(outcome, tier)) {
      paid = await offerGamble(app, session, { maxRounds: app.game.gamble.maxRounds, onValue: (v) => this.setWin(v, bet) });
      this.setWin(paid, bet);
      if (!paid) this.winField.classList.remove("has");
    }
    session.settle();
    app.persist();
    this.round.win += paid;
    if (outcome.features.length) this.round.features += 0; // counted when each feature starts
    await this.growBalance(app.profile.balance);
    this.refresh();
    this.lastWin = paid > 0 ? outcome : null;
  }

  /** Double or collect is opt-in, only for small base-game wins, never during autoplay or when it would be a large share of the balance. */
  gambleOffered(outcome, tier) {
    const { app } = this, g = app.game.gamble;
    return !!app.profile.settings.gamble && !this.auto.active && tier === "win" && this.session.canGamble()
      && outcome.totalWin <= app.profile.balance * g.maxBalanceShare;
  }

  async finishRound() {
    const { app, cfg, session } = this;
    if (session.hasFeature()) {
      this.stopAuto(true); // REEL-05: autoplay stops when a feature triggers
      this.cycleToken++;
      this.go("feature");
      await this.runFeatures();
    }
    this.round = this.round || { bet: this.bet, win: 0, features: 0, jackpots: [], freeSpinFeatures: 0 };
    this.checkAutoWin(this.round.win, this.round.bet);
    this.checkAutoLimits();
    const events = P.recordRound(app.profile, app.game, cfg.id, cfg, this.round);
    app.persist();
    app.handleEvents(events);
    this.round = null;
    if (this.sm.state === "feature") this.go("idle"); else if (this.sm.state === "presenting") this.go("idle");
    this.reels.setSticky({});
    this.setHud(null);
    app.audio.music("base", cfg.musicShift || 0);
    this.refresh();
    this.updateControls();
    this.startCycle();
    // what happens next: the player's queued tap, autoplay, or a low-balance offer
    this.checkSessionLoss();
    if (this.auto.active && this.reminderDue()) this.stopAuto(true); // an endless autoplay still gets its time check (FAIR-06)
    if (this.pendingSpin) { this.pendingSpin = false; if (session.canSpin(this.bet)) return this.startSpin(); }
    if (this.auto.active) return this.autoNext();
    if (app.profile.balance < this.cfg.betLevels[0]) this.lowBalance();
    this.checkReminder();
  }

  // ---- cycling through winning lines after the presentation (PAY-05) --------------------------------------------------
  async startCycle() {
    const o = this.lastWin;
    if (!o || this.prep.cascade || !o.steps[0].wins.length) return;
    const token = ++this.cycleToken;
    const wins = o.steps[0].wins;
    const colors = ["#ffd35a", "#6fd0ff", "#ff6fb7", "#7dffb0", "#b07cff", "#ff9d3d"];
    for (let i = 0; this.cycleToken === token && this.alive; i = (i + 1) % wins.length) {
      const w = wins[i];
      this.reels.highlight(w.positions);
      if (w.type === "line") this.reels.drawLine(this.prep.lines[w.line], w.line + 1, colors[w.line % colors.length]);
      else this.reels.clearLines();
      this.winField.querySelector(".win-note").textContent = w.type === "line" ? this.t("lineWin", { n: w.line + 1, amount: fmt(this.app, w.amount) }) : this.t("waysWin", { count: w.count, ways: w.ways, amount: fmt(this.app, w.amount) });
      await sleep(1400);
      if (wins.length === 1 && this.cycleToken === token) await sleep(2000);
    }
  }

  // ---- low balance, autoplay, reminder ----------------------------------------------------------------------------------
  async lowBalance() {
    const { app } = this;
    const lowest = this.cfg.betLevels[0];
    if (app.profile.balance >= lowest) return toast(app, this.t("lowerBet"), "info"); // enough for a lower bet
    const st = P.refillStatus(app.profile, app.game, lowest);
    app.persist();
    app.showRefill(st, () => { this.refresh(); this.updateControls(); });
  }

  async chooseAuto() {
    if (!this.sm.accepts("autoplay")) return;
    const { app } = this;
    // a challenge needs spins the player presses: offer to play it by hand first
    const c = app.profile.challenge;
    if (c && c.machine === this.cfg.id) {
      const i = await ask(app, { title: this.t("auto.challengeTitle"), body: h("p", { text: this.t("auto.challengeText") }), buttons: [{ label: this.t("auto.byHand"), primary: true }, { label: this.t("auto.anyway") }], dismissible: true });
      if (i !== 1) return;
      if (!this.sm.accepts("autoplay")) return;
    }
    const cfgA = app.game.autoplay;
    let stopMult = 0, lossPct = this.lastLossPct ?? 0;
    const sel = h("select", { class: "select", "aria-label": this.t("stopOnWin") }, cfgA.bigWinMultiples.map((m) => h("option", { value: m, text: m ? this.t("stopOnWinX", { x: m }) : this.t("stopOnWinOff") })));
    sel.onchange = () => (stopMult = Number(sel.value));
    const loss = h("select", { class: "select", "aria-label": this.t("stopOnLoss") }, (cfgA.lossLimits || [0]).map((p) => h("option", { value: p, selected: p === lossPct, text: p ? this.t("stopOnLossX", { pct: p }) : this.t("stopOnWinOff") })));
    loss.onchange = () => (lossPct = Number(loss.value));
    const go = (n) => { m.close(); this.lastLossPct = lossPct; this.startAuto(n, stopMult, lossPct); };
    const chips = cfgA.choices.map((n) => h("button", { type: "button", class: "chip", text: String(n), onclick: () => go(n) }));
    if (cfgA.infinite) chips.push(h("button", { type: "button", class: "chip chip-inf", text: "∞", "aria-label": this.t("autoInfinite"), onclick: () => go(Infinity) }));
    const body = h("div", { class: "auto-modal" }, h("p", { text: this.t("autoNote") }), h("div", { class: "chips" }, chips),
      h("label", { class: "field" }, h("span", {}, h("b", { text: this.t("stopOnWin") })), sel),
      h("label", { class: "field" }, h("span", {}, h("b", { text: this.t("stopOnLoss") }), h("small", { text: this.t("stopOnLoss.note") })), loss));
    const m = openModal(app, { title: this.t("autoplay"), body });
  }

  startAuto(n, stopMult, lossPct = 0) {
    this.auto = { active: true, left: n, stopMult, lossPct, startBalance: this.app.profile.balance };
    this.updateControls();
    this.autoNext();
  }

  stopAuto(quiet = false) {
    if (!this.auto.active) return;
    this.auto.active = false;
    this.pendingSpin = false;
    this.updateControls();
    if (!quiet) toast(this.app, this.t("autoStopped"), "info", 1800);
  }

  async autoNext() {
    const a = this.auto;
    if (!a.active) return;
    const st = this.sm.state;
    if (st !== "idle") return;
    if (a.left <= 0) return this.stopAuto();
    if (!this.session.canSpin(this.bet)) { this.stopAuto(); return this.lowBalance(); } // never changes the bet (REEL-05)
    await sleep(this.turbo ? 200 : 550);
    if (!a.active || this.sm.state !== "idle" || !this.alive) return;
    a.left--;
    this.updateControls();
    await this.startSpin();
  }

  // The stop-on-big-win rule is checked once a round has been paid
  checkAutoWin(win, bet) {
    const a = this.auto;
    if (a.active && a.stopMult && win >= a.stopMult * bet) this.stopAuto();
  }

  /** Autoplay with a loss limit stops once the balance has fallen by that share of what it was when autoplay started. */
  checkAutoLimits() {
    const a = this.auto;
    if (!a.active || !a.lossPct) return;
    if (a.startBalance - this.app.profile.balance >= (a.startBalance * a.lossPct) / 100) {
      this.stopAuto(true);
      toast(this.app, this.t("autoLossStop", { pct: a.lossPct }), "info", 4200);
    }
  }

  /** Once a session, when the net loss since it began passes economy.sessionLossWarn of the starting balance (ECO-09). */
  checkSessionLoss() {
    const { app } = this, p = app.profile, ss = app.sessionStart, share = (app.game.economy && app.game.economy.sessionLossWarn) || 0;
    if (!share || app.lossWarned) return;
    const lost = (p.totals.wagered - p.totals.won) - (ss.wagered - ss.won);   // coins lost since the session began
    if (ss.balance > 0 && lost >= share * ss.balance) {
      app.lossWarned = true;
      this.stopAuto(true);
      toast(app, this.t("lossWarn", { pct: Math.round(share * 100), n: fmt(app, lost) }), "info", 6000);
    }
  }

  reminderDue() {
    const mins = this.app.profile.settings.reminderMinutes;
    return !!mins && Date.now() - this.app.remindedAt >= mins * 60000;
  }

  checkReminder() {
    const { app } = this;
    const mins = app.profile.settings.reminderMinutes;
    if (!mins || !this.sm.accepts("spin") || this.auto.active) return;
    app.maybeRemind(mins);
  }

  // ---- resuming after an interruption (PERS-02) ---------------------------------------------------------------------------------
  async resume() {
    const st = this.session.state;
    if (st.pending) {
      const o = st.pending.outcome;
      this.sm.resumeAt("evaluating");
      this.round = { bet: o.bet, win: 0, features: 0, jackpots: [], freeSpinFeatures: 0 };
      this.reels.setGrid(o.steps[o.steps.length - 1].grid);
      if (o.coins.length) this.reels.setCoinTags(o.coins, o.bet);
      toast(this.app, this.t("resumed"), "info");
      this.updateControls();
      await this.present(o, { resumed: true });
      this.checkAutoWin(o.totalWin, o.bet);
      await this.finishRound();
    } else if (st.feature || st.queue.length) {
      this.sm.resumeAt("feature");
      this.round = { bet: st.feature ? st.feature.bet : st.queue[0].bet, win: 0, features: 0, jackpots: [], freeSpinFeatures: 0 };
      toast(this.app, this.t("resumed"), "info");
      this.updateControls();
      await this.finishRound();
    }
  }

  // ======================================================================================================
  //   features
  // ======================================================================================================
  setHud(html) {
    if (!html) { this.hud.hidden = true; this.hud.replaceChildren(); return; }
    this.hud.hidden = false; this.hud.replaceChildren(...[].concat(html).filter(Boolean));
  }

  async runFeatures() {
    const { session, round } = this;
    while (session.hasFeature()) {
      const resumed = !!session.state.feature;
      const f = session.nextFeature();
      round.features++;
      if (f.type === "freeSpins") { round.freeSpinFeatures++; await this.runFreeSpins(f, resumed); }
      else if (f.type === "holdSpin") await this.runHoldSpin(f, resumed);
      else await this.runPick(f, resumed);
    }
  }

  async closeFeature(f, { title, lines }) {
    const { app, cfg, round } = this;
    const total = f.plan.totalWin;
    await summary(app, { title, total, bet: f.bet, cfg, lines, turbo: this.turbo });
    const fin = this.session.finishFeature();
    round.win += fin.total;
    for (const tier of f.plan.jackpotsWon || []) round.jackpots.push(tier);
    app.persist();
    await this.growBalance(app.profile.balance);
    this.refresh();
    this.setWin(fin.total, f.bet);
    if (fin.capped) toast(app, this.t("capReached", { x: fmt(app, cfg.maxWin) }), "info", 4000);
    this.round.bet = f.bet;
  }

  // ---- free spins (FS-01..06) -----------------------------------------------------------------------------------------------
  async runFreeSpins(f, resumed) {
    const { app, cfg, session, reels } = this;
    app.audio.music("free", cfg.musicShift || 0);
    if (f.phase === "choice") {
      if (!resumed || f.cursor === 0) await announce(app, { title: this.t("fs.triggered"), big: this.t("fs.scatters", { n: f.scatterCount }), subtitle: this.t("fs.choose") });
      const id = await this.chooseFsOption(f);
      session.chooseOption(id);
      app.persist();
    } else if (!resumed || f.cursor === 0) {
      const spins = f.plan.spinsAwarded;
      const fixedBet = f.source === "meter" || f.source === "voucher";
      await announce(app, { title: f.source === "meter" ? this.t("meter.reward") : f.source === "voucher" ? this.t("voucher.title") : this.t("fs.triggered"), big: this.t("fs.award", { n: spins }), subtitle: fixedBet ? this.t("fs.atBet", { bet: fmt(app, f.bet) }) : "" });
    }
    const plan = f.plan;
    this.el.classList.add("free");
    reels.setSticky(f.cursor > 0 ? plan.spins[f.cursor - 1].outcome.sticky || {} : {});
    let total = f.cursor > 0 ? plan.spins[f.cursor - 1].total : 0;
    const initial = plan.option ? plan.option.spins : plan.spins.length ? plan.spinsAwarded - plan.spins.reduce((n, s) => n + s.retrigger, 0) : 0;
    for (let i = f.cursor; i < plan.spins.length; i++) {
      const sp = plan.spins[i];
      const left = i === 0 ? initial : plan.spins[i - 1].spinsLeft;
      this.hudFree(left, total, sp.multiplier, plan);
      await this.waitWhilePaused();
      reels.startSpin("free");
      app.audio.sfx("spin");
      await reels.stopAll(sp.outcome.stops, { turbo: this.turbo, plan: [] });
      await reels.expand(sp.outcome.expanded, sp.outcome.grid);
      if (sp.outcome.newSticky.length || Object.keys(sp.outcome.sticky || {}).length) reels.setSticky(sp.outcome.sticky || {});
      if (this.prep.cascade) await this.playCascade(sp.outcome);
      else if (sp.win > 0) { reels.highlight(sp.outcome.steps[0].wins.flatMap((w) => w.positions).concat(sp.outcome.scatter.amount ? sp.outcome.scatter.positions : [])); }
      if (sp.win > 0) {
        app.audio.sfx("win", Math.min(1, sp.win / f.bet / 20));
        await countUp(app, { from: total, to: sp.total, ms: this.turbo ? 200 : 700, onValue: (v) => this.hudTotal(v), onTick: () => {} });
      }
      total = sp.total;
      if (sp.retrigger) await announce(app, { title: this.t("fs.retrigger"), big: "+" + sp.retrigger, ms: 1600 });
      session.stepDone();
      app.persist();
      reels.clearHighlight();
      this.hudFree(sp.spinsLeft, total, sp.multiplier, plan);
      await sleep(this.turbo ? 120 : 380);
    }
    reels.clearHighlight();
    await this.closeFeature(f, {
      title: this.t("fs.summary"),
      lines: [this.t("fs.played", { n: plan.spinsPlayed }), plan.option ? this.t("fs.optionLine", { m: plan.option.multiplier }) : null, plan.capped ? this.t("capReached", { x: fmt(app, cfg.maxWin) }) : null].filter(Boolean),
    });
    this.el.classList.remove("free");
    reels.setSticky({});
    reels.stripSet = "base";
    reels.showStops(this.cfg.strips.base.map(() => 0));
    app.audio.music("base", cfg.musicShift || 0);
  }

  chooseFsOption(f) {
    const { app } = this;
    return new Promise((resolve) => {
      const cards = f.options.map((o) => h("button", { type: "button", class: "choice-card", onclick: () => { app.audio.sfx("tap"); m.close(); resolve(o.id); } },
        h("b", { text: String(o.spins) }), h("span", { text: this.t("fs.spins") }), h("i", { text: "×" + o.multiplier }), h("small", { text: this.t("fs.opt." + o.id) })));
      const m = openModal(app, { title: this.t("fs.chooseTitle"), body: h("div", { class: "choice" }, h("p", { text: this.t("fs.chooseNote") }), h("div", { class: "choice-row" }, cards)), dismissible: false });
    });
  }

  hudFree(left, total, mult, plan) {
    this.paused = this.paused || false;
    this.hudSpins = h("b", { text: String(left) });
    this.hudTotalEl = h("b", { text: fmt(this.app, total) });
    const pause = h("button", { type: "button", class: "icon-btn", "aria-label": this.t("pause"), onclick: () => { this.paused = !this.paused; pause.replaceChildren(icon(this.paused ? "play" : "pause", 18)); if (!this.paused && this.pauseResolve) this.pauseResolve(); } }, icon(this.paused ? "play" : "pause", 18));
    this.setHud([h("div", { class: "hud-item" }, h("span", { text: this.t("fs.left") }), this.hudSpins),
      mult > 1 ? h("div", { class: "hud-item mult" }, h("span", { text: this.t("fs.mult") }), h("b", { text: "×" + mult })) : null,
      h("div", { class: "hud-item" }, h("span", { text: this.t("fs.total") }), this.hudTotalEl), pause]);
  }

  hudTotal(v) { if (this.hudTotalEl) this.hudTotalEl.textContent = fmt(this.app, v); }

  waitWhilePaused() { return this.paused ? new Promise((r) => { this.pauseResolve = r; }) : Promise.resolve(); }

  // ---- Hold & Spin (HS-01..05) ------------------------------------------------------------------------------------------------
  async runHoldSpin(f, resumed) {
    const { app, cfg, reels } = this;
    const plan = f.plan, bet = f.bet;
    app.audio.music("hold", cfg.musicShift || 0);
    if (!resumed || f.cursor === 0) await announce(app, { title: this.t("hs.title"), big: this.t("hs.coins", { n: plan.startCoins.length }), subtitle: this.t("hs.note", { n: cfg.features.holdSpin.respins }) });
    this.el.classList.add("hold");
    let coins = plan.startCoins.slice();
    for (let i = 0; i < f.cursor; i++) coins = coins.concat(plan.steps[i].fresh);
    reels.holdBoard(coins, bet);
    const max = cfg.features.holdSpin.respins;
    const pips = h("div", { class: "pips" }, Array.from({ length: max }, () => h("i")));
    const totalEl = h("b", { text: "0" });
    const setPips = (n, reset) => { [...pips.children].forEach((p, k) => p.classList.toggle("on", k < n)); if (reset) { pips.classList.remove("refill"); void pips.offsetWidth; pips.classList.add("refill"); } };
    const running = () => coins.reduce((s, c) => s + (c.value ? c.value * bet : 0), 0);
    const hud = () => { totalEl.textContent = fmt(app, running()); };
    this.setHud([h("div", { class: "hud-item" }, h("span", { text: this.t("hs.respins") }), pips), h("div", { class: "hud-item" }, h("span", { text: this.t("hs.coinsHeld") }), h("b", { class: "coin-count", text: String(coins.length) })), h("div", { class: "hud-item" }, h("span", { text: this.t("hs.value") }), totalEl)]);
    setPips(f.cursor ? plan.steps[f.cursor - 1].respinsLeft : max, false);
    hud();
    for (let i = f.cursor; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      await reels.respin(coins, step.fresh, bet, this.turbo);
      coins = coins.concat(step.fresh);
      setPips(step.respinsLeft, step.reset);
      app.audio.sfx("pip", step.respinsLeft);
      this.hud.querySelector(".coin-count").textContent = String(coins.length);
      hud();
      this.session.stepDone(); app.persist();
    }
    // collect the coins one by one (HS-05); jackpot coins play their own sequence (JP-02)
    await sleep(500);
    let run = 0;
    for (const c of plan.collect) {
      if (c.grand) { await celebrateJackpot(app, { tier: "grand", amount: c.amount, bet }); run = c.running; totalEl.textContent = fmt(app, run); continue; }
      const el = reels.cellAt(c.reel, c.row).el;
      el.classList.add("collecting");
      app.audio.sfx("collect", Math.min(12, plan.collect.indexOf(c)));
      app.fx.burst(el.getBoundingClientRect().left + el.offsetWidth / 2, el.getBoundingClientRect().top + el.offsetHeight / 2, 8, 0.6);
      if (c.jackpot) await celebrateJackpot(app, { tier: c.jackpot, amount: c.amount, bet });
      await countUp(app, { from: run, to: c.running, ms: this.turbo ? 120 : 330, onValue: (v) => (totalEl.textContent = fmt(app, v)), onTick: () => {} });
      run = c.running;
      await sleep(this.turbo ? 40 : 120);
    }
    await this.closeFeature(f, { title: this.t("hs.summary"), lines: [this.t("hs.coinsLine", { n: coins.length }), plan.full ? this.t("hs.grandLine") : null].filter(Boolean) });
    reels.endHold();
    this.el.classList.remove("hold");
    reels.showStops(this.cfg.strips.base.map(() => 0));
    app.audio.music("base", cfg.musicShift || 0);
  }

  // ---- pick bonus (PICK-01..04) ---------------------------------------------------------------------------------------------------
  async runPick(f, resumed) {
    const { app, cfg, session } = this;
    const plan = f.plan, bet = f.bet;
    app.audio.music("pick", cfg.musicShift || 0);
    if (!resumed || f.cursor === 0) await announce(app, { title: f.source === "meter" ? this.t("meter.reward") : this.t("pick.title"), big: this.t("pick.picks", { n: plan.startPicks }), subtitle: this.t("pick.note") });
    const totalEl = h("b", { text: "0" }), picksEl = h("b", { text: String(plan.startPicks) }), multEl = h("b", { text: "×1" });
    const grid = h("div", { class: "pick-grid" });
    const overlay = h("div", { class: "pick" }, h("div", { class: "pick-hud" },
      h("div", { class: "hud-item" }, h("span", { text: this.t("pick.left") }), picksEl), h("div", { class: "hud-item" }, h("span", { text: this.t("pick.mult") }), multEl), h("div", { class: "hud-item" }, h("span", { text: this.t("fs.total") }), totalEl)), grid,
      h("div", { class: "pick-foot" }));
    const autoBtn = h("button", { type: "button", class: "pill-btn", text: this.t("pick.auto") });
    overlay.querySelector(".pick-foot").append(autoBtn);
    let autoPick = false;
    autoBtn.onclick = () => { autoPick = !autoPick; autoBtn.classList.toggle("on", autoPick); };
    this.stage.append(overlay);
    const tiles = Array.from({ length: plan.items }, (_, i) => {
      const b = h("button", { type: "button", class: "pick-tile", "aria-label": this.t("pick.item", { n: i + 1 }), onclick: () => choose(i) }, h("span", { class: "pick-front" }, symbolSvg(cfg.symbols[cfg.features.pick.trigger.symbol].art)), h("span", { class: "pick-back" }));
      grid.append(b); return b;
    });
    const label = (p) => p.type === "coins" ? [fmt(app, p.value * bet), "coins"] : p.type === "extraPick" ? ["+" + p.value, "extra"] : p.type === "multiplier" ? ["×" + p.value, "mult"] : p.type === "jackpot" ? [this.t("jp." + p.tier).toUpperCase(), "jp"] : [this.t("pick.collect"), "collect"];
    const show = (tile, p, dim) => { const [txt, kind] = label(p); const back = tile.querySelector(".pick-back"); back.textContent = txt; tile.className = "pick-tile revealed " + kind + (dim ? " dim" : ""); tile.disabled = true; };
    const update = (lg) => { picksEl.textContent = String(lg.picksLeft); multEl.textContent = "×" + lg.multiplier; totalEl.textContent = fmt(app, lg.coins * bet * lg.multiplier + lg.jackpot); };
    // restore after an interruption: tiles already revealed keep their prizes
    for (const [tile, idx] of Object.entries(f.tiles)) show(tiles[tile], plan.prizes[idx], false);
    if (f.cursor > 0) update(plan.log[f.cursor - 1]);
    let idleTimer = 0;
    const resetHint = () => { clearTimeout(idleTimer); tiles.forEach((t) => t.classList.remove("hint")); idleTimer = setTimeout(() => { const free = tiles.filter((t) => !t.disabled); if (free.length) free[(Math.random() * free.length) | 0].classList.add("hint"); }, 15000 / timing.speed); };
    let resolveDone;
    const done = new Promise((r) => { resolveDone = r; });
    const choose = async (tile) => {
      if (f.cursor >= plan.revealsUsed || tiles[tile].disabled || this.picking) return;
      this.picking = true;
      resetHint();
      const idx = f.cursor;
      const res = session.pickTile(tile);
      app.persist();
      app.audio.sfx("reveal");
      show(tiles[tile], res.prize, false);
      update(res.log);
      if (res.prize.type === "jackpot") await celebrateJackpot(app, { tier: res.prize.tier, amount: res.prize.amount, bet });
      this.picking = false;
      if (res.over) resolveDone();
      else if (autoPick) setTimeout(autoStep, 1000 / timing.speed);
    };
    const autoStep = () => { if (!autoPick || this.picking || f.cursor >= plan.revealsUsed) return; const free = tiles.findIndex((t) => !t.disabled); if (free >= 0) choose(free); };
    autoBtn.addEventListener("click", () => { if (autoPick) autoStep(); });
    if (f.cursor >= plan.revealsUsed) resolveDone();
    resetHint();
    await done;
    clearTimeout(idleTimer);
    // PICK-03: items left over show the next real draws from the same pool, never invented near misses
    await sleep(600);
    let next = plan.revealsUsed;
    tiles.forEach((t) => { if (!t.disabled && next < plan.prizes.length) show(t, plan.prizes[next++], true); });
    await sleep(1100);
    overlay.remove();
    await this.closeFeature(f, { title: this.t("pick.summary"), lines: [this.t("pick.revealed", { n: plan.revealsUsed }), plan.multiplier > 1 ? this.t("pick.multLine", { m: plan.multiplier }) : null].filter(Boolean) });
    app.audio.music("base", cfg.musicShift || 0);
  }
}
