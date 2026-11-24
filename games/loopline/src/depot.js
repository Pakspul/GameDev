// Depot's rules: a crowd, a bus stop and a jammed car park. No drawing in here; shared by the game,
// the level generator, the solver and the tests.
//
// People arrive in one, two or three streams (queues). They step into a loop, a walkway with a fixed
// number of spots that keeps walking round, clockwise, one spot per tick. A stream's front person
// steps in when an empty spot passes its gate; the streams take turns (a zip), so each keeps moving.
// When the loop is full, the streams stand still.
//
// At the bottom of the loop is the stop, with a row of bays beside it. Tap a vehicle in the car park
// (it can only leave if nothing stands in the strip in front of its nose) and it drives to a free bay.
// Each tick the person at the stop gets on a parked vehicle of their own colour, if one has a seat
// left; that frees their spot in the loop for the streams. A full vehicle drives away and frees its bay.
//
// The level is lost when nothing can happen any more (no one on the loop has a vehicle, and the loop is
// full or the streams are empty) while every bay is taken. The loop keeps walking while it waits for
// you; that changes nothing, so it can be ticked or not.
//
// Powers (bought with coins in game.js): Tow takes a vehicle out of the car park whatever stands in its
// way; Magnet makes a vehicle, as it parks, take people of its colour off the loop and out of the
// streams; +1 Bay adds a bay for the rest of the level.
import { blockersOf } from "./lot.js";

export const YARD = 0, DRIVING = 1, DOCKED = 2, DONE = 4;

/** Where the gates and the stop sit, as fractions of a lap from the top middle, clockwise: one stream
 *  comes in at the top, two at the left and right, three at the left, top and right. */
export const GATES = { 1: [0], 2: [0.75, 0.25], 3: [0.75, 0, 0.25] };
export const STOP = 0.5;

export class Depot {
  /** level: { streams: [[colour]], loop, docks, transit, movers: [{ color, cap }], lot?: { cars } } */
  constructor(level, { history = true } = {}) {
    this.level = level;
    this.kind = "depot";
    this.R = level.loop;
    this.nS = level.streams.length;
    this.stop = Math.round(STOP * this.R) % this.R;
    this.gates = GATES[this.nS].map((f) => Math.round(f * this.R) % this.R);
    this.N = level.streams.reduce((a, s) => a + s.length, 0);
    this.keepHistory = history;
    this.cars = level.lot ? level.lot.cars : null;
    this.carOf = level.lot ? new Map(level.lot.cars.map((c, i) => [c.m, i])) : null;
    this.blockers = level.lot ? blockersOf(level.lot.cars) : null;
    this.draw = null; // the level generator's hook: picks the colour of a person when they step in
    this.reset();
  }

  reset() {
    const lv = this.level;
    this.remaining = this.N;                     // people not on a vehicle yet
    this.ring = new Int16Array(this.R).fill(-1); // a person per spot, or -1
    this.rot = 0;                                // the spot at position p is ring[(p - rot) mod R]
    this.fed = new Array(this.nS).fill(0);       // how many of each stream have stepped in
    this.turn = 0;                               // whose turn it is at the gates
    this.onRing = new Int16Array(16);            // people on the loop per colour
    this.filled = 0;
    this.left = lv.movers.map((m) => m.cap);
    this.where = lv.movers.map(() => YARD);
    this.magnet = lv.movers.map(() => 0);        // 1 for a vehicle sent with the Magnet power, until it parks
    this.gone = lv.streams.map((q) => new Uint8Array(q.length)); // people the Magnet took out of a stream
    this.docks = new Array(lv.docks).fill(-1);
    this.driving = [];   // [{ m, t }]: on the way to their bay
    this.status = "play";
    this.ticks = 0;
    this.events = [];
    this.history = [];
  }

  color(m) { return this.level.movers[m].color; }
  /** Person `id` is number floor(id / nS) of stream id % nS (the zip deals them out in turn). */
  personColor(id) { return this.level.streams[id % this.nS][Math.floor(id / this.nS)]; }
  /** The spot index at loop position p, and the loop position of spot i. */
  slot(p) { const R = this.R; return (((p - this.rot) % R) + R) % R; }
  posOf(i) { return (i + this.rot) % this.R; }
  freeBays() { return this.docks.filter((d) => d < 0).length; }
  get idle() { return this.status !== "play" || this.quiet(); }
  streamsLeft() { for (let j = 0; j < this.nS; j++) if (this.fed[j] < this.level.streams[j].length) return true; return false; }

  /** Nothing can happen any more until you send a vehicle. */
  quiet() {
    if (this.driving.length) return false;
    for (const m of this.docks) if (m >= 0 && this.where[m] === DOCKED && this.left[m] > 0 && this.onRing[this.color(m)] > 0) return false;
    if (this.filled < this.R && this.streamsLeft()) return false;
    return true;
  }

  /** Can vehicle m leave the car park now (ignoring whether a bay is free)? `any`: the tow truck (the
   *  Tow power) pulls it out whatever stands in its way. */
  free(m, any = false) {
    if (this.status !== "play" || this.where[m] !== YARD) return false;
    if (!this.cars || any) return true;
    return this.blockers[this.carOf.get(m)].every((j) => this.where[this.cars[j].m] !== YARD);
  }
  ready() {
    const out = [];
    for (let m = 0; m < this.where.length; m++) if (this.free(m)) out.push(m);
    return out;
  }

  /** Send vehicle m to a free bay. Returns "ok", "blocked", "full" (no free bay) or "over".
   *  Powers: { any } tows it out of the car park, { magnet } makes it take people of its colour off the
   *  loop and out of the streams as it parks; { power } names the one used, so undo can give it back. */
  launch(m, { any = false, magnet = false, power = null } = {}) {
    if (this.status !== "play") return "over";
    if (!this.free(m, any)) return "blocked";
    const towed = any && !this.free(m); // the tow truck was needed
    const d = this.docks.indexOf(-1);
    if (d < 0) return "full";
    if (this.keepHistory) { const s = this.snapshot(); s.used = power; this.history.push(s); }
    if (magnet) this.magnet[m] = 1;
    this.docks[d] = m;
    this.where[m] = DRIVING;
    this.driving.push({ m, t: this.level.transit || 1 });
    this.events.push({ type: "launch", m, dock: d, car: this.cars ? this.carOf.get(m) : -1, tow: towed });
    return "ok";
  }

  /** The next stream whose turn it is after stream j (one that still has people), or -1. */
  nextTurn(j) {
    for (let k = 1; k <= this.nS; k++) { const s = (j + k) % this.nS; if (this.fed[s] < this.level.streams[s].length) return s; }
    return -1;
  }

  tick() {
    if (this.status !== "play") return;
    const R = this.R;
    // Vehicles on their way arrive.
    for (const d of this.driving) if (--d.t <= 0) { this.where[d.m] = DOCKED; this.events.push({ type: "dock", m: d.m, dock: this.docks.indexOf(d.m) }); }
    this.driving = this.driving.filter((d) => d.t > 0);
    for (let m = 0; m < this.magnet.length; m++) if (this.magnet[m] && this.where[m] === DOCKED) this.pull(m);
    // The loop walks one spot.
    this.rot = (this.rot + 1) % R;
    // The person at the stop gets on a vehicle of their colour.
    const si = this.slot(this.stop), id = this.ring[si];
    if (id >= 0) {
      const c = this.personColor(id);
      for (let d = 0; d < this.docks.length; d++) {
        const m = this.docks[d];
        if (m < 0 || this.where[m] !== DOCKED || this.left[m] === 0 || this.color(m) !== c) continue;
        this.ring[si] = -1; this.onRing[c]--; this.filled--; this.remaining--;
        this.left[m]--;
        this.events.push({ type: "board", m, id, dock: d });
        if (this.left[m] === 0) { this.docks[d] = -1; this.where[m] = DONE; this.events.push({ type: "depart", m, dock: d }); }
        break;
      }
    }
    // The front person of the stream whose turn it is steps in, if an empty spot passes their gate.
    for (let j = 0; j < this.nS; j++) {
      if (j !== this.turn) continue;
      const i = this.slot(this.gates[j]);
      if (this.ring[i] >= 0) continue;
      const k = this.fed[j]++, id = k * this.nS + j;
      this.skipGone(j);
      if (!this.level.streams[j][k] && this.draw) this.level.streams[j][k] = this.draw(j, k);
      const c = this.level.streams[j][k];
      this.ring[i] = id; this.onRing[c]++; this.filled++;
      this.turn = this.nextTurn(j);
      this.events.push({ type: "enter", id, stream: j, tray: i });
    }
    this.ticks++;
    if (this.remaining === 0) { this.status = "won"; this.events.push({ type: "won" }); return; }
    if (this.freeBays() === 0 && this.quiet()) { this.status = "lost"; this.events.push({ type: "lost", why: "docks" }); }
  }

  /** The Magnet power: a vehicle that just parked takes every person of its colour it has seats for: off
   *  the loop first (those nearest the stop first), then out of the streams (the next to step in first). */
  pull(m) {
    this.magnet[m] = 0;
    const c = this.color(m), d = this.docks.indexOf(m), R = this.R;
    for (let k = 0; k < R && this.left[m] > 0; k++) {
      const i = this.slot(this.stop - k), id = this.ring[i];
      if (id < 0 || this.personColor(id) !== c) continue;
      this.ring[i] = -1; this.onRing[c]--; this.filled--; this.remaining--; this.left[m]--;
      this.events.push({ type: "board", m, id, dock: d, spot: i });
    }
    const lists = this.level.streams, deep = Math.max(...lists.map((q) => q.length));
    for (let k = 0; k < deep && this.left[m] > 0; k++) {
      for (let t = 0; t < this.nS && this.left[m] > 0; t++) {
        const j = (Math.max(0, this.turn) + t) % this.nS, i = this.fed[j] + k;
        if (i >= lists[j].length || this.gone[j][i] || lists[j][i] !== c) continue;
        // `queue`: how many still stand in front of them (for drawing where they came from).
        let queue = 0;
        for (let x = this.fed[j]; x < i; x++) if (!this.gone[j][x]) queue++;
        this.gone[j][i] = 1; this.remaining--; this.left[m]--;
        this.events.push({ type: "board", m, id: i * this.nS + j, dock: d, stream: j, queue });
      }
    }
    for (let j = 0; j < this.nS; j++) this.skipGone(j);
    if (this.turn >= 0 && this.fed[this.turn] >= lists[this.turn].length) this.turn = this.nextTurn(this.turn);
    if (this.left[m] === 0) { this.docks[d] = -1; this.where[m] = DONE; this.events.push({ type: "depart", m, dock: d }); }
  }
  /** A stream's queue passes over people the Magnet already took. */
  skipGone(j) {
    const q = this.level.streams[j], gone = this.gone[j];
    while (this.fed[j] < q.length && gone[this.fed[j]]) this.fed[j]++;
  }
  /** How many still wait in stream j. */
  waiting(j) {
    let n = 0;
    for (let i = this.fed[j]; i < this.level.streams[j].length; i++) if (!this.gone[j][i]) n++;
    return n;
  }
  /** The Extra bay power: one more bay for the rest of this level (undo keeps it). */
  addBay() {
    this.docks.push(-1);
    for (const s of this.history) s.docks.push(-1);
  }

  settle(max = 200000) { let n = 0; while (!this.idle && n++ < max) this.tick(); }
  /** Depot never gets stuck without losing: with a free bay there is always a vehicle that can leave. */
  stuck() { return false; }

  /** Can this level no longer be lost? Seats per colour always equal the people of that colour still
   *  to ride, so a vehicle with seats left always has people of its colour somewhere. Sure when:
   *  - nobody waits in a stream any more: everyone left walks the loop, so every vehicle you could send
   *    fills up within a lap or so, and a full yard of bays always empties again; or
   *  - every vehicle left fits in the bays: send them all and everyone has a ride of their colour.
   *  With a free bay there is always a vehicle that can leave the car park (it was parked that way). */
  sureWin() {
    if (this.status !== "play") return false;
    let open = 0;
    for (const w of this.where) if (w !== DONE) open++;
    return open > 0 && (!this.streamsLeft() || open <= this.docks.length);
  }

  /** One step of playing a sure win out: fill every free bay with a vehicle that can leave, the colour
   *  with the most people on the loop who have no seat waiting for them first. (game.js runs this
   *  before every tick to show a sure win finishing.) */
  sendAll() {
    while (this.status === "play" && this.freeBays() > 0) {
      const want = Array.from(this.onRing);
      for (let m = 0; m < this.where.length; m++) if (this.where[m] === DRIVING || this.where[m] === DOCKED) want[this.color(m)] -= this.left[m];
      let best = -1;
      for (let m = 0; m < this.where.length; m++) if (this.free(m) && (best < 0 || want[this.color(m)] > want[this.color(best)])) best = m;
      if (best < 0 || this.launch(best) !== "ok") return;
    }
  }
  /** Finish the level with sendAll() before every tick (no history, no undo). For a sure win, on a
   *  copy: returns true if it won. */
  playOut(maxTicks = 400000) {
    for (let t = 0; this.status === "play" && t < maxTicks; t++) { this.sendAll(); this.tick(); this.events.length = 0; }
    this.events.length = 0;
    return this.status === "won";
  }

  /** For the solver: the position as text. Only how many of each colour walk the loop matters, not
   *  where they walk: everyone on the loop passes the stop within a lap. */
  key() {
    return Array.from(this.onRing).join(",") + "|" + this.fed.join(",") + "|" + this.turn + "|" + this.remaining + "|" + this.left.join(",") + "|" + this.where.join("") + "|" + this.docks.join(",");
  }

  /** For the level generator: a vehicle that wasn't there yet. */
  addMover(color, cap) {
    this.level.movers.push({ color, cap });
    this.left.push(cap); this.where.push(YARD); this.magnet.push(0);
    return this.level.movers.length - 1;
  }

  snapshot() {
    return {
      remaining: this.remaining, ring: this.ring.slice(), rot: this.rot, fed: this.fed.slice(), turn: this.turn,
      onRing: this.onRing.slice(), filled: this.filled, left: this.left.slice(), where: this.where.slice(),
      magnet: this.magnet.slice(), gone: this.gone.map((q) => q.slice()),
      docks: this.docks.slice(), driving: this.driving.map((d) => ({ ...d })), status: this.status, ticks: this.ticks,
    };
  }
  restore(s) {
    this.remaining = s.remaining; this.ring = s.ring.slice(); this.rot = s.rot; this.fed = s.fed.slice(); this.turn = s.turn;
    this.onRing = s.onRing.slice(); this.filled = s.filled; this.left = s.left.slice(); this.where = s.where.slice();
    this.magnet = s.magnet.slice(); this.gone = s.gone.map((q) => q.slice());
    this.docks = s.docks.slice(); this.driving = s.driving.map((d) => ({ ...d })); this.status = s.status; this.ticks = s.ticks;
    this.events = [];
  }
  undo() {
    if (!this.history.length) return false;
    const s = this.history.pop();
    this.restore(s);
    this.undone = s.used || null;
    return true;
  }
  clone() {
    const g = new Depot(this.level, { history: false });
    g.restore(this.snapshot());
    g.draw = this.draw;
    return g;
  }
}
