// The reels (REEL-02/03/04, FEEL-01/02, FAIR-05): a belt per reel that scrolls the machine's real
// reel strip. When a reel stops, the symbols around the window are the real neighbours on that strip;
// nothing is swapped or inserted to suggest a near win.
//
// The reels never decide anything. They receive an outcome from the Session and animate it.
import { h, mod, lerp, ease, tween, sleep, timing, symbolSvg } from "./dom.js";
import { formatCompact } from "../core/format.js";

const SPEED = 24; // rows per second while spinning

export class Reels {
  /**
   * @param root the element to build into
   * @param prep prepared machine config
   * @param env { audio, haptics, fx, t (translate), locale }
   */
  constructor(root, prep, env) {
    this.root = root; this.prep = prep; this.cfg = prep.cfg; this.env = env;
    this.reels = prep.reels; this.rows = prep.rows;
    this.pos = new Array(this.reels).fill(0);
    this.mode = new Array(this.reels).fill("idle"); // idle | spin | land
    this.static = new Array(this.reels).fill(false); // true: cells hold explicit symbols, not the strip
    this.stripSet = "base";
    this.cell = 80;
    this.slam = false;
    this.raf = 0;
    this.sticky = {};
    this.build();
  }

  get strips() { return this.prep.strips[this.stripSet]; }

  build() {
    this.root.innerHTML = "";
    this.reelEls = []; this.cells = [];
    const strip = h("div", { class: "reel-strip" });
    for (let r = 0; r < this.reels; r++) {
      const belt = h("div", { class: "belt" });
      const cells = [];
      for (let k = 0; k < this.rows + 2; k++) {
        const use = h("use", { href: "#sym-blank" });
        const svg = h("svg", { viewBox: "0 0 100 100", class: "sym", "aria-hidden": "true" }, use);
        const tag = h("span", { class: "tag" });
        const el = h("div", { class: "cell" }, svg, tag);
        belt.append(el);
        cells.push({ el, use, tag, sym: "", art: "" });
      }
      const reel = h("div", { class: "reel", dataset: { r } }, belt);
      strip.append(reel);
      this.reelEls.push(reel); this.cells.push(cells);
    }
    this.stickyLayer = h("div", { class: "sticky-layer" });
    this.lineLayer = h("svg", { class: "line-layer", viewBox: "0 0 100 100", preserveAspectRatio: "none" });
    this.root.append(strip, this.stickyLayer, this.lineLayer);
    this.strip = strip;
  }

  /** Size the cells to fit the space the stage gives us. */
  layout(w, h2) {
    const gap = 6, pad = 8;
    this.cell = Math.max(40, Math.floor(Math.min((w - gap * (this.reels - 1) - pad * 2) / this.reels, (h2 - pad * 2) / this.rows)));
    this.root.style.setProperty("--cell", this.cell + "px");
    this.root.style.setProperty("--gap", gap + "px");
    this.root.style.setProperty("--rows", this.rows);
    this.lineLayer.style.width = this.reels * this.cell + (this.reels - 1) * gap + "px";
    this.lineLayer.style.height = this.rows * this.cell + "px";
    this.renderAll();
    this.buildSticky(this.sticky);
  }

  artOf(id) { return (this.cfg.symbols[id] && this.cfg.symbols[id].art) || "blank"; }
  kindOf(id) { return this.prep.kindOf[id]; }

  setCell(c, id) {
    if (c.sym === id) return;
    c.sym = id;
    c.use.setAttribute("href", "#sym-" + (id ? this.artOf(id) : "blank"));
    c.el.dataset.kind = id ? this.kindOf(id) || "" : "";
  }

  renderReel(r) {
    const cell = this.cell, cells = this.cells[r];
    if (this.static[r]) return;
    const strip = this.strips[r], L = strip.length, P = this.pos[r], base = Math.floor(P);
    for (let k = 0; k < this.rows + 2; k++) {
      const j = base - 1 + k;
      this.setCell(cells[k], strip[mod(j, L)]);
      cells[k].el.style.transform = `translateY(${((j - P) * cell).toFixed(1)}px)`;
    }
  }

  renderAll() { for (let r = 0; r < this.reels; r++) { if (this.static[r]) this.placeStatic(r); else this.renderReel(r); } }

  placeStatic(r) {
    const cells = this.cells[r];
    for (let k = 0; k < this.rows + 2; k++) cells[k].el.style.transform = `translateY(${(k - 1) * this.cell}px)`;
  }

  // ---- showing a grid without spinning ----------------------------------------------------------
  /** Show explicit symbols: grid[reel][row]. */
  setGrid(grid) {
    for (let r = 0; r < this.reels; r++) {
      this.static[r] = true;
      const cells = this.cells[r];
      for (let row = 0; row < this.rows; row++) { this.setCell(cells[row + 1], grid[r][row]); cells[row + 1].tag.textContent = ""; }
      this.setCell(cells[0], ""); this.setCell(cells[this.rows + 1], "");
      this.placeStatic(r);
    }
  }

  /** Back to showing the real strip at integer stops (used before a spin and to resume). */
  showStops(stops) {
    for (let r = 0; r < this.reels; r++) { this.static[r] = false; this.pos[r] = stops[r]; this.mode[r] = "idle"; this.renderReel(r); this.clearTags(r); }
  }

  cellAt(r, row) { return this.cells[r][row + 1]; }

  clearTags(r) { for (const c of this.cells[r]) { c.tag.textContent = ""; c.tag.className = "tag"; } }

  /** Show coin values (HS-03) or jackpot labels on landed coin symbols. */
  setCoinTags(coins, bet) {
    for (const c of coins) {
      const cell = this.cellAt(c.reel, c.row);
      cell.tag.textContent = c.jackpot ? this.env.t("jp." + c.jackpot).toUpperCase() : formatCompact(c.value * bet, this.env.locale);
      cell.tag.className = "tag coin" + (c.jackpot ? " jp" : "");
    }
  }

  // ---- spinning and stopping -------------------------------------------------------------------
  startSpin(stripSet = this.stripSet) {
    this.stripSet = stripSet;
    this.slam = false;
    this.clearHighlight(); this.clearLines();
    for (let r = 0; r < this.reels; r++) {
      this.static[r] = false; this.mode[r] = "spin"; this.clearTags(r);
      this.reelEls[r].classList.add("spinning"); this.reelEls[r].classList.remove("anticipate");
    }
    this.root.classList.add("is-spinning");
    this.loop();
  }

  loop() {
    if (this.raf) return;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * timing.speed;
      last = now;
      let moving = false;
      for (let r = 0; r < this.reels; r++) {
        if (this.mode[r] === "spin") { this.pos[r] -= SPEED * dt; this.renderReel(r); moving = true; }
      }
      this.raf = moving ? requestAnimationFrame(frame) : 0;
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Slam stop: all reels stop at once; the outcome does not change (REEL-04). */
  doSlam() { this.slam = true; (this._wakers || []).splice(0).forEach((f) => f()); }

  /** A sleep that ends early on a slam stop. */
  wait(ms) {
    return new Promise((resolve) => {
      if (this.slam) return resolve();
      const timer = setTimeout(() => { done(); }, ms / timing.speed);
      const done = () => { clearTimeout(timer); resolve(); };
      (this._wakers = this._wakers || []).push(done);
    });
  }

  landReel(r, stopIdx, { approach, ms }) {
    const frac = this.pos[r] - Math.floor(this.pos[r]);
    const p0 = stopIdx + approach + frac;
    this.mode[r] = "land";
    const over = stopIdx - 0.14;
    let landed = false;
    return tween(ms, (t) => {
      if (t < 0.78) this.pos[r] = lerp(p0, over, ease.outCubic(t / 0.78));
      else {
        if (!landed) { landed = true; this.onLand(r); }
        this.pos[r] = lerp(over, stopIdx, ease.inOutCubic((t - 0.78) / 0.22));
      }
      this.renderReel(r);
    }).then(() => { this.pos[r] = stopIdx; this.mode[r] = "idle"; this.renderReel(r); this.reelEls[r].classList.remove("spinning", "anticipate"); });
  }

  /** A reel touched down: sound, haptic, and a pop for special symbols (FEEL-02). */
  onLand(r) {
    const { audio, haptics } = this.env;
    audio.sfx("stop");
    const kinds = new Set();
    for (let row = 0; row < this.rows; row++) {
      const c = this.cellAt(r, row), kind = c.el.dataset.kind;
      if (["scatter", "wild", "bonus", "coin", "collect"].includes(kind)) {
        kinds.add(kind);
        c.el.classList.remove("land-pop"); void c.el.offsetWidth; c.el.classList.add("land-pop");
      }
    }
    for (const k of kinds) audio.sfx("land-" + k);
    if (kinds.size) haptics.medium(); else haptics.light();
  }

  /**
   * Stop all reels left to right (REEL-03) on the outcome's stops. `plan` says which reels get the extra
   * anticipation time (FEEL-01). Resolves when every reel has settled.
   */
  async stopAll(stops, { turbo = false, plan = [], minSpinMs = null } = {}) {
    const T = turbo ? { spin: 140, stagger: 45, extra: 280, ms: 190, approach: 4 } : { spin: 620, stagger: (this.cfg.timing && this.cfg.timing.staggerMs) || 150, extra: this.cfg.anticipation.extraMs, ms: 380, approach: 6 };
    await this.wait(minSpinMs ?? T.spin);
    const pending = [];
    for (let r = 0; r < this.reels; r++) {
      if (plan[r] && !this.slam) {
        this.reelEls[r].classList.add("anticipate");
        this.env.audio.riser(true, T.extra);
        await this.wait(T.extra);
        this.env.audio.riser(false);
      }
      const quick = this.slam;
      pending.push(this.landReel(r, stops[r], quick ? { approach: 3, ms: 150 } : T));
      if (r < this.reels - 1) await this.wait(quick ? 0 : T.stagger);
    }
    await Promise.all(pending);
    this.env.audio.riser(false);
    this.root.classList.remove("is-spinning");
  }

  // ---- wilds ---------------------------------------------------------------------------------------
  /** Expanding wilds fill their reel before wins are evaluated (WILD-02). */
  async expand(expanded, grid) {
    if (!expanded.length) return;
    this.env.audio.sfx("expand");
    for (const { reel } of expanded) {
      this.static[reel] = true;
      const cells = this.cells[reel];
      for (let row = 0; row < this.rows; row++) {
        const c = this.cellAt(reel, row);
        this.setCell(c, grid[reel][row]);
        c.el.classList.remove("expand"); void c.el.offsetWidth; c.el.classList.add("expand");
      }
      this.setCell(cells[0], ""); this.setCell(cells[this.rows + 1], "");
      this.placeStatic(reel);
    }
    await sleep(650);
  }

  /** Sticky wilds are drawn above the reels so they stay while the reels spin (WILD-03). */
  setSticky(map) { this.sticky = map || {}; this.buildSticky(this.sticky); }

  buildSticky(map) {
    this.stickyLayer.innerHTML = "";
    for (const [key, id] of Object.entries(map)) {
      const [r, row] = key.split(",").map(Number);
      const el = h("div", { class: "sticky-cell", style: { transform: `translate(${r * (this.cell + 6)}px, ${row * this.cell}px)`, width: this.cell + "px", height: this.cell + "px" } }, symbolSvg(this.artOf(id)), h("span", { class: "pin" }, "📌"));
      this.stickyLayer.append(el);
    }
  }

  // ---- showing wins ----------------------------------------------------------------------------------
  highlight(positions) {
    const set = new Set(positions.map(([r, row]) => r * this.rows + row));
    this.root.classList.add("showing-wins");
    for (let r = 0; r < this.reels; r++) for (let row = 0; row < this.rows; row++) {
      const el = this.cellAt(r, row).el;
      const on = set.has(r * this.rows + row);
      el.classList.toggle("win", on); el.classList.toggle("dim", !on);
    }
  }

  clearHighlight() {
    this.root.classList.remove("showing-wins");
    for (const cells of this.cells) for (const c of cells) c.el.classList.remove("win", "dim", "pop");
  }

  /** A payline drawn over the reels, with its number (paylines are identified by number as well as colour, NFR-08). */
  drawLine(rowsPerReel, number, color) {
    this.clearLines();
    const w = this.reels, hh = this.rows;
    const pts = rowsPerReel.map((row, r) => [((r + 0.5) / w) * 100, ((row + 0.5) / hh) * 100]);
    const path = h("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: color, "stroke-width": "2.2", "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", style: { strokeWidth: "4px" } });
    this.lineLayer.append(path);
    this.lineNumber = h("div", { class: "line-number", text: String(number), style: { background: color } });
    this.root.append(this.lineNumber);
  }

  clearLines() {
    this.lineLayer.innerHTML = "";
    if (this.lineNumber) { this.lineNumber.remove(); this.lineNumber = null; }
  }

  // ---- cascades ------------------------------------------------------------------------------------------
  /** One cascade step: winners vanish, the rest drops, new symbols fall in from the top (CASC-01). */
  async cascade(step, nextGrid) {
    const { audio, fx } = this.env;
    audio.sfx("pop");
    const rect = this.root.getBoundingClientRect();
    for (const [r, row] of step.removed) {
      const el = this.cellAt(r, row).el;
      el.classList.add("pop");
      fx.burst(rect.left + (r + 0.5) * (rect.width / this.reels), rect.top + (row + 0.5) * (rect.height / this.rows), 4, 0.5);
    }
    await sleep(300);
    const removed = new Set(step.removed.map(([r, row]) => r * this.rows + row));
    for (let r = 0; r < this.reels; r++) {
      this.static[r] = true;
      const n = step.refill[r].length;
      const survivorsFrom = [];
      for (let row = 0; row < this.rows; row++) if (!removed.has(r * this.rows + row)) survivorsFrom.push(row);
      for (let row = 0; row < this.rows; row++) {
        const c = this.cellAt(r, row);
        c.el.classList.remove("pop", "win", "dim");
        this.setCell(c, nextGrid[r][row]);
        const from = row < n ? row - n : survivorsFrom[row - n];
        if (from !== row && c.el.animate) {
          c.el.animate([{ transform: `translateY(${(from + 1) * this.cell}px)` }, { transform: `translateY(${(row + 1) * this.cell}px)` }],
            { duration: 330 / timing.speed, easing: "cubic-bezier(.3,1.25,.5,1)", delay: (r * 25) / timing.speed });
        }
      }
      this.setCell(this.cells[r][0], ""); this.setCell(this.cells[r][this.rows + 1], "");
      this.placeStatic(r);
    }
    this.root.classList.remove("showing-wins");
    await sleep(520);
  }

  // ---- Hold & Spin board ---------------------------------------------------------------------------------
  /** Show only the locked coins; all other positions are empty (HS-01). */
  holdBoard(coins, bet) {
    const grid = Array.from({ length: this.reels }, () => new Array(this.rows).fill(""));
    for (const c of coins) grid[c.reel][c.row] = this.cfg.features.holdSpin.trigger.symbol;
    this.setGrid(grid);
    this.root.classList.add("hold-board");
    this.setCoinTags(coins, bet);
    for (const c of coins) this.cellAt(c.reel, c.row).el.classList.add("locked");
  }

  endHold() { this.root.classList.remove("hold-board"); for (const cells of this.cells) for (const c of cells) c.el.classList.remove("locked", "rolling"); }

  /** Empty positions roll for a moment, then the coins that landed lock in (HS-02). */
  async respin(coinsSoFar, fresh, bet, turbo) {
    const taken = new Set(coinsSoFar.map((c) => c.reel * this.rows + c.row));
    const empties = [];
    for (let r = 0; r < this.reels; r++) for (let row = 0; row < this.rows; row++) if (!taken.has(r * this.rows + row)) empties.push([r, row]);
    const sym = this.cfg.features.holdSpin.trigger.symbol;
    this.env.audio.sfx("spin");
    for (const [r, row] of empties) this.cellAt(r, row).el.classList.add("rolling");
    const timer = setInterval(() => { for (const [r, row] of empties) { const c = this.cellAt(r, row); this.setCell(c, Math.random() < 0.5 ? sym : ""); c.tag.textContent = ""; } }, 90);
    await sleep(turbo ? 350 : 800);
    clearInterval(timer);
    const landed = new Set(fresh.map((c) => c.reel * this.rows + c.row));
    for (const [r, row] of empties) {
      const c = this.cellAt(r, row);
      c.el.classList.remove("rolling");
      this.setCell(c, landed.has(r * this.rows + row) ? sym : "");
      c.tag.textContent = ""; c.tag.className = "tag";
    }
    for (const c of fresh) {
      const cell = this.cellAt(c.reel, c.row);
      cell.el.classList.add("locked", "land-pop");
      this.env.audio.sfx("land-coin");
    }
    this.setCoinTags(fresh, bet);
    if (fresh.length) this.env.haptics.medium();
    await sleep(turbo ? 250 : 500);
  }
}
