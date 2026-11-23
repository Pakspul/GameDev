// Orbit's rules: Critters in 3D. A voxel sculpture (w × h × d blocks) stands inside the loop. The loop
// runs round its footprint (w × d) exactly like Critters' track round a picture. At each step along a
// side a critter looks straight in on every layer at once, bottom to top: on each layer, if the first
// block it sees has its colour (empty cells are looked past), it pops it, while it has pops left. So it
// peels the side it is passing, and what is behind or inside shows up for later.
//
// Everything else (lanes, buddies, bays, the loop, losing, stuck, undo) is Critters' (engine.js).
import { Game, makeTrack } from "./engine.js";

/** On one layer (cells from `off`), what a critter of `color` takes looking along `line`. */
export function takeAlong3(cells, line, off, color) {
  for (let i = 0; i < line.length; i++) {
    const v = cells[off + line[i]];
    if (v === 0) continue;
    if (v !== color) return -1;
    cells[off + line[i]] = 0;
    return off + line[i];
  }
  return -1;
}

/** Like takeAlong3 for a zapping critter (the Laser power): the first block of its own colour. */
export function takeColour3(cells, line, off, color) {
  for (let i = 0; i < line.length; i++) {
    if (cells[off + line[i]] !== color) continue;
    cells[off + line[i]] = 0;
    return off + line[i];
  }
  return -1;
}

/** What one step takes on every layer (up to `room`), bottom to top. Changes `cells`. */
export function look3(cells, line, layers, plane, color, room, out, zap = false) {
  let n = 0;
  const take = zap ? takeColour3 : takeAlong3;
  for (let y = 0; y < layers && n < room; y++) {
    const got = take(cells, line, y * plane, color);
    if (got >= 0) { n++; if (out) out.push(got); }
  }
  return n;
}

/** One lap of a lone critter: how many blocks it would take. Changes `cells`. */
export function lap3(cells, track, layers, plane, color, room) {
  let n = 0;
  for (const t of track) if (t.line && n < room) n += look3(cells, t.line, layers, plane, color, room - n);
  return n;
}

export class Orbit extends Game {
  /** level: { w, h, d, cells, movers, lanes, bays, belt?, spacing? }; h is the height. */
  constructor(level, opts) {
    super({ ...level, h: level.d }, opts); // Critters' track runs round the footprint, w × d
    this.level = level;
    this.kind = "orbit";
    this.h = level.h; this.d = level.d;
    this.plane = level.w * level.d;
    this.track = makeTrack(level.w, level.d);
    this.L = this.track.length;
    this.reset();
  }

  tick() {
    if (this.status === "lost") return;
    const got = [];
    for (const b of this.belt) {
      b.pos++;
      if (b.pos >= this.L) continue;
      const t = this.track[b.pos];
      if (!t.line || this.left[b.m] === 0) continue;
      got.length = 0;
      const n = look3(this.cells, t.line, this.h, this.plane, this.color(b.m), this.left[b.m], got, this.zap[b.m] === 1);
      if (!n) continue;
      this.left[b.m] -= n;
      this.remaining -= n;
      for (const cell of got) this.events.push({ type: "take", m: b.m, cell, pos: b.pos });
    }
    while (this.belt.length && this.belt[0].pos >= this.L) this.arrive(this.belt.shift().m);
    if (this.status === "lost") return;
    this.enter();
    this.ticks++;
    if (this.remaining === 0 && this.status === "play") { this.status = "won"; this.events.push({ type: "won" }); }
  }

  /** How many a critter of `color` with `room` would take in one lap from here, alone. */
  lapFrom(color, room) { return lap3(this.cells.slice(), this.track, this.h, this.plane, color, room); }

  clone() {
    const g = new Orbit(this.level, { history: false });
    g.restore(this.snapshot());
    return g;
  }
}
