// The simulation: one engine for every mode. It knows nothing about the screen, the DOM or the
// save; it steps the world at a fixed 120 Hz and reports what happened through `events(type, data)`.
// That keeps it testable in Node (tests/wallbreaker.mjs) and lets the renderer, sound and haptics
// react to the same events.
//
//   const e = new Engine({ level, rules, mods, events });
//   e.setPaddle(x); e.tap(); e.fire(angle); e.step(1 / 120);
//
// Two ways to play share the engine:
//   paddle   Classic, Zen, Run, Daily, Time Attack: a paddle at the bottom keeps the ball in play
//   aim      Descent and Puzzle: aim and fire from a launcher; balls that come down are returned
import { CONFIG } from "./config.js";
import { sweepRect, circleRect } from "./collide.js";
import { BREAKABLE, dropFor, pityDrop } from "./levels.js";
import { rng, hash32 } from "./rng.js";

const WD = CONFIG.world, P = CONFIG.physics, BK = CONFIG.bricks;
const DEG = Math.PI / 180;
export const DT = 1 / P.hz;

export class Engine {
  /**
   * @param {object} o
   * @param {object} o.level   level JSON (levels.js)
   * @param {object} o.rules   mode rules (modes.js)
   * @param {object} [o.mods]  modifiers from Workshop, boosts and Run perks (modes.js buildMods)
   * @param {function} [o.events]
   * @param {number} [o.lives]
   * @param {boolean} [o.autoLaunch]
   */
  constructor({ level, rules, mods = {}, events = () => {}, lives, autoLaunch = false, puzzle = null }) {
    this.level = level;
    this.rules = rules;
    this.mods = mods;
    this.ev = events;
    this.n = level.number || 1;
    this.autoLaunch = autoLaunch;
    this.rand = rng(hash32(level.seed >>> 0, "play")); // Wild Ball wobble and serve offsets
    this.t = 0;              // simulated time
    this.playTime = 0;       // time with balls in flight: the clock for the speed star and Time Attack
    this.penalty = 0;        // Time Attack: seconds added for lost balls
    this.state = rules.play === "aim" ? "aim" : "serve";
    this.stateT = 0;
    this.lives = lives != null ? lives : rules.lives;
    this.ballsLost = 0;
    this.bricksBroken = 0;
    this.brickCredits = 0;
    this.maxMult = 1;        // highest risky multiplier a brick was broken under (for the result screen)
    this.score = 0;
    this.combo = 0;
    this.sinceDrop = 0;      // breaks since the last capsule (the pity rule)
    this.firstBreak = false; // boosts are consumed when this turns true
    this.lastBreakT = 0;
    this.fx = new Map();     // good timed effects: id → { left, total, catches? }
    this.risky = new Map();  // risky effects: id → { left, total }
    this.net = 0;
    this.bomb = false;
    this.balls = [];
    this.capsules = [];
    this.lasers = [];
    this.lastLaser = -1;
    this.pending = [];       // queued explosions (chain reactions)
    this.zaps = [];
    this.result = null;      // { cleared: bool, reason }
    this.timeScale = 1;
    this.serves = 0;
    this.saves = mods.descentSaves || 0;

    // Bricks in world units.
    const cellH = level.cellH || WD.cellH;
    this.cellH = cellH;
    this.groups = new Map();
    for (const g of level.groups || []) this.groups.set(g.id, { ...g, dx: 0, v: g.speed || 0, min: 0, max: 0 });
    this.bricks = level.bricks.map((b) => {
      const x = WD.left + b.c * WD.cellW, y = WD.gridTop + b.r * cellH;
      return {
        id: b.id, t: b.t, hp: b.hp, maxHp: b.hp, c: b.c, r: b.r,
        bx: x, x, y, w: b.w * WD.cellW, h: b.h * cellH,
        g: b.g ? this.groups.get(b.g) : null, pair: b.pair || 0,
        alive: true, lastHit: -9, regenT: 0, flash: 0,
      };
    });
    for (const g of this.groups.values()) {
      const mine = this.bricks.filter((b) => b.g === g);
      const minX = Math.min(...mine.map((b) => b.bx)), maxX = Math.max(...mine.map((b) => b.bx + b.w));
      g.min = WD.left - minX; g.max = WD.right - maxX;
    }
    for (const b of this.bricks) if (b.t === "portal") b.partner = this.bricks.find((q) => q.t === "portal" && q.pair === b.pair && q !== b);
    this.breakableLeft = this.bricks.filter((b) => BREAKABLE.has(b.t)).length;
    this.breakableTotal = this.breakableLeft;
    const core = this.bricks.find((b) => b.t === "core");
    this.par = CONFIG.stars.parBase + CONFIG.stars.parPerBrick * this.breakableTotal + (core ? CONFIG.stars.parPerCoreHp * core.hp : 0);

    this.dropCtx = {
      level: this.n,
      goodMul: mods.goodMul || 1,
      risky: !!rules.risky,
      table: rules.drops === "descent" ? "descent" : "good",
    };

    // Paddle.
    this.paddle = { x: (WD.left + WD.right) / 2, y: WD.paddleY, w: P.paddleWidth, h: P.paddleHeight };
    // Aim modes.
    this.launcher = { x: puzzle && puzzle.launchX != null ? puzzle.launchX : (WD.left + WD.right) / 2, y: WD.launchY };
    this.nextLaunchX = null;
    this.volley = rules.descent ? 1 + (mods.startBalls > 1 ? mods.startBalls - 1 : 0) : (puzzle ? puzzle.balls || 1 : 1);
    this.shots = 0;
    this.shotLimit = puzzle ? puzzle.shots : Infinity;
    this.toLaunch = 0;
    this.launchT = 0;
    this.launchDir = null;
    this.volleyT = 0;
    this.closestRows = Infinity;

    // Head start from boosts and Run perks.
    if (mods.startNet) this.net = 1;
    if (mods.startBomb) this.bomb = true;
    if (mods.startWide) this.fx.set("wide", { left: mods.startWide, total: mods.startWide });
    if (mods.startFire) this.fx.set("fire", { left: mods.startFire, total: mods.startFire });
    if (mods.startLaser) this.fx.set("laser", { left: mods.startLaser, total: mods.startLaser });
    if (mods.startMagnet) this.fx.set("magnet", { left: mods.startMagnet, total: mods.startMagnet });
    if (mods.startSticky) this.fx.set("sticky", { left: Infinity, total: Infinity, catches: mods.startSticky });
    this.updatePaddleWidth();
    if (rules.play === "paddle") this.serve();
    else if (rules.descent) this.trackClosest();
  }

  // ---- Queries -----------------------------------------------------------------------------------
  get over() { return this.state === "cleared" || this.state === "failed"; }
  has(id) { return this.fx.has(id); }
  hasRisky(id) { return this.risky.has(id); }
  /** Brick-credit multiplier from active risky capsules: bonuses add, capped. */
  multiplier() {
    let m = 1;
    for (const id of this.risky.keys()) m += CONFIG.risky[id].bonus;
    return Math.min(CONFIG.multiplierCap, m);
  }
  levelSpeed() {
    if (this.rules.play === "aim") return P.descentSpeed;
    const s = Math.min(P.speedCap, P.baseSpeed * (1 + P.speedPerLevel * (this.n - 1)));
    return s * (this.mods.speedMul || 1);
  }
  ballSpeed() {
    let s = this.levelSpeed();
    if (this.has("slow")) s *= CONFIG.capsules.slow.speed;
    if (this.hasRisky("surge")) s *= CONFIG.risky.surge.speed;
    return s;
  }
  ballRadius() { return this.has("big") ? CONFIG.capsules.big.radius : P.ballRadius; }
  paddles() {
    const p = this.paddle;
    if (!this.has("twin")) return [p];
    return [p, { x: WD.left + WD.right - p.x, y: p.y, w: p.w, h: p.h, twin: true }];
  }
  updatePaddleWidth() {
    let w = P.paddleWidth * (this.mods.paddleMul || 1);
    if (this.has("wide")) w *= CONFIG.capsules.wide.width;
    if (this.hasRisky("tiny")) w *= CONFIG.risky.tiny.width;
    this.paddle.w = Math.min(w, (WD.right - WD.left) * 0.6);
    this.setPaddle(this.paddle.x);
  }

  // ---- Input -------------------------------------------------------------------------------------
  /** Move the paddle's centre to x (clamped to the walls). Stuck balls ride along. */
  setPaddle(x) {
    const p = this.paddle, half = p.w / 2;
    const nx = Math.max(WD.left + half, Math.min(WD.right - half, x));
    const dx = nx - p.x;
    p.x = nx;
    if (dx) for (const b of this.balls) if (b.stuck) b.x += dx;
  }
  /** Tap: launch a served or stuck ball, otherwise fire the laser. */
  tap() {
    if (this.over) return;
    const stuck = this.balls.filter((b) => b.stuck);
    if (stuck.length) { for (const b of stuck) this.release(b); return; }
    if (this.has("laser") && this.t - this.lastLaser >= 1 / P.laserPerSecond - 1e-9) {
      this.lastLaser = this.t;
      const p = this.paddle;
      for (const q of this.paddles()) {
        this.lasers.push({ x: q.x - q.w / 2 + 5, y: p.y - 2 }, { x: q.x + q.w / 2 - 5, y: p.y - 2 });
      }
      this.ev("laser");
    }
  }
  /** Aim modes: fire a volley in the direction `angle` (radians from straight up, + is right). */
  fire(angle) {
    if (this.state !== "aim") return false;
    const lim = 80 * DEG;
    const a = Math.max(-lim, Math.min(lim, angle));
    this.launchDir = { x: Math.sin(a), y: -Math.cos(a) };
    this.toLaunch = this.volley;
    this.launchT = 0;
    this.volleyT = 0;
    this.nextLaunchX = null;
    this.state = "volley";
    this.ev("fire", { angle: a });
    return true;
  }

  // ---- Serving and launching ---------------------------------------------------------------------
  serve() {
    const off = (this.serves++ % 2 ? -1 : 1) * (6 + this.rand.int(6));
    const r = this.ballRadius();
    this.balls = [{ x: this.paddle.x + off, y: this.paddle.y - r - 0.5, vx: 0, vy: 0, r, stuck: true, off, stall: 0, portalCd: 0, age: 0, trail: [] }];
    this.state = "serve";
    this.stateT = 0;
  }
  release(b) {
    const p = this.paddle;
    b.stuck = false;
    this.bounceFromPaddle(b, p, false);
    if (this.state === "serve") {
      this.state = "play";
      if (this.mods.startBalls > 1 && !this.startSplit) { this.startSplit = true; this.split(1); }
    }
    this.ev("launch");
  }
  bounceFromPaddle(b, p, sound = true) {
    const span = p.w / 2 + b.r * 0.5;
    const off = Math.max(-1, Math.min(1, (b.x - p.x) / span));
    const a = off * P.maxBounceDeg * DEG;
    const s = this.ballSpeed();
    b.vx = s * Math.sin(a);
    b.vy = -s * Math.cos(a);
    b.y = Math.min(b.y, p.y - b.r - 0.01);
    b.stall = 0;
    b.portals = 0;
    b.idle = 0;
    this.combo = 0;
    if (sound) this.ev("paddle", { offset: off, x: b.x });
  }

  // ---- Stepping ----------------------------------------------------------------------------------
  /** Advance the world by dt real seconds (normally 1/120). */
  step(dt = DT) {
    if (this.over) return;
    this.timeScale = this.computeTimeScale();
    const sdt = dt * this.timeScale;
    this.t += sdt;
    this.stateT += sdt;
    const flying = this.state === "play" || this.state === "volley";
    if (flying) this.playTime += sdt;

    this.moveGroups(sdt);
    if (flying) this.tickEffects(sdt);
    this.tickBricks(sdt);

    if (this.state === "serve" && this.autoLaunch && this.stateT >= P.autoLaunch) this.tap();
    if (this.state === "lost" && this.stateT >= P.lostPause) this.serve();
    if (this.state === "volley") this.launchVolley(sdt);

    const r = this.ballRadius();
    for (const b of this.balls.slice()) {
      if (!this.balls.includes(b)) continue; // gone this step (a serve after a lost ball)
      if (b.r !== r) b.r = r;
      if (b.stuck) { b.y = this.paddle.y - b.r - 0.5; continue; }
      b.age += sdt;
      if (b.portalCd > 0) b.portalCd -= sdt;
      this.steer(b, sdt);
      this.moveBall(b, sdt);
      if (!this.balls.includes(b)) continue;
      this.checkStall(b, sdt);
      this.checkOut(b);
      if (this.over) return;
    }
    this.moveCapsules(sdt);
    this.moveLasers(sdt);
    this.runExplosions();
    if (this.state === "volley" && this.toLaunch === 0 && this.balls.length === 0 && !this.pending.length) this.endVolley();
    this.checkClear();
  }

  computeTimeScale() {
    if (this.state === "volley" && this.volleyT > P.descentFastAfter) return 2;
    if (this.rules.play !== "paddle" || this.state !== "play" || this.net > 0) return 1;
    const live = this.balls.filter((b) => !b.stuck);
    if (live.length === 1 && live[0].vy > 0 && live[0].y > this.paddle.y + P.slowMoBelow) return P.slowMoScale;
    return 1;
  }

  moveGroups(dt) {
    for (const g of this.groups.values()) {
      if (g.motion === "bounce") {
        g.dx += g.v * dt;
        if (g.dx < g.min) { g.dx = g.min; g.v = Math.abs(g.v); }
        if (g.dx > g.max) { g.dx = g.max; g.v = -Math.abs(g.v); }
      } else if (g.motion === "sweep") {
        const u = this.t / g.period + (g.phase || 0);
        g.dx = Math.max(g.min, Math.min(g.max, (g.range * WD.cellW * (1 - Math.cos(2 * Math.PI * u))) / 2));
      }
    }
    for (const b of this.bricks) if (b.g) b.x = b.bx + b.g.dx;
  }

  tickEffects(dt) {
    for (const [id, f] of this.fx) {
      f.left -= dt;
      if (f.left <= 0) {
        this.fx.delete(id);
        if (id === "sticky") for (const b of this.balls) if (b.stuck) this.release(b);
        if (id === "wide") this.updatePaddleWidth();
        this.ev("expire", { id });
      }
    }
    for (const [id, f] of this.risky) {
      f.left -= dt;
      if (f.left <= 0) {
        this.risky.delete(id);
        if (id === "tiny") this.updatePaddleWidth();
        this.ev("expire", { id, risky: true });
      }
    }
  }

  tickBricks(dt) {
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (b.flash > 0) b.flash -= dt;
      if (b.t === "regen" && b.hp < b.maxHp) {
        b.regenT += dt;
        if (b.regenT >= BK.regenSeconds) { b.regenT = 0; b.hp = Math.min(b.maxHp, Math.floor(b.hp) + 1); this.ev("regen", { brick: b }); }
      }
    }
  }

  steer(b, dt) {
    let target = null, rate = 0;
    if (this.has("magnet") && b.vy > 0 && this.rules.play === "paddle") { target = [this.paddle.x, this.paddle.y]; rate = P.steerMagnet; }
    else if (this.has("gravity") && b.vy < 0) { target = this.cluster(); rate = P.steerGravity; }
    else if (b.vy < 0 && this.rules.play === "paddle" && this.breakableLeft <= P.huntBricks && this.t - this.lastBreakT > P.huntAfter) {
      // The last-brick hunt: when a few bricks have been left alone for a while, the ball leans toward them.
      target = this.nearestBrick(b); rate = P.steerHunt;
    }
    if (!target) return;
    const want = Math.atan2(target[1] - b.y, target[0] - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    let d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const turn = Math.max(-rate * dt, Math.min(rate * dt, d));
    const s = Math.hypot(b.vx, b.vy);
    const a = cur + turn;
    b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
  }
  nearestBrick(b) {
    let best = null, bd = Infinity;
    for (const q of this.bricks) {
      if (!q.alive || !BREAKABLE.has(q.t)) continue;
      const d = (q.x + q.w / 2 - b.x) ** 2 + (q.y + q.h / 2 - b.y) ** 2;
      if (d < bd) { bd = d; best = [q.x + q.w / 2, q.y + q.h / 2]; }
    }
    return best;
  }
  /** Centre of the densest cluster of breakable bricks (Gravity Pull), refreshed twice a second. */
  cluster() {
    if (this.clusterAt != null && this.t - this.clusterAt < 0.5) return this.clusterPos;
    this.clusterAt = this.t;
    let best = null, bestN = -1;
    const live = this.bricks.filter((b) => b.alive && BREAKABLE.has(b.t));
    for (const b of live) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      let n = 0, sx = 0, sy = 0;
      for (const q of live) {
        const qx = q.x + q.w / 2, qy = q.y + q.h / 2;
        if (Math.abs(qx - cx) <= 2.5 * WD.cellW && Math.abs(qy - cy) <= 2.5 * this.cellH) { n++; sx += qx; sy += qy; }
      }
      if (n > bestN) { bestN = n; best = [sx / n, sy / n]; }
    }
    this.clusterPos = best;
    return best;
  }

  moveBall(b, dt) {
    let rem = 1;
    const fire = this.has("fire");
    for (let iter = 0; iter < 8 && rem > 1e-6; iter++) {
      const dx = b.vx * dt * rem, dy = b.vy * dt * rem;
      const hit = this.firstHit(b, dx, dy, fire);
      if (!hit) { b.x += dx; b.y += dy; break; }
      b.x += dx * hit.t + hit.nx * 0.01;
      b.y += dy * hit.t + hit.ny * 0.01;
      rem *= 1 - hit.t;
      this.resolve(b, hit, fire);
      if (b.stuck || !this.balls.includes(b) || this.over) break;
    }
    // Plus-ball pickups (Descent) are collected by touching them.
    if (this.rules.descent) {
      for (const q of this.bricks) {
        if (q.alive && q.t === "plus" && circleRect(b.x, b.y, b.r, q.x + 6, q.y + 4, q.x + q.w - 6, q.y + q.h - 4)) {
          q.alive = false;
          this.volley = Math.min(30, this.volley + 1);
          this.ev("plus", { brick: q, volley: this.volley });
        }
      }
    }
  }

  /** The earliest thing the ball touches on its path (dx, dy) this step. */
  firstHit(b, dx, dy, fire) {
    let best = null;
    const r = b.r;
    const take = (h, kind, obj) => { if (h && (!best || h.t < best.t)) best = { ...h, kind, obj }; };
    // Walls: left, right, top.
    if (dx < 0 && b.x + dx < WD.left + r) take(lineHit(b.x, dx, WD.left + r, 1), "wall");
    if (dx > 0 && b.x + dx > WD.right - r) take(lineHit(b.x, dx, WD.right - r, -1), "wall");
    if (dy < 0 && b.y + dy < WD.top + r) { const h = lineHit(b.y, dy, WD.top + r, 1); if (h) take({ t: h.t, nx: 0, ny: 1 }, "wall"); }
    // Bricks (with a cheap box test first).
    const minX = Math.min(b.x, b.x + dx) - r - 1, maxX = Math.max(b.x, b.x + dx) + r + 1;
    const minY = Math.min(b.y, b.y + dy) - r - 1, maxY = Math.max(b.y, b.y + dy) + r + 1;
    for (const q of this.bricks) {
      if (!q.alive || q.t === "plus") continue;
      if (q.x > maxX || q.x + q.w < minX || q.y > maxY || q.y + q.h < minY) continue;
      if (q.t === "portal") {
        if (b.portalCd > 0 || b.portals >= 2) continue; // two portal trips per paddle hit: no endless loops
        const h = sweepRect(b.x, b.y, dx, dy, r * 0.4, q.x, q.y, q.x + q.w, q.y + q.h);
        take(h, "portal", q);
        continue;
      }
      take(sweepRect(b.x, b.y, dx, dy, r, q.x, q.y, q.x + q.w, q.y + q.h), "brick", q);
    }
    if (this.rules.play === "paddle" && dy > 0) {
      for (const p of this.paddles()) {
        const g = P.edgeGrace;
        const h = sweepRect(b.x, b.y, dx, dy, r, p.x - p.w / 2 - g, p.y, p.x + p.w / 2 + g, p.y + p.h);
        // A clip of the paddle's edge or side still counts as a hit, as long as the ball is above its bottom.
        if (h && b.y + dy * h.t < p.y + p.h) take({ t: h.t, nx: 0, ny: -1 }, "paddle", p);
      }
      if (this.net > 0 && b.y + dy > WD.netY - r) {
        const h = lineHit(b.y, dy, WD.netY - r, -1);
        if (h) take({ t: h.t, nx: 0, ny: -1 }, "net");
      }
    }
    return best;
  }

  resolve(b, hit, fire) {
    if (hit.kind === "wall") { reflect(b, hit); this.ev("wall", { x: b.x, y: b.y }); return; }
    if (hit.kind === "paddle") {
      if (this.has("sticky")) {
        const f = this.fx.get("sticky");
        b.stuck = true;
        b.vx = 0; b.vy = 0;
        b.y = this.paddle.y - b.r - 0.5;
        if (hit.obj.twin) b.x = this.paddle.x - (b.x - hit.obj.x); // a catch on the twin sticks to the real paddle, mirrored
        b.x = Math.max(this.paddle.x - this.paddle.w / 2, Math.min(this.paddle.x + this.paddle.w / 2, b.x));
        this.combo = 0;
        this.ev("paddle", { offset: 0, x: b.x, sticky: true });
        if (f.catches != null && --f.catches <= 0) this.fx.delete("sticky");
        return;
      }
      this.bounceFromPaddle(b, hit.obj);
      return;
    }
    if (hit.kind === "net") {
      b.vy = -Math.abs(b.vy);
      this.net = 0;
      this.ev("net", { x: b.x });
      return;
    }
    const q = hit.obj;
    if (hit.kind === "portal") {
      const to = q.partner;
      if (!to || !to.alive) return;
      b.x = to.x + to.w / 2;
      b.y = to.y + to.h / 2;
      b.portalCd = 0.3;
      b.portals = (b.portals || 0) + 1;
      this.ev("portal", { from: q, to });
      return;
    }
    // A brick.
    const pierce = fire && q.t !== "steel" && q.t !== "core" && BREAKABLE.has(q.t);
    if (!pierce) {
      reflect(b, hit);
      if (this.hasRisky("wild")) {
        const a = (this.rand.float() * 2 - 1) * CONFIG.risky.wild.degrees * DEG;
        const c = Math.cos(a), s = Math.sin(a);
        const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
        b.vx = vx; b.vy = vy;
      }
    }
    if (q.t === "steel") { q.flash = 0.15; this.ev("steel", { brick: q }); return; }
    let dmg = pierce ? q.hp : 1;
    if (q.t === "core" && hit.ny > 0.5 && Math.abs(b.x - (q.x + q.w / 2)) < q.w / 4) {
      dmg *= BK.weakMultiplier;
      this.ev("weak", { brick: q });
    }
    if (this.bomb && BREAKABLE.has(q.t)) {
      this.bomb = false;
      this.explode(q, "bomb");
    }
    this.damage(q, dmg, b);
    if (this.has("lightning")) this.lightning(q);
  }

  damage(q, amount, src) {
    if (!q.alive || !BREAKABLE.has(q.t)) return;
    if (this.hasRisky("armor") && amount < 50) amount *= CONFIG.risky.armor.damage;
    q.hp -= amount;
    q.lastHit = this.t;
    q.regenT = 0;
    q.flash = 0.12;
    if (q.hp <= 1e-6) this.breakBrick(q);
    else this.ev("hit", { brick: q, combo: this.combo });
  }

  breakBrick(q) {
    q.alive = false;
    q.hp = 0;
    this.breakableLeft--;
    this.bricksBroken++;
    this.lastBreakT = this.t;
    this.combo++;
    const mult = this.multiplier();
    if (mult > this.maxMult) this.maxMult = mult;
    const value = CONFIG.credits.brick[q.t] || 0;
    this.brickCredits += value * mult;
    const pts = Math.round(10 * (1 + Math.min(20, this.combo - 1) * 0.1) * (this.has("score2") ? CONFIG.capsules.score2.factor : 1));
    this.score += pts;
    if (!this.firstBreak) { this.firstBreak = true; this.ev("firstBreak"); }
    this.ev("break", { brick: q, combo: this.combo, credits: value * mult, points: pts });
    if (q.t === "explosive") this.pending.push({ q, at: this.t + BK.explosionDelay });
    this.dropFrom(q);
  }

  dropFrom(q) {
    if (this.rules.drops === "none") return;
    let d = dropFor(this.level, q, this.dropCtx);
    if (d) this.sinceDrop = 0;
    else if (q.t !== "core" && this.n >= CONFIG.intro.goodDrops) {
      this.sinceDrop++;
      if (this.sinceDrop > CONFIG.drops.pity) { d = pityDrop(this.level, q, this.dropCtx); this.sinceDrop = 0; this.ev("pity"); }
    }
    if (!d) return;
    const x = q.x + q.w / 2, y = q.y + q.h / 2;
    if (this.rules.play === "aim") { this.apply(d.id, false); this.ev("collect", { id: d.id, x, y }); return; }
    this.capsules.push({ id: d.id, risky: d.risky, x, y, born: this.t });
    this.ev("drop", { id: d.id, risky: d.risky });
  }

  explode(q, why) {
    const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
    const rx = q.w / 2 + WD.cellW * 0.75, ry = q.h / 2 + this.cellH * 0.75;
    this.ev("explode", { x: cx, y: cy, why });
    for (const o of this.bricks) {
      if (o === q || !o.alive || !BREAKABLE.has(o.t)) continue;
      const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
      if (Math.abs(ox - cx) <= rx + o.w / 2 - 1 && Math.abs(oy - cy) <= ry + o.h / 2 - 1) {
        this.damage(o, o.t === "core" ? 3 : 999, null);
      }
    }
  }
  runExplosions() {
    if (!this.pending.length) return;
    const due = this.pending.filter((p) => p.at <= this.t);
    this.pending = this.pending.filter((p) => p.at > this.t);
    for (const p of due) this.explode(p.q, "chain");
  }

  lightning(from) {
    const cx = from.x + from.w / 2, cy = from.y + from.h / 2;
    const near = this.bricks
      .filter((o) => o !== from && o.alive && BREAKABLE.has(o.t))
      .map((o) => ({ o, d: (o.x + o.w / 2 - cx) ** 2 + (o.y + o.h / 2 - cy) ** 2 }))
      .sort((a, b) => a.d - b.d || a.o.id - b.o.id)
      .slice(0, CONFIG.capsules.lightning.chain);
    for (const { o } of near) {
      this.ev("zap", { x0: cx, y0: cy, x1: o.x + o.w / 2, y1: o.y + o.h / 2 });
      this.damage(o, 1, null);
    }
  }

  checkStall(b, dt) {
    const s = Math.hypot(b.vx, b.vy);
    if (!s) return;
    if (Math.abs(b.vy) < s * Math.sin(P.stallDeg * DEG)) {
      b.stall += dt;
      if (b.stall > P.stallSeconds) {
        const up = b.vy > 0 ? 1 : -1;
        const a = P.nudgeDeg * DEG;
        b.vx = Math.sign(b.vx || 1) * s * Math.cos(a);
        b.vy = up * s * Math.sin(a);
        b.stall = 0;
        this.ev("nudge", { ball: b });
      }
    } else b.stall = 0;
    // A ball caught in a loop between steel and walls (nothing broken, no paddle) gets a small wobble.
    b.idle = (b.idle || 0) + dt;
    if (b.idle > P.loopSeconds && this.t - this.lastBreakT > P.loopSeconds) {
      const a = (this.rand.float() < 0.5 ? -1 : 1) * (4 + this.rand.float() * 6) * DEG;
      const c = Math.cos(a), sn = Math.sin(a);
      const vx = b.vx * c - b.vy * sn, vy = b.vx * sn + b.vy * c;
      b.vx = vx; b.vy = vy;
      b.idle = 0;
      b.portals = 0;
      this.ev("nudge", { ball: b });
    }
    // Keep speed exact after steering and wobble.
    const want = this.ballSpeed();
    if (Math.abs(s - want) > 0.5) { b.vx *= want / s; b.vy *= want / s; }
  }

  checkOut(b) {
    if (this.rules.play === "aim") {
      if ((b.vy > 0 && b.y >= WD.launchY) || b.age > P.maxFlight) {
        this.balls.splice(this.balls.indexOf(b), 1);
        if (this.nextLaunchX == null && b.age <= P.maxFlight) this.nextLaunchX = Math.max(WD.left + 10, Math.min(WD.right - 10, b.x));
        this.ev("return");
      }
      return;
    }
    if (b.y - b.r <= WD.H) return;
    this.balls.splice(this.balls.indexOf(b), 1);
    this.ballsLost++;
    this.ev("lost", { x: b.x });
    if (this.hasRisky("allin")) return this.fail("allin");
    if (this.balls.length) return;
    if (this.rules.onLost === "return") { this.serve(); this.ev("returned"); return; }
    if (this.rules.onLost === "penalty") {
      this.penalty += CONFIG.timeAttack.lostBallPenalty;
      this.ev("penalty", { seconds: CONFIG.timeAttack.lostBallPenalty });
      this.serve();
      return;
    }
    this.lives--;
    this.capsules = [];
    this.ev("lifeLost", { lives: this.lives });
    if (this.lives <= 0) return this.fail("lives");
    this.state = "lost";
    this.stateT = 0;
  }

  moveCapsules(dt) {
    if (!this.capsules.length) return;
    const ps = this.paddles();
    const cw = P.capsuleW / 2, ch = P.capsuleH / 2;
    for (const c of this.capsules.slice()) {
      c.y += P.capsuleSpeed * dt;
      for (const p of ps) {
        if (c.x + cw > p.x - p.w / 2 && c.x - cw < p.x + p.w / 2 && c.y + ch > p.y && c.y - ch < p.y + p.h) {
          this.capsules.splice(this.capsules.indexOf(c), 1);
          this.apply(c.id, c.risky);
          this.ev("catch", { id: c.id, risky: c.risky, x: c.x, y: c.y });
          break;
        }
      }
      if (c.y - ch > WD.H && this.capsules.includes(c)) {
        this.capsules.splice(this.capsules.indexOf(c), 1);
        this.ev("miss", { id: c.id, risky: c.risky });
      }
    }
  }

  moveLasers(dt) {
    for (const l of this.lasers.slice()) {
      const dy = -P.laserSpeed * dt;
      let hitQ = null, hitT = 2;
      for (const q of this.bricks) {
        if (!q.alive || q.t === "portal" || q.t === "plus") continue;
        const h = sweepRect(l.x, l.y, 0, dy, 2, q.x, q.y, q.x + q.w, q.y + q.h);
        if (h && h.t < hitT) { hitT = h.t; hitQ = q; }
      }
      if (hitQ) {
        this.lasers.splice(this.lasers.indexOf(l), 1);
        if (hitQ.t === "steel") { hitQ.flash = 0.1; this.ev("steel", { brick: hitQ }); }
        else this.damage(hitQ, 1, null);
        continue;
      }
      l.y += dy;
      if (l.y < WD.top) this.lasers.splice(this.lasers.indexOf(l), 1);
    }
  }

  // ---- Capsules ----------------------------------------------------------------------------------
  /** Apply a capsule. Taking one you already have refreshes its timer; it never stacks. */
  apply(id, risky) {
    if (risky) {
      const R = CONFIG.risky[id];
      if (id === "allin") { this.risky.set("allin", { left: Infinity, total: Infinity }); this.net = 0; }
      else this.risky.set(id, { left: R.seconds, total: R.seconds });
      if (id === "tiny") this.updatePaddleWidth();
      return;
    }
    const Cp = CONFIG.capsules[id];
    const dur = Cp.seconds ? Cp.seconds * (this.mods.durationMul || 1) : null;
    switch (id) {
      case "multi2": case "multi3": this.split(Cp.split); return;
      case "net":
        if (this.hasRisky("allin")) { this.ev("blocked", { id }); return; }
        this.net = 1; return;
      case "bomb": this.bomb = true; return;
      case "life": if (Number.isFinite(this.lives)) this.lives++; return;
      case "sticky": this.fx.set("sticky", { left: dur, total: dur, catches: Cp.catches }); return;
      default:
        this.fx.set(id, { left: dur, total: dur });
        if (id === "wide") this.updatePaddleWidth();
    }
  }

  /** Every flying ball becomes 1 + `extra` balls, fanned out, up to the cap. */
  split(extra) {
    const out = [];
    for (const b of this.balls) {
      if (b.stuck) continue;
      for (let k = 1; k <= extra; k++) {
        if (this.balls.length + out.length >= P.maxBalls) break;
        const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * P.splitDeg * DEG;
        const c = Math.cos(a), s = Math.sin(a);
        out.push({ ...b, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stall: 0, trail: [] });
      }
    }
    this.balls.push(...out);
    if (out.length) this.ev("split", { n: out.length });
  }

  // ---- Aim modes ---------------------------------------------------------------------------------
  launchVolley(dt) {
    this.volleyT += dt;
    this.launchT -= dt;
    while (this.toLaunch > 0 && this.launchT <= 0) {
      const s = this.ballSpeed();
      const r = this.ballRadius();
      this.balls.push({ x: this.launcher.x, y: this.launcher.y - r, vx: this.launchDir.x * s, vy: this.launchDir.y * s, r, stuck: false, stall: 0, portalCd: 0, age: 0, trail: [] });
      this.toLaunch--;
      this.launchT += P.volleyGap;
    }
  }
  endVolley() {
    this.shots++;
    if (this.nextLaunchX != null && this.rules.descent) this.launcher.x = this.nextLaunchX;
    this.fx.delete("fire"); this.fx.delete("lightning"); // a volley's power-ups end with it
    if (this.rules.descent && this.shots % CONFIG.descent.shotsPerRow === 0 && this.breakableLeft > 0) this.dropRow();
    if (this.over) return;
    if (this.breakableLeft > 0 && this.shots >= this.shotLimit) return this.fail("shots");
    this.state = "aim";
    this.ev("ready", { shots: this.shots });
  }
  /** Descent: every brick moves down one row. Reaching the line ends the level. */
  dropRow() {
    const dy = CONFIG.descent.rowH;
    for (const q of this.bricks) { q.y += dy; q.r += 1; }
    this.ev("descend");
    const crossing = this.bricks.filter((q) => q.alive && BREAKABLE.has(q.t) && q.y + q.h > CONFIG.descent.failY);
    for (const q of this.bricks) if (q.alive && q.t === "plus" && q.y + q.h > CONFIG.descent.failY) q.alive = false;
    if (crossing.length) {
      if (this.saves > 0) {
        this.saves--;
        for (const q of crossing) { q.alive = false; this.breakableLeft--; }
        this.ev("saved");
      } else return this.fail("reached");
    }
    this.trackClosest();
  }
  trackClosest() {
    let low = -Infinity;
    for (const q of this.bricks) if (q.alive && BREAKABLE.has(q.t)) low = Math.max(low, q.y + q.h);
    if (low > -Infinity) this.closestRows = Math.min(this.closestRows, (CONFIG.descent.failY - low) / CONFIG.descent.rowH);
  }

  // ---- Ending ------------------------------------------------------------------------------------
  checkClear() {
    if (this.over || this.breakableLeft > 0 || this.pending.length) return;
    this.state = "cleared";
    this.result = { cleared: true };
    this.balls = this.balls.filter((b) => b.stuck);
    this.ev("cleared");
  }
  fail(reason) {
    if (this.over) return;
    this.state = "failed";
    this.result = { cleared: false, reason };
    this.ev("failed", { reason });
  }

  /** Stars for a cleared level: 1 for the clear, +1 no ball lost, +1 under the speed target. */
  stars() {
    if (!this.result || !this.result.cleared) return 0;
    if (this.rules.play === "aim") {
      if (!this.rules.descent) return 0; // Puzzle stars come from shots (modes.js)
      const parShots = Math.ceil(this.level.bricks.length ? CONFIG.descent.shotsPerRow * rowsOf(this.level) * 0.6 : 1);
      return 1 + (this.closestRows >= 3 ? 1 : 0) + (this.shots <= parShots ? 1 : 0);
    }
    return 1 + (this.ballsLost === 0 ? 1 : 0) + (this.playTime + this.penalty <= this.par ? 1 : 0);
  }
}

function rowsOf(lvl) {
  const rows = new Set(lvl.bricks.map((b) => b.r));
  return rows.size;
}

function lineHit(pos, d, wall, n) {
  const t = (wall - pos) / d;
  if (t < 0) return { t: 0, nx: n, ny: 0 };
  if (t > 1) return null;
  return { t, nx: n, ny: 0 };
}

function reflect(b, hit) {
  const d = b.vx * hit.nx + b.vy * hit.ny;
  if (d >= 0) return; // already moving away
  b.vx -= 2 * d * hit.nx;
  b.vy -= 2 * d * hit.ny;
}
