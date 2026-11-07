// The rules of the machine on top of the physics board: the bank and drops, auto-drop, nudges,
// gold and lucky coins, prize replenishment, cascades, bonus events, anti-stall, the coin cap and
// the credits that prizes and milestones pay. Headless like board.js: the shell (game.js) feeds it
// input, steps it at the fixed rate and turns its events into sound, haptics and pictures.
//
// Everything random comes from one seeded generator, so a seed reproduces a board.
import { CONFIG } from "./config.js";
import { Board, isCoin, isPrize } from "./board.js";
import { Rng, freshSeed } from "./rng.js";
import { GEM_COLOURS } from "./shapes.js";
import * as Eco from "./economy.js";

const RAIN = ["shower", "jackpot"];

/** Today as YYYY-MM-DD, local time (the collection shows the day a prize was won). */
export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export class Machine {
  /**
   * progress: the persistent progress object (economy.js freshProgress), mutated in place.
   * onEvent(type, data): what happened, for sound, haptics, pictures and saving.
   */
  constructor({ cfg = CONFIG, progress = Eco.freshProgress(cfg), onEvent = () => {}, date = today } = {}) {
    this.cfg = cfg;
    this.progress = progress;
    this.emit = onEvent;
    this.date = date;
    this.board = new Board({ cfg, onEvent: (t, d) => this.boardEvent(t, d) });
    this.dt = this.board.dt;
    this.quiet = false;      // true while a new board settles: nothing is paid or reported
    this.reset(freshSeed());
  }

  /** State that belongs to one board (and is saved with it). */
  reset(seed) {
    const cfg = this.cfg;
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.bank = Eco.startBank(this.progress, cfg);
    this.time = 0;                       // seconds of play on this board
    this.aim = 0;
    this.auto = false;
    this.autoT = 0;
    this.lastDrop = -1e9;
    this.nudges = Eco.maxNudges(this.progress, cfg);
    this.nudgeT = 0;                     // seconds toward the next recharge
    this.fever = 0;                      // seconds of fever left
    this.gemTimes = [];
    this.rain = null;                    // { type, t, total, spawned }
    this.queue = [];                     // rain-type events waiting
    this.lastShowerEnd = -1e9;
    this.wide = 0;                       // drops left with the gutters closed
    this.luckyAt = this.nextLucky();
    this.replenishT = 0;
    this.figureT = 0;                    // seconds since the last figure was won
    this.stall = 0;                      // pusher cycles with nothing over the front edge
    this.stallStage = 0;
    this.wonThisCycle = 0;               // anything (coins or prizes) over the front edge this cycle
    this.cascade = 0;                    // coins over the front edge in this advance
    this.cascades = [];                  // sizes per completed advance (for the simulation)
    this.antiStallLog = [];              // [cycle, step] for tests
  }

  // ---- A new board ----------------------------------------------------------------------------------------
  /** Fill a fresh board: a loose pile of coins and the start prizes, settled before anyone sees it. */
  newBoard(seed = freshSeed()) {
    const S = this.cfg.start, B = this.cfg.board;
    for (const it of [...this.board.items.values()]) this.board.remove(it);
    this.board.phase = 0; this.board.cycles = 0; this.board.speed = 1; this.board.pz1 = undefined;
    this.board.setGuttersClosed(false);
    this.reset(seed);
    const r = this.rng, W2 = B.width / 2;
    const placed = [];
    const free = (x, z, y, rad) => placed.every((p) => Math.abs(p.y - y) > 0.2 || Math.hypot(p.x - x, p.z - z) > p.r + rad);
    // Prizes first, on the shelf in the middle of the pile.
    for (let i = 0; i < S.figures; i++) {
      const x = r.range(-1.5, 1.5), z = r.range(0, 2);
      this.board.add("figure", { x, y: this.cfg.prizes.figure.height / 2 + 0.01, z, sub: this.pickFigure() });
      placed.push({ x, z, y: 0.3, r: 0.4 });
    }
    for (let i = 0; i < S.gems; i++) {
      for (let k = 0; k < 40; k++) {
        const x = r.range(-W2 + 1, W2 - 1), z = r.range(-0.5, 3.5);
        if (!free(x, z, 0.2, 0.4)) continue;
        this.board.add("gem", { x, y: 0.3, z, sub: r.pick(GEM_COLOURS), q: [0.7071, 0, 0, 0.7071] });
        placed.push({ x, z, y: 0.2, r: 0.4 });
        break;
      }
    }
    // Coins: a loose pile in front of the pusher, layered where it gets crowded.
    const t = this.cfg.coin.thickness;
    for (let i = 0; i < S.coins; i++) {
      let layer = 0, x = 0, z = 0;
      for (let k = 0; ; k++) {
        x = r.range(-W2 + 0.55, W2 - 0.55); z = r.range(B.dropZ + B.stroke + 0.2, B.depth / 2 - 0.7);
        if (free(x, z, layer * (t + 0.01), 0.52)) break;
        if (k % 12 === 11) layer++;
      }
      const y = t / 2 + 0.005 + layer * (t + 0.012);
      const tilt = r.range(-0.08, 0.08);
      this.board.add(r.chance(this.cfg.drop.goldChance) ? "gold" : "coin", { x, y, z, q: [Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)] });
      placed.push({ x, z, y, r: 0.5 });
    }
    this.quiet = true;
    for (let i = 0; i < S.settleSeconds * this.cfg.physics.hz; i++) this.board.step();
    this.quiet = false;
    this.board.cycles = 0;
    this.cascade = 0; this.wonThisCycle = 0;
    this.emit("newBoard", {});
  }

  // ---- Player input ---------------------------------------------------------------------------------------
  /** Clamp an aim position to the shelf. */
  clampAim(x) {
    const lim = this.cfg.board.width / 2 - this.cfg.board.aimMargin;
    return Math.max(-lim, Math.min(lim, x));
  }
  setAim(x) { this.aim = this.clampAim(x); }

  /** Drop one coin at x (or the current aim). Returns false when rate-limited or the bank is empty. */
  drop(x = this.aim) {
    const D = this.cfg.drop, B = this.cfg.board;
    if (this.time - this.lastDrop < D.minInterval - 1e-9) return false;
    if (this.bank < 1) return false;
    this.aim = this.clampAim(x);
    this.lastDrop = this.time;
    this.bank -= 1;
    this.progress.stats.dropped++;
    const kind = this.rng.chance(Eco.goldChance(this.progress, this.cfg)) ? "gold" : "coin";
    const jx = this.clampAim(this.aim + this.rng.range(-B.dropJitter, B.dropJitter));
    this.spawnCoin(kind, jx, B.dropHeight, B.dropZ, { player: true });
    if (this.wide > 0 && --this.wide === 0) { this.board.setGuttersClosed(false); this.emit("eventEnd", { type: "wide" }); }
    this.emit("drop", { kind, x: jx });
    if (this.auto && this.bank < 1) { this.auto = false; this.emit("autoOff", {}); }  // auto-drop stops when the bank runs empty
    return true;
  }

  setAuto(on) {
    this.auto = !!on;
    this.autoT = 0;
  }

  /** Shake the board. Uses a charge; false when there are none. */
  nudge() {
    if (this.nudges < 1) return false;
    this.nudges--;
    this.board.shake(this.rng, 1);
    this.emit("nudge", { charges: this.nudges });
    return true;
  }

  get maxNudges() { return Eco.maxNudges(this.progress, this.cfg); }

  /** Coins dropped by the player that haven't landed yet (the lifeline waits for them). */
  inFlight() {
    let n = 0;
    for (const it of this.board.items.values()) if (it.player && it.falling) n++;
    return n;
  }

  // ---- Spawning -------------------------------------------------------------------------------------------
  spawnCoin(kind, x, y, z, extra = {}) {
    this.makeRoom();
    const r = this.rng, tilt = r.range(-0.12, 0.12), yaw = r.range(0, Math.PI);
    const q = [Math.sin(tilt / 2) * Math.cos(yaw), 0, Math.sin(tilt / 2) * Math.sin(yaw), Math.cos(tilt / 2)];
    const it = this.board.add(kind, { x, y, z, q, v: [0, -1.5, 0], falling: true });
    if (extra.player) it.player = true;
    return it;
  }

  /** The machine drops a prize (or a lucky coin) at the back of the shelf. */
  spawnPrize(kind, sub) {
    const B = this.cfg.board, r = this.rng;
    const x = r.range(-B.width / 2 + 1, B.width / 2 - 1), z = r.range(B.dropZ - 0.5, B.dropZ + 0.6);
    if (isCoin(kind)) return this.spawnCoin(kind, x, B.dropHeight + 0.4, z);
    const y = B.dropHeight + 0.6;
    const q = kind === "gem" ? [0.7071, 0, 0, 0.7071] : [0, 0, 0, 1];
    const it = this.board.add(kind, { x, y, z, q, sub, v: [0, -1, 0], falling: true });
    this.emit("prizeDrop", { item: it });
    return it;
  }

  /** Keep the coin count under the cap: remove the oldest settled coin farthest from the front edge. */
  makeRoom() {
    const cap = this.cfg.board.maxCoins;
    let coins = this.board.count((it) => isCoin(it.kind));
    while (coins >= cap) {
      const victim = this.pickForRemoval();
      if (!victim) break;
      this.board.remove(victim);
      this.emit("fade", { item: victim });
      coins--;
    }
  }

  pickForRemoval() {
    const coins = [...this.board.items.values()].filter((it) => isCoin(it.kind) && it.kind !== "jackpot" && it.kind !== "lucky");
    if (!coins.length) return null;
    const settled = coins.filter((it) => it.asleep && !it.falling);
    const pool = settled.length ? settled : coins.filter((it) => !it.falling);
    if (!pool.length) return null;
    // Farthest from the front edge first; among those (within half a coin) the oldest, and one with nothing on top.
    pool.sort((a, b) => a.z - b.z);
    const band = pool.filter((it) => it.z < pool[0].z + 0.5).sort((a, b) => a.born - b.born);
    return band.find((it) => !this.board.covered(it)) || band[0];
  }

  pickFigure() {
    const set = this.progress.collection[this.progress.theme] || {};
    const w = [];
    for (let i = 0; i < 8; i++) w.push(set[4 + i] ? 1 : this.cfg.prizes.unownedWeight);
    return this.rng.weighted(w);
  }

  nextLucky() {
    const P = this.cfg.prizes, base = Eco.luckyInterval(this.progress, this.cfg);
    return this.time + base * (1 + this.rng.range(-P.luckySpread, P.luckySpread));
  }

  // ---- The fixed step ---------------------------------------------------------------------------------------
  step() {
    const dt = this.dt, cfg = this.cfg, E = cfg.events;
    this.time += dt;

    // Auto-drop at the aim position; it stops itself when the bank runs out.
    if (this.auto) {
      this.autoT += dt;
      if (this.autoT >= cfg.drop.autoInterval - 1e-9) {
        this.autoT -= cfg.drop.autoInterval;
        if (this.bank < 1) { this.auto = false; this.emit("autoOff", {}); }
        else this.drop(this.aim);
      }
    }

    // Nudge charges come back with play time.
    const maxN = this.maxNudges;
    if (this.nudges < maxN) {
      this.nudgeT += dt;
      if (this.nudgeT >= cfg.nudge.rechargeSeconds) { this.nudgeT = 0; this.nudges++; this.emit("nudgeCharge", { charges: this.nudges }); }
    } else this.nudgeT = 0;

    // Fever.
    if (this.fever > 0) {
      this.fever -= dt;
      if (this.fever <= 0) { this.fever = 0; this.board.speed = 1; this.emit("eventEnd", { type: "fever" }); }
    }

    // Rain-type events: one at a time.
    if (!this.rain && this.queue.length) this.startRain(this.queue.shift());
    if (this.rain) this.rainStep(dt);

    // Prizes: keep 2–4 gems and one figure around, and a lucky coin every few minutes.
    this.replenishT += dt;
    this.figureT += dt;
    if (this.replenishT >= cfg.prizes.replenishEvery) {
      this.replenishT = 0;
      const gems = this.board.count((it) => it.kind === "gem");
      const figures = this.board.count((it) => it.kind === "figure");
      if (figures < 1 && this.figureT >= cfg.prizes.figureDelay) this.spawnPrize("figure", this.pickFigure());
      else if (gems < cfg.prizes.gemsMin || (gems < cfg.prizes.gemsMax && this.rng.chance(0.2))) this.spawnPrize("gem", this.rng.pick(GEM_COLOURS));
    }
    if (this.time >= this.luckyAt) {
      this.luckyAt = this.nextLucky();
      this.spawnPrize("lucky");
    }
    if (cfg.hazard.enabled && this.rng.chance(cfg.hazard.bombChance * dt / cfg.drop.autoInterval)) this.spawnPrize("bomb");

    this.board.step();

    // Lifeline: never stuck with an empty bank.
    const gift = Eco.lifeline(this.bank, this.inFlight(), cfg);
    if (gift) { this.bank += gift; this.emit("lifeline", { coins: gift }); }
  }

  startRain(type) {
    const S = this.cfg.events.shower;
    if (type === "shower") this.rain = { type, t: 0, total: S.coinsMin + this.rng.int(S.coinsMax - S.coinsMin + 1), spawned: 0, seconds: S.seconds };
    else this.rain = { type, t: 0, total: 1, spawned: 0, seconds: 2.5 };
    this.emit("eventStart", { type });
  }

  rainStep(dt) {
    const R = this.rain, B = this.cfg.board;
    R.t += dt;
    const due = Math.min(R.total, Math.ceil((R.t / R.seconds) * R.total));
    while (R.spawned < due) {
      R.spawned++;
      if (R.type === "jackpot") {
        this.spawnCoin("jackpot", this.rng.range(-0.8, 0.8), B.dropHeight + 1, B.dropZ + 0.4);
      } else {
        const x = this.rng.range(-B.width / 2 + 0.5, B.width / 2 - 0.5), z = this.rng.range(-B.depth / 2 + 0.5, 1.5);
        this.spawnCoin(this.rng.chance(Eco.goldChance(this.progress, this.cfg)) ? "gold" : "coin", x, B.dropHeight + this.rng.range(0, 1.5), z);
      }
    }
    if (R.t >= R.seconds) { this.emit("eventEnd", { type: R.type }); this.rain = null; this.lastShowerEnd = this.time; }
  }

  /** Queue a rain-type event (coin shower, jackpot); at most `maxQueued` wait behind the one playing. */
  trigger(type) {
    const E = this.cfg.events;
    if (RAIN.includes(type)) {
      if (!this.rain && !this.queue.length) { this.startRain(type); return true; }
      if (this.queue.length >= E.maxQueued) return false;
      this.queue.push(type);
      this.emit("queued", { type });
      return true;
    }
    if (type === "fever") {
      const F = E.fever;
      const first = this.fever <= 0;
      this.fever = F.seconds;
      this.board.speed = F.speed;
      if (first) this.emit("eventStart", { type });
      this.milestone("fever");
      return true;
    }
    if (type === "wide") {
      this.wide = E.wideShelfDrops;
      this.board.setGuttersClosed(true);
      this.emit("eventStart", { type });
      return true;
    }
    return false;
  }

  milestone(id) {
    const n = Eco.reachMilestone(this.progress, id, this.cfg);
    if (n) this.emit("milestone", { id, credits: n });
  }

  // ---- What the board reports ---------------------------------------------------------------------------------
  boardEvent(type, d) {
    if (this.quiet) return;
    if (type === "won") this.won(d.item);
    else if (type === "lost") this.emit("lost", { item: d.item });
    else if (type === "land") this.emit("land", d);
    else if (type === "advance") this.advance();
    else if (type === "retract") this.emit("retract", {});
  }

  won(item) {
    const cfg = this.cfg, E = cfg.events;
    this.wonThisCycle++;
    if (isCoin(item.kind)) {
      if (item.kind === "bomb") {
        const lose = Math.min(this.bank, cfg.values.bombPenalty);
        this.bank -= lose;
        this.emit("bomb", { item, coins: lose });
        return;
      }
      const value = Eco.coinValue(item.kind, this.fever > 0, cfg);
      this.bank += value;
      const before = this.progress.stats.coinsWon;
      this.progress.stats.coinsWon += value;
      if (before < 100 && this.progress.stats.coinsWon >= 100) this.milestone("won100");
      this.cascade++;
      this.emit("won", { item, value, cascade: this.cascade });
      if (this.cascade === E.cascadeMin) this.emit("cascade", { n: this.cascade });
      if (this.cascade === E.showerCascade && !this.rain && !this.queue.length && this.time - this.lastShowerEnd >= E.cascadeCooldown) this.trigger("shower");
      if (item.kind === "lucky") {
        if (this.fever > 0) { this.trigger("jackpot"); }
        else this.trigger("shower");
      }
      if (item.kind === "jackpot") this.milestone("jackpot");
      return;
    }
    if (isPrize(item.kind)) {
      const index = item.kind === "gem" ? Math.max(0, GEM_COLOURS.indexOf(item.sub)) : 4 + (item.sub | 0);
      const theme = this.progress.theme;
      const res = Eco.collect(this.progress, theme, index, this.date(), cfg);
      this.emit("prize", { item, theme, index, ...res });
      if (res.complete) this.milestone("fullSet");
      if (item.kind === "gem") {
        this.gemTimes.push(this.time);
        this.gemTimes = this.gemTimes.filter((t) => this.time - t <= E.fever.window);
        if (this.gemTimes.length >= E.fever.gems) { this.gemTimes = []; this.trigger("fever"); }
      } else {
        this.figureT = 0;
        this.trigger("wide");
      }
    }
  }

  /** A new advance starts: close the last one's cascade, run anti-stall checks. */
  advance() {
    const A = this.cfg.antiStall, E = this.cfg.events;
    const n = this.cascade;
    this.cascades.push(n);
    if (n > this.progress.stats.bestCascade) this.progress.stats.bestCascade = n;
    if (n >= E.cascadeMin) this.emit("cascadeEnd", { n });
    if (n >= 10) this.milestone("cascade10");
    this.cascade = 0;

    // Anti-stall: never a dead board. Looks like normal physics; no message.
    if (this.wonThisCycle > 0) { this.stall = 0; this.stallStage = 0; }
    else this.stall++;
    this.wonThisCycle = 0;
    if (this.stallStage === 0 && this.stall >= A.cycles) {
      this.board.settle(A.settleCoins, A.settleImpulse);
      this.stallStage = 1;
      this.antiStallLog.push([this.board.cycles, 1]);
    } else if (this.stallStage === 1 && this.stall >= A.cycles + A.coinsAfter) {
      const B = this.cfg.board;
      for (let i = 0; i < A.freeCoins; i++) this.spawnCoin("coin", this.rng.range(-B.width / 2 + 0.8, B.width / 2 - 0.8), B.dropHeight + i * 0.4, B.dropZ);
      this.antiStallLog.push([this.board.cycles, 2]);
      this.stall = 0; this.stallStage = 0;
    }
    // A prize that hasn't moved for a while gets a small sideways push.
    for (const it of this.board.items.values()) {
      if (!isPrize(it.kind)) continue;
      const moved = Math.hypot(it.x - it.lastX, it.z - it.lastZ);
      it.lastX = it.x; it.lastZ = it.z;
      it.still = moved < A.prizeMoved ? it.still + 1 : 0;
      if (it.still >= A.prizeCycles) {
        it.still = 0;
        const dir = it.x > 0 ? -1 : it.x < 0 ? 1 : (this.rng.chance(0.5) ? 1 : -1);
        this.board.kick(it, dir * A.prizeImpulse, A.prizeImpulse * 0.4, A.prizeImpulse * 0.3);
        this.antiStallLog.push([this.board.cycles, 3]);
      }
    }
    this.emit("advance", { cycles: this.board.cycles });
  }

  // ---- Save and restore -----------------------------------------------------------------------------------
  snapshot() {
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return {
      seed: this.seed, rng: this.rng.s, bank: this.bank, time: r3(this.time), aim: r3(this.aim), auto: this.auto,
      nudges: this.nudges, nudgeT: r3(this.nudgeT), fever: r3(this.fever), gemTimes: this.gemTimes.map(r3),
      rain: this.rain, queue: this.queue.slice(), lastShowerEnd: r3(Math.max(-1e6, this.lastShowerEnd)), wide: this.wide, luckyAt: r3(this.luckyAt),
      figureT: r3(this.figureT), stall: this.stall, stallStage: this.stallStage,
      board: this.board.snapshot(),
    };
  }

  /** Restore a saved board. Throws if the snapshot is unusable (the caller then starts a new board). */
  restore(s) {
    if (!s || typeof s !== "object" || !s.board || !Array.isArray(s.board.items)) throw new Error("bad snapshot");
    const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    this.reset(num(s.seed));
    this.rng.s = num(s.rng) >>> 0;
    this.bank = Math.max(0, Math.floor(num(s.bank, this.bank)));
    this.time = num(s.time);
    this.lastDrop = this.time - 1;
    this.aim = this.clampAim(num(s.aim));
    this.auto = !!s.auto;
    this.nudges = Math.min(this.maxNudges, Math.max(0, Math.floor(num(s.nudges, this.maxNudges))));
    this.nudgeT = num(s.nudgeT);
    this.fever = Math.max(0, num(s.fever));
    this.board.speed = this.fever > 0 ? this.cfg.events.fever.speed : 1;
    this.gemTimes = Array.isArray(s.gemTimes) ? s.gemTimes.map(Number).filter(Number.isFinite) : [];
    this.rain = s.rain && RAIN.includes(s.rain.type) ? { ...s.rain } : null;
    this.queue = Array.isArray(s.queue) ? s.queue.filter((t) => RAIN.includes(t)).slice(0, this.cfg.events.maxQueued) : [];
    this.lastShowerEnd = num(s.lastShowerEnd, -1e9);
    this.wide = Math.max(0, Math.floor(num(s.wide)));
    this.luckyAt = num(s.luckyAt, this.nextLucky());
    this.figureT = num(s.figureT);
    this.stall = Math.floor(num(s.stall));
    this.stallStage = Math.floor(num(s.stallStage));
    this.board.restore(s.board);
    this.board.setGuttersClosed(this.wide > 0);
  }
}
