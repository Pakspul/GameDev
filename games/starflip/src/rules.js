// The rules of a game of Starflip: balls, scoring, the top lanes and skill shot, missions, the
// Mothership multiball and the bonus tables behind the wormhole. No DOM here: game.js feeds in
// the player's input and real time, reads the state to draw it, and turns `fx` into sound and
// pictures. That keeps every rule testable in Node (tests/starflip).
//
//   const g = new Game({ seed });          a full game: three balls on the main table
//   const g = new Game({ practice: "ufo" }) one bonus table on its own, from the menu
//   g.flip("L", true); g.plunge(true);      input
//   g.update(dt);                           advance real time (fixed physics steps inside)
//   g.fx                                    what happened since the caller last emptied it
import { CONFIG } from "./config.js";
import { World } from "./physics.js";
import { buildTable, ROCK_SLOTS, STAR_RING, UFO } from "./tables.js";
import { MISSIONS, MOTHERSHIP_SHOTS, ARROW } from "./missions.js";

const S = CONFIG.score, SB = S.bonus;
export const DT = 1 / CONFIG.hz;

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor({ seed = (Math.random() * 2 ** 32) >>> 0, practice = null } = {}) {
    this.rand = rng(seed);
    this.practice = practice;
    this.main = new World(buildTable("main"));
    this.world = this.main;
    this.phase = "play";      // play | mini | between | over
    this.score = 0;
    this.ballNo = 1;
    this.balls = CONFIG.balls;
    this.mult = 1;
    this.bonus = 0;
    this.lanes = [false, false, false];
    this.skill = null;        // { lane, t }: the lit skill-shot lane; t counts down once the ball is launched
    this.ready = null;        // the ball waiting in the plunger lane for the player
    this.power = 0;           // plunger pull, 0..1
    this.charging = false;
    this.ballSave = 0;
    this.saveUsed = false;
    this.done = new Set();    // missions done in this round
    this.round = 1;           // goes up after every Mothership
    this.next = 0;            // index of the next mission to offer
    this.active = null;       // the mission being played
    this.mothership = null;
    this.wormhole = null;     // the bonus table the wormhole leads to, when it's open
    this.mini = null;
    this.timers = [];
    this.acc = 0;
    this.t = 0;
    this.fx = [];
    this.stats = { missions: 0, minis: 0, jackpots: 0, best: {} };
    this.input = { L: false, R: false };
    if (practice) this.enterMini(practice);
    else this.serve();
  }

  // ---- Input ----------------------------------------------------------------------------------------------
  flip(side, on) {
    if (this.input[side] === on) return;
    this.input[side] = on;
    if (this.phase === "over") return;
    this.world.flip(side, on);
    if (on) {
      this.fx.push({ type: "flip", side });
      // Lane change: the lit top lanes (and the skill-shot lane) move the way you flipped.
      if (this.world === this.main) {
        const d = side === "L" ? 1 : 2; // rotate left or right by one
        this.lanes = [0, 1, 2].map((i) => this.lanes[(i + d) % 3]);
        if (this.skill && this.ready) this.skill.lane = (this.skill.lane + (side === "L" ? 2 : 1)) % 3;
      }
    }
  }
  plunge(on) {
    if (on && this.ready && this.phase === "play") { this.charging = true; return; }
    if (!on && this.charging) {
      this.charging = false;
      if (this.ready) this.launch(this.power);
      this.power = 0;
    }
  }

  // ---- Time -----------------------------------------------------------------------------------------------
  update(dt) {
    if (this.phase === "over") return;
    if (this.charging) this.power = Math.min(1, this.power + dt / CONFIG.plunger.charge);
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= DT && n++ < 120) { this.tick(DT); this.acc -= DT; }
    if (n >= 120) this.acc = 0;
  }

  tick(dt) {
    this.t += dt;
    const w = this.world;
    if (this.mini) this.miniMovers(dt);
    w.step(dt);
    for (const e of w.events) this.onEvent(e);
    w.events.length = 0;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if ((tm.t -= dt) <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    if (this.phase === "mini") return this.miniTick(dt);
    if (this.phase !== "play") return;
    const inPlay = w.balls.some((b) => !b.held && !this.inLane(b));
    if (this.ballSave > 0 && inPlay) this.ballSave = Math.max(0, this.ballSave - dt);
    if (this.skill && this.skill.t != null && (this.skill.t -= dt) <= 0) this.skill = null;
    if (this.active && inPlay) {
      const a = this.active;
      if (a.cometT != null && (a.cometT -= dt) <= 0) this.moveComet();
      if ((a.time -= dt) <= 0) this.failMission("time");
    }
    this.watchBalls(dt);
  }

  /** A ball in the plunger lane, or one that rolled back into it. */
  inLane(b) {
    const P = this.main.table.plunger;
    return this.world === this.main && b.x > P.x0 && b.y > P.y0;
  }

  watchBalls(dt) {
    for (const b of this.world.balls) {
      if (b.held) { b.still = 0; continue; }
      const slow = Math.hypot(b.vx, b.vy) < 12;
      if (this.inLane(b)) {
        // A weak plunge that fell back: the player plunges again (in multiball it goes by itself).
        if (slow && b !== this.ready && !b.auto && (b.still += dt) > 0.3) {
          b.still = 0;
          if (this.main.balls.length > 1 || this.mothership) this.autoLaunch(b, 0.3);
          else { this.ready = b; this.skill = null; }
        }
        continue;
      }
      // Stuck somewhere (on a post, in a corner): a little nudge, like a ball search in a real machine.
      if (slow && b.y < 850) {
        if ((b.still += dt) > CONFIG.stuck) {
          b.still = 0;
          b.vx += (this.rand() < 0.5 ? -1 : 1) * (200 + 200 * this.rand());
          b.vy -= 350;
          this.fx.push({ type: "nudge" });
        }
      } else b.still = 0;
    }
  }

  later(t, fn) { this.timers.push({ t, fn }); }

  add(points) {
    this.score += points;
    if (this.mini) this.mini.score += points;
  }

  // ---- Balls ----------------------------------------------------------------------------------------------
  /** A new ball in the plunger lane: for the player to launch, or (auto) launched by itself. */
  serve(auto = false) {
    const P = this.main.table.plunger;
    const b = this.main.addBall(P.x, P.y);
    if (auto) { this.autoLaunch(b, 0.6); return b; }
    this.ready = b;
    this.skill = { lane: Math.floor(this.rand() * 3), t: null };
    this.fx.push({ type: "serve" });
    return b;
  }
  autoLaunch(b, delay) {
    b.auto = true;
    this.later(delay, () => {
      if (!this.main.balls.includes(b)) return;
      b.auto = false;
      b.vy = -(CONFIG.plunger.min + (CONFIG.plunger.max - CONFIG.plunger.min) * (0.55 + 0.4 * this.rand()));
      this.fx.push({ type: "launch", power: 0.8 });
    });
  }
  launch(power) {
    const b = this.ready;
    this.ready = null;
    b.vy = -(CONFIG.plunger.min + (CONFIG.plunger.max - CONFIG.plunger.min) * power);
    if (!this.saveUsed && this.ballSave <= 0) this.ballSave = CONFIG.ballSave;
    if (this.skill) this.skill.t = CONFIG.skillTime;
    this.fx.push({ type: "launch", power });
  }

  onDrain(b) {
    if (this.phase === "mini") return this.miniDrain(b);
    if (b === this.ready) this.ready = null;
    const left = this.main.balls.length;
    if (this.ballSave > 0) {
      this.fx.push({ type: "saved" });
      if (left === 0) { this.ballSave = 0; this.saveUsed = true; }
      this.serve(true);
      return;
    }
    if (left > 0) {
      if (this.mothership && left === 1) this.endMothership();
      return;
    }
    this.endBall();
  }

  endBall() {
    this.fx.push({ type: "drain" });
    // A mission carries over to the next ball (its clock only runs while a ball is in play):
    // losing a ball costs the ball, not the work you put into the mission.
    if (this.mothership) this.endMothership();
    this.phase = "between";
    const total = this.bonus * this.mult;
    this.score += total;
    this.fx.push({ type: "bonus", bonus: this.bonus, mult: this.mult, total });
    this.later(2.4, () => this.nextBall());
  }

  nextBall() {
    if (this.ballNo >= this.balls) return this.gameOver();
    this.ballNo++;
    this.phase = "play";
    this.mult = 1;
    this.bonus = 0;
    this.lanes = [false, false, false];
    this.saveUsed = false;
    this.ballSave = 0;
    for (const s of this.main.segs) if (s.kind === "drop") s.active = true;
    this.serve();
  }

  gameOver() {
    this.phase = "over";
    this.ready = null;
    this.charging = false;
    this.fx.push({ type: "over", score: this.score });
  }

  // ---- What the ball touched ------------------------------------------------------------------------------
  onEvent(e) {
    if (e.type === "drain") return this.onDrain(e.ball);
    if (e.type === "flipHit") return;
    if (this.phase === "mini") return this.miniEvent(e);
    if (e.type === "hole") return e.id === "pad" ? this.onPad(e.ball) : this.onWormhole(e.ball);
    if (e.type === "hit") {
      const fx = { type: e.kind, id: e.id, x: e.x, y: e.y, speed: e.speed };
      if (e.kind === "bumper") { this.add(S.bumper); this.bonus += SB.bumper; this.shot("bumpers"); }
      else if (e.kind === "sling") this.add(S.sling);
      else if (e.kind === "drop") this.dropHit(e.id);
      else if (e.kind === "standup") { this.add(S.standup); this.bonus += SB.standup; this.shot("sat"); }
      else return;
      this.fx.push(fx);
      return;
    }
    if (e.type === "sensor") {
      if (e.id.startsWith("lane")) this.laneRoll(+e.id.slice(4) - 1);
      else if (e.id === "spinner") {
        const spins = Math.max(1, Math.min(12, Math.round(Math.abs(e.vy) / 160)));
        this.add(S.spin * spins);
        this.fx.push({ type: "spinner", spins });
        this.shot("spinner", spins);
      } else if ((e.id === "orbitL" || e.id === "orbitR") && e.vy < 0) {
        this.add(S.orbit);
        this.bonus += SB.orbit;
        this.fx.push({ type: "orbit", side: e.id.slice(-1) });
        this.shot(e.id === "orbitL" ? "leftOrbit" : "rightOrbit");
      }
    }
  }

  dropHit(id) {
    const s = this.main.get(id);
    if (!s.active) return;
    s.active = false;
    this.add(S.drop);
    this.bonus += SB.drop;
    this.shot("drops");
    const bank = this.main.segs.filter((x) => x.kind === "drop");
    if (bank.every((x) => !x.active)) {
      this.add(S.dropBank);
      this.fx.push({ type: "dropBank" });
      this.shot("dropBank");
      this.later(1.0, () => { for (const x of bank) x.active = true; this.fx.push({ type: "dropReset" }); });
    }
  }

  laneRoll(i) {
    if (this.skill && this.skill.t != null) {
      if (this.skill.lane === i) { this.add(S.skill); this.fx.push({ type: "skill", lane: i }); }
      this.skill = null;
    }
    this.add(S.lane);
    this.bonus += SB.lane;
    this.fx.push({ type: "lane", lane: i });
    this.lanes[i] = true;
    if (this.lanes.every(Boolean)) {
      this.lanes = [false, false, false];
      this.add(S.lanes);
      if (this.mult < CONFIG.multMax) { this.mult++; this.fx.push({ type: "mult", mult: this.mult }); }
    }
  }

  onPad(b) {
    if (!this.active && !this.mothership && this.main.balls.length === 1) {
      if (this.done.size >= MISSIONS.length) this.startMothership();
      else this.startMission();
      return this.holdAndEject(b, CONFIG.holdPad, -320, 260);
    }
    this.add(S.hole);
    this.shot("pad");
    this.holdAndEject(b, CONFIG.holdShort, -320, 260);
  }

  onWormhole(b) {
    this.add(S.hole);
    this.shot("wormhole");
    if (this.wormhole && this.main.balls.length === 1 && !this.mothership && this.phase === "play") {
      const id = this.wormhole;
      this.wormhole = null;
      this.fx.push({ type: "warp", mini: id });
      this.later(0.9, () => { this.main.removeBall(b); this.enterMini(id); });
      return;
    }
    this.holdAndEject(b, CONFIG.holdShort, 260, 300);
  }

  holdAndEject(b, t, vx, vy) {
    this.fx.push({ type: "hole", x: b.x, y: b.y });
    this.later(t, () => {
      this.main.eject(b, vx + (this.rand() - 0.5) * 120, vy + this.rand() * 80);
      this.fx.push({ type: "eject", x: b.x, y: b.y });
    });
  }

  // ---- Missions -------------------------------------------------------------------------------------------
  /** The mission the launch pad starts next: the first one not done yet, from `next` on. */
  nextMission() {
    for (let k = 0; k < MISSIONS.length; k++) {
      const m = MISSIONS[(this.next + k) % MISSIONS.length];
      if (!this.done.has(m.id)) return m;
    }
    return null;
  }

  startMission() {
    const def = this.nextMission();
    this.active = { def, step: 0, count: 0, time: CONFIG.missionTime, cometT: null, comet: null };
    this.prepStep();
    this.fx.push({ type: "missionStart", id: def.id });
  }

  prepStep() {
    const a = this.active, st = a.def.steps[a.step];
    if (st.shot === "comet") { a.comet = null; this.moveComet(); } else { a.comet = null; a.cometT = null; }
  }
  moveComet() {
    const a = this.active, pool = a.def.steps[a.step].pool.filter((s) => s !== a.comet);
    a.comet = pool[Math.floor(this.rand() * pool.length)];
    a.cometT = CONFIG.cometMove;
    this.fx.push({ type: "comet", shot: a.comet });
  }

  /** The shot the current mission step wants, as an arrow name. */
  target() {
    const a = this.active;
    if (!a) return null;
    const st = a.def.steps[a.step];
    return st.shot === "comet" ? a.comet : st.shot;
  }

  shot(name, n = 1) {
    if (this.mothership) {
      if (this.mothership.lit.has(name)) {
        this.mothership.lit.delete(name);
        this.add(S.jackpot * this.round);
        this.stats.jackpots++;
        this.fx.push({ type: "jackpot", shot: name, points: S.jackpot * this.round });
        if (!this.mothership.lit.size) {
          this.add(S.superJackpot * this.round);
          this.fx.push({ type: "superJackpot", points: S.superJackpot * this.round });
          this.mothership.lit = new Set(MOTHERSHIP_SHOTS);
        }
      }
      return;
    }
    const a = this.active;
    if (!a || this.target() !== name) return;
    const st = a.def.steps[a.step];
    a.count = Math.min(st.n, a.count + n);
    if (a.count < st.n) {
      this.add(Math.round(S.step * this.round / 5));
      this.fx.push({ type: "progress", count: a.count, n: st.n });
      if (st.shot === "comet") this.moveComet();
      return;
    }
    this.add(S.step * this.round);
    if (++a.step < a.def.steps.length) {
      a.count = 0;
      this.prepStep();
      this.fx.push({ type: "step", step: a.step, shot: a.def.steps[a.step].shot, at: this.target() });
      return;
    }
    this.completeMission();
  }

  completeMission() {
    const def = this.active.def;
    this.active = null;
    this.done.add(def.id);
    this.next = (MISSIONS.indexOf(def) + 1) % MISSIONS.length;
    this.add(S.mission * this.round);
    this.bonus += SB.mission;
    this.stats.missions++;
    this.wormhole = def.mini;
    this.fx.push({ type: "missionDone", id: def.id, mini: def.mini, points: S.mission * this.round, all: this.done.size >= MISSIONS.length });
  }

  failMission(why) {
    const id = this.active.def.id;
    this.active = null;
    this.fx.push({ type: "missionFail", id, why });
  }

  startMothership() {
    this.mothership = { lit: new Set(MOTHERSHIP_SHOTS) };
    this.ballSave = 15;
    this.saveUsed = false;
    this.fx.push({ type: "mothership" });
    this.later(0.6, () => this.serve(true));
    this.later(1.8, () => this.serve(true));
  }

  endMothership() {
    this.mothership = null;
    this.done.clear();
    this.next = 0;
    this.round++;
    this.fx.push({ type: "mothershipEnd", round: this.round });
  }

  /** Every arrow that should blink, and why: shot → "start" | "mission" | "comet" | "wormhole" | "jackpot". */
  litShots() {
    const lit = new Map();
    if (this.phase === "mini") return lit;
    if (this.mothership) for (const s of this.mothership.lit) lit.set(ARROW[s] || s, "jackpot");
    else if (this.active) lit.set(ARROW[this.target()] || this.target(), this.active.comet ? "comet" : "mission");
    else lit.set("pad", "start");
    if (this.wormhole && !lit.has("wormhole")) lit.set("wormhole", "wormhole");
    return lit;
  }

  // ---- Bonus tables ---------------------------------------------------------------------------------------
  enterMini(id) {
    this.world = new World(buildTable(id));
    this.phase = "mini";
    this.mini = { id, time: CONFIG.mini.time, save: CONFIG.mini.save, score: 0, count: 0 };
    this.stats.minis++;
    const M = this.mini, w = this.world;
    if (id === "asteroids") {
      M.hp = {};
      const slots = ROCK_SLOTS.map((_, i) => i).sort(() => this.rand() - 0.5).slice(0, 5);
      for (const i of slots) this.spawnRock(i);
    } else if (id === "gravity") {
      M.lit = Math.floor(this.rand() * STAR_RING.n);
    } else if (id === "ufo") {
      M.ufoHits = 0;
      M.ufoSpeed = UFO.speed;
      w.get("ufo").vx = UFO.speed;
    }
    for (const side of ["L", "R"]) w.flip(side, this.input[side]);
    this.miniBall();
    this.fx.push({ type: "miniStart", mini: id });
  }

  miniBall() {
    const [x, y] = this.world.table.entry;
    this.world.addBall(x, y, (this.rand() - 0.5) * 240, 60);
  }

  spawnRock(i) {
    const c = this.world.get("rock" + i);
    c.active = true;
    this.mini.hp[i] = 2 + (this.rand() < 0.4 ? 1 : 0);
    c.hp = this.mini.hp[i];
  }

  miniMovers(dt) {
    if (this.mini.id !== "ufo") return;
    const u = this.world.get("ufo");
    if (!u.active) return;
    u.x += u.vx * dt;
    if (u.x < UFO.x0) { u.x = UFO.x0; u.vx = Math.abs(u.vx); }
    if (u.x > UFO.x1) { u.x = UFO.x1; u.vx = -Math.abs(u.vx); }
  }

  miniTick(dt) {
    const M = this.mini;
    if (M.save > 0) M.save = Math.max(0, M.save - dt);
    if ((M.time -= dt) <= 0) {
      M.time = 0;
      this.world.balls.length = 0;
      this.exitMini("time");
    } else this.watchBalls(dt);
  }

  miniDrain() {
    if (this.mini.save > 0) {
      this.fx.push({ type: "saved" });
      this.miniBall();
      return;
    }
    if (this.world.balls.length === 0) this.exitMini("drain");
  }

  miniEvent(e) {
    const M = this.mini, w = this.world;
    if (e.type === "hole" && e.id === "core") {
      this.add(S.core);
      M.count++;
      this.fx.push({ type: "core", x: e.ball.x, y: e.ball.y, points: S.core });
      const b = e.ball;
      this.later(0.6, () => w.eject(b, (this.rand() - 0.5) * 900, 900));
      return;
    }
    if (e.type !== "hit") return;
    const fx = { type: e.kind, id: e.id, x: e.x, y: e.y, speed: e.speed };
    if (e.kind === "bumper") this.add(S.miniBumper);
    else if (e.kind === "rock") {
      const i = +e.id.slice(4), c = w.get(e.id);
      c.hp = --M.hp[i];
      this.add(S.rockHit);
      if (c.hp <= 0) {
        c.active = false;
        M.count++;
        this.add(S.rockBreak);
        fx.type = "rockBreak";
        fx.points = S.rockBreak + S.rockHit;
        // Another rock appears in an empty spot, away from where this one broke.
        this.later(0.9, () => {
          if (!this.mini || this.mini !== M) return;
          const free = ROCK_SLOTS.map((_, k) => k).filter((k) => !w.get("rock" + k).active && k !== i);
          if (free.length) this.spawnRock(free[Math.floor(this.rand() * free.length)]);
        });
      }
    } else if (e.kind === "star") {
      const i = +e.id.slice(4);
      if (i === M.lit) {
        M.count++;
        this.add(S.starLit);
        fx.type = "starLit";
        fx.points = S.starLit;
        if (M.count % STAR_RING.n === 0) {
          this.add(S.supernova);
          this.fx.push({ type: "supernova", points: S.supernova });
        }
        let n = M.lit;
        while (n === M.lit) n = Math.floor(this.rand() * STAR_RING.n);
        M.lit = n;
      } else this.add(S.starHit);
    } else if (e.kind === "ufo") {
      const u = w.get("ufo");
      M.ufoHits++;
      this.add(S.ufoHit);
      fx.points = S.ufoHit;
      if (M.ufoHits >= 3) {
        M.ufoHits = 0;
        M.count++;
        u.active = false;
        this.add(S.ufoDown);
        fx.type = "ufoDown";
        fx.points = S.ufoDown;
        this.later(1.2, () => {
          if (this.mini !== M) return;
          M.ufoSpeed *= 1.25;
          u.active = true;
          u.x = this.rand() < 0.5 ? UFO.x0 : UFO.x1;
          u.vx = (u.x === UFO.x0 ? 1 : -1) * M.ufoSpeed;
        });
      }
    } else if (e.kind === "drop") {
      const s = w.get(e.id);
      if (!s.active) return;
      s.active = false;
      this.add(S.alien);
      const bank = w.segs.filter((x) => x.kind === "drop");
      if (bank.every((x) => !x.active)) {
        this.add(S.aliens);
        this.fx.push({ type: "aliens", points: S.aliens });
        this.later(0.8, () => { for (const x of bank) x.active = true; });
      }
    } else return;
    this.fx.push(fx);
  }

  exitMini(why) {
    const M = this.mini;
    this.mini = null;
    this.stats.best[M.id] = Math.max(this.stats.best[M.id] || 0, M.score);
    this.fx.push({ type: "miniEnd", mini: M.id, score: M.score, why });
    if (this.practice) { this.world.balls.length = 0; return this.gameOver(); }
    this.world = this.main;
    this.phase = "play";
    for (const side of ["L", "R"]) this.main.flip(side, this.input[side]);
    // The ball comes back out of the wormhole.
    const h = this.main.holes.find((x) => x.id === "wormhole");
    const b = this.main.addBall(h.x, h.y);
    this.main.hold(b, h);
    this.holdAndEject(b, 1.0, 260, 300);
  }

  // ---- For the banner -------------------------------------------------------------------------------------
  /** What the player should do now, for the banner above the table. */
  view() {
    if (this.mini) {
      const M = this.mini;
      return { kind: "mini", id: M.id, time: M.time, timeMax: CONFIG.mini.time, score: M.score, count: M.count, ufoHits: M.ufoHits };
    }
    if (this.mothership) return { kind: "mothership", left: this.mothership.lit.size, total: MOTHERSHIP_SHOTS.length, round: this.round };
    if (this.active) {
      const a = this.active, st = a.def.steps[a.step];
      return { kind: "mission", id: a.def.id, step: a.step, steps: a.def.steps.length, shot: this.target(), count: a.count, n: st.n,
        time: a.time, timeMax: CONFIG.missionTime, comet: !!a.comet };
    }
    const m = this.nextMission();
    return { kind: "idle", next: m ? m.id : "mothership", wormhole: this.wormhole, done: this.done.size, total: MISSIONS.length };
  }
}
