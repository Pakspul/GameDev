// Critters' rules (Depot's are in depot.js), with no drawing in them. Shared by the game, the level
// generator, the solver and the tests, so what you see is exactly what was checked.
//
// The board: a picture of w × h cells, each empty (0) or a colour (1..). Around it runs a loop
// (the track). Movers (buses in Depot, critters in Critters) have a colour and a capacity. You send
// one onto the loop; it goes round once. At every step along a side it looks straight into the
// picture: if the first cell it sees there has its colour and it has room, it takes that cell (the
// cell behind it then shows, for the next mover or the next lap). After its lap a mover with nothing left is done; one with room left
// parks in a free bay, from where you can send it again. No free bay: the level is lost.
//
// Critters wait in lanes; only the front one of a lane can go. (The car park helpers at the bottom
// of the file are Depot's.)
//
// Time runs in ticks. Each tick every mover on the loop moves one step. Several movers can be on
// the loop at once; the front one acts first. All of it is deterministic.

export const YARD = 0, QUEUE = 1, BELT = 2, BAY = 3, DONE = 4;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The loop round a w × h picture: corner, left side (bottom to top), corner, top (left to right),
 *  corner, right side (top to bottom), corner, bottom (right to left). Each side step has the cells
 *  it looks along, nearest first. The lap starts and ends at the bottom-left corner. */
export function makeTrack(w, h) {
  const T = [];
  T.push({ x: -1, y: h, line: null, side: "c" });
  for (let y = h - 1; y >= 0; y--) T.push({ x: -1, y, side: "l", line: Array.from({ length: w }, (_, x) => y * w + x) });
  T.push({ x: -1, y: -1, line: null, side: "c" });
  for (let x = 0; x < w; x++) T.push({ x, y: -1, side: "t", line: Array.from({ length: h }, (_, y) => y * w + x) });
  T.push({ x: w, y: -1, line: null, side: "c" });
  for (let y = 0; y < h; y++) T.push({ x: w, y, side: "r", line: Array.from({ length: w }, (_, k) => y * w + (w - 1 - k)) });
  T.push({ x: w, y: h, line: null, side: "c" });
  for (let x = w - 1; x >= 0; x--) T.push({ x, y: h, side: "b", line: Array.from({ length: h }, (_, k) => (h - 1 - k) * w + x) });
  return T;
}

/** What a mover of `color` takes looking along `line`: the first cell it sees, if that has its colour
 *  (empty cells are looked past). Removes it from `cells` and returns its index, or -1. */
export function takeAlong(cells, line, color) {
  for (let i = 0; i < line.length; i++) {
    const v = cells[line[i]];
    if (v === 0) continue;
    if (v !== color) return -1;
    cells[line[i]] = 0;
    return line[i];
  }
  return -1;
}

/** A zapping mover (the Laser power) looks past other colours: it takes the first cell of its own
 *  colour along `line`. */
export function takeColour(cells, line, color) {
  for (let i = 0; i < line.length; i++) {
    if (cells[line[i]] !== color) continue;
    cells[line[i]] = 0;
    return line[i];
  }
  return -1;
}

/** One lap of a lone mover: what it would take. Changes `cells`. */
export function lap(cells, track, color, room) {
  let n = 0;
  for (const t of track) if (t.line && n < room && takeAlong(cells, t.line, color) >= 0) n++;
  return n;
}

/** The cells a car in the park covers: (x, y) is its nose, its body trails behind it. */
export function carCells(car) {
  const [dx, dy] = DIRS[car.dir];
  const out = [];
  for (let k = 0; k < car.len; k++) out.push([car.x - dx * k, car.y - dy * k]);
  return out;
}
/** The park cells between a car's nose and the edge, in order. */
export function carPath(car, lw, lh) {
  const [dx, dy] = DIRS[car.dir];
  const out = [];
  for (let x = car.x + dx, y = car.y + dy; x >= 0 && y >= 0 && x < lw && y < lh; x += dx, y += dy) out.push([x, y]);
  return out;
}

export class Game {
  /** level: { w, h, cells, movers: [{ color, cap }], lanes: [[mover]], bays, belt? } */
  constructor(level, { history = true } = {}) {
    this.level = level;
    this.kind = "critters";
    this.w = level.w; this.h = level.h;
    this.track = makeTrack(level.w, level.h);
    this.L = this.track.length;
    this.beltMax = level.belt || 4;
    this.spacing = level.spacing || 2;
    this.keepHistory = history;
    this.reset();
  }

  reset() {
    const lv = this.level;
    this.cells = Uint8Array.from(lv.cells);
    this.remaining = this.cells.reduce((a, v) => a + (v ? 1 : 0), 0);
    this.left = lv.movers.map((m) => m.cap);
    this.where = lv.movers.map(() => YARD);
    this.lanes = lv.lanes.map((l) => l.slice());
    this.bays = new Array(lv.bays).fill(-1);
    this.zap = lv.movers.map(() => 0); // 1 while a mover rides a lap with the Laser power
    this.belt = [];   // [{ m, pos }], front first
    this.queue = [];  // movers waiting to get on the loop
    this.status = "play"; // play | won | lost
    this.lostBy = -1;
    this.ticks = 0;
    this.events = [];
    this.history = [];
  }

  get idle() { return this.belt.length === 0 && this.queue.length === 0; }
  color(m) { return this.level.movers[m].color; }

  /** Can mover m be sent now (ignoring how full the loop is)? `any`: from anywhere in a lane (the
   *  Pick power), not just the front. */
  free(m, any = false) {
    if (this.status !== "play") return false;
    const w = this.where[m];
    if (w === BAY) return true;
    if (w !== YARD) return false;
    return this.lanes.some((l) => (any ? l.includes(m) : l[0] === m));
  }
  /** Every mover that can be sent now. */
  ready() {
    const out = [];
    for (let m = 0; m < this.where.length; m++) if (this.free(m)) out.push(m);
    return out;
  }
  get beltFull() { return this.belt.length + this.queue.length >= this.beltMax; }
  freeBays() { return this.bays.filter((b) => b < 0).length; }

  /** Send mover m. Returns "ok", "blocked" (it can't leave), "full" (the loop is full) or "over".
   *  Powers: { any } takes it from anywhere in its lane, { zap } makes this lap look past other
   *  colours; { power } names the one used, so undo can give it back. */
  launch(m, { any = false, zap = false, power = null } = {}) {
    if (this.status !== "play") return "over";
    if (!this.free(m, any)) return "blocked";
    if (this.beltFull) return "full";
    if (this.keepHistory) { const s = this.snapshot(); s.used = power; this.history.push(s); }
    let from;
    if (this.where[m] === BAY) { const b = this.bays.indexOf(m); this.bays[b] = -1; from = { bay: b }; }
    else { const k = this.lanes.findIndex((l) => l.includes(m)), row = this.lanes[k].indexOf(m); this.lanes[k].splice(row, 1); from = { lane: k, row }; }
    if (zap) this.zap[m] = 1;
    this.where[m] = QUEUE;
    this.queue.push(m);
    this.events.push({ type: "launch", m, from });
    this.enter();
    return "ok";
  }

  /** The first waiting mover gets on the loop if the entrance is clear. */
  enter() {
    if (!this.queue.length) return;
    const last = this.belt[this.belt.length - 1];
    if (last && last.pos < this.spacing) return;
    const m = this.queue.shift();
    this.where[m] = BELT;
    this.belt.push({ m, pos: 0 });
    this.events.push({ type: "enter", m });
  }

  tick() {
    if (this.status === "lost") return;
    for (const b of this.belt) {
      b.pos++;
      if (b.pos >= this.L) continue;
      const t = this.track[b.pos];
      if (!t.line || this.left[b.m] === 0) continue;
      const got = (this.zap[b.m] ? takeColour : takeAlong)(this.cells, t.line, this.color(b.m));
      if (got >= 0) {
        this.left[b.m]--;
        this.remaining--;
        this.events.push({ type: "take", m: b.m, cell: got, pos: b.pos });
      }
    }
    while (this.belt.length && this.belt[0].pos >= this.L) this.arrive(this.belt.shift().m);
    if (this.status === "lost") return;
    this.enter();
    this.ticks++;
    if (this.remaining === 0 && this.status === "play") { this.status = "won"; this.events.push({ type: "won" }); }
  }

  arrive(m) {
    this.zap[m] = 0;
    if (this.left[m] === 0) { this.where[m] = DONE; this.events.push({ type: "done", m }); return; }
    const b = this.bays.indexOf(-1);
    if (b < 0 || this.status !== "play") {
      if (this.status === "play") { this.status = "lost"; this.lostBy = m; this.events.push({ type: "lost", m, why: "bays" }); }
      this.where[m] = DONE;
      return;
    }
    this.bays[b] = m;
    this.where[m] = BAY;
    this.events.push({ type: "park", m, bay: b });
  }

  /** Run until nothing moves (or the level ends). */
  settle(max = 100000) {
    let n = 0;
    while (!this.idle && this.status !== "lost" && n++ < max) this.tick();
  }

  /** With the loop empty: is there no way forward at all? (Nothing that can go takes a cell, and
   *  no yard mover can be parked to make room in the yard.) */
  stuck() {
    if (this.status !== "play" || !this.idle) return false;
    const ready = this.ready();
    if (!ready.length) return true;
    const room = this.freeBays() > 0;
    for (const m of ready) {
      if (this.where[m] === YARD && room) return false;
      if (lap(this.cells.slice(), this.track, this.color(m), this.left[m]) > 0) return false;
    }
    return true;
  }

  /** The Extra bay power: one more bay for the rest of this level (undo keeps it). */
  addBay() {
    this.bays.push(-1);
    for (const s of this.history) s.bays.push(-1);
  }

  /** For the solver: the position as text. */
  key() { return String.fromCharCode.apply(null, this.cells) + "|" + this.left.join(",") + "|" + this.where.join(""); }

  snapshot() {
    return {
      cells: this.cells.slice(), remaining: this.remaining, left: this.left.slice(), where: this.where.slice(), zap: this.zap.slice(),
      lanes: this.lanes.map((l) => l.slice()), bays: this.bays.slice(),
      belt: this.belt.map((b) => ({ ...b })), queue: this.queue.slice(), status: this.status, lostBy: this.lostBy, ticks: this.ticks,
    };
  }
  restore(s) {
    this.cells = s.cells.slice(); this.remaining = s.remaining; this.left = s.left.slice(); this.where = s.where.slice(); this.zap = s.zap.slice();
    this.lanes = s.lanes.map((l) => l.slice()); this.bays = s.bays.slice();
    this.belt = s.belt.map((b) => ({ ...b })); this.queue = s.queue.slice(); this.status = s.status; this.lostBy = s.lostBy; this.ticks = s.ticks;
    this.events = [];
  }
  /** Back to just before the last send. `undone` then names the power that send used, if any. */
  undo() {
    if (!this.history.length) return false;
    const s = this.history.pop();
    this.restore(s);
    this.undone = s.used || null;
    return true;
  }
  /** A copy without history, for looking ahead (hints, the solver). */
  clone() {
    const g = new Game(this.level, { history: false });
    g.restore(this.snapshot());
    return g;
  }
}
