// The physics board: shelf, pusher, rails, coins and prizes in a Rapier world. It knows nothing
// about the screen, the bank or the rules; it steps the world at a fixed rate and reports what
// happens (a coin landed, a coin went over the front edge or off a side) through `onEvent`.
// That keeps it testable headlessly in Node (tests/coin-dozer/).
//
// Coordinates: one unit is one coin diameter, y up, shelf top at y = 0, front edge at
// z = +depth/2 (toward the player), back wall at z = -depth/2.
//
// Two machines share this board (config.machines): "classic" drops coins straight onto the pusher,
// "pins" adds a wall of pins above the back of the shelf. A coin in that wall is held in its plane
// (it can only fall, slide sideways and spin) until it drops out of the bottom; then it is an
// ordinary coin again.
import RAPIER from "../../../shared/vendor/rapier/rapier.js";
import { CONFIG } from "./config.js";
import { gemPoints } from "./shapes.js";

let ready = null;
/** Load the physics engine once (it compiles a small WebAssembly module). */
export function initPhysics() {
  if (!ready) {
    // rapier.js warns about its own internal call; keep the console clean.
    const warn = console.warn;
    console.warn = (...a) => { if (!String(a[0]).includes("deprecated parameters")) warn(...a); };
    ready = RAPIER.init().finally(() => { console.warn = warn; });
  }
  return ready;
}

// Collision groups (membership << 16 | filter): coins in the pin wall are in group 2 and ignore group 2.
const ALL_GROUPS = 0xffffffff, WALL_GROUPS = 0x0002fffd;

export const COIN_KINDS = ["coin", "gold", "lucky", "bomb", "jackpot"];
export const isCoin = (kind) => COIN_KINDS.includes(kind);
export const isPrize = (kind) => kind === "gem" || kind === "figure";

/** Pusher front face position (z) for a phase in [0, 1): advance on the first half, retract on the second. */
export function pusherFront(phase, cfg = CONFIG) {
  const B = cfg.board;
  const s = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return -B.depth / 2 + B.stroke * s;
}

export class Board {
  constructor({ cfg = CONFIG, onEvent = () => {}, type = "classic" } = {}) {
    this.cfg = cfg;
    this.onEvent = onEvent;
    this.type = type === "pins" ? "pins" : "classic";
    const P = cfg.physics, B = cfg.board;
    this.dt = 1 / P.hz;
    this.world = new RAPIER.World({ x: 0, y: -P.gravity, z: 0 });
    this.world.timestep = this.dt;
    this.world.numSolverIterations = P.solverIterations;
    this.world.numInternalPgsIterations = P.pgsIterations;
    this.events = new RAPIER.EventQueue(true);
    this.items = new Map();       // id → item
    this.byCollider = new Map();  // collider handle → item
    this.byBody = new Map();      // body handle → item
    this.inWall = new Set();      // coins falling through the pin wall
    this.nextId = 1;
    this.stepCount = 0;
    this.phase = 0;               // pusher phase, [0, 1)
    this.speed = 1;               // pusher speed multiplier (fever)
    this.cycles = 0;              // completed pusher cycles
    this.W = B.width; this.D = B.depth;
    this.buildStatics();
  }

  // ---- The machine --------------------------------------------------------------------------------------
  buildStatics() {
    const P = this.cfg.physics, B = this.cfg.board, w = this.world;
    const W = B.width, D = B.depth, back = -D / 2;
    const fixed = (desc, fr) => w.createCollider(desc.setFriction(fr.friction ?? fr).setRestitution(fr.restitution ?? 0));
    // Shelf: from well behind the back wall (under the pusher) to the front edge.
    const behind = B.stroke + 2;
    const shelfLen = D + behind;
    fixed(RAPIER.ColliderDesc.cuboid(W / 2, 0.5, shelfLen / 2).setTranslation(0, -0.5, D / 2 - shelfLen / 2), P.shelf);
    // Back wall: hangs just above the pusher, so coins riding the pusher are swept off as it retracts.
    const wallBottom = B.pusherHeight + 0.04, wallTop = B.railHeight + 3;
    fixed(RAPIER.ColliderDesc.cuboid(W / 2 + 0.3, (wallTop - wallBottom) / 2, 0.15).setTranslation(0, (wallBottom + wallTop) / 2, back - 0.15), P.wall);
    // Side rails along the pusher and the back part of the shelf.
    const railFrom = back - behind, railTo = B.sideOpenFrom, railLen = railTo - railFrom;
    for (const sx of [-1, 1]) {
      fixed(RAPIER.ColliderDesc.cuboid(0.15, B.railHeight / 2, railLen / 2).setTranslation(sx * (W / 2 + 0.15), B.railHeight / 2, railFrom + railLen / 2), P.wall);
    }
    // Gutter covers: closed only during Wide Shelf.
    const openLen = D / 2 - B.sideOpenFrom;
    this.gutterWalls = [-1, 1].map((sx) => fixed(RAPIER.ColliderDesc.cuboid(0.15, B.railHeight / 2, openLen / 2 + 0.05)
      .setTranslation(sx * (W / 2 + 0.15), B.railHeight / 2, B.sideOpenFrom + openLen / 2), P.wall));
    this.setGuttersClosed(false);
    // Pusher: a kinematic block on the shelf. It moves the pile; nothing moves it.
    this.pusherLen = B.stroke + 2.2;
    this.pusher = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, B.pusherHeight / 2, this.pusherZ(0)));
    w.createCollider(RAPIER.ColliderDesc.cuboid(W / 2 - 0.005, B.pusherHeight / 2, this.pusherLen / 2)
      .setFriction(P.pusher.friction), this.pusher);
    if (this.type === "pins") this.buildPinWall();
  }

  /** The pin wall: pins across a thin plane in front of the back wall, glass in front, sides up to the top. */
  buildPinWall() {
    const PW = this.cfg.pinWall, B = this.cfg.board, w = this.world;
    const back = -B.depth / 2, glassZ = PW.z + 0.16, depth = glassZ - back, top = PW.top + 1;
    const pinDesc = (x, y, r = PW.pinRadius) => RAPIER.ColliderDesc.cylinder(depth / 2, r)
      .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })   // the cylinder's axis along z
      .setTranslation(x, y, back + depth / 2)
      .setFriction(0.05).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(PW.restitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);
    this.pins = [];
    this.wallParts = new Set();   // collider handles of the pins, glass, sides and lid
    const part = (desc) => this.wallParts.add(w.createCollider(desc).handle);
    PW.rows.forEach((row, r) => { for (const x of row) { const y = PW.rowTop - r * PW.rowGap; part(pinDesc(x, y)); this.pins.push([x, y]); } });
    for (const r of PW.bumpers) {
      for (const sx of [-1, 1]) part(pinDesc(sx * B.width / 2, PW.rowTop - r * PW.rowGap, PW.bumperRadius));
    }
    const wall = (hx, hy, hz, x, y, z) => part(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.1).setRestitution(0.2));
    const h = (top - PW.bottom) / 2, cy = (top + PW.bottom) / 2;
    wall(B.width / 2 + 0.3, h, 0.02, 0, cy, glassZ + 0.02);                                    // the glass: nothing else gets in
    for (const sx of [-1, 1]) wall(0.15, h, depth / 2, sx * (B.width / 2 + 0.15), cy, back + depth / 2);
    wall(B.width / 2 + 0.3, 0.15, 0.3, 0, PW.top + 0.75, PW.z);                                 // the slot plate (the lid)
  }

  pusherZ(phase) { return pusherFront(phase, this.cfg) - this.pusherLen / 2; }
  get pusherFrontZ() { return pusherFront(this.phase, this.cfg); }

  setGuttersClosed(closed) {
    this.guttersClosed = !!closed;
    for (const c of this.gutterWalls) c.setEnabled(this.guttersClosed);
  }

  // ---- Bodies -------------------------------------------------------------------------------------------
  /**
   * Add a coin or prize. kind: coin | gold | lucky | bomb | jackpot | gem | figure.
   * o: { x, y, z, q: [x, y, z, w], v: [x, y, z], sub (gem colour / figure index), sleeping, falling, born }
   */
  add(kind, o) {
    const P = this.cfg.physics, C = this.cfg.coin, PR = this.cfg.prizes;
    const q = o.q || [0, 0, 0, 1];
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(o.x, o.y, o.z)
      .setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
      .setLinearDamping(P.coin.linearDamping)
      .setAngularDamping(P.coin.angularDamping)
      .setCcdEnabled(P.ccd)
      .setSleeping(!!o.sleeping);
    if (o.v) bd.setLinvel(o.v[0], o.v[1], o.v[2]);
    const body = this.world.createRigidBody(bd);
    let cd;
    if (kind === "gem") {
      cd = RAPIER.ColliderDesc.convexHull(gemPoints(o.sub)).setDensity(PR.gem.density).setFriction(PR.gem.friction);
    } else if (kind === "figure") {
      const f = PR.figure;
      cd = RAPIER.ColliderDesc.roundCylinder(f.height / 2 - 0.04, f.radius - 0.04, 0.04).setDensity(f.density).setFriction(f.friction);
    } else {
      const big = kind === "jackpot";
      const r = (big ? C.jackpotDiameter : 1) / 2, h = (big ? C.jackpotThickness : C.thickness) / 2, b = P.coinBorder;
      cd = RAPIER.ColliderDesc.roundCylinder(h - b, r - b, b).setDensity(big ? C.jackpotDensity : P.coin.density).setFriction(P.coin.friction);
    }
    cd.setRestitution(P.coin.restitution);
    if (o.falling) cd.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const col = this.world.createCollider(cd, body);
    const item = {
      id: this.nextId++, kind, sub: o.sub ?? null, body, col, wall: !!o.wall, wallT: 0, stuckT: 0,
      born: o.born ?? this.stepCount, falling: !!o.falling, fade: 0,
      x: o.x, y: o.y, z: o.z, qx: q[0], qy: q[1], qz: q[2], qw: q[3],
      px: o.x, py: o.y, pz: o.z, pqx: q[0], pqy: q[1], pqz: q[2], pqw: q[3],
      asleep: !!o.sleeping, still: 0, lastX: o.x, lastZ: o.z,
    };
    this.items.set(item.id, item);
    this.byCollider.set(col.handle, item);
    this.byBody.set(body.handle, item);
    if (item.wall) { this.hold(item, true); this.inWall.add(item); }
    return item;
  }

  /**
   * Hold a coin in the pin wall's plane (it falls, slides sideways and spins), or let it go. Coins in
   * the wall pass through each other: two held coins can only overlap face to face, along the one
   * direction they can't move, and the solver would blow up. Each bounces off the pins on its own.
   */
  hold(item, on) {
    const body = item.body;
    item.col.setCollisionGroups(on ? WALL_GROUPS : ALL_GROUPS);
    body.setEnabledTranslations(true, true, !on, true);
    body.setEnabledRotations(!on, !on, true, true);
    body.setGravityScale(on ? this.cfg.pinWall.gravityScale : 1, true);
  }

  /** A coin leaves the pin wall: an ordinary coin again, tipping forward onto the pile. */
  release(it, v) {
    this.inWall.delete(it);
    it.wall = false;
    it.touched = false;
    this.hold(it, false);
    it.body.setLinvel({ x: v.x * 0.5, y: Math.min(0, v.y), z: this.cfg.pinWall.exitSpeed }, true);
    it.body.setAngvel({ x: 2.5, y: 0, z: 0 }, true);
    this.onEvent("leaveWall", { item: it });
  }

  /**
   * Coins in the pin wall: let go of the ones at the bottom, and kick any that got stuck. A held coin
   * that touches anything but the wall (a coin standing on the pusher below, say)
   * is let go at once: held in its plane, it can't give way, and the solver would fling it sideways.
   */
  wallStep() {
    const PW = this.cfg.pinWall;
    for (const it of this.inWall) {
      it.wallT += this.dt;
      const v = it.body.linvel();
      if (it.y < PW.bottom) { this.release(it, v); continue; }
      if (it.touched) { this.release(it, v); continue; }
      it.stuckT = Math.hypot(v.x, v.y) < 0.3 ? it.stuckT + this.dt : 0;
      if (it.stuckT >= PW.stuckSeconds) {
        it.stuckT = 0;
        it.body.setLinvel({ x: (it.x > 0 ? -1 : 1) * PW.stuckKick, y: 1, z: 0 }, true);
      }
    }
  }

  remove(item) {
    if (!this.items.has(item.id)) return;
    this.items.delete(item.id);
    this.inWall.delete(item);
    this.byCollider.delete(item.col.handle);
    this.byBody.delete(item.body.handle);
    this.world.removeRigidBody(item.body);
  }

  count(pred) {
    let n = 0;
    for (const it of this.items.values()) if (pred(it)) n++;
    return n;
  }

  // ---- Stepping -----------------------------------------------------------------------------------------
  step() {
    const B = this.cfg.board;
    const before = this.phase;
    this.phase += (this.dt / B.cycle) * this.speed;
    let wrapped = false;
    if (this.phase >= 1) { this.phase -= 1; this.cycles++; wrapped = true; }
    this.pz0 = this.pz1 ?? this.pusherZ(before);
    this.pz1 = this.pusherZ(this.phase);
    this.pusher.setNextKinematicTranslation({ x: 0, y: B.pusherHeight / 2, z: this.pz1 });
    if (before < 0.5 && this.phase >= 0.5) this.onEvent("retract", {});
    if (wrapped) this.onEvent("advance", { cycles: this.cycles });

    this.world.step(this.events);
    this.stepCount++;

    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      for (const h of [h1, h2]) {
        const it = this.byCollider.get(h);
        if (it && it.wall) {
          if (!this.wallParts.has(h === h1 ? h2 : h1)) it.touched = true;
          const v = it.body.linvel();
          this.onEvent("pin", { item: it, speed: Math.hypot(v.x, v.y) });
        } else if (it && it.falling) {
          it.falling = false;
          it.col.setActiveEvents(RAPIER.ActiveEvents.NONE);
          const v = it.body.linvel();
          this.onEvent("land", { item: it, speed: Math.hypot(v.x, v.y, v.z) });
        }
      }
    });

    // Read back what moved, and catch anything that left the board.
    const W2 = B.width / 2, front = B.depth / 2;
    const gone = [];
    for (const it of this.items.values()) {
      it.px = it.x; it.py = it.y; it.pz = it.z;
      it.pqx = it.qx; it.pqy = it.qy; it.pqz = it.qz; it.pqw = it.qw;
    }
    this.world.forEachActiveRigidBody((body) => {
      const it = this.byBody.get(body.handle);
      if (!it) return;
      const t = body.translation(), r = body.rotation();
      it.x = t.x; it.y = t.y; it.z = t.z;
      it.qx = r.x; it.qy = r.y; it.qz = r.z; it.qw = r.w;
      if (it.y < B.wonBelow || it.y > 30 || !Number.isFinite(it.y)) gone.push(it);
    });
    for (const it of this.items.values()) it.asleep = it.body.isSleeping();
    if (this.inWall.size) this.wallStep();
    for (const it of gone) {
      const where = !Number.isFinite(it.x + it.y + it.z) ? "lost" : it.z > front - 0.3 && Math.abs(it.x) < W2 + 0.6 ? "front" : "side";
      this.remove(it);
      this.onEvent(where === "front" ? "won" : "lost", { item: it, where });
    }
  }

  // ---- Nudges -------------------------------------------------------------------------------------------
  /** Shake the whole board: wake everything and give each body a small seeded kick. */
  shake(rng, strength = 1) {
    const N = this.cfg.nudge;
    for (const it of this.items.values()) {
      const m = it.body.mass();
      it.body.applyImpulse({ x: rng.range(-1, 1) * N.impulse * m * strength, y: N.lift * m * strength * rng.range(0.5, 1), z: rng.range(-0.3, 1) * N.impulse * m * strength }, true);
    }
  }

  /** A gentle push toward the front for the n coins nearest the front edge (anti-stall step 1). */
  settle(n, impulse) {
    const coins = [...this.items.values()].filter((it) => isCoin(it.kind)).sort((a, b) => b.z - a.z).slice(0, n);
    for (const it of coins) {
      const m = it.body.mass();
      it.body.applyImpulse({ x: 0, y: impulse * m * 0.5, z: impulse * m }, true);
    }
    return coins.length;
  }

  kick(item, x, y, z) {
    const m = item.body.mass();
    item.body.applyImpulse({ x: x * m, y: y * m, z: z * m }, true);
  }

  /** Does anything rest on top of this item? (Removing it would then disturb the pile.) */
  covered(item) {
    let hit = false;
    this.world.contactPairsWith(item.col, (other) => {
      const o = this.byCollider.get(other.handle);
      if (o && o.y > item.y + 0.04) hit = true;
    });
    return hit;
  }

  // ---- Save and restore -----------------------------------------------------------------------------------
  snapshot() {
    const r = (v) => Math.round(v * 10000) / 10000;
    const items = [];
    for (const it of this.items.values()) {
      items.push([it.kind, it.sub, r(it.x), r(it.y), r(it.z), r(it.qx), r(it.qy), r(it.qz), r(it.qw), it.asleep ? 1 : 0, it.wall ? 1 : 0]);
    }
    return { type: this.type, phase: r(this.phase), cycles: this.cycles, items };
  }

  restore(snap) {
    for (const it of [...this.items.values()]) this.remove(it);
    this.phase = Number(snap.phase) || 0;
    this.cycles = Number(snap.cycles) || 0;
    this.pz0 = this.pz1 = this.pusherZ(this.phase);
    this.pusher.setTranslation({ x: 0, y: this.cfg.board.pusherHeight / 2, z: this.pz1 }, true);
    for (const row of snap.items || []) {
      const [kind, sub, x, y, z, qx, qy, qz, qw, sl, wall] = row;
      if (!isCoin(kind) && !isPrize(kind)) continue;
      if (![x, y, z, qx, qy, qz, qw].every(Number.isFinite)) continue;
      const inWall = !!wall && this.type === "pins" && isCoin(kind);
      this.add(kind, { x, y, z, q: [qx, qy, qz, qw], sub, sleeping: !!sl && !inWall, born: 0, wall: inWall, falling: inWall });
    }
  }

  free() {
    this.events.free();
    this.world.free();
  }
}
