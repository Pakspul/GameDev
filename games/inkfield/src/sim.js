// The rules of Inkfield, with no rendering: a grid of cells, players moving freely over it, trails
// and captures. Runs the same in the browser and in Node (tests/inkfield).
//
// The board is N × N cells. owner[i] is the player who owns cell i (0 = nobody), trail[i] the
// player whose trail runs over it (0 = none). Positions are in cells: x to the right, y down,
// a heading of 0 points right and π/2 points down.
//
// The rules, per step:
//   - every player turns towards p.target (at most turnRate) and moves `speed` forward
//   - each cell the head enters (4-connected, so trails never have diagonal gaps):
//       someone else's trail      → that player is cut and out
//       your own (older) trail    → you are out
//       your own land, with trail → the loop closes: the trail and everything it encloses is yours
//       anything else             → your trail grows
//   - two heads that touch while one is on its own land: the other one is out
//   - a player whose last cell of land is taken is out
// Whoever is out loses all their land and trail. The last one left wins.
import { CONFIG } from "./config.js";
import { Rng } from "./rng.js";

export class World {
  /**
   * @param {object} o
   * @param {number} o.seed
   * @param {number} o.players    how many players (ids 1..players)
   * @param {string[]} [o.names]
   * @param {object} [o.config]   overrides for CONFIG (tests)
   */
  constructor(o) {
    const C = (this.C = { ...CONFIG, ...(o.config || {}) });
    const N = (this.N = C.N);
    this.rng = new Rng(o.seed);
    this.owner = new Uint8Array(N * N);
    this.trail = new Uint8Array(N * N);
    this.trailSeq = new Int32Array(N * N);
    this.stamp = new Uint32Array(N * N); // flood-fill visit marks
    this.gen = 0;
    this.queue = new Int32Array(N * N);
    this.time = 0;
    this.tick = 0;
    this.events = [];   // read and cleared by whoever draws or plays sounds
    this.dirty = null;  // cells whose owner changed since the last draw: {x0, y0, x1, y1}
    this.players = [null];
    const names = o.names || [];
    for (let id = 1; id <= o.players; id++) {
      this.players.push({
        id, name: names[id - 1] || "P" + id, alive: true,
        x: 0, y: 0, angle: 0, target: 0,
        cell: -1, inHome: true, seq: 0,
        trailCells: [], path: [], pathVersion: 0, trailStart: null,
        area: 0, maxArea: 0, kills: 0, killedBy: 0, how: null, diedAt: 0,
        bbox: { x0: N, y0: N, x1: -1, y1: -1 },
      });
    }
    this.spawnAll();
  }

  get alive() { return this.players.filter((p) => p && p.alive); }
  idx(x, y) { return y * this.N + x; }

  // ---- Start ----------------------------------------------------------------------------------------------
  spawnAll() {
    const { N, C, rng } = this;
    const placed = [];
    const m = C.spawnMargin;
    for (let id = 1; id < this.players.length; id++) {
      let best = null, bestD = -1;
      // Pick the spot farthest from everyone already placed, out of a few random tries.
      for (let k = 0; k < 40; k++) {
        const x = rng.range(m, N - m), y = rng.range(m, N - m);
        let d = Infinity;
        for (const q of placed) d = Math.min(d, Math.hypot(q.x - x, q.y - y));
        if (d > bestD) { bestD = d; best = { x, y }; }
        if (d > N * 0.32) break;
      }
      placed.push(best);
      this.spawn(this.players[id], best.x, best.y, rng.range(-Math.PI, Math.PI));
    }
  }

  spawn(p, x, y, angle) {
    const { N, C } = this;
    p.x = Math.floor(x) + 0.5; p.y = Math.floor(y) + 0.5;
    p.angle = p.target = angle;
    const r = C.startRadius, r2 = r * r;
    for (let cy = Math.floor(p.y - r); cy <= p.y + r; cy++)
      for (let cx = Math.floor(p.x - r); cx <= p.x + r; cx++) {
        if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
        const dx = cx + 0.5 - p.x, dy = cy + 0.5 - p.y;
        if (dx * dx + dy * dy <= r2) this.setOwner(this.idx(cx, cy), p.id);
      }
    p.cell = this.idx(Math.floor(p.x), Math.floor(p.y));
    p.inHome = true;
  }

  setOwner(i, id) {
    const old = this.owner[i];
    if (old === id) return;
    if (old) this.players[old].area--;
    this.owner[i] = id;
    if (id) {
      const p = this.players[id];
      p.area++;
      if (p.area > p.maxArea) p.maxArea = p.area;
      const x = i % this.N, y = (i / this.N) | 0, b = p.bbox;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    }
    this.markDirty(i % this.N, (i / this.N) | 0);
  }

  markDirty(x, y) {
    const d = this.dirty;
    if (!d) this.dirty = { x0: x, y0: y, x1: x, y1: y };
    else {
      if (x < d.x0) d.x0 = x; if (x > d.x1) d.x1 = x;
      if (y < d.y0) d.y0 = y; if (y > d.y1) d.y1 = y;
    }
  }

  // ---- One fixed step ---------------------------------------------------------------------------------------
  step(dt = 1 / this.C.hz) {
    const { C, N } = this;
    this.time += dt;
    this.tick++;
    const maxTurn = C.turnRate * dt;
    const lo = 0.5, hi = N - 0.5;
    for (let id = 1; id < this.players.length; id++) {
      const p = this.players[id];
      if (!p.alive) continue;
      // Turn towards the target heading, then move.
      let d = p.target - p.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.angle += Math.max(-maxTurn, Math.min(maxTurn, d));
      let nx = p.x + Math.cos(p.angle) * C.speed * dt;
      let ny = p.y + Math.sin(p.angle) * C.speed * dt;
      // The edge: slide along it.
      if (nx < lo) nx = lo; else if (nx > hi) nx = hi;
      if (ny < lo) ny = lo; else if (ny > hi) ny = hi;
      p.x = nx; p.y = ny;
      this.moveHead(p);
      if (p.alive && p.trailCells.length) this.addPathPoint(p);
    }
    if (this.C.headOn) this.headOn();
  }

  /** Walk the head from its old cell to its new one, one 4-connected cell at a time. */
  moveHead(p) {
    const N = this.N;
    const cx = Math.floor(p.x), cy = Math.floor(p.y);
    const target = cx + cy * N;
    let guard = 4;
    while (p.cell !== target && p.alive && guard-- > 0) {
      const ox = p.cell % N, oy = (p.cell / N) | 0;
      const sx = Math.sign(cx - ox), sy = Math.sign(cy - oy);
      // Diagonal: go through the side cell first, so the trail stays 4-connected.
      let nx = ox, ny = oy;
      if (sx && sy) {
        // Through whichever side cell the head passed closer to.
        const fx = p.x - (ox + 0.5), fy = p.y - (oy + 0.5);
        if (Math.abs(fx) >= Math.abs(fy)) nx += sx; else ny += sy;
      } else { nx += sx; ny += sy; }
      this.enterCell(p, nx + ny * N);
    }
    if (p.alive) p.inHome = this.owner[p.cell] === p.id;
  }

  enterCell(p, i) {
    p.cell = i;
    const t = this.trail[i];
    if (t && t !== p.id) {
      this.kill(this.players[t], p, "cut");
    } else if (t === p.id && this.trailSeq[i] < p.seq - this.C.selfGrace) {
      this.kill(p, p, "self");
      return;
    }
    if (this.owner[i] === p.id) {
      if (p.trailCells.length) this.capture(p);
      return;
    }
    if (t === p.id) return; // a recent trail cell, walked over again at a corner
    if (!p.trailCells.length) {
      p.trailStart = { x: p.x, y: p.y };
      p.path.length = 0;
      p.pathVersion++;
      // The trail starts at the edge of the land the head just left.
      p.path.push({ x: p.x - Math.cos(p.angle) * 0.6, y: p.y - Math.sin(p.angle) * 0.6 });
    }
    this.trail[i] = p.id;
    this.trailSeq[i] = ++p.seq;
    p.trailCells.push(i);
  }

  addPathPoint(p) {
    const last = p.path[p.path.length - 1];
    const dx = p.x - last.x, dy = p.y - last.y;
    if (dx * dx + dy * dy >= 0.35 * 0.35) p.path.push({ x: p.x, y: p.y });
  }

  clearTrail(p) {
    for (const i of p.trailCells) if (this.trail[i] === p.id) this.trail[i] = 0;
    p.trailCells.length = 0;
    p.path.length = 0;
    p.pathVersion++;
    p.trailStart = null;
  }

  // ---- Capture: the loop closed ----------------------------------------------------------------------------
  capture(p) {
    const { N, owner } = this;
    const before = p.area;
    for (const i of p.trailCells) {
      if (this.trail[i] === p.id) this.trail[i] = 0;
      this.setOwner(i, p.id);
    }
    p.trailCells.length = 0;
    p.path.length = 0;
    p.pathVersion++;
    p.trailStart = null;

    // Flood the area around p's land from its border: whatever the flood can't reach is enclosed.
    const b = p.bbox;
    const x0 = Math.max(0, b.x0 - 1), y0 = Math.max(0, b.y0 - 1);
    const x1 = Math.min(N - 1, b.x1 + 1), y1 = Math.min(N - 1, b.y1 + 1);
    const g = ++this.gen;
    const { stamp, queue } = this;
    let head = 0, tail = 0;
    const seed = (x, y) => {
      const i = x + y * N;
      if (owner[i] !== p.id && stamp[i] !== g) { stamp[i] = g; queue[tail++] = i; }
    };
    for (let x = x0; x <= x1; x++) { seed(x, y0); seed(x, y1); }
    for (let y = y0; y <= y1; y++) { seed(x0, y); seed(x1, y); }
    while (head < tail) {
      const i = queue[head++];
      const x = i % N, y = (i / N) | 0;
      if (x > x0) seed(x - 1, y);
      if (x < x1) seed(x + 1, y);
      if (y > y0) seed(x, y - 1);
      if (y < y1) seed(x, y + 1);
    }
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = x + y * N;
        if (owner[i] !== p.id && stamp[i] !== g) this.setOwner(i, p.id);
      }

    this.events.push({ type: "capture", id: p.id, gained: p.area - before });
    // Anyone whose last land was just taken is out.
    for (let id = 1; id < this.players.length; id++) {
      const q = this.players[id];
      if (q.alive && q !== p && q.area <= 0) this.kill(q, p, "land");
    }
  }

  // ---- Out ---------------------------------------------------------------------------------------------------
  kill(victim, killer, how) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.how = how;
    victim.killedBy = killer ? killer.id : 0;
    victim.diedAt = this.time;
    if (killer && killer !== victim) killer.kills++;
    this.clearTrail(victim);
    const b = victim.bbox;
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const i = x + y * this.N;
        if (this.owner[i] === victim.id) this.setOwner(i, 0);
      }
    victim.area = 0;
    this.events.push({ type: "out", id: victim.id, by: victim.killedBy, how });
  }

  headOn() {
    const r = this.C.headRadius * 2;
    const ps = this.players;
    for (let a = 1; a < ps.length; a++) {
      const p = ps[a];
      if (!p.alive) continue;
      for (let b = a + 1; b < ps.length; b++) {
        const q = ps[b];
        if (!q.alive || !p.alive) continue;
        const dx = p.x - q.x, dy = p.y - q.y;
        if (dx * dx + dy * dy > r * r) continue;
        // On your own land you're safe and the other one is out. Out in the open, nothing
        // happens: whoever then crosses the other's trail first cuts it.
        if (p.inHome && !q.inHome) this.kill(q, p, "head");
        else if (q.inHome && !p.inHome) this.kill(p, q, "head");
      }
    }
  }

  /** Share of the board, 0..1. */
  share(p) { return p.area / (this.N * this.N); }

  /** The match is over when at most one player is left. Returns the winner, null for nobody, or undefined while it runs. */
  winner() {
    const left = this.alive;
    if (left.length > 1) return undefined;
    return left[0] || null;
  }
}
