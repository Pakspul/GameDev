// Wallbreaker: the app shell. Menus, the seven modes as sessions on one engine, the shop, settings,
// input, the frame loop, sound and haptics. The rules live in src/ (engine, levels, modes, economy).
//
// Shell contract: window.Wallbreaker = { init, pause, resume, destroy }. Save data stays under the
// "wallbreaker." namespace in localStorage (src/save.js).
import { CONFIG } from "./src/config.js";
import { Engine, DT } from "./src/engine.js";
import { generate, generateDescent, level1, dailyLevel, dateKey, CLASSIC_SEED, DESCENT_SEED } from "./src/levels.js";
import { MODES, MODE_ORDER, buildMods, boostsFor, wsLevel, puzzleStars, medalFor, MEDALS, checkpointFor } from "./src/modes.js";
import { levelPay, dailyPay, medalPay, workshopPrice, boostPrice, cosmetics } from "./src/economy.js";
import { makeStorage, loadSave, writeSave, exportSave, importSave, freshSave } from "./src/save.js";
import { Renderer, iconURL, CAPSULE_COLORS, THEMES, BRICK_SETS, fmtMult } from "./src/render.js";
import { Sound } from "./src/audio.js";
import { PUZZLES, puzzleLevel, TIME_ATTACK, timeAttackLevel } from "./src/walls.js";
import { SOLUTIONS } from "./src/puzzles.gen.js";
import { SLACK, launchX } from "./src/puzzle-play.js";
import { perkOffer, runLevel, unlockedStarts } from "./src/run.js";
import { seedToCode, codeToSeed, freshSeed } from "./src/rng.js";

const _t = I18n.t;
const $ = (s) => document.querySelector(s);
const DEG = Math.PI / 180;

// ---- Tiny DOM helper ------------------------------------------------------------------------------------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
const fmt = (n) => Math.round(n).toLocaleString(I18n.lang);
const credits = (n) => h("span", { class: "cr" }, h("i", { "aria-hidden": "true" }), fmt(n));
const starsEl = (n, of = 3) => h("span", { class: "stars", "aria-label": _t("stars.aria", { n }) }, ...Array.from({ length: of }, (_, i) => h("b", { class: i < n ? "on" : "" }, "★")));
const fmtTime = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return m ? `${m}:${r.toFixed(1).padStart(4, "0")}` : r.toFixed(1); };

// ---- State ----------------------------------------------------------------------------------------------
let storage, save, R, sound;
let session = null;          // the level being played
let running = false, rafId = 0, lastTs = 0, acc = 0;
let paused = false;
let aim = null;              // aim angle (radians) in Descent and Puzzle
let keys = new Set();
let menuEngine = null;       // a still wall behind the menus
let started = false;
const listeners = [];

function persist() { writeSave(storage, save); }
function award(n) { if (n > 0) { save.credits += n; save.stats.earned += n; } }
function spend(n) { save.credits -= n; save.stats.spent += n; }
function haptic(ms) { if (save.settings.haptics && window.Platform) Platform.haptic(ms); }
function reducedMotion() {
  const s = save.settings.reducedMotion;
  return s == null ? !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) : s;
}
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function applySettings() {
  const s = save.settings;
  sound.setVolumes(s.sound, s.music);
  sound.setPack(save.look.sound);
  R.setLook(save.look);
  R.setOptions({ palette: s.palette, reducedMotion: reducedMotion(), leftHanded: s.leftHanded, aimAssist: s.aimAssist });
  document.body.classList.toggle("left-handed", !!s.leftHanded);
  document.body.classList.toggle("reduced-motion", reducedMotion());
  const th = THEMES[save.look.theme] || THEMES["theme.night"];
  document.documentElement.style.setProperty("--theme-bg", th.bg[0]);
  document.documentElement.style.setProperty("--theme-glow", th.glow);
}

// ---- Layout and the frame loop ----------------------------------------------------------------------------
function resize() {
  const hud = $("#hud");
  const top = hud.hidden ? 0 : hud.offsetHeight;
  R.resize(top, 0);
  if (!running) R.draw(session ? session.engine : menuEngine, performance.now(), { aim });
}

function startLoop() {
  if (running) return;
  running = true;
  lastTs = performance.now();
  acc = 0;
  rafId = requestAnimationFrame(frame);
}
function stopLoop() {
  running = false;
  cancelAnimationFrame(rafId);
}

function frame(ts) {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (ts - lastTs) / 1000));
  lastTs = ts;
  const e = session && session.engine;
  if (e && !paused) {
    keyboardControl(e, dt);
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 24) {
      e.step(DT);
      acc -= DT;
      if (e.over) break;
    }
    if (e.over && !session.ending) {
      session.ending = true;
      setTimeout(() => finishLevel(), 900);
    }
  }
  R.tick(paused ? 0 : dt);
  R.draw(e || menuEngine, ts, { aim });
  if (e) updateHud(e);
}

// ---- HUD --------------------------------------------------------------------------------------------------
let hudCache = "";
function updateHud(e) {
  const s = session;
  let left = "", mid = "", right = "";
  switch (s.mode) {
    case "classic": left = _t("hud.level", { n: s.number }); mid = fmt(e.score); right = lives(e.lives); break;
    case "zen": left = _t("hud.zen", { n: s.number }); mid = fmt(e.score); break;
    case "descent": left = _t("hud.descent", { n: s.number }); mid = _t("hud.shots", { n: e.shots }); right = _t("hud.nextRow", { n: CONFIG.descent.shotsPerRow - (e.shots % CONFIG.descent.shotsPerRow) }); break;
    case "run": left = _t("hud.run", { n: s.number, code: s.code }); mid = "◆ " + fmt(s.bank); right = lives(e.lives); break;
    case "daily": left = _t("hud.daily"); mid = fmtTime(e.playTime); right = lives(e.lives); break;
    case "puzzle": left = _t("hud.puzzle", { n: s.index + 1 }); mid = _t("hud.shotsOf", { n: e.shots, max: e.shotLimit }); right = _t("hud.par", { n: s.par }); break;
    case "timeattack": left = _t("ta." + s.wall.name); mid = fmtTime(e.playTime + e.penalty); right = e.penalty ? "+" + e.penalty + " s" : ""; break;
  }
  const key = left + "|" + mid + "|" + right;
  if (key === hudCache) return;
  hudCache = key;
  $("#hudLeft").textContent = left;
  $("#hudMid").textContent = mid;
  $("#hudRight").textContent = right;
}
function lives(n) { return Number.isFinite(n) ? "♥ " + Math.max(0, n) : ""; }

// ---- Screens ---------------------------------------------------------------------------------------------
const overlay = () => $("#overlay");
let screenBack = null;       // where the back button goes from the screen on show (null: the arcade)
/** Show a menu screen. `back` is where the back button (and Android back) goes from it: Wallbreaker's
 *  home by default, null on the home screen itself (then it goes to the arcade). */
function showScreen(node, { modal = false, back = home, keepScroll = false } = {}) {
  screenBack = back;
  const o = overlay();
  o.replaceChildren(node);
  o.hidden = false;
  o.classList.toggle("modal", modal);
  if (!keepScroll) o.scrollTop = 0;
  placeNav();
  const first = o.querySelector("[autofocus]") || o.querySelector(".screen > :not(.screen-head) button");
  if (first && matchMedia("(hover: hover)").matches) first.focus({ preventScroll: true });
}
function hideScreen() { overlay().hidden = true; overlay().replaceChildren(); placeNav(); }

/** The balance, top right next to the menu: a tap opens the shop. */
function wallet() { return h("button", { type: "button", class: "bal", "aria-label": _t("shop"), onclick: () => { sound.play("click"); shop(); } }, credits(save.credits)); }
/** A menu screen: the back button (to `back`), a title, the balance and the menu (see placeNav). */
function screen(title, ...body) { return screenWith(title, wallet(), body); }
function screenWith(title, right, body) {
  return h("section", { class: "screen" }, h("div", { class: "screen-head" }, h("h2", {}, title), right || h("span")), ...body);
}

function leaveLevel() {
  if (session && !session.engine.over) save.stats.bricks += session.engine.bricksBroken;
  if (session) persist();
  session = null;
  paused = false;
  aim = null;
  sound.stopMusic();
  $("#hud").hidden = true;
  stopLoop();
  resize();
}

// ---- The lobby (shared/js/gamelobby.js) ----------------------------------------------------------------------
// The same layout as every game's menu: today's wall on top, the modes as tabs, and below the chosen mode
// one tap to play on, its boosts, and every level with its stars.
const LOBBY_MODES = MODE_ORDER.filter((m) => m !== "daily");
const CP = CONFIG.checkpointEvery;
function home() { lobby(save.lobbyMode); }
/** Back to a mode's tab in the lobby (from a level, a result or a screen of its own). */
function openMode(mode) { lobby(mode); }

function lobby(mode) {
  leaveLevel();
  if (!LOBBY_MODES.includes(mode)) mode = LOBBY_MODES.includes(save.lobbyMode) ? save.lobbyMode : "classic";
  if (save.lobbyMode !== mode) { save.lobbyMode = mode; persist(); }
  const again = !overlay().hidden && !!overlay().querySelector(".lobby"); // switching tabs: keep the scroll
  showScreen(h("section", { class: "screen home lobby" },
    h("div", { class: "screen-head" }, h("span"), wallet()),
    h("h1", { class: "logo" }, h("span", {}, "WALL"), h("span", {}, "BREAKER")),
    dailyCard(),
    GameLobby.tabs({
      label: _t("lobby.modes"), value: mode,
      options: LOBBY_MODES.map((m) => ({ value: m, label: _t("mode." + m), meta: modeProgress(m) || _t("lobby.new") })),
      onChoose: (m) => { sound.unlock(); sound.play("click"); lobby(m); },
    }),
    modeParts(mode),
    h("p", { class: "fine center" }, _t("promise"))), { back: null, keepScroll: again });
  if (!save.seenHelp) { save.seenHelp = true; persist(); }
}

function modeProgress(mode) {
  switch (mode) {
    case "classic": return _t("prog.level", { n: save.classic.level });
    case "zen": case "descent": return _t("prog.level", { n: reachedIn(mode) });
    case "run": return save.run.active ? _t("prog.runOn", { n: save.run.active.level, code: save.run.active.code }) : save.run.best ? _t("prog.best", { n: save.run.best }) : null;
    case "puzzle": { const st = Object.values(save.puzzle.stars).reduce((a, b) => a + b, 0); return st ? _t("prog.stars", { n: st, max: PUZZLES.length * 3 }) : null; }
    case "timeattack": { const m = Object.values(save.ta.medal).filter(Boolean).length; return m ? _t("prog.medals", { n: m, max: TIME_ATTACK.length }) : null; }
  }
  return null;
}
function modeParts(mode) {
  if (mode === "run") return runParts();
  if (mode === "puzzle") return puzzleParts();
  if (mode === "timeattack") return taParts();
  return levelParts(mode);
}

function dailyCard() {
  const key = dateKey(), best = save.daily.best[key];
  const streak = save.daily.streak > 1 && (save.daily.last === key || save.daily.last === yesterday()) ? save.daily.streak : 0;
  return GameLobby.daily({
    eyebrow: _t("mode.daily") + " · " + new Date().toLocaleDateString(I18n.lang, { weekday: "long", day: "numeric", month: "long" }),
    title: _t("mode.daily.rule"),
    meta: [best ? "★".repeat(best.stars) + " " + _t("daily.time", { t: fmtTime(best.time) }) : _t("lobby.dailyPays", { n: CONFIG.credits.daily }),
      streak ? _t("prog.streak", { n: streak }) : null].filter(Boolean).join(" · "),
    done: !!best, label: best ? _t("res.again") : _t("play"),
    onClick: () => playLevel("daily", 0, { date: key }),
  });
}

/** The highest level reached in Classic, Zen or Descent (replaying an earlier one never lowers it). */
function reachedIn(mode) {
  if (mode === "classic") return save.classic.reached;
  return Math.max(save[mode].level, ...Object.keys(save[mode].stars).map((k) => +k + 1));
}
function starStats(values) {
  const v = values.filter((s) => s > 0);
  return [[v.length, _t("lobby.cleared")], [v.reduce((a, b) => a + b, 0), _t("lobby.stars")], [v.filter((s) => s === 3).length, _t("lobby.perfect")]];
}

// Classic, Zen and Descent: endless levels. Classic carries its lives from level to level, so it can be
// restarted only from a checkpoint (every CP levels); Zen and Descent replay any level reached.
function levelParts(mode) {
  const reached = reachedIn(mode), n = mode === "classic" ? save.classic.level : reached;
  const lives = mode === "classic" ? (save.classic.lives != null ? save.classic.lives : buildMods("classic", { workshop: save.workshop }).lives) : null;
  const boss = n % 10 === 0 && mode !== "descent";
  return [
    GameLobby.play({
      eyebrow: _t("mode." + mode), title: _t("hud.level", { n }), text: _t("mode." + mode + ".rule"),
      action: { label: _t("play"), sub: [boss ? _t("pre.boss") : null, lives != null ? _t("pre.lives", { n: lives }) : null].filter(Boolean).join(" · "), onClick: () => playLevel(mode, n) },
      stats: starStats(Object.values(save[mode].stars)),
    }),
    boostPicker(mode),
    GameLobby.levels({
      last: reached, next: n,
      stars: (k) => save[mode].stars[k] || 0,
      playable: mode === "classic" ? (k) => k <= reached && (k === n || k === 1 || k % CP === 0) : null,
      onPick: (k) => {
        if (mode === "classic" && k !== n) { save.classic.level = k; save.classic.lives = null; persist(); }
        playLevel(mode, k);
      },
    }),
    mode === "classic" && reached > CP ? h("p", { class: "fine" }, _t("lobby.checkpoints", { n: CP })) : null,
  ];
}

function puzzleOpen(i) { return i < 3 || (save.puzzle.stars[PUZZLES[i - 1].name] || 0) > 0; }
function puzzleParts() {
  const st = (i) => save.puzzle.stars[PUZZLES[i].name] || 0;
  let next = PUZZLES.findIndex((p, i) => puzzleOpen(i) && !st(i));
  if (next < 0) next = Math.max(0, PUZZLES.findIndex((p, i) => st(i) < 3));
  return [
    GameLobby.play({
      eyebrow: _t("mode.puzzle"), title: _t("hud.puzzle", { n: next + 1 }), text: _t("mode.puzzle.rule"),
      action: { label: _t("play"), onClick: () => playLevel("puzzle", 0, { index: next }) },
      stats: starStats(PUZZLES.map((p, i) => st(i))),
    }),
    GameLobby.levels({
      count: PUZZLES.length, last: PUZZLES.length, next: next + 1, perPage: PUZZLES.length,
      stars: (k) => st(k - 1), locked: (k) => !puzzleOpen(k - 1),
      aria: (k) => _t("puz.aria", { n: k, s: st(k - 1) }),
      onPick: (k) => playLevel("puzzle", 0, { index: k - 1 }),
    }),
  ];
}

function taParts() {
  const open = (i) => i === 0 || !!save.ta.medal[TIME_ATTACK[i - 1].name];
  let next = TIME_ATTACK.findIndex((w, i) => open(i) && !save.ta.medal[w.name]);
  if (next < 0) next = Math.max(0, TIME_ATTACK.findIndex((w) => save.ta.medal[w.name] !== MEDALS[MEDALS.length - 1]));
  const w = TIME_ATTACK[next];
  const list = h("div", { class: "list" }, TIME_ATTACK.map((wall, i) => {
    const m = save.ta.medal[wall.name], best = save.ta.best[wall.name];
    return h("button", { type: "button", class: "row-btn" + (open(i) ? "" : " locked"), disabled: !open(i), onclick: () => playLevel("timeattack", 0, { index: i }) },
      h("span", { class: "medal " + (m || "none") }, m ? _t("ta.short." + m) : "–"),
      h("strong", {}, _t("ta." + wall.name)),
      h("small", {}, open(i) ? (best ? _t("ta.best", { t: fmtTime(best) }) : _t("ta.goals", { g: wall.gold, s: wall.silver, b: wall.bronze })) : _t("ta.locked")));
  }));
  return [
    GameLobby.play({
      eyebrow: _t("mode.timeattack"), title: _t("ta." + w.name), text: _t("ta.goals", { g: w.gold, s: w.silver, b: w.bronze }),
      action: { label: _t("play"), onClick: () => playLevel("timeattack", 0, { index: next }) },
    }),
    h("section", { class: "lob-levels" }, h("div", { class: "lob-levels-head" }, h("h3", {}, _t("lobby.walls"))), list),
  ];
}

// ---- Boosts picker (Classic, Descent) -------------------------------------------------------------------
function boostPicker(mode) {
  const ids = boostsFor(mode);
  if (!ids.length) return null;
  save.equip = save.equip.filter((id) => ids.includes(id) && save.boosts[id] > 0);
  const row = h("div", { class: "boosts" });
  const draw = () => {
    row.replaceChildren(...ids.map((id) => {
      const on = save.equip.includes(id), have = save.boosts[id] || 0;
      return h("button", {
        type: "button", class: "boost" + (on ? " on" : "") + (have ? "" : " none"), "aria-pressed": String(on),
        onclick: () => {
          if (!have) { toast(_t("boost.noneOwned")); return; }
          if (on) save.equip = save.equip.filter((x) => x !== id);
          else if (save.equip.length < CONFIG.boosts.maxEquipped) save.equip.push(id);
          else { toast(_t("boost.max", { n: CONFIG.boosts.maxEquipped })); return; }
          sound.play("click"); persist(); draw();
        },
      }, h("img", { src: iconURL(boostIcon(id), "#fff"), alt: "" }), h("span", {}, _t("boost." + id)), h("small", {}, "×" + have));
    }));
  };
  draw();
  return h("div", { class: "panel" },
    h("h3", {}, _t("boosts.equip", { n: CONFIG.boosts.maxEquipped })),
    row,
    h("p", { class: "fine" }, _t("boosts.note")),
    h("button", { type: "button", class: "link", onclick: () => shop("boosts", () => lobby(mode)) }, _t("boosts.buy")));
}
function boostIcon(id) { return { multiStart: "multi2", life: "life", wideStart: "wide", netStart: "net", stickyStart: "sticky", lucky: "score2" }[id]; }

// ---- Starting a level ---------------------------------------------------------------------------------------
function playLevel(mode, n, opts = {}) {
  sound.unlock();
  let level, spec = { mode, number: n };
  if (mode === "classic" || mode === "zen") level = n === 1 ? level1() : generate(CLASSIC_SEED, n);
  else if (mode === "descent") level = generateDescent(DESCENT_SEED, n);
  else if (mode === "run") { level = n === 1 ? level1() : runLevel(opts.seed, n); spec.code = opts.code; spec.bank = opts.bank || 0; }
  else if (mode === "daily") { level = dailyLevel(opts.date); spec.date = opts.date; }
  else if (mode === "puzzle") { level = puzzleLevel(opts.index); spec.index = opts.index; spec.par = SOLUTIONS[PUZZLES[opts.index].name].par; }
  else if (mode === "timeattack") { level = timeAttackLevel(opts.index); spec.index = opts.index; spec.wall = TIME_ATTACK[opts.index]; }

  const boosts = MODES[mode].boosts ? save.equip.filter((id) => (save.boosts[id] || 0) > 0) : [];
  const perks = mode === "run" ? save.run.active.perks : {};
  const built = buildMods(mode, { workshop: save.workshop, boosts, perks });
  let lv = built.lives;
  if (mode === "classic" && save.classic.lives != null) lv = save.classic.lives + (built.equipped.includes("life") ? 1 : 0);
  if (mode === "run") lv = save.run.active.lives;
  if (opts.lives != null) lv = opts.lives;

  const puzzle = mode === "puzzle" ? { launchX: launchX(level), balls: level.balls || 1, shots: spec.par + SLACK } : null;
  const engine = new Engine({ level, rules: MODES[mode], mods: built.mods, lives: lv, events: onEvent, autoLaunch: !!save.settings.autoLaunch, puzzle });
  session = { ...spec, level, engine, creditMul: built.creditMul, equipped: built.equipped, ending: false, opts };
  aim = null;
  paused = false;
  hudCache = "";
  hideScreen();
  $("#hud").hidden = false;
  resize();
  sound.startMusic();
  startLoop();
  if (MODES[mode].play === "aim" && !save.tipAim) { save.tipAim = true; toast(_t("tip.aim")); }
  else if (MODES[mode].play === "paddle" && !save.tipPaddle) { save.tipPaddle = true; toast(_t("tip.paddle")); }
}

// ---- Engine events: sound, haptics, particles -----------------------------------------------------------------
function onEvent(type, d = {}) {
  const e = session && session.engine;
  switch (type) {
    case "paddle": sound.play("paddle"); haptic(8); break;
    case "wall": sound.play("wall"); break;
    case "hit": sound.play("hit", d); break;
    case "break": {
      const b = d.brick;
      sound.play("break", d);
      haptic(10);
      R.burst(b.x + b.w / 2, b.y + b.h / 2, R.brickColor(b), 8, 110);
      if (d.combo >= 5 && d.combo % 5 === 0) R.float(b.x + b.w / 2, b.y, _t("fx.combo", { n: d.combo }), "#fde68a");
      break;
    }
    case "steel": sound.play("steel"); break;
    case "explode": sound.play("explode"); haptic(30); R.addShake(6); R.burst(d.x, d.y, "#ff7a3d", 24, 200); break;
    case "catch": {
      sound.play(d.risky ? "risky" : "catch");
      haptic(d.risky ? 40 : 15);
      R.float(d.x, d.y - 14, d.risky ? _t("risky." + d.id) + " · ×" + fmtMult(e.multiplier()) : _t("cap." + d.id), d.risky ? "#ff8a80" : CAPSULE_COLORS[d.id]);
      if (d.risky) R.flash("#ff2a2a", 0.3);
      break;
    }
    case "collect": sound.play("catch"); R.float(d.x, d.y, _t("cap." + d.id), CAPSULE_COLORS[d.id]); break;
    case "miss": if (d.risky) R.float(e.paddle.x, CONFIG.world.paddleY - 20, _t("fx.refused"), "#94a3b8"); break;
    case "lost": sound.play("lose"); haptic(40); break;
    case "lifeLost": R.flash("#ff0000", 0.35); break;
    case "firstBreak": consumeBoosts(); break;
    case "laser": sound.play("laser"); break;
    case "portal": sound.play("portal"); break;
    case "zap": sound.play("zap"); R.zap(d.x0, d.y0, d.x1, d.y1); break;
    case "launch": sound.play("launch"); break;
    case "fire": sound.play("launch"); break;
    case "plus": sound.play("plus"); R.float(d.brick.x + d.brick.w / 2, d.brick.y, "+1", "#fde047"); break;
    case "net": sound.play("net"); haptic(20); break;
    case "weak": R.float(d.brick.x + d.brick.w / 2, d.brick.y + d.brick.h + 8, "×2", "#fde047"); break;
    case "penalty": R.float(CONFIG.world.W / 2, CONFIG.world.paddleY - 30, "+" + d.seconds + " s", "#fca5a5"); break;
    case "descend": sound.play("wall"); R.addShake(2); break;
    case "saved": R.float(CONFIG.world.W / 2, CONFIG.descent.failY - 20, _t("fx.saved"), "#86efac"); break;
    case "blocked": R.float(e.paddle.x, CONFIG.world.paddleY - 20, _t("fx.blocked"), "#fca5a5"); break;
    case "cleared": sound.play("clear"); haptic(50); break;
    case "failed": sound.play("fail"); break;
  }
}

/** Boosts are only used up once the first brick breaks: quitting or losing before that keeps them. */
function consumeBoosts() {
  if (!session || !session.equipped.length) return;
  for (const id of session.equipped) save.boosts[id] = Math.max(0, (save.boosts[id] || 0) - 1);
  save.equip = save.equip.filter((id) => save.boosts[id] > 0);
  persist();
}

// ---- The end of a level --------------------------------------------------------------------------------------
function finishLevel() {
  if (!session) return;
  const s = session, e = s.engine;
  stopLoop();
  sound.stopMusic();
  save.stats.bricks += e.bricksBroken;
  const cleared = e.result && e.result.cleared;
  if (cleared) save.stats.cleared++;
  let view;
  if (cleared) view = clearedView(s, e);
  else view = failedView(s, e);
  persist();
  session.ending = "done";
  showScreen(view, { modal: true });
}

function payLines(pay, extraNote) {
  const lines = [
    [_t("pay.base"), Math.round(pay.base)],
    [_t("pay.bricks"), Math.round(pay.bricks * 10) / 10],
    pay.stars ? [_t("pay.stars"), pay.stars] : null,
  ].filter(Boolean);
  const notes = [];
  if (pay.factor !== 1) notes.push(_t("pay.factor", { p: Math.round(pay.factor * 100) }));
  if (pay.creditMul !== 1) notes.push(_t("pay.workshop", { p: Math.round((pay.creditMul - 1) * 100) }));
  if (extraNote) notes.push(extraNote);
  return h("div", { class: "pay" },
    h("dl", {}, lines.map(([k, v]) => [h("dt", {}, k), h("dd", {}, "+" + v)])),
    notes.map((n) => h("p", { class: "fine" }, n)),
    h("p", { class: "total" }, _t("pay.total"), " ", credits(pay.total)));
}

function clearedView(s, e) {
  const n = s.number;
  const title = h("h2", {}, _t("res.cleared"));
  let stars = e.stars(), pay, body = [], buttons = [];
  const riskyNote = e.brickCredits > 0 && e.maxMult > 1 ? _t("pay.risky") : null;
  switch (s.mode) {
    case "classic": case "zen": case "descent": {
      const store = save[s.mode];
      const prev = store.stars[n] || 0;
      pay = levelPay({ mode: s.mode, level: n, brickCredits: e.brickCredits, stars, prevStars: prev, creditMul: s.creditMul });
      award(pay.total);
      store.stars[n] = Math.max(prev, stars);
      store.level = s.mode === "classic" ? n + 1 : Math.max(store.level, n + 1);
      if (s.mode === "classic") {
        save.classic.lives = e.lives;
        save.classic.reached = Math.max(save.classic.reached, n + 1);
        save.stats.classicBest = Math.max(save.stats.classicBest, n);
      }
      body.push(payLines(pay, riskyNote));
      buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => (MODES[s.mode].boosts ? lobby(s.mode) : playLevel(s.mode, n + 1)) }, _t("res.next")));
      break;
    }
    case "run": {
      const a = save.run.active;
      pay = levelPay({ mode: "run", level: n, brickCredits: e.brickCredits, stars, prevStars: 0, creditMul: s.creditMul });
      a.bank += pay.total;
      a.level = n + 1;
      a.lives = e.lives;
      if (s.level.kind === "boss") save.run.bosses++;
      save.run.best = Math.max(save.run.best, n + 1);
      save.stats.runBest = Math.max(save.stats.runBest, n + 1);
      body.push(payLines(pay, riskyNote), h("p", { class: "sub" }, _t("run.banked", { n: fmt(a.bank) })));
      body.push(perkPicker(a, n));
      break;
    }
    case "daily": {
      const key = s.date;
      const time = e.playTime;
      const prev = save.daily.best[key];
      if (!prev || stars > prev.stars || (stars === prev.stars && time < prev.time)) save.daily.best[key] = { stars, time };
      const got = dailyPay(save.daily.paid === key);
      if (got) {
        award(got);
        save.daily.paid = key;
        save.daily.streak = save.daily.last === yesterday() ? save.daily.streak + 1 : save.daily.last === key ? save.daily.streak : 1;
        save.daily.last = key;
      }
      body.push(h("p", { class: "sub" }, _t("daily.time", { t: fmtTime(time) })),
        h("p", { class: "total" }, got ? [_t("pay.total"), " ", credits(got)] : _t("daily.paidAlready")));
      if (save.daily.streak > 1) body.push(h("p", { class: "fine" }, _t("daily.streak", { n: save.daily.streak })));
      buttons.push(h("button", { type: "button", class: "primary", onclick: () => playLevel("daily", 0, { date: key }) }, _t("res.again")));
      break;
    }
    case "puzzle": {
      stars = puzzleStars(e.shots, s.par);
      const name = PUZZLES[s.index].name;
      const prev = save.puzzle.stars[name] || 0;
      pay = levelPay({ mode: "puzzle", level: s.index + 1, brickCredits: e.brickCredits, stars, prevStars: prev });
      award(pay.total);
      save.puzzle.stars[name] = Math.max(prev, stars);
      body.push(h("p", { class: "sub" }, _t("puz.used", { n: e.shots, par: s.par })), payLines(pay));
      if (s.index + 1 < PUZZLES.length) buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => playLevel("puzzle", 0, { index: s.index + 1 }) }, _t("res.next")));
      buttons.push(h("button", { type: "button", class: "secondary", onclick: () => playLevel("puzzle", 0, { index: s.index }) }, _t("res.again")));
      break;
    }
    case "timeattack": {
      const time = e.playTime + e.penalty;
      const name = s.wall.name;
      const medal = medalFor(time, s.wall);
      const prevMedal = save.ta.medal[name] || null;
      const better = MEDALS.indexOf(medal) > MEDALS.indexOf(prevMedal);
      const got = medalPay(prevMedal, medal);
      award(got);
      if (better) save.ta.medal[name] = medal;
      if (!save.ta.best[name] || time < save.ta.best[name]) save.ta.best[name] = time;
      save.stats.bestTimes[name] = save.ta.best[name];
      stars = medal ? MEDALS.indexOf(medal) : 0;
      body.push(h("p", { class: "big" }, fmtTime(time)),
        h("p", { class: "sub" }, medal ? _t("ta.medal." + medal) : _t("ta.noMedal", { t: fmtTime(s.wall.bronze) })),
        e.penalty ? h("p", { class: "fine" }, _t("ta.penalty", { n: e.penalty })) : null,
        h("p", { class: "total" }, got ? [_t("pay.total"), " ", credits(got)] : _t("ta.noPay")));
      buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => playLevel("timeattack", 0, { index: s.index }) }, _t("res.again")));
      break;
    }
  }
  buttons.push(h("button", { type: "button", class: "secondary", onclick: () => openMode(s.mode) }, _t("res.menu")));
  return h("section", { class: "screen result" }, title, s.mode === "timeattack" && !stars ? null : starsEl(stars), ...body, h("div", { class: "buttons" }, buttons));
}

function failedView(s, e) {
  const reason = e.result.reason;
  const body = [], buttons = [];
  let title = _t("res.failed");
  if (reason === "allin") body.push(h("p", { class: "sub" }, _t("res.allin")));
  if (s.mode === "classic") {
    const lv = reason === "allin" ? e.lives - 1 : 0;
    if (lv > 0) {
      save.classic.lives = lv;
      body.push(h("p", { class: "sub" }, _t("pre.lives", { n: lv })));
      buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => playLevel("classic", s.number) }, _t("res.retry")));
    } else {
      title = _t("res.gameOver");
      const cp = checkpointFor(s.number);
      save.classic.level = cp;
      save.classic.lives = null;
      body.push(h("p", { class: "sub" }, _t("res.checkpoint", { n: cp })));
      buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => lobby("classic") }, _t("res.fromCheckpoint", { n: cp })));
    }
  } else if (s.mode === "run") {
    const a = save.run.active;
    const lv = reason === "allin" ? e.lives - 1 : 0;
    if (lv > 0) {
      a.lives = lv;
      body.push(h("p", { class: "sub" }, _t("pre.lives", { n: lv })));
      buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => continueRun() }, _t("res.retry")));
    } else {
      title = _t("run.over");
      body.push(...endRun());
      buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => lobby("run") }, _t("run.new")));
    }
  } else if (s.mode === "descent") {
    body.push(h("p", { class: "sub" }, _t("res.reached")));
    buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => lobby("descent") }, _t("res.retry")));
  } else if (s.mode === "daily") {
    body.push(h("p", { class: "sub" }, _t("daily.retry")));
    buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => playLevel("daily", 0, { date: s.date }) }, _t("res.retry")));
  } else if (s.mode === "puzzle") {
    title = _t("puz.out");
    body.push(h("p", { class: "sub" }, _t("puz.outText", { n: e.shotLimit })));
    buttons.push(h("button", { type: "button", class: "primary", autofocus: true, onclick: () => playLevel("puzzle", 0, { index: s.index }) }, _t("res.retry")));
  }
  buttons.push(h("button", { type: "button", class: "secondary", onclick: () => openMode(s.mode) }, _t("res.menu")));
  return h("section", { class: "screen result" }, h("h2", {}, title), ...body, h("div", { class: "buttons" }, buttons));
}

// ---- Run ----------------------------------------------------------------------------------------------------
function runParts() {
  const a = save.run.active;
  if (a) return [
    GameLobby.play({
      eyebrow: _t("mode.run"), title: _t("hud.level", { n: a.level }),
      text: _t("run.code") + " " + a.code + " · " + lives(a.lives) + " · ◆ " + fmt(a.bank),
      action: { label: _t("run.continue"), onClick: () => continueRun() },
      more: [{ label: _t("run.abandon"), onClick: () => abandonRun() }],
    }),
    perkList(a.perks),
  ];
  const starts = unlockedStarts(save.run.best, save.run.bosses);
  let pick = null;
  const chips = h("div", { class: "chips" });
  const drawChips = () => chips.replaceChildren(
    h("button", { type: "button", class: "chip" + (pick == null ? " on" : ""), onclick: () => { pick = null; drawChips(); } }, _t("run.startNone")),
    ...starts.map((id) => h("button", { type: "button", class: "chip" + (pick === id ? " on" : ""), onclick: () => { pick = id; drawChips(); } }, _t("perk." + id))));
  drawChips();
  const code = h("input", { type: "text", maxlength: "9", placeholder: "ABC234", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": _t("run.enterCode") });
  const locked = CONFIG.run.starts.filter(([id]) => !starts.includes(id));
  return [
    GameLobby.play({
      eyebrow: _t("mode.run"), title: save.run.best ? _t("prog.best", { n: save.run.best }) : _t("mode.run"), text: _t("mode.run.rule"),
      action: { label: _t("run.start"), onClick: () => newRun(freshSeed(), pick) },
    }),
    h("div", { class: "panel" },
      h("h3", {}, _t("run.startWith")), chips,
      locked.length ? h("p", { class: "fine" }, _t("run.unlockHint", { what: _t("perk." + locked[0][0]), how: _t("run.ms." + locked[0][1], { n: locked[0][2] }) })) : null,
      h("div", { class: "row" }, code, h("button", { type: "button", class: "secondary", onclick: () => {
        const seed = codeToSeed(code.value);
        if (seed == null) { toast(_t("run.badCode")); return; }
        newRun(seed, pick);
      } }, _t("run.playCode")))),
  ];
}
function abandonRun() {
  const lines = endRun();
  persist();
  showScreen(screen(_t("mode.run"), h("div", { class: "panel center" }, ...lines, h("button", { type: "button", class: "primary", onclick: () => lobby("run") }, _t("run.new")))), { back: () => lobby("run") });
}
function newRun(seed, start) {
  const perks = {};
  if (start) perks[start] = 1;
  const lv = buildMods("run", { workshop: save.workshop, perks }).lives + (perks.life || 0);
  save.run.active = { seed, code: seedToCode(seed), level: 1, lives: lv, perks, bank: 0, start };
  persist();
  continueRun();
}
function continueRun() {
  const a = save.run.active;
  playLevel("run", a.level, { seed: a.seed, code: a.code, bank: a.bank });
}
/** Bank the run's credits and close it. Returns lines for the summary. */
function endRun() {
  const a = save.run.active;
  if (!a) return [];
  award(a.bank);
  save.run.active = null;
  const reached = a.level;
  return [h("p", { class: "big" }, _t("run.reached", { n: reached })), h("p", { class: "total" }, _t("run.bankedTotal"), " ", credits(a.bank))];
}
function perkList(perks) {
  const ids = Object.keys(perks || {}).filter((k) => perks[k]);
  if (!ids.length) return null;
  return h("p", { class: "fine" }, ids.map((k) => _t("perk." + k) + (perks[k] > 1 ? " ×" + perks[k] : "")).join(" · "));
}
function perkPicker(a, n) {
  const offer = perkOffer(a.seed, n, a.perks);
  const box = h("div", { class: "perks" },
    h("h3", {}, _t("run.pick")),
    offer.map((id) => h("button", { type: "button", class: "perk", onclick: () => {
      a.perks[id] = (a.perks[id] || 0) + 1;
      if (id === "life") a.lives++;
      persist();
      continueRun();
    } }, h("strong", {}, _t("perk." + id)), h("span", {}, _t("perk." + id + ".d")))));
  return box;
}

// ---- Daily ------------------------------------------------------------------------------------------------
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); }

// ---- Shop -------------------------------------------------------------------------------------------------
function shop(tab = "boosts", back = home) {
  leaveLevel();
  const tabs = ["boosts", "workshop", "cosmetics"];
  const content = h("div", { class: "shop-body" });
  const head = h("span", { class: "bal" }, credits(save.credits));
  const refresh = () => { head.replaceChildren(credits(save.credits)); draw(); };
  const buy = (price, ok) => {
    if (save.credits < price) { toast(_t("shop.short", { n: fmt(price - save.credits) })); return; }
    spend(price); ok(); persist(); sound.play("buy"); haptic(15); refresh();
  };
  const draw = () => {
    if (tab === "boosts") {
      content.replaceChildren(h("p", { class: "fine" }, _t("shop.boostsNote")), ...Object.keys(CONFIG.boosts.items).map((id) =>
        h("div", { class: "item" },
          h("img", { src: iconURL(boostIcon(id), CAPSULE_COLORS[boostIcon(id)]), alt: "" }),
          h("div", {}, h("strong", {}, _t("boost." + id)), h("small", {}, _t("boost." + id + ".d")), h("small", { class: "own" }, _t("shop.owned", { n: save.boosts[id] || 0 }))),
          h("button", { type: "button", class: "price", onclick: () => buy(boostPrice(id), () => { save.boosts[id] = (save.boosts[id] || 0) + 1; }) }, credits(boostPrice(id))))));
    } else if (tab === "workshop") {
      content.replaceChildren(h("p", { class: "fine" }, _t("shop.wsNote")), ...Object.keys(CONFIG.workshop.items).map((id) => {
        const lvl = wsLevel(save.workshop, id), max = CONFIG.workshop.items[id].max;
        const price = workshopPrice(id, lvl + 1);
        return h("div", { class: "item" },
          h("div", { class: "pips", "aria-label": _t("shop.level", { n: lvl, max }) }, Array.from({ length: max }, (_, i) => h("i", { class: i < lvl ? "on" : "" }))),
          h("div", {}, h("strong", {}, _t("ws." + id)), h("small", {}, _t("ws." + id + ".d")), h("small", { class: "own" }, _t("shop.level", { n: lvl, max }))),
          price == null ? h("span", { class: "maxed" }, _t("shop.max")) : h("button", { type: "button", class: "price", onclick: () => buy(price, () => { save.workshop[id] = lvl + 1; }) }, credits(price)));
      }));
    } else {
      const shelves = Object.keys(CONFIG.cosmetics);
      content.replaceChildren(h("p", { class: "fine" }, _t("shop.cosNote")), ...shelves.map((shelf) => h("div", { class: "shelf" },
        h("h3", {}, _t("shelf." + shelf)),
        h("div", { class: "cos" }, cosmetics().filter((c) => c.shelf === shelf).map((c) => {
          const owned = !!save.owned[c.id], on = save.look[shelf] === c.id;
          return h("button", { type: "button", class: "cos-item" + (on ? " on" : ""), "aria-pressed": String(on), onclick: () => {
            if (owned) { save.look[shelf] = c.id; persist(); applySettings(); sound.play("click"); refresh(); if (shelf === "sound") sound.play("clear"); }
            else buy(c.price, () => { save.owned[c.id] = true; save.look[shelf] = c.id; applySettings(); });
          } }, swatch(c.id, shelf), h("span", {}, _t("cos." + c.id)), owned ? h("small", {}, on ? _t("shop.equipped") : _t("shop.ownedShort")) : credits(c.price));
        })))));
    }
  };
  const tabBar = h("div", { class: "tabs", role: "tablist" }, tabs.map((t) => h("button", { type: "button", role: "tab", "aria-selected": String(t === tab), class: t === tab ? "on" : "", onclick: (ev) => {
    tab = t; for (const b of tabBar.children) { b.classList.toggle("on", b === ev.currentTarget); b.setAttribute("aria-selected", String(b === ev.currentTarget)); } draw();
  } }, _t("shop." + t))));
  draw();
  showScreen(screenWith(_t("shop"), head, [tabBar, content, h("p", { class: "fine center" }, _t("shop.never"))]), { back });
}
function swatch(id, shelf) {
  const el = h("i", { class: "sw sw-" + shelf, "aria-hidden": "true" });
  if (shelf === "theme") { const t = THEMES[id]; el.style.background = `linear-gradient(${t.bg[0]}, ${t.bg[1]})`; }
  else if (shelf === "bricks") { const s = BRICK_SETS[id]; el.style.background = `linear-gradient(90deg, ${s.slice(0, 4).join(",")})`; }
  else el.classList.add(id.replace(".", "-"));
  return el;
}

// ---- Stats, help, settings ------------------------------------------------------------------------------------
function stats() {
  leaveLevel();
  const s = save.stats;
  const rows = [
    ["stats.classic", s.classicBest || "–"], ["stats.run", s.runBest || "–"], ["stats.cleared", fmt(s.cleared)],
    ["stats.bricks", fmt(s.bricks)], ["stats.earned", fmt(s.earned)], ["stats.spent", fmt(s.spent)],
    ["stats.puzzle", Object.values(save.puzzle.stars).reduce((a, b) => a + b, 0) + " / " + PUZZLES.length * 3],
  ];
  const times = TIME_ATTACK.filter((w) => save.ta.best[w.name]).map((w) => [_t("ta." + w.name), fmtTime(save.ta.best[w.name])]);
  showScreen(screen(_t("stats"), h("dl", { class: "stats" }, rows.map(([k, v]) => [h("dt", {}, _t(k)), h("dd", {}, String(v))])),
    times.length ? [h("h3", {}, _t("stats.times")), h("dl", { class: "stats" }, times.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]))] : null));
}

function help() {
  leaveLevel();
  const capRow = (id, risky) => h("li", {}, h("img", { src: iconURL(id, risky ? "#ff8a80" : CAPSULE_COLORS[id]), alt: "" }), h("div", {}, h("strong", {}, _t((risky ? "risky." : "cap.") + id)), h("small", {}, _t((risky ? "risky." : "cap.") + id + ".d"))));
  showScreen(screen(_t("help"),
    h("div", { class: "panel" }, h("h3", {}, _t("help.controls")), h("ul", { class: "how" }, ["c1", "c2", "c3", "c4"].map((k) => h("li", { html: _t("help." + k) })))),
    h("div", { class: "panel" }, h("h3", {}, _t("help.bricks")), h("ul", { class: "how" }, ["normal", "tough", "steel", "explosive", "moving", "regen", "portal", "gift", "ghost", "core"].map((k) => h("li", { html: _t("brick." + k) })))),
    h("div", { class: "panel" }, h("h3", {}, _t("help.good")), h("ul", { class: "caps" }, Object.keys(CONFIG.capsules).map((id) => capRow(id, false))), h("p", { class: "fine" }, _t("help.goodRules"))),
    h("div", { class: "panel" }, h("h3", {}, _t("help.risky")), h("p", { class: "fine" }, _t("help.riskyRules")), h("ul", { class: "caps" }, Object.keys(CONFIG.risky).map((id) => capRow(id, true)))),
    h("div", { class: "panel" }, h("h3", {}, _t("help.modes")), h("ul", { class: "how" }, MODE_ORDER.map((m) => h("li", {}, h("strong", {}, _t("mode." + m))," ", _t("mode." + m + ".long"))))),
    h("div", { class: "panel" }, h("h3", {}, _t("help.credits")), h("p", { class: "fine" }, _t("help.creditsText")))));
}

function settings(back = home) {
  if (!session) leaveLevel();
  const s = save.settings;
  const set = (k, v) => { s[k] = v; persist(); applySettings(); };
  const toggle = (k, label) => h("label", { class: "toggle" }, h("span", {}, _t(label)),
    h("input", { type: "checkbox", checked: k === "reducedMotion" ? reducedMotion() : !!s[k], onchange: (ev) => set(k, ev.target.checked) }));
  const slider = (k, label, min, max, step) => h("label", { class: "slider" }, h("span", {}, _t(label)),
    h("input", { type: "range", min, max, step, value: s[k], oninput: (ev) => set(k, Number(ev.target.value)) }));
  const io = h("textarea", { rows: "3", "aria-label": _t("set.saveText"), placeholder: _t("set.pastePlaceholder") });
  const file = h("input", { type: "file", accept: "application/json,.json,.txt", hidden: true, onchange: async (ev) => { const f = ev.target.files[0]; if (f) io.value = await f.text(); } });
  showScreen(screenWith(_t("settings"), null, [
    h("div", { class: "panel" },
      slider("sound", "set.sound", 0, 1, 0.05),
      slider("music", "set.music", 0, 1, 0.05),
      toggle("haptics", "set.haptics"),
      h("label", { class: "toggle" }, h("span", {}, _t("set.palette")),
        h("select", { onchange: (ev) => set("palette", ev.target.value) },
          h("option", { value: "default", selected: s.palette !== "cb" }, _t("set.palette.default")),
          h("option", { value: "cb", selected: s.palette === "cb" }, _t("set.palette.cb")))),
      toggle("reducedMotion", "set.reducedMotion"),
      toggle("leftHanded", "set.leftHanded"),
      toggle("autoLaunch", "set.autoLaunch"),
      toggle("aimAssist", "set.aimAssist"),
      slider("sensitivity", "set.sensitivity", 0.5, 2, 0.05)),
    h("div", { class: "panel" },
      h("h3", {}, _t("set.save")),
      h("p", { class: "fine" }, _t("set.saveNote")),
      h("div", { class: "row wrap" },
        h("button", { type: "button", class: "secondary", onclick: () => {
          const text = exportSave(save);
          io.value = text;
          try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
          const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: "wallbreaker-save.json" });
          a.click();
          toast(_t("set.exported"));
        } }, _t("set.export")),
        h("button", { type: "button", class: "secondary", onclick: () => file.click() }, _t("set.openFile")),
        h("button", { type: "button", class: "secondary", onclick: () => {
          try {
            const data = importSave(io.value);
            if (!confirm(_t("set.importConfirm"))) return;
            save = data; persist(); applySettings(); toast(_t("set.imported")); settings(back);
          } catch (err) { toast(_t("set.importBad." + err.message)); }
        } }, _t("set.import"))),
      io, file,
      h("button", { type: "button", class: "link danger", onclick: () => {
        if (!confirm(_t("set.resetConfirm"))) return;
        save = freshSave(); persist(); applySettings(); toast(_t("set.reset")); settings(back);
      } }, _t("set.resetBtn")))]), { back });
}

// ---- Back (top left) and the menu drawer (top right), shared/js/gamenav.js --------------------------------
// In a level the drawer is the pause menu: opening it pauses, closing it plays on. On the menus it holds
// the shop, rules, stats, settings and the language.
const nav = GameNav.create({
  title: () => (session && paused ? _t("paused") : "Wallbreaker"),
  onOpen() { pauseGame({ drawer: false }); },
  // Closing resumes, unless the chosen item showed a screen (settings) or left the level: those run
  // right after onClose, so wait for them before deciding.
  onClose() { queueMicrotask(() => { if (session && paused && overlay().hidden) resumeGame(); }); },
  items: () => {
    const s = session, inLevel = s && !s.ending;
    return [
      inLevel && { icon: "play", label: _t("resume"), onSelect() {} },
      inLevel && { icon: "restart", label: _t("restart"), onSelect() { const o = s.opts; leaveLevel(); playLevel(s.mode, s.number, o); } },
      s && { icon: "help", label: _t("help"), note: inLevel ? _t("pause.note") : "", html: "<ul>" + ["c1", "c2", "c3", "c4"].map((k) => "<li>" + _t("help." + k) + "</li>").join("") + "</ul>" },
      inLevel && { icon: "gear", label: _t("settings"), onSelect() { settings(() => { hideScreen(); nav.open(); }); } },
      !s && { icon: "shop", label: _t("shop"), onSelect: () => shop() },
      !s && { icon: "help", label: _t("help"), onSelect: () => help() },
      !s && { icon: "trophy", label: _t("stats"), onSelect: () => stats() },
      !s && { icon: "gear", label: _t("settings"), onSelect: () => settings() },
      !s && GameNav.language(),
    ];
  },
});
/** Put the two buttons where they belong: in the HUD during a level, else in the head of the menu screen. */
function placeNav() {
  const head = !overlay().hidden && overlay().querySelector(".screen-head");
  if (head) {
    head.prepend(nav.back); head.append(nav.menu);
    if (screenBack) nav.setBack(() => { sound.play("click"); screenBack(); }); else nav.setBack();
  } else if (session) {
    $("#hud").prepend(nav.back); $("#hud").append(nav.menu);
    nav.setBack(quitLevel, _t("quit"));
  }
}
/** Leave the level for its mode's menu. Quitting mid-level costs nothing. */
function quitLevel() {
  const m = session && session.mode;
  leaveLevel();
  openMode(m);
}

// ---- Pause --------------------------------------------------------------------------------------------------
function pauseGame({ drawer = true } = {}) {
  if (!session || session.ending || paused) return;
  paused = true;
  sound.stopMusic();
  stopLoop();
  R.draw(session.engine, performance.now(), { aim });
  if (drawer) nav.open();
}
function resumeGame() {
  if (!session) return;
  if (nav.isOpen()) { nav.close(); return; } // closing the drawer resumes (see nav.onClose)
  hideScreen();
  paused = false;
  sound.startMusic();
  startLoop();
}

// ---- Input ----------------------------------------------------------------------------------------------------
const ptrs = new Map();
let primary = null;
function onDown(ev) {
  sound.unlock();
  if (!session || paused || session.ending) return;
  const e = session.engine;
  ev.preventDefault();
  try { ev.target.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
  ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), moved: 0 });
  if (primary == null) primary = ev.pointerId;
  if (e.rules.play === "aim" && ev.pointerId === primary) updateAim(ev);
}
function onMove(ev) {
  if (!session || paused) return;
  const e = session.engine;
  const p = ptrs.get(ev.pointerId);
  if (!p) {
    // A mouse without a button held: the paddle follows the pointer directly.
    if (ev.pointerType === "mouse" && e.rules.play === "paddle") e.setPaddle(R.toWorld(ev.clientX, ev.clientY)[0]);
    return;
  }
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  p.x = ev.clientX; p.y = ev.clientY;
  p.moved += Math.abs(dx) + Math.abs(dy);
  if (ev.pointerId !== primary) return;
  if (e.rules.play === "paddle") {
    if (ev.pointerType === "mouse") e.setPaddle(R.toWorld(ev.clientX, ev.clientY)[0]);
    else e.setPaddle(e.paddle.x + (dx / R.scale) * save.settings.sensitivity); // relative drag: the thumb never covers the paddle
  } else updateAim(ev);
}
function onUp(ev) {
  const p = ptrs.get(ev.pointerId);
  ptrs.delete(ev.pointerId);
  const wasPrimary = ev.pointerId === primary;
  if (wasPrimary) primary = ptrs.size ? ptrs.keys().next().value : null;
  if (!p || !session || paused || session.ending) return;
  const e = session.engine;
  if (e.rules.play === "paddle") {
    if (p.moved < 12 && performance.now() - p.t0 < 350) e.tap();
  } else if (wasPrimary && aim != null && ev.type === "pointerup") {
    if (e.fire(aim)) aim = null;
  }
}
function updateAim(ev) {
  const e = session.engine;
  if (e.state !== "aim") return;
  const [wx, wy] = R.toWorld(ev.clientX, ev.clientY);
  const dx = wx - e.launcher.x, dy = wy - e.launcher.y;
  if (dy > -12) { aim = null; return; } // below the launcher: cancel
  aim = Math.max(-78 * DEG, Math.min(78 * DEG, Math.atan2(dx, -dy)));
}
function keyboardControl(e, dt) {
  const left = keys.has("ArrowLeft") || keys.has("a"), right = keys.has("ArrowRight") || keys.has("d");
  if (!left && !right) return;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (e.rules.play === "paddle") e.setPaddle(e.paddle.x + dir * 420 * dt * save.settings.sensitivity);
  else if (e.state === "aim") aim = Math.max(-78 * DEG, Math.min(78 * DEG, (aim == null ? 0 : aim) + dir * 50 * DEG * dt));
}
function onKey(ev) {
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (ev.type === "keyup") { keys.delete(k); return; }
  if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
  if (!session || session.ending) return;
  if (k === "Escape" || k === "p") { ev.preventDefault(); paused ? resumeGame() : pauseGame(); return; }
  if (paused) return;
  keys.add(k);
  if (k === " " || k === "Enter" || k === "ArrowUp") {
    ev.preventDefault();
    const e = session.engine;
    if (e.rules.play === "paddle") e.tap();
    else if (e.state === "aim") { if (e.fire(aim == null ? 0 : aim)) aim = null; }
  }
  if (k.startsWith("Arrow")) ev.preventDefault();
}

// ---- Shell contract -------------------------------------------------------------------------------------------
function on(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }

function init() {
  if (started) return;
  started = true;
  storage = makeStorage();
  save = loadSave(storage);
  sound = new Sound();
  R = new Renderer($("#cv"), _t);
  applySettings();
  menuEngine = new Engine({ level: level1(), rules: MODES.zen, events: () => {} });
  const cv = $("#cv");
  on(cv, "pointerdown", onDown);
  on(window, "pointermove", onMove);
  on(window, "pointerup", onUp);
  on(window, "pointercancel", onUp);
  on(window, "keydown", onKey);
  on(window, "keyup", onKey);
  on(window, "resize", resize);
  on(document, "visibilitychange", () => { if (document.visibilityState === "hidden") { pauseGame(); persist(); sound.suspend(); } else sound.resume(); });
  on(window, "contextmenu", (ev) => { if (session) ev.preventDefault(); });
  resize();
  home();
  if ("serviceWorker" in navigator && !(window.Platform && Platform.isApp) && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
function destroy() {
  leaveLevel();
  persist();
  for (const [t, type, fn, opts] of listeners) t.removeEventListener(type, fn, opts);
  listeners.length = 0;
  hideScreen();
  started = false;
}

window.Wallbreaker = {
  init,
  pause: () => { pauseGame(); persist(); },
  resume: () => { if (session && paused) resumeGame(); },
  destroy,
  /** For tests and the console: the running engine, if any. */
  get engine() { return session ? session.engine : null; },
  get save() { return save; },
};
init();
