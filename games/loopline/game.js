// Loopline: the app shell. Taps, the tick loop, the HUD and toolbar, coins and powers, the lobby and the
// result screen, sound and saving. The rules live in src/engine.js (Critters), src/orbit.js (Orbit) and
// src/depot.js (Depot), the levels in src/levels.js, hints come from src/solver.js, src/render.js and
// src/render3d.js draw it all, and economy.js holds every price (rules: docs/ECONOMY.md).
//
// Saves under "loopline.v3" in localStorage: the chosen mode and difficulty, per mode and difficulty
// the highest level cleared and the stars per level, the coins, and the sound and vibration switches.
// (v2 had other Hard and Orbit levels; its Easy and Medium Depot and Critters progress is carried over.
// v1 had one track per mode with other levels; it is ignored.)
// "depot": 2 marks saves from after Depot became the crowd and the car park: older Depot progress
// pointed at other levels and is dropped (the coins it earned stay; Critters and Orbit keep theirs).
import { CONFIG } from "./src/config.js";
import { makeLevel, newGame, MODES, DIFFS, MODELS, modelView, makeTestLevel } from "./src/levels.js";
import { DONE } from "./src/engine.js";
import { solve } from "./src/solver.js";
import { Renderer, colorOf } from "./src/render.js";
import { Renderer3D } from "./src/render3d.js";
import { DepotRenderer } from "./src/renderDepot.js";
import { Sound } from "./src/audio.js";

const _t = I18n.t;
const $ = (id) => document.getElementById(id);

// ---- Saving -------------------------------------------------------------------------------------------------
const SAVE_KEY = "loopline.v3";
const tierOf = (m, d) => (m === "orbit" ? "orbit-" : "") + d;
function loadSave() {
  const fresh = { mode: "depot", diff: "easy", progress: {}, coins: ECO.start, sound: true, haptics: true };
  let s = null;
  try {
    const now = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (now) s = Object.assign(fresh, now);
    else {
      // From v2: Easy and Medium Depot and Critters are the same levels, so their stars stay, and pay
      // what they would have paid. Hard and Orbit have new levels now.
      const old = JSON.parse(localStorage.getItem("loopline.v2"));
      if (old) {
        const keep = {};
        for (const k in old.progress || {}) {
          const [m, d] = k.split(":");
          if (m === "orbit" || d === "hard") continue;
          keep[k] = old.progress[k];
          for (const st of Object.values(keep[k].stars || {})) fresh.coins += ECO.levelPay(tierOf(m, d), st, 0);
        }
        s = Object.assign(fresh, { mode: old.mode || fresh.mode, diff: old.diff || fresh.diff, sound: old.sound !== false, haptics: old.haptics !== false, progress: keep });
      }
    }
  } catch (e) { /* storage blocked or broken: start fresh */ }
  if (!s) return Object.assign(fresh, { depot: 2 });
  if (s.depot !== 2) { for (const k of Object.keys(s.progress)) if (k.startsWith("depot:")) delete s.progress[k]; s.depot = 2; }
  return s;
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }
const save = loadSave();
const track = () => `${mode}:${diff}`;
const prog = (k = track()) => (save.progress[k] = save.progress[k] || { best: 0, stars: {} });

// ---- State --------------------------------------------------------------------------------------------------
let state = "menu";   // menu | models | play | pause | over
let mode = MODES.includes(save.mode) ? save.mode : "depot";
let diff = DIFFS.includes(save.diff) ? save.diff : "easy";
let levelN = 1, game = null, helps = 0, total = 1;
// Coins and powers: uses of each item in this level (boosts get dearer), and the power that waits for
// the next tap ("pick" or "zap"; paid when that send happens).
let used = {}, armed = null;
let raf = 0, last = 0, acc = 0, endAt = -1, endKind = "", wantHint = false, wasIdle = false;
const streak = new Map(), popAt = new Map();
// The model gallery: which model and size it shows; `testing` while a test level of one is played
// ({ id, diff }: not part of any track, nothing saved, powers free).
const gallery = { i: 0, diff: "easy" };
let testing = null;
/** The mode on screen: the gallery and its tests are Orbit, whatever track is chosen. */
const pm = () => (testing || state === "models" ? "orbit" : mode);
// Repeat (Critters and Orbit): parked critters are sent round again by themselves. `dry` counts, per
// critter, the laps it finished since any block was last popped; at 2 for every critter going round,
// nothing more can happen and Repeat stops.
let repeat = false;
const dry = new Map();
// A sure win: once nothing can go wrong any more, the level finishes itself from `sureAt`: the critters
// play it out live, fast enough to take about CONFIG.finishSeconds, under a celebration. `auto` holds the
// tick length while that runs (taps wait; restart and the menu still work).
let sureAt = -1, auto = null;
const sound = new Sound();
sound.on = save.sound;
// Depot and Critters draw on the 2D canvas (each with its own renderer); Orbit adds a 3D view under it
// (made the first time it's needed).
const R2 = new Renderer($("cv")), RD = new DepotRenderer($("cv"));
let R3 = null, R = R2;
/** The renderer for the current mode. */
function pickRenderer() {
  let want = pm() === "depot" ? RD : R2;
  if (pm() === "orbit") {
    if (!R3) {
      try { R3 = new Renderer3D($("cv"), $("gl")); }
      catch (e) { console.warn("Orbit needs WebGL", e); toast(_t("toast.no3d")); setMode("critters"); return pickRenderer(); }
    }
    want = R3;
  }
  if (want !== R) { R = want; R.resize(); }
  if (R3) R3.viewer = state === "models";
  syncModeClass();
}
const now = () => performance.now() / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function haptic(ms) { if (save.haptics) Platform.haptic(ms); }

// ---- A level ------------------------------------------------------------------------------------------------
function loadLevel(n, level = null) {
  levelN = n;
  pickRenderer();
  game = newGame(level || makeLevel(mode, diff, n));
  total = game.remaining;
  helps = 0; acc = 0; endAt = -1; endKind = ""; wantHint = false; wasIdle = false; sureAt = -1; auto = null;
  used = {}; setArmed(null); setRepeat(false);
  streak.clear();
  showTip();
  R.tickDT = tickDT();
  layoutCanvas();
  R.setGame(game, pm());
  placeLoopbar();
  updateHud();
  updateTools();
  redraw();
}
const lapDT = () => (game.kind === "depot" ? CONFIG.depot.tick : (game.kind === "orbit" ? CONFIG.orbit.lapSeconds : CONFIG.lapSeconds) / game.L);
const tickDT = () => (auto ? auto.dt : lapDT());

/** The first levels' tips; and the first time buddies show up, what they are (until a pair is sent). */
function showTip() {
  const key = `tip.${mode}.${levelN}`;
  const tip = $("tip");
  if (!testing && diff === "easy" && levelN <= 3 && I18n.has(key)) { tip.textContent = _t(key); tip.hidden = false; }
  else if (game.level.pairs && game.level.pairs.length && !save.buddies) { tip.textContent = _t("tip.buddies"); tip.hidden = false; }
  else tip.hidden = true;
}
function layoutCanvas() {
  if (state === "models") { // the gallery: between its title and its card
    R.top = Math.round(document.querySelector(".mhead").getBoundingClientRect().bottom + 4);
    R.bottom = Math.round(window.innerHeight - document.querySelector(".mcard").getBoundingClientRect().top);
    return;
  }
  const hud = $("hud").getBoundingClientRect();
  const tip = $("tip");
  const tipH = !tip.hidden && state !== "menu" ? tip.getBoundingClientRect().height + 8 : 0;
  R.top = Math.round(hud.bottom + tipH + 2);
  R.bottom = Math.round(window.innerHeight - $("tools").getBoundingClientRect().top);
}

function send(m) {
  if (auto) return; // the level is finishing itself
  const opt = {};
  // An armed power goes with this send, unless it isn't needed (Pick on a critter that could go anyway).
  let power = armed;
  if (power === "pick" && game.free(m)) power = null;
  if (power) {
    const cost = price(power);
    if (save.coins < cost) { setArmed(null); poor(cost); return; }
    if (power === "pick") opt.any = true;
    else if (game.kind === "depot") opt.magnet = true;
    else opt.zap = true;
    opt.power = { item: power, cost };
  }
  const r = game.launch(m, opt);
  if (r === "ok") {
    if (power) { spend(power); setArmed(null); }
    if (game.events.some((e) => e.type === "launch" && e.pair) && !save.buddies) { save.buddies = true; writeSave(); }
    sound.go(); drain(); kick(); return;
  }
  if (r === "buddy") { const p = game.buddy[m]; R.shake(m, now()); R.shake(p, now()); sound.nope(); toast(_t("toast.buddy")); kick(); }
  else if (r === "blocked") { R.shake(m, now()); sound.nope(); toast(_t("toast.blocked." + pm())); kick(); }
  else if (r === "full") { R.shake(m, now()); sound.nope(); toast(_t("toast.full." + pm())); kick(); }
}

/** Turn the engine's events into sounds and effects. */
function drain() {
  const t = now(), depot = game.kind === "depot";
  for (const e of game.events) {
    if (e.type === "launch") { R.onLaunch(e.m, e, t); streak.set(e.m, 0); }
    else if (e.type === "take") {
      if (repeat) dry.clear(); // something changed: every critter may see something new
      R.onTake(e.m, e.cell, t, e.pos);
      // Orbit pops a whole column at once: one pop sound per critter per step.
      if (game.kind === "orbit" && popAt.get(e.m) === game.ticks) continue;
      popAt.set(e.m, game.ticks);
      const k = streak.get(e.m) || 0;
      streak.set(e.m, k + 1);
      sound.pop(k);
    } else if (e.type === "board") {
      const k = streak.get(e.m) || 0;
      streak.set(e.m, k + 1);
      // The Magnet takes people from anywhere on the loop and out of the streams; the rest board at the stop.
      R.onBoard(e.m, e.id, e.dock, t, e);
      sound.pop(k);
    } else if (e.type === "enter" && depot) R.onEnter(e.id, e.stream, t);
    else if (e.type === "dock") { sound.park(); haptic(6); }
    else if (e.type === "depart") { R.onDepart(e.m, e.dock, t); sound.done(); haptic(12); }
    else if (e.type === "park") { R.onPark(e.m, e.bay, t); sound.park(); haptic(8); if (repeat) dry.set(e.m, (dry.get(e.m) || 0) + 1); }
    else if (e.type === "done") { R.onDone(e.m, t); sound.done(); haptic(12); }
    else if (e.type === "won") { R.onWin(t); if (!auto) sound.win(); haptic(30); endKind = "won"; endAt = Math.max(t + 1.0, auto ? auto.until : 0); }
    else if (e.type === "lost") { sound.lose(); haptic(60); endKind = "lost"; endAt = t + 0.7; }
  }
  if (game.events.length) { updateHud(); updateLoopbar(); }
  game.events.length = 0;
}

// ---- Loop: ticks while something can happen, frames while anything moves ----------------------------------
let inFrame = false;
// Depot's crowd keeps walking round its loop while the game waits for you (that changes nothing in the
// rules), so a Depot level ticks and draws for as long as it is played.
function frame(ts) {
  raf = 0;
  // Depot draws for as long as it is played; 30 frames a second is plenty for a calm walk, and half
  // the work (battery) of 60.
  if (game.kind === "depot" && last && ts / 1000 - last < 1 / 31) { raf = requestAnimationFrame(frame); return; }
  inFrame = true;
  const t = ts / 1000, dt = Math.min(0.1, t - (last || t));
  last = t;
  if (state === "play") repeatStep();
  const walk = game.kind === "depot" && game.status === "play";
  const running = state === "play" && game.status !== "lost" && (walk || !game.idle); // after a win, let the loop run empty
  if (running) {
    acc += dt;
    const DT = tickDT();
    let k = 0;
    while (acc >= DT && k++ < 40 && (walk || !game.idle) && game.status !== "lost") { game.tick(); acc -= DT; autoStep(); drain(); repeatStep(); }
    if (!walk && game.idle) acc = 0;
  }
  const idle = game.idle;
  if (state === "play" && idle && !wasIdle) afterSettle();
  wasIdle = idle;
  if (state === "play") checkSure(t);
  R.draw(running ? Math.min(1, acc / tickDT()) : 0, t);
  if (endAt >= 0 && t >= endAt && (endKind !== "won" || game.idle)) finish();
  if (!raf && ((state === "play" && (walk || !game.idle) && game.status !== "lost") || R.busy(t) || endAt >= 0 || sureAt >= 0)) raf = requestAnimationFrame(frame); // a kick() during this frame may have asked already
  inFrame = false;
}
function kick() { if (!raf) { if (!inFrame) last = 0; raf = requestAnimationFrame(frame); } } // inside a frame, keep its clock
function redraw() { R.draw(0, now()); kick(); }

// ---- Repeat ---------------------------------------------------------------------------------------------------
function setRepeat(on) {
  repeat = on;
  dry.clear();
  const b = $("repeatBtn");
  b.classList.toggle("on", on);
  b.setAttribute("aria-pressed", String(on));
  if (on) kick();
}
/** The Repeat button: on (if something is parked) or off. */
function toggleRepeat() {
  if (state !== "play" || game.kind === "depot" || game.status !== "play" || auto) return;
  if (repeat) { setRepeat(false); toast(_t("toast.repeatOff")); return; }
  if (!game.bays.some((m) => m >= 0)) { sound.nope(); toast(_t("toast.repeatNone")); return; }
  setRepeat(true);
  sound.go();
  toast(_t("toast.repeatOn"));
}
/** While Repeat is on: send every parked critter that fits on the loop; stop once a whole lap of every
 *  critter going round popped nothing (they'd only keep going round). */
function repeatStep() {
  if (!repeat || game.status !== "play") return;
  const g = game, round = [...g.bays.filter((m) => m >= 0), ...g.belt.map((b) => b.m), ...g.queue];
  if (!round.length) { if (g.idle) setRepeat(false); return; }
  if (round.every((m) => (dry.get(m) || 0) >= 2)) { setRepeat(false); toast(_t("toast.repeatDone")); return; }
  let sent = false;
  for (const m of g.bays) {
    if (m < 0) continue;
    if (g.beltFull) break;
    if (g.launch(m) === "ok") sent = true;
  }
  if (sent) { sound.go(); drain(); kick(); }
}

// ---- A sure win finishes itself ---------------------------------------------------------------------------------
/** Critters and Orbit: once at least half the critters are done and nothing can go wrong any more
 *  (game.sureWin()), say so and, a moment later, finish the level for the player. */
function checkSure(t) {
  if (game.kind === "depot" || game.status !== "play" || auto) { sureAt = -1; return; }
  if (sureAt < 0) {
    let done = 0;
    for (const w of game.where) if (w === DONE) done++;
    if (done * 2 >= game.where.length && game.sureWin()) { sureAt = t + 0.6; toast(_t("toast.sure")); }
    return;
  }
  if (t >= sureAt) { sureAt = -1; autoFinish(t); }
}
/** Play the rest out live: every critter that can go goes, as often as it can (game.sendAll(), the same
 *  steps as game.playOut()), at a pace that has the last block pop after about CONFIG.finishPop seconds,
 *  while the celebration runs; the result shows CONFIG.finishSeconds after it started at the earliest.
 *  A copy plays it first, to know how many ticks that takes. */
function autoFinish(t) {
  const sim = game.clone(), t0 = sim.ticks;
  for (let k = 0; sim.status === "play" && k < 400000; k++) { sim.sendAll(); sim.tick(); sim.events.length = 0; }
  if (sim.status !== "won") return; // can't happen for a sure win; then the player just plays on
  const ticks = Math.max(1, sim.ticks - t0), normal = lapDT();
  // Slow motion when little is left, fast forward when a lot is, within limits (a blur shows nothing).
  auto = { dt: clamp(CONFIG.finishPop / ticks, normal / CONFIG.finishMaxSpeed, normal * CONFIG.finishMaxSlow), until: t + CONFIG.finishSeconds };
  game.keepHistory = false; // nothing to undo any more
  setRepeat(false); setArmed(null);
  R.onCelebrate(t, CONFIG.finishSeconds);
  sound.win(); haptic(30);
  acc = 0;
  autoStep();
  drain();
  updateHud(); updateTools();
  kick();
}
/** While the level finishes itself: before every tick, send whatever can go. */
function autoStep() { if (auto && game.status === "play") game.sendAll(); }

/** Everything just stopped: a pending hint, or no way forward at all. */
function afterSettle() {
  if (game.status !== "play") return;
  if (wantHint) { wantHint = false; hint(); }
  if (game.stuck()) { endKind = "stuck"; endAt = now() + 0.4; }
}

// ---- HUD ----------------------------------------------------------------------------------------------------
function updateHud() {
  if (!game) return;
  const d = testing ? testing.diff : diff;
  $("levelName").textContent = testing ? _t("hud.test", { name: _t("model." + testing.id) }) : _t("hud.level", { n: levelN });
  const chip = $("diffChip");
  chip.textContent = `${_t("mode." + pm())} · ${_t("diff." + d)}`;
  chip.className = "chip " + d;
  const p = Math.round((100 * (total - game.remaining)) / total);
  $("bar").style.width = p + "%";
  $("bar").parentElement.setAttribute("title", _t("hud.progress", { p }));
  $("undoBtn").disabled = !game.history.length || !!auto;
  $("coins").textContent = save.coins;
}

/** The loop bar over the bays: one pip per place on the loop (in the colour of the critter in it), n / max. */
let loopSig = "";
function updateLoopbar() {
  if (!game || game.kind === "depot") return;
  const ms = [...game.belt.map((b) => b.m), ...game.queue], max = game.beltMax;
  const sig = ms.join(",") + "/" + max + "/" + I18n.lang;
  if (sig === loopSig) return;
  loopSig = sig;
  const pips = [];
  for (let i = 0; i < max; i++) pips.push(i < ms.length ? `<i style="background:${colorOf(game.color(ms[i]))}"></i>` : "<i></i>");
  $("loopPips").innerHTML = pips.join("");
  $("loopNum").textContent = `${ms.length}/${max}`;
  $("loopCount").classList.toggle("full", ms.length >= max);
  $("loopCount").setAttribute("aria-label", _t("hud.loop", { n: ms.length, max }));
}
/** Put the loop bar where the renderer left room for it. */
function placeLoopbar() {
  const bar = $("loopbar"), at = game && game.kind !== "depot" && R.bar;
  bar.hidden = !at;
  if (!at) return;
  bar.style.top = Math.round(at.y) + "px";
  bar.style.height = Math.round(at.h) + "px";
  bar.style.left = Math.round(at.x) + "px";
  loopSig = "";
  updateLoopbar();
}

// ---- Coins and powers -------------------------------------------------------------------------------------
// Prices follow the tier you're playing (economy.js): hints and Hard's undo cost half a level's pay, an
// extra bay or a Pick two levels' (doubling with each use in a level), a Laser three. Paid when used.
const tier = () => tierOf(mode, diff);
const price = (item) => (testing ? 0 : ECO.price(item, tier(), used[item] || 0)); // test levels: powers are free
const undoCost = () => (diff === "hard" ? price("rewind") : 0);
const coinSvg = '<svg viewBox="0 0 24 24" class="coin" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffcf3f" stroke="#191b33" stroke-width="2.2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#d99a12" stroke-width="2"/></svg>';
function poor(cost) { sound.nope(); toast(_t("toast.poor", { cost, n: save.coins })); }
/** Pay for one use of an item now. Any help takes a star (docs/ECONOMY.md). */
function spend(item) {
  save.coins -= price(item);
  used[item] = (used[item] || 0) + 1;
  helps++;
  writeSave();
  updateHud(); updateTools();
}
function setArmed(p) {
  armed = p;
  R2.armed = p; RD.armed = p; if (R3) R3.armed = p;
  document.body.dataset.armed = p || "";
  updateTools();
  if (game) kick();
}
/** A power button: the extra bay works at once; Pick and Laser wait for the next send. Tap again to put it away. */
function power(item) {
  if (state !== "play" || game.status !== "play" || auto) return;
  if (armed === item) { setArmed(null); toast(_t("toast.off")); return; }
  const cost = price(item);
  if (save.coins < cost) { poor(cost); return; }
  if (item === "bay") {
    spend("bay");
    game.addBay();
    R.layout();
    placeLoopbar();
    sound.park(); haptic(10);
    toast(_t("toast.bay." + (pm() === "depot" ? "depot" : "critters")));
    redraw();
    return;
  }
  setArmed(item);
  sound.go();
  toast(_t(`toast.${item}.${pm() === "depot" ? "depot" : "critters"}`, { cost }));
}
function updateTools() {
  if (!game) return;
  const tag = (id, cost) => { const el = $(id); el.hidden = !cost; el.innerHTML = cost ? coinSvg + cost : ""; };
  tag("undoCost", undoCost());
  tag("hintCost", price("hint"));
  for (const p of ["bay", "pick", "zap"]) {
    const b = $(p + "Btn"), c = price(p);
    tag(p + "Cost", c);
    b.classList.toggle("armed", armed === p);
    b.classList.toggle("short", save.coins < c && armed !== p);
    b.setAttribute("aria-pressed", String(armed === p));
  }
  $("hintBtn").classList.toggle("short", save.coins < price("hint"));
  $("undoBtn").classList.toggle("short", save.coins < undoCost());
}
/** The power names follow the mode: bays and critters, or docks and buses. */
function labelTools() {
  const k = pm() === "depot" ? "depot" : "critters";
  for (const p of ["bay", "pick", "zap"]) {
    $(p + "Btn").querySelector(".cap").textContent = _t(`pw.${p}.${k}`);
    $(p + "Btn").title = _t(`pw.${p}.${k}.tip`);
  }
}
let toastTimer = 0;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 1800);
}

function undo() {
  if (auto) return; // the level is finishing itself
  if (!game.history.length) { toast(_t("toast.nothingToUndo")); return; }
  // Hard: undo is the Rewind, and costs coins. Easy and Medium: free, and it still costs a star.
  const cost = undoCost();
  if (cost && save.coins < cost) { poor(cost); return; }
  if (cost) spend("rewind"); else helps++;
  game.undo();
  setRepeat(false); sureAt = -1;
  // A power the undone send used is handed back.
  if (game.undone) {
    save.coins += game.undone.cost;
    used[game.undone.item] = Math.max(0, (used[game.undone.item] || 0) - 1);
    writeSave();
    toast(_t("toast.refund", { cost: game.undone.cost }));
  }
  setArmed(null);
  sound.undo();
  R.clearFx();
  acc = 0; endAt = -1; endKind = ""; wantHint = false; wasIdle = false;
  if (state !== "play") setState("play");
  updateHud(); updateLoopbar();
  redraw();
}

function hint() {
  if (game.status !== "play" || auto) return;
  if (!game.idle) { wantHint = true; return; }
  const cost = price("hint");
  if (save.coins < cost) { poor(cost); return; }
  // A hint that finds nothing costs nothing.
  const sol = solve(game, { budget: game.kind === "orbit" ? 8000 : 30000, ms: 2500 });
  if (!sol || !sol.length) { toast(_t("toast.noHint")); return; }
  spend("hint");
  R.showHint(sol[0], now());
  kick();
}

// ---- Input --------------------------------------------------------------------------------------------------
$("cv").addEventListener("pointerdown", (e) => {
  sound.unlock();
  if (state !== "play" && state !== "models") return;
  const r = $("cv").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (state === "models") { R.beginDrag(x, y); $("cv").setPointerCapture?.(e.pointerId); kick(); return; } // turn the model
  const h = game.status === "play" && !auto ? R.hit(x, y, armed === "pick") : null;
  if (h) send(h.m);
  else if (R.beginDrag) { R.beginDrag(x, y); $("cv").setPointerCapture?.(e.pointerId); kick(); } // Orbit: turn the view
});
$("cv").addEventListener("pointermove", (e) => {
  if (!R.moveDrag) return;
  const r = $("cv").getBoundingClientRect();
  if (R.moveDrag(e.clientX - r.left, e.clientY - r.top)) kick();
});
for (const ev of ["pointerup", "pointercancel"]) $("cv").addEventListener(ev, () => { if (R.endDrag && R.endDrag()) kick(); });
$("cv").addEventListener("wheel", (e) => { if ((state === "play" || state === "models") && R.wheel) { e.preventDefault(); R.wheel(e.deltaY); kick(); } }, { passive: false });
$("undoBtn").addEventListener("click", () => { sound.unlock(); if (state === "play") undo(); });
$("hintBtn").addEventListener("click", () => { sound.unlock(); if (state === "play") hint(); });
$("restartBtn").addEventListener("click", () => { sound.unlock(); if (state === "play") restart(); });
$("repeatBtn").addEventListener("click", () => { sound.unlock(); toggleRepeat(); });
for (const p of ["bay", "pick", "zap"]) $(p + "Btn").addEventListener("click", () => { sound.unlock(); power(p); });
addEventListener("keydown", (e) => {
  if (state === "play" && (e.key === "z" || e.key === "Z" || e.key === "Backspace")) { e.preventDefault(); undo(); }
  else if (state === "play" && (e.key === "h" || e.key === "H")) hint();
  else if (state === "play" && (e.key === "r" || e.key === "R")) restart();
  else if (state === "models" && e.key === "ArrowLeft") showModel(gallery.i - 1);
  else if (state === "models" && e.key === "ArrowRight") showModel(gallery.i + 1);
  else if (state === "menu" && e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") start(prog().best + 1);
});

// ---- Screens ------------------------------------------------------------------------------------------------
function setState(s) {
  state = s;
  document.body.classList.remove("state-menu", "state-models", "state-play", "state-pause", "state-over");
  document.body.classList.add("state-" + s);
  $("menu").hidden = s !== "menu";
  $("models").hidden = s !== "models";
  $("result").hidden = s !== "over";
  if (s === "pause") nav.open(); else if (nav.isOpen()) nav.close();
  placeNav();
  if (s === "play") kick();
}
function setMode(m) {
  mode = save.mode = m;
  writeSave();
  syncModeClass();
}
/** The body's mode class (which canvas shows) and the power names follow the mode on screen. */
function syncModeClass() {
  for (const x of MODES) document.body.classList.toggle("mode-" + x, x === pm());
  labelTools();
}
function setDiff(d) {
  diff = save.diff = d;
  writeSave();
}

function start(n) {
  sound.unlock();
  testing = null;
  setState("play");
  loadLevel(n);
}
/** Play the level again: a track's level, or the same test. */
function restart() { if (testing) startTest(testing.id, testing.diff); else start(levelN); }

// ---- The model gallery ---------------------------------------------------------------------------------------
/** Every Orbit sculpture on a slowly turning turntable, one at a time; test-play any of them. */
function openModels() {
  sound.unlock();
  testing = null;
  setState("models");
  buildDiffs();
  showModel(gallery.i);
}
function showModel(i) {
  const n = MODELS.length;
  gallery.i = ((i % n) + n) % n;
  const id = MODELS[gallery.i], lv = modelView(id, gallery.diff);
  $("mCount").textContent = _t("models.count", { i: gallery.i + 1, n });
  $("mName").textContent = _t("model." + id);
  const count = new Map();
  for (const c of lv.cells) if (c) count.set(c, (count.get(c) || 0) + 1);
  const blocks = [...count.values()].reduce((a, b) => a + b, 0);
  $("mInfo").textContent = _t("models.info", { blocks: blocks.toLocaleString(I18n.lang), colors: count.size });
  $("mSwatches").innerHTML = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => `<i style="background:${colorOf(c)}"></i>`).join("");
  loadLevel(0, lv);
}
function buildDiffs() {
  $("mDiff").replaceChildren(...DIFFS.map((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(d === gallery.diff));
    b.textContent = _t("diff." + d);
    b.onclick = () => { gallery.diff = d; buildDiffs(); showModel(gallery.i); };
    return b;
  }));
}
/** A test level of model `id`: like level 1 of Orbit `d`. Nothing is saved; powers are free. */
function startTest(id, d) {
  sound.unlock();
  testing = { id, diff: d };
  setState("play");
  loadLevel(0, makeTestLevel(id, d));
}
$("mPrev").addEventListener("click", () => showModel(gallery.i - 1));
$("mNext").addEventListener("click", () => showModel(gallery.i + 1));
$("mPlay").addEventListener("click", () => startTest(MODELS[gallery.i], gallery.diff));

const STAR = '<svg viewBox="0 0 24 24" class="{c}"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>';
function finish() {
  const kind = endKind;
  endAt = -1; endKind = "";
  const main = $("resultMain"), alt = $("resultAlt");
  $("resultLevel").textContent = testing ? `${_t("model." + testing.id)} · ${_t("diff." + testing.diff)}` : `${_t("hud.level", { n: levelN })} · ${_t("diff." + diff)}`;
  if (kind === "won" && testing) {
    // A test: nothing to save or pay.
    $("resultStars").innerHTML = ""; $("resultCoins").innerHTML = ""; $("resultNote").textContent = "";
    $("resultTitle").textContent = _t("res.win.orbit");
    $("resultText").textContent = _t("res.testText");
    main.textContent = _t("testAgain"); main.onclick = restart;
    alt.textContent = _t("toModels"); alt.onclick = openModels;
    $("result").classList.remove("lost");
  } else if (kind === "won") {
    const stars = helps === 0 ? 3 : helps <= 2 ? 2 : 1;
    const p = prog();
    // Coins for new stars only (a level you've perfected pays nothing again).
    const pay = ECO.levelPay(tier(), stars, p.stars[levelN] || 0);
    save.coins += pay;
    p.best = Math.max(p.best, levelN);
    p.stars[levelN] = Math.max(p.stars[levelN] || 0, stars);
    writeSave();
    $("resultCoins").innerHTML = pay ? coinSvg + "+" + pay : "";
    $("resultStars").innerHTML = [0, 1, 2].map((i) => STAR.replace("{c}", i < stars ? "on" : "")).join("");
    $("resultTitle").textContent = _t(I18n.has("res.win." + mode) ? "res.win." + mode : "res.win");
    $("resultText").textContent = _t("res.winText." + mode);
    $("resultNote").textContent = stars < 3 ? _t("res.helps") : "";
    main.textContent = _t("next"); main.onclick = () => start(levelN + 1);
    alt.textContent = _t("menu"); alt.onclick = toMenu;
    $("result").classList.remove("lost");
  } else {
    $("resultStars").innerHTML = "";
    $("resultCoins").innerHTML = "";
    $("resultTitle").textContent = _t(kind === "stuck" ? "res.stuck" : "res.lost." + pm());
    $("resultText").textContent = kind === "stuck" ? _t("res.stuckText") : _t("res.lostText." + pm());
    // Hard: undo costs coins. Without enough, trying again is the way on.
    const cost = undoCost();
    $("resultNote").textContent = diff === "hard" && !testing ? _t("res.hardUndo") : "";
    if (cost <= save.coins) {
      main.innerHTML = _t("undoLast") + (cost ? ` <span class="cost">${coinSvg}${cost}</span>` : ""); main.onclick = undo;
      alt.textContent = _t("again"); alt.onclick = restart;
    } else {
      main.textContent = _t("again"); main.onclick = restart;
      alt.textContent = _t("menu"); alt.onclick = toMenu;
    }
    $("result").classList.add("lost");
  }
  $("tip").hidden = true;
  setState("over");
  main.focus({ preventScroll: true, focusVisible: false });
}

// The start screen is the lobby (shared/js/gamelobby.js): the two modes, the difficulty, one big Play, every level.
const ICON = {
  depot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="3"/><path d="M3 11h18M8 5v6M13 5v6"/><circle cx="7.5" cy="18.5" r="1.8" fill="currentColor"/><circle cx="16.5" cy="18.5" r="1.8" fill="currentColor"/></svg>',
  orbit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 4v8l-7 4-7-4V7z"/><path d="M5 7l7 4 7-4M12 11v8"/><ellipse cx="12" cy="12" rx="11" ry="4" stroke-width="1.6" transform="rotate(-18 12 12)"/></svg>',
  critters: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><circle cx="6.5" cy="5.5" r="2"/><circle cx="17.5" cy="5.5" r="2"/><circle cx="9.3" cy="11.5" r="1.3" fill="currentColor"/><circle cx="14.7" cy="11.5" r="1.3" fill="currentColor"/></svg>',
};
function refreshMenu() {
  const p = prog(), next = p.best + 1;
  const stars = Object.values(p.stars).reduce((a, b) => a + b, 0);
  document.body.dataset.diff = diff;
  $("lobby").replaceChildren(
    GameLobby.choice({
      label: _t("mode"), value: mode,
      options: MODES.map((m) => ({ value: m, label: _t("mode." + m), note: _t(`mode.${m}.note`), icon: ICON[m] })),
      onChoose: (m) => { setMode(m); refreshMenu(); showBehind(); },
    }),
    GameLobby.tabs({
      label: _t("diff"), value: diff,
      options: DIFFS.map((d, i) => ({ value: d, label: _t("diff." + d), pips: [i + 1, 3], meta: _t("diff.cleared", { n: prog(`${mode}:${d}`).best }) })),
      onChoose: (d) => { setDiff(d); refreshMenu(); showBehind(); },
    }),
    GameLobby.play({
      eyebrow: `${_t("mode." + mode)} · ${_t("diff." + diff)}`,
      title: _t("hud.level", { n: next }),
      text: _t(`playText.${mode}.${diff}`),
      action: { label: _t("play"), onClick: () => start(next) },
      stats: [[p.best, _t("st.cleared")], [stars, _t("st.stars")], [save.coins, _t("st.coins")]],
    }),
    galleryButton(),
    GameLobby.levels({ last: next, stars: (n) => p.stars[n] || 0, onPick: start }),
  );
}
/** The way into the model gallery, under Play. */
function galleryButton() {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lob-models";
  b.innerHTML = ICON.orbit + `<span><b>${_t("models")}</b><small>${_t("models.note", { n: MODELS.length })}</small></span>`;
  b.onclick = openModels;
  return b;
}
/** The board of the next level, behind the menu. */
function showBehind() { loadLevel(prog().best + 1); }

// ---- Back (top left) and the menu drawer (top right) ------------------------------------------------------
const nav = GameNav.create({
  title: () => (state === "pause" ? _t("paused") : state === "models" ? _t("models") : "Loopline"),
  onOpen: () => { if (state === "play") setState("pause"); },
  onClose: () => { if (state === "pause") setState("play"); },
  items: () => {
    const inLevel = state === "pause";
    return [
      inLevel && { icon: "play", label: _t("resume"), onSelect() {} },
      inLevel && { icon: "restart", label: _t("restart"), onSelect() { restart(); } },
      (state === "menu" || state === "pause") && { icon: "view", label: _t("models"), onSelect() { openModels(); } },
      { icon: "sound", label: _t("sound"), checked: save.sound, onToggle(on) { save.sound = sound.on = on; writeSave(); } },
      { icon: "tap", label: _t("haptics"), checked: save.haptics, onToggle(on) { save.haptics = on; writeSave(); } },
      { icon: "help", label: _t("how"), html: "<p><b>" + _t("mode." + pm()) + "</b></p><ul>" + [1, 2, 3, 4, 5, 6].filter((n) => I18n.has(`how.${pm()}.${n}`)).map((n) => "<li>" + _t(`how.${pm()}.${n}`) + "</li>").join("") + (pm() === "depot" ? "" : "<li>" + _t("how.end") + "</li>") + "</ul>" },
      { icon: "help", label: _t("powers"), html: "<p>" + _t("powers.intro") + "</p><ul>" + ["hint", "undo", "bay", "pick", "zap"].map((k) => "<li>" + _t(`powers.${k}.${pm() === "depot" ? "depot" : "critters"}`) + "</li>").join("") + "</ul><p>" + _t("powers.prices") + "</p>" },
      state === "menu" && GameNav.language(),
    ];
  },
});
const navBar = GameNav.bar(nav);
document.body.append(navBar);
function toMenu() { testing = null; refreshMenu(); setState("menu"); showBehind(); }
function placeNav() {
  if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
  else if (state === "models") { navBar.append(nav.back, nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
  else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(testing ? openModels : toMenu, _t(testing ? "backToModels" : "backToMenu")); }
}

document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") setState("pause"); });
addEventListener("resize", () => { if (!game) return; layoutCanvas(); R.resize(); placeLoopbar(); redraw(); });
// The canvas draws numbers in the game's font: draw again once it has loaded.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redraw());

// ---- Start: the menu over the next level's board ------------------------------------------------------------
setMode(mode);
refreshMenu();
setState("menu");
showBehind();
window.Loopline = {
  get game() { return game; }, get state() { return state; }, get yaw() { return R.yaw; }, get mode() { return mode; }, get diff() { return diff; }, get level() { return levelN; },
  start, send, undo, hint, openModels, showModel, startTest, toggleRepeat,
  get repeat() { return repeat; }, get auto() { return !!auto; }, get testing() { return testing; }, get gallery() { return { ...gallery, id: MODELS[gallery.i] }; },
  setMode(m) { setMode(m); refreshMenu(); showBehind(); },
  setDiff(d) { setDiff(d); refreshMenu(); showBehind(); },
  solve: () => solve(game),
  get coins() { return save.coins; }, set coins(n) { save.coins = n; writeSave(); updateHud(); updateTools(); },
  power, get armed() { return armed; },
  point: (m) => R.yardPoint(m), bayPoint: (b) => R.bayPoint(b),
  /** Where the board and the yard ended up, for the layout check in the tests. */
  layoutInfo: () => mode === "depot" ? { zone: R.zone, slots: R.slots, lot: R.lotBox, u: R.u, ps: R.ps, H: innerHeight, W: innerWidth } : mode === "orbit" ? { view: R.view, slots: R.slots, yard: R.yard, H: innerHeight, W: innerWidth } : ({ cs: R.cs, bottom: R.yard.y + R.yard.h + (mode === "depot" ? 10 : 6), left: Math.min(R.yard.x, R.px - R.ringOut), right: Math.max(R.yard.x + R.yard.w, R.px + R.pw + R.ringOut) }),
};
