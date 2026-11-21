// Depot's rules: the bus stop. No drawing in here; shared by the game, the level generator, the
// solver and the tests.
//
// The picture is a crowd of pixels. Around it runs a loop of trays (the ring) that turns clockwise,
// one tray per tick. Pixels leave the picture by two doors: the left half by the left door, the right
// half by the right door, each half from its outside column inwards and each column from the top down.
// A pixel steps onto an empty tray as it passes its door.
//
// Under the loop is the one stop, and beside it a row of docks. Tap a bus in the car park (it can only
// leave if nothing stands in front of its nose) and it drives to a free dock. Each tick the pixel at
// the stop gets on a docked bus of its own colour, if one has a seat left. A full bus drives away and
// frees its dock. Pixels with no bus just ride round again.
//
// When nothing can happen any more (no pixel on the loop has a bus, no pixel can get on the loop) the
// loop stops and waits for you. If it stops with every dock taken, the level is lost.
import { carCells, carPath } from "./engine.js";

export const YARD = 0, DRIVING = 1, DOCKED = 2, DONE = 4;

/** Where things sit on the ring, as fractions of a lap from the top-left corner, clockwise. The
 *  ring runs `gap` cells outside a w × h picture. */
export function ringShape(w, h, gap = 1.3) {
  const W = w + 2 * gap, H = h + 2 * gap, P = 2 * (W + H);
  return {
    W, H, P, gap,
    stop: (W + H + W / 2) / P,          // bottom middle
    doors: [(2 * W + H + H / 2) / P,     // left side, halfway up
            (W + H / 2) / P],            // right side, halfway down
  };
}
/** How many trays a ring round a w × h picture holds at a given density (trays per cell of length). */
export function trayCount(w, h, density) {
  const s = ringShape(w, h);
  return Math.max(12, Math.round(s.P * density));
}

/** The two queues of pixels (cell indices) that leave by the left and the right door. */
export function feedsOf(w, h, cells) {
  const half = Math.ceil(w / 2);
  const left = [], right = [];
  for (let k = 0; k < half; k++) {
    for (let y = 0; y < h; y++) { const i = y * w + k; if (cells[i]) left.push(i); }
    const x = w - 1 - k;
    if (x >= half) for (let y = 0; y < h; y++) { const i = y * w + x; if (cells[i]) right.push(i); }
  }
  return [left, right];
}

export class Depot {
  /** level: { w, h, cells, ring, docks, transit, movers: [{ color, cap }], lot?: { w, h, cars } } */
  constructor(level, { history = true } = {}) {
    this.level = level;
    this.kind = "depot";
    this.w = level.w; this.h = level.h;
    this.R = level.ring;
    const s = ringShape(level.w, level.h);
    this.stop = Math.round(s.stop * this.R) % this.R;
    this.doors = s.doors.map((d) => Math.round(d * this.R) % this.R);
    this.feeds = feedsOf(level.w, level.h, level.cells);
    this.keepHistory = history;
    this.cars = level.lot ? level.lot.cars : null;
    this.carOf = level.lot ? new Map(level.lot.cars.map((c, i) => [c.m, i])) : null;
    this.reset();
  }

  reset() {
    const lv = this.level;
    this.cells = Uint8Array.from(lv.cells);                // what is still in the picture
    this.remaining = this.cells.reduce((a, v) => a + (v ? 1 : 0), 0); // not yet on a bus
    this.ring = new Int16Array(this.R).fill(-1);           // a cell index per tray, or -1
    this.rot = 0;                                          // the tray at position p is ring[(p - rot) mod R]
    this.fed = [0, 0];                                     // how far each door's queue has gone
    this.onRing = new Int16Array(16);                      // pixels on the ring per colour
    this.filled = 0;
    this.left = lv.movers.map((m) => m.cap);
    this.where = lv.movers.map(() => YARD);
    if (lv.lot) {
      this.occ = new Int16Array(lv.lot.w * lv.lot.h).fill(-1);
      lv.lot.cars.forEach((c, i) => { for (const [x, y] of carCells(c)) this.occ[y * lv.lot.w + x] = i; });
    } else this.occ = null;
    this.docks = new Array(lv.docks).fill(-1);
    this.driving = [];   // [{ m, t }]: on the way to their dock
    this.status = "play";
    this.ticks = 0;
    this.events = [];
    this.history = [];
  }

  color(m) { return this.level.movers[m].color; }
  /** The tray index at ring position p. */
  slot(p) { const R = this.R; return (((p - this.rot) % R) + R) % R; }
  /** Ring position of tray index i. */
  posOf(i) { return (i + this.rot) % this.R; }
  freeBays() { return this.docks.filter((d) => d < 0).length; }
  get beltFull() { return this.freeBays() === 0; }
  get idle() { return this.status !== "play" || this.quiet(); }

  /** Nothing can happen any more until you send a bus. */
  quiet() {
    if (this.driving.length) return false;
    for (const m of this.docks) if (m >= 0 && this.where[m] === DOCKED && this.left[m] > 0 && this.onRing[this.color(m)] > 0) return false;
    if (this.filled < this.R && (this.fed[0] < this.feeds[0].length || this.fed[1] < this.feeds[1].length)) return false;
    return true;
  }

  /** Can bus m leave the car park now (ignoring whether a dock is free)? */
  free(m) {
    if (this.status !== "play" || this.where[m] !== YARD) return false;
    if (!this.cars) return true;
    const lot = this.level.lot;
    return carPath(this.cars[this.carOf.get(m)], lot.w, lot.h).every(([x, y]) => this.occ[y * lot.w + x] === -1);
  }
  ready() {
    const out = [];
    for (let m = 0; m < this.where.length; m++) if (this.free(m)) out.push(m);
    return out;
  }

  /** Send bus m to a free dock. Returns "ok", "blocked", "full" (no free dock) or "over". */
  launch(m) {
    if (this.status !== "play") return "over";
    if (!this.free(m)) return "blocked";
    const d = this.docks.indexOf(-1);
    if (d < 0) return "full";
    if (this.keepHistory) this.history.push(this.snapshot());
    let from = null;
    if (this.cars) {
      const i = this.carOf.get(m), lw = this.level.lot.w;
      for (const [x, y] of carCells(this.cars[i])) this.occ[y * lw + x] = -1;
      from = { car: i };
    }
    this.docks[d] = m;
    this.where[m] = DRIVING;
    this.driving.push({ m, t: this.level.transit || 1 });
    this.events.push({ type: "launch", m, from, dock: d });
    return "ok";
  }

  tick() {
    if (this.status !== "play") return;
    const R = this.R;
    // Buses on their way arrive.
    for (const d of this.driving) if (--d.t <= 0) { this.where[d.m] = DOCKED; this.events.push({ type: "dock", m: d.m, dock: this.docks.indexOf(d.m) }); }
    this.driving = this.driving.filter((d) => d.t > 0);
    // The loop turns one tray.
    this.rot = (this.rot + 1) % R;
    // The pixel at the stop gets on a bus of its colour.
    const si = this.slot(this.stop), cell = this.ring[si];
    if (cell >= 0) {
      const c = this.level.cells[cell];
      for (let d = 0; d < this.docks.length; d++) {
        const m = this.docks[d];
        if (m < 0 || this.where[m] !== DOCKED || this.left[m] === 0 || this.color(m) !== c) continue;
        this.ring[si] = -1; this.onRing[c]--; this.filled--; this.remaining--;
        this.left[m]--;
        this.events.push({ type: "board", m, cell, dock: d });
        if (this.left[m] === 0) { this.docks[d] = -1; this.where[m] = DONE; this.events.push({ type: "depart", m, dock: d }); }
        break;
      }
    }
    // Pixels step on at the doors.
    for (let side = 0; side < 2; side++) {
      const q = this.feeds[side];
      if (this.fed[side] >= q.length) continue;
      const i = this.slot(this.doors[side]);
      if (this.ring[i] >= 0) continue;
      const cell = q[this.fed[side]++];
      this.ring[i] = cell; this.cells[cell] = 0;
      this.onRing[this.level.cells[cell]]++; this.filled++;
      this.events.push({ type: "enter", cell, side, tray: i });
    }
    this.ticks++;
    if (this.remaining === 0) { this.status = "won"; this.events.push({ type: "won" }); return; }
    if (this.freeBays() === 0 && this.quiet()) { this.status = "lost"; this.events.push({ type: "lost", why: "docks" }); }
  }

  settle(max = 200000) { let n = 0; while (!this.idle && n++ < max) this.tick(); }
  /** Depot never gets stuck without losing: with a free dock there is always a bus that can leave. */
  stuck() { return false; }

  /** For the solver: the position as text (colours by ring position, not which pixel it is). */
  key() {
    let s = "";
    for (let p = 0; p < this.R; p++) { const c = this.ring[this.slot(p)]; s += c < 0 ? "." : String.fromCharCode(64 + this.level.cells[c]); }
    return s + "|" + this.fed.join(",") + "|" + this.left.join(",") + "|" + this.where.join("") + "|" + this.docks.join(",");
  }

  /** For the level generator: a bus that wasn't there yet. */
  addMover(color, cap) {
    this.level.movers.push({ color, cap });
    this.left.push(cap); this.where.push(YARD);
    return this.level.movers.length - 1;
  }

  snapshot() {
    return {
      cells: this.cells.slice(), remaining: this.remaining, ring: this.ring.slice(), rot: this.rot, fed: this.fed.slice(),
      onRing: this.onRing.slice(), filled: this.filled, left: this.left.slice(), where: this.where.slice(),
      occ: this.occ && this.occ.slice(), docks: this.docks.slice(), driving: this.driving.map((d) => ({ ...d })),
      status: this.status, ticks: this.ticks,
    };
  }
  restore(s) {
    this.cells = s.cells.slice(); this.remaining = s.remaining; this.ring = s.ring.slice(); this.rot = s.rot; this.fed = s.fed.slice();
    this.onRing = s.onRing.slice(); this.filled = s.filled; this.left = s.left.slice(); this.where = s.where.slice();
    this.occ = s.occ && s.occ.slice(); this.docks = s.docks.slice(); this.driving = s.driving.map((d) => ({ ...d }));
    this.status = s.status; this.ticks = s.ticks;
    this.events = [];
  }
  undo() {
    if (!this.history.length) return false;
    this.restore(this.history.pop());
    return true;
  }
  clone() {
    const g = new Depot(this.level, { history: false });
    g.restore(this.snapshot());
    return g;
  }
}
