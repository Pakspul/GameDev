// One game of Bubbleworks: the board, the launcher, the tray of powers and the rules of the mode.
// Knows nothing about the screen or the clock: fire() works out where a shot goes (at once), the app
// animates the flight, then land() applies it. What happened is reported in `events`.
//
// Modes: "classic" (clear the screen, the ceiling drops after shots that pop nothing, endless stages),
// "endless" (a new row pushes in every few shots) and "levels" (a goal and a shot budget; the daily
// level is a "levels" game too).
import { CONFIG, stepTable } from "./config.js";
import { Grid, trace, resolve, randomRow, STONE } from "./grid.js";
import { rng } from "./rng.js";

const { RH } = CONFIG;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  /**
   * @param {object} o
   *   mode: "classic" | "endless" | "levels"
   *   grid: the starting board (a Grid); colours: how many colours this board may deal
   *   seed: the deal (and Endless' new rows)
   *   levels: shots (the budget), goal ({ type: "top" } | { type: "rescue", n } | { type: "collect", colour, n })
   *   classic: stage (1 for a new run), nextStage(stage) → { grid, colours } for the stage after
   */
  constructor(o) {
    this.mode = o.mode;
    this.grid = o.grid;
    this.colourCount = o.colours;
    this.rand = rng(o.seed);
    this.events = [];
    this.status = "play";       // play | stage (Classic: between stages) | won | lost
    this.score = 0;
    this.combo = 0;             // shots in a row that popped something
    this.shots = 0;             // coloured shots fired (powers are free)
    this.tray = [];             // collected powers, at most CONFIG.powers.slots
    this.armed = -1;            // the tray slot that goes out with the next shot, or -1
    this.freeze = 0;            // shots left before the ceiling or the push moves again
    this.flight = null;         // the shot in the air: { shot, tr, angle }
    this.ceil = 0;              // Classic: rows the ceiling has come down
    this.scroll = 0;            // Levels: rows scrolled up out of view
    // Classic
    this.stage = o.stage || 1;
    this.nextStage = o.nextStage || null;
    this.misses = 0;
    // Endless
    this.pushed = 0;
    this.pushIn = CONFIG.endless.pushFirst;
    // Levels
    this.budget = o.shots ?? Infinity;
    this.shotsLeft = this.budget;
    this.goal = o.goal ? { ...o.goal, have: 0 } : null;
    if (this.goal && this.goal.type === "rescue") this.goal.n = this.grid.all().filter(([, , b]) => b.crit).length;
    this.lost = "";             // why the game ended: "line" | "shots"
    this.current = this.deal();
    this.next = this.deal();
    this.updateScroll();
  }

  // ---- Where things are ---------------------------------------------------------------------------------
  /** Field y = grid y + offset (the ceiling's drop minus the Levels scroll). */
  get offset() { return (this.ceil - this.scroll) * RH; }
  /** The launcher, in grid space. */
  launcher() { return { x: CONFIG.width / 2, y: CONFIG.launchY - this.offset }; }
  /** The lowest bubble's row on screen (-1 when the board is empty). */
  lowestOnScreen() { const l = this.grid.lowest(); return l < 0 ? -1 : l + this.ceil - this.scroll; }
  /** Rows between the lowest bubble and the line (Classic and Endless). */
  room() { return CONFIG.lineRow - 1 - this.lowestOnScreen(); }
  /** Classic: shots that pop nothing before the ceiling drops. Endless: shots before the next row. */
  shotsToMove() {
    if (this.mode === "classic") return this.missLimit() - this.misses;
    if (this.mode === "endless") return this.pushIn;
    return Infinity;
  }
  missLimit() { return stepTable(CONFIG.classic.missesPerDrop, this.stage); }
  pushEvery() { const e = CONFIG.endless; return Math.max(e.pushMin, e.pushFirst - Math.floor(this.pushed / e.pushFaster)); }
  armedPower() { return this.armed >= 0 ? this.tray[this.armed] : null; }

  // ---- Dealing ------------------------------------------------------------------------------------------
  /** A colour that is still on the board (any colour of this board when none is). */
  deal() {
    const have = [...this.grid.colours().keys()].sort((a, b) => a - b);
    if (!have.length) return this.rand.int(this.colourCount);
    return have[this.rand.int(have.length)];
  }
  /** After a shot: a colour that's gone from the board is never dealt again. */
  refresh() {
    const have = this.grid.colours();
    if (!have.size) return;
    if (!have.has(this.current)) this.current = this.deal();
    if (!have.has(this.next)) this.next = this.deal();
  }

  // ---- What the player does ----------------------------------------------------------------------------
  /** The path a shot at `angle` would take, in grid space (the aim line uses exactly this). */
  aim(angle) {
    const L = this.launcher();
    return trace(this.grid, L.x, L.y, clamp(angle, -CONFIG.maxAngle, CONFIG.maxAngle), this.armedPower() === "comet");
  }
  swap() {
    if (this.status !== "play" || this.flight || this.armed >= 0) return false;
    [this.current, this.next] = [this.next, this.current];
    this.events.push({ type: "swap" });
    return true;
  }
  /** Tap a tray slot: load that power for the next shot (tap again to unload). Freeze works at once. */
  arm(i) {
    if (this.status !== "play" || this.flight || i < 0 || i >= this.tray.length) return false;
    if (this.tray[i] === "freeze") {
      this.tray.splice(i, 1);
      if (this.armed === i) this.armed = -1; else if (this.armed > i) this.armed--;
      this.freeze = CONFIG.powers.freezeShots;
      this.events.push({ type: "freeze" });
      return true;
    }
    this.armed = this.armed === i ? -1 : i;
    this.events.push({ type: "arm", p: this.armedPower() });
    return true;
  }
  /** Fire at `angle`. Returns the flight ({ shot, tr, angle }); call land() when it has been shown. */
  fire(angle) {
    if (this.status !== "play" || this.flight) return null;
    angle = clamp(angle, -CONFIG.maxAngle, CONFIG.maxAngle);
    const p = this.armedPower();
    const tr = this.aim(angle);
    const shot = p ? { p } : { c: this.current };
    if (p) { this.tray.splice(this.armed, 1); this.armed = -1; }
    this.flight = { shot, tr, angle };
    this.events.push({ type: "fire", shot });
    return this.flight;
  }

  /** The shot in the air lands: stick, pop, drop, collect, then the mode's rules. */
  land() {
    const f = this.flight;
    if (!f) return null;
    this.flight = null;
    const g = this.grid, off = this.offset;
    const out = resolve(g, f.tr, f.shot);
    const power = f.shot.p || null;
    const removed = out.popped.length + out.dropped.length;
    const S = CONFIG.score;

    // Score: pops and drops, more for every shot in a row that pops something.
    if (out.popped.length) this.combo++; else this.combo = 0;
    const mult = 1 + Math.min(S.comboMax, Math.max(0, this.combo - 1) * S.comboStep);
    const points = Math.round((out.popped.length * S.pop + out.dropped.length * S.drop) * mult);
    this.score += points;

    const at = (q) => ({ ...q, y: q.y + off });
    this.events.push({ type: "land", shot: f.shot, placed: out.placed, x: out.at[0], y: out.at[1] + off, colour: out.colour });
    if (out.popped.length) this.events.push({ type: "pop", list: out.popped.map(at), power, combo: this.combo });
    if (out.dropped.length) this.events.push({ type: "drop", list: out.dropped.map(at) });
    if (out.thawed.length) this.events.push({ type: "thaw", cells: out.thawed });
    if (points) this.events.push({ type: "points", points, x: out.at[0], y: out.at[1] + off });

    // What came off the board: powers to the tray, rescued creatures, the colour to collect.
    for (const q of [...out.popped, ...out.dropped]) {
      if (q.b.p) {
        const room = this.tray.length < CONFIG.powers.slots;
        if (room) this.tray.push(q.b.p);
        this.events.push({ type: "power", p: q.b.p, x: q.x, y: q.y + off, kept: room });
      }
      if (q.b.crit) {
        if (this.goal && this.goal.type === "rescue") this.goal.have++;
        this.events.push({ type: "free", x: q.x, y: q.y + off });
      }
      if (this.goal && this.goal.type === "collect" && q.b.k !== STONE && q.b.c === this.goal.colour) this.goal.have++;
    }
    // A big drop earns a random power (Classic and Endless; levels place theirs by hand).
    if (this.mode !== "levels" && out.dropped.length >= CONFIG.powers.bigDrop && this.tray.length < CONFIG.powers.slots) {
      const p = this.rand.weighted(CONFIG.powers.weights);
      this.tray.push(p);
      this.events.push({ type: "power", p, x: out.at[0], y: out.at[1] + off, kept: true, bonus: true });
    }

    if (!power) { this.shots++; this.current = this.next; this.next = this.deal(); }
    this.refresh();

    if (this.mode === "classic") this.classicRules(power, removed);
    else if (this.mode === "endless") this.endlessRules(power, removed);
    else this.levelRules(power);
    this.updateScroll();
    return out;
  }

  classicRules(power, removed) {
    if (!this.grid.count()) {
      // Stage clear: a bonus for every shot left before the ceiling would have dropped.
      const bonus = CONFIG.score.stageClear + CONFIG.score.shotLeft * (this.missLimit() - this.misses);
      this.score += bonus;
      this.status = "stage";
      this.events.push({ type: "stage", stage: this.stage, bonus });
      return;
    }
    if (!power) {
      if (this.freeze > 0) this.freeze--;
      else if (!removed && ++this.misses >= this.missLimit()) {
        this.misses = 0;
        this.ceil++;
        this.events.push({ type: "ceiling", ceil: this.ceil });
      }
    }
    this.checkLine();
  }

  /** Classic: on to the next stage (the tray and the score stay). */
  advance() {
    if (this.status !== "stage" || !this.nextStage) return;
    this.stage++;
    const s = this.nextStage(this.stage);
    this.grid = s.grid;
    this.colourCount = s.colours;
    this.ceil = 0; this.misses = 0; this.freeze = 0; this.combo = 0;
    this.status = "play";
    this.current = this.deal(); this.next = this.deal();
    this.events.push({ type: "newStage", stage: this.stage });
  }

  endlessRules(power, removed) {
    if (!power) {
      if (this.freeze > 0) this.freeze--;
      else if (removed < CONFIG.endless.bigClear) this.pushIn--; // a big clear holds the next row back a shot
      if (this.pushIn <= 0) this.pushRow();
    }
    this.checkLine();
  }
  pushRow() {
    const E = CONFIG.endless;
    this.grid.pushTop(randomRow(this.grid, this.rand, this.endlessColours(), E.powerChance, CONFIG.powers.weights));
    this.pushed++;
    this.pushIn = this.pushEvery();
    this.events.push({ type: "push", pushed: this.pushed });
  }
  endlessColours() { return Math.max(this.colourCount, stepTable(CONFIG.endless.colours, this.pushed)); }

  levelRules(power) {
    if (!power) this.shotsLeft--;
    if (this.goalDone()) {
      const bonus = CONFIG.score.shotLeft * Math.max(0, this.shotsLeft);
      this.score += bonus;
      this.status = "won";
      this.events.push({ type: "won", bonus });
    } else if (this.shotsLeft <= 0) {
      this.status = "lost";
      this.lost = "shots";
      this.events.push({ type: "lost", why: "shots" });
    }
  }
  goalDone() {
    const G = this.goal;
    if (!G || G.type === "top") return this.grid.count() === 0;
    return G.have >= G.n;
  }
  /** Stars for a cleared level, by the share of the budget used. */
  stars() {
    const used = (this.budget - this.shotsLeft) / this.budget, [three, two] = CONFIG.levels.stars;
    return used <= three ? 3 : used <= two ? 2 : 1;
  }
  /** The "+5 shots" help: more shots, and a level that ran out goes on. */
  addShots(n) {
    this.shotsLeft += n;
    if (this.status === "lost" && this.lost === "shots") { this.status = "play"; this.lost = ""; }
  }

  checkLine() {
    if (this.status === "play" && this.lowestOnScreen() >= CONFIG.lineRow) {
      this.status = "lost";
      this.lost = "line";
      this.events.push({ type: "lost", why: "line" });
    }
  }
  /** Levels: scroll so the lowest bubbles sit near the launcher, but never so far that the highest gap a
   *  shot can reach (through empty cells from below) is out of view. */
  updateScroll() {
    const prev = this.scroll;
    if (this.mode !== "levels") this.scroll = 0;
    else {
      const g = this.grid, low = g.lowest();
      let want = Math.max(0, low - CONFIG.viewLow);
      if (want > 0) {
        // Flood the empty cells from the open space under the board.
        const seen = new Set(), queue = [];
        for (let c = 0; c < g.width(low + 1); c++) { seen.add((low + 1) * 16 + c); queue.push([low + 1, c]); }
        let top = low + 1;
        for (let i = 0; i < queue.length; i++) {
          const [r, c] = queue[i];
          if (r < top) top = r;
          for (const [a, b] of g.neighbours(r, c)) {
            const k = a * 16 + b;
            if (a <= low + 1 && !seen.has(k) && !g.get(a, b)) { seen.add(k); queue.push([a, b]); }
          }
        }
        want = Math.max(Math.min(want, top - 1), low - (CONFIG.lineRow - 2), 0);
      }
      this.scroll = want;
    }
    if (this.scroll !== prev) this.events.push({ type: "scroll", from: prev, to: this.scroll });
  }
}

export { Grid };
