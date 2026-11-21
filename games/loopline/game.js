// Loopline: the app shell. Taps, the tick loop, the HUD, the lobby and the result screen, sound
// and saving. The rules live in src/engine.js, the levels in src/levels.js, hints come from
// src/solver.js, and src/render.js draws it all on one canvas.
//
// Saves under "loopline.v1" in localStorage: the chosen mode, per mode the highest level cleared
// and the stars per level, and the sound and vibration switches.
import { CONFIG } from "./src/config.js";
import { Game, YARD } from "./src/engine.js";
import { makeLevel, MODES } from "./src/levels.js";
import { solve } from "./src/solver.js";
import { Renderer } from "./src/render.js";
import { Sound } from "./src/audio.js";

const _t = I18n.t;
const $ = (id) => document.getElementById(id);

// ---- Saving -------------------------------------------------------------------------------------------------
const SAVE_KEY = "loopline.v1";
function loadSave() {
  const fresh = { mode: "depot", progress: {}, sound: true, haptics: true };
  try { return Object.assign(fresh, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { return fresh; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }
const save = loadSave();
const prog = (m) => (save.progress[m] = save.progress[m] || { best: 0, stars: {} });

// ---- State --------------------------------------------------------------------------------------------------
let state = "menu";   // menu | play | pause | over
let mode = MODES.includes(save.mode) ? save.mode : "depot";
let levelN = 1, game = null, helps = 0, total = 1;
let raf = 0, last = 0, acc = 0, endAt = -1, endKind = "", wantHint = false;
const streak = new Map();
const sound = new Sound();
sound.on = save.sound;
const R = new Renderer($("cv"));
const now = () => performance.now() / 1000;
function haptic(ms) { if (save.haptics) Platform.haptic(ms); }

// ---- A level ------------------------------------------------------------------------------------------------
function loadLevel(n) {
  levelN = n;
  game = new Game(makeLevel(mode, n));
  total = game.remaining;
  helps = 0; acc = 0; endAt = -1; endKind = ""; wantHint = false;
  streak.clear();
  showTip();
  R.top = layoutTop();
  R.setGame(game, mode);
  updateHud();
  redraw();
}
const tickDT = () => CONFIG.lapSeconds / game.L;

function showTip() {
  const key = `tip.${mode}.${levelN}`;
  const tip = $("tip");
  if (levelN <= 3 && I18n.has(key)) { tip.textContent = _t(key); tip.hidden = false; } else tip.hidden = true;
}
function layoutTop() {
  const hud = $("hud").getBoundingClientRect();
  const tip = $("tip");
  const tipH = !tip.hidden && state !== "menu" ? tip.getBoundingClientRect().height + 8 : 0;
  return Math.round(hud.bottom + tipH + 6);
}

function send(m) {
  const r = game.launch(m);
  if (r === "ok") { sound.go(); drain(); kick(); return; }
  if (r === "blocked") { R.shake(m, now()); sound.nope(); toast(_t("toast.blocked." + mode)); kick(); }
  else if (r === "full") { sound.nope(); toast(_t("toast.full")); }
}

/** Turn the engine's events into sounds and effects. */
function drain() {
  const t = now();
  for (const e of game.events) {
    if (e.type === "launch") { R.onLaunch(e.m, e.from, t); streak.set(e.m, 0); }
    else if (e.type === "take") {
      const k = streak.get(e.m) || 0;
      streak.set(e.m, k + 1);
      R.onTake(e.m, e.cell, t, R.trackPoint(e.pos));
      sound.pop(k);
    } else if (e.type === "park") { R.onPark(e.m, e.bay, t); sound.park(); haptic(8); }
    else if (e.type === "done") { R.onDone(e.m, t); sound.done(); haptic(12); }
    else if (e.type === "won") { R.onWin(t); sound.win(); haptic(30); endKind = "won"; endAt = t + 0.9; }
    else if (e.type === "lost") { sound.lose(); haptic(60); endKind = "lost"; endAt = t + 0.6; }
  }
  if (game.events.length) updateHud();
  game.events.length = 0;
}

// ---- Loop: ticks while movers are on the loop, frames while anything moves ---------------------------------
function frame(ts) {
  raf = 0;
  const t = ts / 1000, dt = Math.min(0.1, t - (last || t));
  last = t;
  const running = state === "play" && game.status !== "lost" && !game.idle;
  if (running) {
    acc += dt;
    const DT = tickDT();
    let k = 0;
    while (acc >= DT && k++ < 30 && !game.idle && game.status !== "lost") { game.tick(); acc -= DT; drain(); }
    if (game.idle) { acc = 0; afterSettle(); }
  }
  R.draw(game.idle ? 0 : Math.min(1, acc / tickDT()), t);
  if (endAt >= 0 && t >= endAt && (endKind !== "won" || game.idle)) finish();
  if ((state === "play" && !game.idle && game.status !== "lost") || R.busy(t) || endAt >= 0) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function redraw() { R.draw(0, now()); kick(); }

/** The loop just ran empty: a pending hint, or no way forward at all. */
function afterSettle() {
  if (game.status !== "play") return;
  if (wantHint) { wantHint = false; hint(); }
  if (game.stuck()) { endKind = "stuck"; endAt = now() + 0.4; }
}

// ---- HUD ----------------------------------------------------------------------------------------------------
function updateHud() {
  if (!game) return;
  $("levelName").textContent = `${_t("mode." + mode)} · ${_t("hud.level", { n: levelN })}`;
  const p = Math.round((100 * (total - game.remaining)) / total);
  $("bar").style.width = p + "%";
  $("bar").parentElement.setAttribute("title", _t("hud.progress", { p }));
  $("undoBtn").disabled = !game.history.length;
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
  if (!game.undo()) { toast(_t("toast.nothingToUndo")); return; }
  helps++;
  sound.undo();
  R.clearFx();
  acc = 0; endAt = -1; endKind = ""; wantHint = false;
  if (state !== "play") setState("play");
  updateHud();
  redraw();
}

function hint() {
  if (game.status !== "play") return;
  if (!game.idle) { wantHint = true; return; }
  const sol = solve(game, { budget: 30000 });
  if (!sol || !sol.length) { toast(_t("toast.noHint")); return; }
  helps++;
  R.showHint(sol[0], now());
  kick();
}

// ---- Input --------------------------------------------------------------------------------------------------
$("cv").addEventListener("pointerdown", (e) => {
  sound.unlock();
  if (state !== "play" || game.status !== "play") return;
  const r = $("cv").getBoundingClientRect();
  const h = R.hit(e.clientX - r.left, e.clientY - r.top);
  if (h) send(h.m);
});
$("undoBtn").addEventListener("click", () => { sound.unlock(); undo(); });
$("hintBtn").addEventListener("click", () => { sound.unlock(); hint(); });
addEventListener("keydown", (e) => {
  if (state === "play" && (e.key === "z" || e.key === "Z" || e.key === "Backspace")) { e.preventDefault(); undo(); }
  else if (state === "play" && (e.key === "h" || e.key === "H")) hint();
  else if (state === "menu" && e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") start(prog(mode).best + 1);
});

// ---- Screens ------------------------------------------------------------------------------------------------
function setState(s) {
  state = s;
  document.body.classList.remove("state-menu", "state-play", "state-pause", "state-over");
  document.body.classList.add("state-" + s);
  $("menu").hidden = s !== "menu";
  $("result").hidden = s !== "over";
  if (s === "pause") nav.open(); else if (nav.isOpen()) nav.close();
  placeNav();
  if (s === "play") kick();
}
function setMode(m) {
  mode = save.mode = m;
  writeSave();
  document.body.classList.toggle("mode-depot", m === "depot");
  document.body.classList.toggle("mode-critters", m === "critters");
}

function start(n) {
  sound.unlock();
  setState("play");
  loadLevel(n);
}

const STAR = '<svg viewBox="0 0 24 24" class="{c}"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>';
function finish() {
  const kind = endKind;
  endAt = -1; endKind = "";
  const main = $("resultMain"), alt = $("resultAlt");
  if (kind === "won") {
    const stars = helps === 0 ? 3 : helps <= 2 ? 2 : 1;
    const p = prog(mode);
    p.best = Math.max(p.best, levelN);
    p.stars[levelN] = Math.max(p.stars[levelN] || 0, stars);
    writeSave();
    $("resultStars").innerHTML = [0, 1, 2].map((i) => STAR.replace("{c}", i < stars ? "on" : "")).join("");
    $("resultTitle").textContent = _t("res.win");
    $("resultText").textContent = _t("res.winText." + mode);
    $("resultNote").textContent = stars < 3 ? _t("res.helps") : "";
    main.textContent = _t("next"); main.onclick = () => start(levelN + 1);
    alt.textContent = _t("menu"); alt.onclick = toMenu;
  } else {
    $("resultStars").innerHTML = "";
    $("resultTitle").textContent = _t(kind === "stuck" ? "res.stuck" : "res.lost");
    $("resultText").textContent = kind === "stuck" ? _t("res.stuckText") : _t("res.lostText." + mode);
    $("resultNote").textContent = "";
    main.textContent = _t("undoLast"); main.onclick = undo;
    alt.textContent = _t("again"); alt.onclick = () => start(levelN);
  }
  $("tip").hidden = true;
  setState("over");
  main.focus({ preventScroll: true });
}

// The start screen is the lobby (shared/js/gamelobby.js): the two modes, one big Play, every level.
const ICON = {
  depot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="3"/><path d="M3 11h18M8 5v6M13 5v6"/><circle cx="7.5" cy="18.5" r="1.8" fill="currentColor"/><circle cx="16.5" cy="18.5" r="1.8" fill="currentColor"/></svg>',
  critters: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><circle cx="6.5" cy="5.5" r="2"/><circle cx="17.5" cy="5.5" r="2"/><circle cx="9.3" cy="11.5" r="1.3" fill="currentColor"/><circle cx="14.7" cy="11.5" r="1.3" fill="currentColor"/></svg>',
};
function refreshMenu() {
  const p = prog(mode), next = p.best + 1;
  const stars = Object.values(p.stars).reduce((a, b) => a + b, 0);
  $("lobby").replaceChildren(
    GameLobby.choice({
      label: _t("mode"), value: mode,
      options: MODES.map((m) => ({ value: m, label: _t("mode." + m), note: _t(`mode.${m}.note`), icon: ICON[m] })),
      onChoose: (m) => { setMode(m); refreshMenu(); showBehind(); },
    }),
    GameLobby.play({
      title: _t("playTitle", { mode: _t("mode." + mode), n: next }),
      text: _t("playText." + mode),
      action: { label: _t("play"), onClick: () => start(next) },
      stats: [[p.best, _t("st.cleared")], [stars, _t("st.stars")]],
    }),
    GameLobby.levels({ last: next, stars: (n) => p.stars[n] || 0, onPick: start }),
  );
}
/** The board of the next level, behind the menu. */
function showBehind() { loadLevel(prog(mode).best + 1); }

// ---- Back (top left) and the menu drawer (top right) ------------------------------------------------------
const nav = GameNav.create({
  title: () => (state === "pause" ? _t("paused") : "Loopline"),
  onOpen: () => { if (state === "play") setState("pause"); },
  onClose: () => { if (state === "pause") setState("play"); },
  items: () => {
    const inLevel = state === "pause";
    return [
      inLevel && { icon: "play", label: _t("resume"), onSelect() {} },
      inLevel && { icon: "restart", label: _t("restart"), onSelect() { start(levelN); } },
      { icon: "sound", label: _t("sound"), checked: save.sound, onToggle(on) { save.sound = sound.on = on; writeSave(); } },
      { icon: "tap", label: _t("haptics"), checked: save.haptics, onToggle(on) { save.haptics = on; writeSave(); } },
      { icon: "help", label: _t("how"), html: "<ul>" + [1, 2, 3, 4, 5].map((n) => "<li>" + _t("how." + n) + "</li>").join("") + "</ul>" },
      state === "menu" && GameNav.language(),
    ];
  },
});
const navBar = GameNav.bar(nav);
document.body.append(navBar);
function toMenu() { refreshMenu(); setState("menu"); showBehind(); }
function placeNav() {
  if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
  else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
}

document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") setState("pause"); });
addEventListener("resize", () => { R.top = layoutTop(); R.resize(); redraw(); });

// ---- Start: the menu over the next level's board ------------------------------------------------------------
setMode(mode);
refreshMenu();
setState("menu");
showBehind();
window.Loopline = {
  get game() { return game; }, get state() { return state; }, get mode() { return mode; }, get level() { return levelN; },
  start, send, undo, hint, setMode(m) { setMode(m); refreshMenu(); showBehind(); }, solve: () => solve(game),
  point: (m) => R.yardPoint(m), bayPoint: (b) => R.bayPoint(b),
};
