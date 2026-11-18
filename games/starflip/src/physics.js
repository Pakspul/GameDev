// The physics of one table: balls against walls, posts, bumpers, targets and flippers. It knows
// nothing about scores, missions or the screen; it steps at a fixed rate and reports what happened
// in `events`, so the rules (rules.js), the renderer and the tests all see the same thing.
//
//   const w = new World(table);       table: see tables.js
//   w.addBall(x, y, vx, vy);
//   w.flip("L", true);                press (true) or release (false) a flipper
//   w.step(1 / CONFIG.hz);            one fixed step; then read and clear w.events
//
// Contacts are resolved by pushing the ball out of whatever it overlaps and reflecting the part
// of its velocity going into the surface (relative to the surface, for flippers and moving parts).
// At 600 steps a second a ball at top speed moves under half its radius per step, so it can't
// pass through a wall between two steps.
import { CONFIG } from "./config.js";

const B = CONFIG.ball;

export class World {
  constructor(table) {
    this.table = table;
    this.g = table.gravity ?? CONFIG.gravity;
    this.segs = table.segs.map(prepSeg);
    this.circles = table.circles.map((c) => ({ active: true, vx: 0, vy: 0, e: 0.5, ...c }));
    this.flippers = table.flippers.map((f) => ({ ...CONFIG.flipper, ...f, a: 0, w: 0, pressed: false }));
    for (const f of this.flippers) f.a = f.rest;
    this.sensors = (table.sensors || []).map((s) => (s.ax != null ? prepSeg(s) : { ...s }));
    this.holes = (table.holes || []).map((h) => ({ active: true, ...h }));
    this.fields = (table.fields || []).map((f) => ({ ...f }));
    this.drainY = table.drainY ?? table.H + 20;
    this.balls = [];
    this.events = [];
    this.t = 0;
    this.nextId = 1;
    this.byId = new Map();
    for (const o of [...this.segs, ...this.circles]) if (o.id) this.byId.set(o.id, o);
  }

  addBall(x, y, vx = 0, vy = 0) {
    const b = { id: this.nextId++, x, y, vx, vy, r: B.r, held: null, ignore: null, ignoreT: 0, inside: new Set(), still: 0, px: x, py: y };
    this.balls.push(b);
    return b;
  }
  removeBall(b) { const i = this.balls.indexOf(b); if (i >= 0) this.balls.splice(i, 1); }

  flip(side, on) {
    for (const f of this.flippers) if (f.side === side) f.pressed = on;
  }
  get(id) { return this.byId.get(id); }

  /** Hold a ball in a hole (rules decide when it comes out again with eject()). */
  hold(b, hole) {
    b.held = hole;
    b.x = hole.x; b.y = hole.y; b.vx = b.vy = 0;
  }
  eject(b, vx, vy) {
    if (!b.held) return;
    b.ignore = b.held.id; b.ignoreT = 0.5;
    b.held = null;
    b.vx = vx; b.vy = vy;
  }

  step(dt) {
    this.t += dt;
    for (const f of this.flippers) {
      const target = f.pressed ? f.up : f.rest;
      const sp = (f.pressed ? f.wUp : f.wDown) * dt;
      const da = target - f.a;
      const move = Math.abs(da) <= sp ? da : Math.sign(da) * sp;
      f.a += move;
      f.w = move / dt;
    }
    for (const b of this.balls) {
      if (b.held) continue;
      b.px = b.x; b.py = b.y;
      let ax = 0, ay = this.g;
      for (const fl of this.fields) {
        const dx = fl.x - b.x, dy = fl.y - b.y, d = Math.hypot(dx, dy);
        if (d < fl.R && d > 1) { const k = fl.k * (1 - d / fl.R) / d; ax += dx * k; ay += dy * k; }
      }
      b.vx += ax * dt; b.vy += ay * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.ignoreT > 0 && (b.ignoreT -= dt) <= 0) b.ignore = null;
      for (let pass = 0; pass < 2; pass++) {
        for (const s of this.segs) if (s.active) this.collideSeg(b, s);
        for (const c of this.circles) if (c.active) this.collideCircle(b, c);
        for (const f of this.flippers) this.collideFlipper(b, f);
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > B.vmax) { b.vx *= B.vmax / sp; b.vy *= B.vmax / sp; }
      this.sense(b);
    }
    // Balls against each other (multiball): equal masses, a little loss.
    for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
      const a = this.balls[i], c = this.balls[j];
      if (a.held || c.held) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), R = a.r + c.r;
      if (d >= R || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, pen = (R - d) / 2;
      a.x -= nx * pen; a.y -= ny * pen; c.x += nx * pen; c.y += ny * pen;
      const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (vn < 0) {
        const j2 = -0.95 * vn;
        a.vx -= nx * j2; a.vy -= ny * j2; c.vx += nx * j2; c.vy += ny * j2;
      }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.y > this.drainY) { this.balls.splice(i, 1); this.events.push({ type: "drain", ball: b }); }
    }
  }

  /** Push the ball out along n by pen, and bounce what goes into the surface (moving at svx, svy). */
  resolve(b, nx, ny, pen, e, f, svx = 0, svy = 0) {
    b.x += nx * pen; b.y += ny * pen;
    const rvx = b.vx - svx, rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const ee = -vn < CONFIG.rest ? 0 : e;
    b.vx -= (1 + ee) * vn * nx; b.vy -= (1 + ee) * vn * ny;
    if (f) { // a touch of friction along the surface
      const tx = -ny, ty = nx, vt = (b.vx - svx) * tx + (b.vy - svy) * ty;
      b.vx -= vt * f * tx; b.vy -= vt * f * ty;
    }
    return -vn;
  }

  collideSeg(b, s) {
    const px = b.x - s.ax, py = b.y - s.ay;
    let t = (px * s.dx + py * s.dy) / s.len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.ax + s.dx * t, cy = s.ay + s.dy * t;
    let nx = b.x - cx, ny = b.y - cy;
    const R = b.r + s.r, d2 = nx * nx + ny * ny;
    if (d2 >= R * R) return;
    // A gate lets balls through one way: it only blocks a ball that is already on its far side.
    if (s.pass && (b.x - s.ax) * s.pass[0] + (b.y - s.ay) * s.pass[1] < 0) return;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { nx = -s.dy; ny = s.dx; d = Math.hypot(nx, ny); }
    nx /= d; ny /= d;
    const vn = this.resolve(b, nx, ny, R - d, s.e, s.f ?? CONFIG.wall.f);
    if (s.kick && vn > (s.minHit ?? 0)) {
      b.vx += nx * s.kick; b.vy += ny * s.kick;
      this.events.push({ type: "hit", id: s.id, kind: s.kind, speed: vn, x: cx, y: cy, ball: b });
    } else if (s.id && vn > 60) this.events.push({ type: "hit", id: s.id, kind: s.kind, speed: vn, x: cx, y: cy, ball: b });
  }

  collideCircle(b, c) {
    let nx = b.x - c.x, ny = b.y - c.y;
    const R = b.r + c.r, d2 = nx * nx + ny * ny;
    if (d2 >= R * R) return;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { nx = 0; ny = -1; d = 1; }
    nx /= d; ny /= d;
    const vn = this.resolve(b, nx, ny, R - d, c.e, 0, c.vx, c.vy);
    if (c.kick) {
      // Bumpers: whatever came in, the ball leaves at least this fast.
      const out = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
      if (out < c.kick) { b.vx += nx * (c.kick - out); b.vy += ny * (c.kick - out); }
      if (vn > 0 || out < c.kick) this.events.push({ type: "hit", id: c.id, kind: c.kind, speed: Math.max(vn, 1), x: c.x + nx * c.r, y: c.y + ny * c.r, ball: b });
    } else if (c.id && vn > 60) this.events.push({ type: "hit", id: c.id, kind: c.kind, speed: vn, x: c.x + nx * c.r, y: c.y + ny * c.r, ball: b });
  }

  collideFlipper(b, f) {
    const L = f.len, ca = Math.cos(f.a), sa = Math.sin(f.a);
    const dx = ca * L, dy = sa * L;
    const px = b.x - f.x, py = b.y - f.y;
    let t = (px * dx + py * dy) / (L * L);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const rr = f.r1 + (f.r2 - f.r1) * t;
    const cx = f.x + dx * t, cy = f.y + dy * t;
    let nx = b.x - cx, ny = b.y - cy;
    const R = b.r + rr, d2 = nx * nx + ny * ny;
    if (d2 >= R * R) return;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { nx = sa; ny = -ca; d = 1; }
    nx /= d; ny /= d;
    // The flipper's surface moves at w × r where the ball touches it.
    const qx = cx + nx * rr - f.x, qy = cy + ny * rr - f.y;
    const svx = -f.w * qy, svy = f.w * qx;
    const vn = this.resolve(b, nx, ny, R - d, f.e, 0.01, svx, svy);
    if (vn > 400 && f.w !== 0) this.events.push({ type: "flipHit", side: f.side, speed: vn, ball: b });
  }

  sense(b) {
    for (const s of this.sensors) {
      if (s.ax != null) {
        // A line: fires when the ball's centre crosses it this step.
        const s0 = (b.px - s.ax) * s.dy - (b.py - s.ay) * s.dx;
        const s1 = (b.x - s.ax) * s.dy - (b.y - s.ay) * s.dx;
        if ((s0 < 0) === (s1 < 0)) continue;
        const t = ((b.x - s.ax) * s.dx + (b.y - s.ay) * s.dy) / s.len2;
        if (t < -0.05 || t > 1.05) continue;
        this.events.push({ type: "sensor", id: s.id, vx: b.vx, vy: b.vy, ball: b });
      } else {
        // A circle (a rollover): fires when the ball's centre comes in.
        const inside = (b.x - s.x) ** 2 + (b.y - s.y) ** 2 < s.r * s.r;
        if (inside && !b.inside.has(s.id)) { b.inside.add(s.id); this.events.push({ type: "sensor", id: s.id, vx: b.vx, vy: b.vy, ball: b }); }
        else if (!inside) b.inside.delete(s.id);
      }
    }
    for (const h of this.holes) {
      if (!h.active || b.ignore === h.id) continue;
      if ((b.x - h.x) ** 2 + (b.y - h.y) ** 2 < h.r * h.r) {
        this.hold(b, h);
        this.events.push({ type: "hole", id: h.id, ball: b });
        return;
      }
    }
  }
}

function prepSeg(s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  return { active: true, r: 0, e: CONFIG.wall.e, ...s, dx, dy, len2: Math.max(1e-6, dx * dx + dy * dy) };
}
