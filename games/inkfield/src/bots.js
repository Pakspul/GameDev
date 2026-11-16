// The computer players. Each bot thinks a few times a second (not every frame), and in between
// keeps the heading it chose. What it does:
//
//   plan    at home, pick a direction with room in it and draw a box-shaped loop out there:
//           out `reach` cells, across `width` cells, back towards home
//   return  head for its own land the moment it's in danger: an enemy could reach its trail
//           before it can get home (times `caution`), or the trail got too long
//   hunt    an enemy's trail is close, and the bot can get there before that enemy is home
//
// How it steers once it has a trail: it tries a handful of headings and plays each one forward
// for a moment with the real turning circle (a "rollout"). A heading that runs into its own trail
// is out. Going home, the rollouts are scored on a distance-to-home map (a breadth-first search
// from its land, around its trail), so it finds the way out of a curl instead of circling in it.
//
// Mistakes come from thinking only now and then, a little noise on the heading, and greed: how far
// out a bot dares to go, and how late it heads home.
import { CONFIG } from "./config.js";

const TAU = Math.PI * 2;
const angleTo = (p, t) => Math.atan2(t.y - p.y, t.x - p.x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const OFFSETS = [0, 0.3, -0.3, 0.65, -0.65, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, 2.8, -2.8];
const FIELD_R = 50;          // the distance-to-home map covers this many cells around the head
const FAR = 0xffff;

export class Bot {
  /** @param {object} skill one of CONFIG.difficulty; the personality varies per bot */
  constructor(world, id, skill, rng) {
    this.w = world;
    this.p = world.players[id];
    this.rng = rng;
    // Personality: some bots are greedy, some careful, some like a fight.
    const greed = rng.range(0.75, 1.3);
    this.reach = skill.reach.map((v) => v * greed);
    this.width = skill.width.map((v) => v * greed);
    this.caution = (skill.caution * rng.range(0.9, 1.15)) / Math.sqrt(greed);
    this.huntR = 10 * skill.hunt * rng.range(0.6, 1.4);
    this.noise = skill.noise;
    this.period = skill.think;
    this.next = rng.range(0, this.period); // so bots don't all think on the same frame
    this.mode = "plan";
    this.waypoints = [];
    this.goal = null;
    this.hadTrail = false;
    this.heading = this.p.angle;
    this.field = null;
  }

  update(dt) {
    if (!this.p.alive) return;
    this.next -= dt;
    if (this.next <= 0) { this.next += this.period; this.think(); }
    this.p.target = this.heading;
  }

  think() {
    const { p, w } = this;
    const hasTrail = p.trailCells.length > 0;
    // Just closed a loop (or never left): make a new plan.
    if (!hasTrail && (this.hadTrail || this.mode !== "plan" || !this.waypoints.length)) this.makePlan();
    this.hadTrail = hasTrail;

    if (hasTrail) {
      // The quick estimate (straight line) while all is well; the full map once we're going home.
      this.field = this.mode === "return" ? this.homeField() : null;
      let dHome = this.field ? this.fieldAt(p.x, p.y) : FAR;
      if (dHome >= FAR) dHome = this.nearestHome().d * 1.3;
      const tHome = dHome / w.C.speed + 0.25;
      const tooLong = p.trailCells.length > (this.reach[1] * 2 + this.width[1]) * 1.6;
      if (this.mode !== "return" && (this.threat() < tHome * this.caution + 0.35 || tooLong)) this.mode = "return";
    }
    if (this.mode !== "return") this.considerHunt(hasTrail);

    if (this.mode === "plan") {
      while (this.waypoints.length && dist(p, this.waypoints[0]) < 1.6) this.waypoints.shift();
      if (this.waypoints.length) this.goal = this.waypoints[0];
      else if (hasTrail) this.mode = "return";
      else this.makePlan();
    }
    if (this.mode === "hunt" && (!this.goal || dist(p, this.goal) < 0.8)) this.mode = hasTrail ? "return" : "plan";

    if (this.mode === "return") {
      if (!this.field) this.field = this.homeField();
      this.heading = this.bestHomeward();
      return;
    }
    if (!this.goal) return;
    const want = angleTo(p, this.goal) + (this.rng.float() - 0.5) * this.noise;
    this.heading = hasTrail ? this.safeHeading(want) : want;
  }

  // ---- Planning ---------------------------------------------------------------------------------------------
  makePlan() {
    const { p, w, rng } = this;
    const N = w.N, m = 3;
    let best = null, bestScore = -Infinity;
    for (let k = 0; k < 10; k++) {
      const a = rng.range(-Math.PI, Math.PI);
      const exit = this.exitAlong(a);
      if (!exit) continue;
      const reach = rng.range(this.reach[0], this.reach[1]);
      const width = rng.range(this.width[0], this.width[1]);
      const side = rng.chance(0.5) ? 1 : -1;
      const ux = Math.cos(a), uy = Math.sin(a), vx = -uy * side, vy = ux * side;
      const P1 = { x: exit.x + ux * reach, y: exit.y + uy * reach };
      const P2 = { x: P1.x + vx * width, y: P1.y + vy * width };
      const P3 = { x: P2.x - ux * (reach + 1.5), y: P2.y - uy * (reach + 1.5) };
      const pts = [P1, P2, P3];
      // Room on the board, and preferably over land that isn't ours yet.
      let score = rng.range(0, 1.5) - exit.d * 0.08;
      for (const q of pts) {
        if (q.x < m || q.y < m || q.x > N - m || q.y > N - m) score -= 6;
        const o = w.owner[w.idx(clampi(q.x, N), clampi(q.y, N))];
        if (o === p.id) score -= 2; else if (o) score += 0.6;
      }
      if (score > bestScore) { bestScore = score; best = [exit, ...pts.map((q) => clampPt(q, N, m))]; }
    }
    this.waypoints = best || [];
    this.mode = "plan";
    this.goal = this.waypoints[0] || null;
  }

  /** Walk from the head along angle a until leaving our land: the exit point. */
  exitAlong(a) {
    const { p, w } = this;
    const ux = Math.cos(a), uy = Math.sin(a), N = w.N;
    for (let d = 0; d < 90; d += 0.7) {
      const x = p.x + ux * d, y = p.y + uy * d;
      if (x < 1 || y < 1 || x > N - 1 || y > N - 1) return null;
      if (w.owner[w.idx(x | 0, y | 0)] !== p.id) return { x, y, d };
    }
    return null;
  }

  // ---- Danger -----------------------------------------------------------------------------------------------
  /** Seconds until the quickest enemy could reach any part of our trail (or our head). */
  threat() {
    const { p, w } = this;
    const path = p.path;
    let best = Infinity;
    for (const q of w.players) {
      if (!q || !q.alive || q === p) continue;
      let dmin = dist(q, p);
      for (let k = 0; k < path.length; k += 3) {
        const dx = q.x - path[k].x, dy = q.y - path[k].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < dmin) dmin = d;
      }
      if (dmin < best) best = dmin;
    }
    return best / w.C.speed;
  }

  /** Go for an enemy trail that's close, if we can get there before its owner is home. */
  considerHunt(hasTrail) {
    const { p, w } = this;
    if (this.huntR <= 0 || (hasTrail && p.trailCells.length > 12)) return;
    let best = null, bestD = this.huntR;
    for (const q of w.players) {
      if (!q || !q.alive || q === p || q.path.length < 4) continue;
      const qHome = q.trailStart ? dist(q, q.trailStart) : 0;
      for (let k = 0; k < q.path.length - 3; k += 2) {
        const pt = q.path[k];
        const d = dist(p, pt);
        if (d < bestD && d < qHome + 2) { bestD = d; best = pt; }
      }
    }
    if (best) { this.mode = "hunt"; this.goal = { x: best.x, y: best.y }; }
  }

  // ---- The way home -----------------------------------------------------------------------------------------
  /** Distance (in steps) from every cell near the head to our land, going around our trail.
   *  A breadth-first search from all of our land in a window around the head at once. */
  homeField() {
    const { p, w } = this;
    const N = w.N, R = FIELD_R, S = 2 * R + 1;
    const F = scratch(S);
    const ox = Math.floor(p.x) - R, oy = Math.floor(p.y) - R;
    F.dist.fill(FAR);
    let tail = 0;
    for (let y = 0; y < S; y++) {
      const gy = oy + y;
      if (gy < 0 || gy >= N) continue;
      for (let x = 0; x < S; x++) {
        const gx = ox + x;
        if (gx < 0 || gx >= N) continue;
        if (w.owner[gx + gy * N] === p.id) { F.dist[x + y * S] = 0; F.queue[tail++] = x + y * S; }
      }
    }
    if (!tail) return null;
    const lethal = p.seq - w.C.selfGrace;
    let head = 0;
    while (head < tail) {
      const i = F.queue[head++];
      const x = i % S, y = (i / S) | 0, d = F.dist[i] + 1;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const j = nx + ny * S;
        if (F.dist[j] <= d) continue;
        const gx = ox + nx, gy = oy + ny;
        if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
        const g = gx + gy * N;
        if (w.trail[g] === p.id && w.trailSeq[g] < lethal) continue;
        F.dist[j] = d; F.queue[tail++] = j;
      }
    }
    return { ox, oy, S, dist: F.dist };
  }

  fieldAt(x, y) {
    const f = this.field;
    const fx = Math.floor(x) - f.ox, fy = Math.floor(y) - f.oy;
    if (fx < 0 || fy < 0 || fx >= f.S || fy >= f.S) return FAR;
    return f.dist[fx + fy * f.S];
  }

  /** Play a fixed target heading forward for `T` seconds with the real turning circle. */
  rollout(target, T) {
    const { p, w } = this;
    const C = w.C, N = w.N, dt = 1 / 30;
    const maxTurn = C.turnRate * dt, step = C.speed * dt;
    const lethal = p.seq - C.selfGrace;
    let x = p.x, y = p.y, a = p.angle;
    for (let t = dt; t <= T + 1e-6; t += dt) {
      let d = target - a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a += Math.max(-maxTurn, Math.min(maxTurn, d));
      x = Math.max(0.5, Math.min(N - 0.5, x + Math.cos(a) * step));
      y = Math.max(0.5, Math.min(N - 0.5, y + Math.sin(a) * step));
      const i = (x | 0) + (y | 0) * N;
      if (w.trail[i] === p.id && w.trailSeq[i] < lethal) return { dead: true, t, x, y };
      if (w.owner[i] === p.id) return { home: true, t, x, y };
    }
    return { x, y, t: T };
  }

  /** The heading that gets us home soonest without touching our trail. */
  bestHomeward() {
    const p = this.p;
    const fallback = this.field ? null : (p.trailStart || this.nearestHome());
    let best = p.angle, bestScore = -Infinity;
    for (const o of OFFSETS) {
      const a = p.angle + o;
      const r = this.rollout(a, 0.9);
      let score;
      if (r.dead) score = -1e6 + r.t;
      else if (r.home) score = 1e6 - r.t;
      else if (fallback) score = -dist(r, fallback);
      else { const d = this.fieldAt(r.x, r.y); score = d >= FAR ? -5e5 : -d; }
      score -= Math.abs(o) * 0.05; // all else equal, don't swerve
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  /** The heading closest to `want` whose rollout doesn't run into our own trail. */
  safeHeading(want) {
    let fallback = want, fallbackT = -1;
    for (const o of OFFSETS) {
      const r = this.rollout(want + o, 0.8);
      if (!r.dead) return want + o;
      if (r.t > fallbackT) { fallbackT = r.t; fallback = want + o; }
    }
    return fallback;
  }

  /** The nearest cell of our own land, by a search in growing rings (where we left as a fallback). */
  nearestHome() {
    const { p, w } = this;
    const N = w.N;
    const fallback = p.trailStart ? { x: p.trailStart.x, y: p.trailStart.y, d: dist(p, p.trailStart) } : null;
    const maxR = fallback ? Math.min(fallback.d, 60) : 60;
    for (let r = 1; r <= maxR; r++) {
      const n = Math.max(8, Math.ceil(TAU * r));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        if (w.owner[w.idx(x | 0, y | 0)] === p.id) return { x: (x | 0) + 0.5, y: (y | 0) + 0.5, d: r };
      }
    }
    return fallback || { x: p.x, y: p.y, d: 0 };
  }
}

const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
let SCR = null;
/** Search buffers shared by every bot (they think one at a time). */
function scratch(S) {
  if (!SCR || SCR.S !== S) SCR = { S, dist: new Uint16Array(S * S), queue: new Int32Array(S * S) };
  return SCR;
}

function clampi(v, N) { return Math.max(0, Math.min(N - 1, v | 0)); }
function clampPt(q, N, m) { return { x: Math.max(m, Math.min(N - m, q.x)), y: Math.max(m, Math.min(N - m, q.y)) }; }

/** Bots for every player from `fromId` on: 2 in a match (1 is you), 1 for bots-only matches. */
export function makeBots(world, skillName, rng, fromId = 2) {
  const skill = CONFIG.difficulty[skillName] || CONFIG.difficulty.normal;
  const bots = [];
  for (let id = fromId; id < world.players.length; id++) bots.push(new Bot(world, id, skill, rng));
  return bots;
}
