// Starflip: the app shell. Input (touch halves, keys), the frame loop, the score and mission banner,
// the big call-outs, the start and result screens, sound and saving. The rules live in src/rules.js,
// the physics in src/physics.js, the tables in src/tables.js, and src/render.js draws them.
//
// Saves under "starflip.v1" in localStorage: best score, games played, how often each mission was
// done, the best score on each bonus table reached, and the sound and vibration switches.
import { Game } from "./src/rules.js";
import { Renderer, COLORS } from "./src/render.js";
import { Sound } from "./src/audio.js";
import { MISSIONS } from "./src/missions.js";
import { MINIS } from "./src/tables.js";
import { CONFIG } from "./src/config.js";

const _t = I18n.t;
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString(I18n.lang);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Saving -------------------------------------------------------------------------------------------------
const SAVE_KEY = "starflip.v1";
function loadSave() {
  const fresh = { best: 0, games: 0, missions: {}, minis: {}, sound: true, haptics: true };
  try { return Object.assign(fresh, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { return fresh; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }
const save = loadSave();

// ---- State --------------------------------------------------------------------------------------------------
let state = "menu";            // menu | play | pause | over
let game = new Game();
let rafId = 0, lastTs = 0, bannerT = 0;
const sound = new Sound();
sound.on = save.sound;
const R = new Renderer($("cv"));
const labels = {};
for (const k of ["shot.leftOrbit", "shot.rightOrbit", "shot.pad", "shot.wormhole", "shot.drops", "shot.sat", "shot.spinner", "shot.bumpers",
  "table.main", "table.asteroids", "table.gravity", "table.ufo"]) labels[k] = _t(k);
labels.shield = _t("shield");
labels.launch = _t("launch");

function haptic(ms) { if (save.haptics) Platform.haptic(ms); }

// ---- Loop ---------------------------------------------------------------------------------------------------
function frame(ts) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
  lastTs = ts;
  game.update(dt);
  for (const f of game.fx) onFx(f);
  game.fx.length = 0;
  R.draw(game, dt, labels);
  if ((bannerT -= dt) <= 0) { bannerT = 0.1; updateHud(); }
}
function startLoop() { if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(frame); } }
function stopLoop() { cancelAnimationFrame(rafId); rafId = 0; }
function renderOnce() { R.draw(game, 0, labels); }

// ---- What happened: sound, sparks, call-outs, saving ---------------------------------------------------------
const missionName = (id) => _t("m." + id);
const tableName = (id) => _t("table." + id);
/** "Shoot the LEFT ORBIT": a step's shot in words (`at`: where the comet is, for a comet step). */
function stepText(shot, at = game.target()) {
  return shot === "comet" ? _t("do.comet", { shot: _t("shot." + at) }) : _t("do." + shot);
}
function onFx(f) {
  sound.play(f);
  R.event(f);
  switch (f.type) {
    case "serve": if (game.ballNo > 1) callout(_t("c.ball", { n: game.ballNo }), "#fff"); break;
    case "missionStart": callout(_t("c.missionStart", { name: missionName(f.id) }), COLORS.mission); haptic(20); break;
    case "step": callout(_t("c.next", { what: stepText(f.shot, f.at) }), COLORS.mission, true); break;
    case "missionDone":
      save.missions[f.id] = (save.missions[f.id] || 0) + 1; writeSave();
      callout(_t("c.missionDone"), COLORS.mission);
      callout(_t("c.wormholeOpen", { name: tableName(f.mini) }), COLORS.wormhole, true);
      if (f.all) callout(_t("c.allDone"), COLORS.jackpot, true);
      haptic(40);
      break;
    case "missionFail":
      callout(_t(f.why === "time" ? "c.missionFailTime" : "c.missionFail"), "#ff6b6b");
      callout(_t("c.retry"), "#fff", true);
      break;
    case "saved": callout(_t("c.saved"), COLORS.jackpot); break;
    case "skill": callout(_t("c.skill"), COLORS.jackpot); haptic(20); break;
    case "mult": callout(_t("c.mult", { n: f.mult }), COLORS.wormhole); break;
    case "jackpot": callout(_t("c.jackpot"), COLORS.jackpot); haptic(30); break;
    case "superJackpot": callout(_t("c.superJackpot"), COLORS.jackpot); haptic(60); break;
    case "mothership": callout(_t("c.mothership"), COLORS.jackpot); haptic(40); break;
    case "mothershipEnd": callout(_t("c.mothershipEnd", { n: f.round }), COLORS.mission, true); break;
    case "bonus": callout(_t("c.bonus", { b: fmt(f.bonus), m: f.mult }), "#fff"); haptic(50); break;
    case "warp": callout(_t("c.warp"), COLORS.wormhole); haptic(30); break;
    case "miniStart":
      save.minis[f.mini] = save.minis[f.mini] || 0; writeSave();
      R.layout(bannerBottom(), 0);
      callout(tableName(f.mini), COLORS.wormhole);
      callout(_t("mini." + f.mini), "#fff", true);
      break;
    case "miniEnd":
      save.minis[f.mini] = Math.max(save.minis[f.mini] || 0, f.score); writeSave();
      if (!game.practice) callout(_t("c.miniEnd", { p: fmt(f.score) }), COLORS.wormhole);
      break;
    case "supernova": callout(_t("c.supernova"), COLORS.mission); haptic(40); break;
    case "ufoDown": callout(_t("c.ufoDown"), COLORS.jackpot); haptic(40); break;
    case "core": callout(_t("c.core"), COLORS.wormhole); haptic(30); break;
    case "bumper": case "rockBreak": haptic(6); break;
    case "drain": haptic(80); break;
    case "over": setTimeout(finish, 900); break;
  }
}

function callout(text, color, small) {
  const box = $("callouts");
  const el = document.createElement("div");
  el.textContent = text;
  el.style.setProperty("--c", color);
  if (small) el.className = "small";
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 2300);
}

// ---- HUD and banner -----------------------------------------------------------------------------------------
function updateHud() {
  $("score").textContent = fmt(game.score);
  $("ballInfo").innerHTML = game.practice ? esc(_t("hud.practice"))
    : esc(_t("hud.ball", { n: game.ballNo, of: game.balls })) + (game.mult > 1 ? ` · <b>×${game.mult}</b>` : "");
  const v = game.view(), b = $("banner");
  let kind = "mission", tag = "", line = "", sub = "", time = null, bar = 0;
  if (v.kind === "mini") {
    kind = "mini";
    tag = tableName(v.id);
    line = _t("mini." + v.id);
    sub = _t("mini.score", { p: fmt(v.score) });
    time = v.time; bar = v.time / v.timeMax;
  } else if (v.kind === "mothership") {
    kind = "mothership";
    tag = _t("mothership");
    line = _t("b.jackpots", { n: v.left });
  } else if (v.kind === "mission") {
    kind = v.comet ? "comet" : "mission";
    tag = _t("b.missionOf", { n: MISSIONS.findIndex((m) => m.id === v.id) + 1, of: MISSIONS.length }) + " · " + missionName(v.id) +
      (v.steps > 1 ? " · " + _t("b.stepOf", { n: v.step + 1, of: v.steps }) : "");
    line = esc(stepText(MISSIONS.find((m) => m.id === v.id).steps[v.step].shot)) + (v.n > 1 ? ` <small>${v.count}/${v.n}</small>` : "");
    time = v.time; bar = v.time / v.timeMax;
  } else {
    kind = "mission";
    tag = v.next === "mothership" ? _t("b.mothershipNext") : _t("b.next", { name: missionName(v.next) });
    line = esc(_t(v.next === "mothership" ? "b.mothershipStart" : "b.start"));
  }
  if (v.kind !== "mini" && v.kind !== "mission") line = esc(line);
  if (v.kind !== "mini" && game.wormhole) sub = _t("b.wormhole", { name: tableName(game.wormhole) });
  if (game.ready && v.kind !== "mini") {
    // A ball waiting in the plunger lane: say how to launch it first.
    kind = "ready";
    if (!sub) sub = game.skill ? _t("b.skill") : "";
    line = esc(_t("b.ready"));
  }
  b.className = "k-" + kind;
  $("bTag").textContent = tag;
  $("bLine").innerHTML = line;
  $("bSub").textContent = sub;
  $("bSub").style.color = kind === "ready" && !game.wormhole ? "var(--green)" : "";
  const secs = Math.ceil(Math.max(0, time ?? 0));
  $("bTime").textContent = time == null ? "" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  $("bBar").style.width = (time == null ? 0 : Math.max(0, bar) * 100) + "%";
}
function bannerBottom() { return $("banner").getBoundingClientRect().bottom + 4; }

// ---- Input: the two halves of the screen are the flippers; a ball in the plunger lane is launched by
// holding anywhere and letting go. Keys: ← → / Z M / Shift for the flippers, Space or ↓ for the plunger. ----
const pointers = new Map(); // pointer id → "L" | "R" | "P" (the plunger)
const keys = { L: false, R: false };
function syncFlippers() {
  const on = { L: keys.L, R: keys.R };
  for (const side of pointers.values()) if (side !== "P") on[side] = true;
  game.flip("L", on.L);
  game.flip("R", on.R);
}
function releaseAll() {
  pointers.clear();
  keys.L = keys.R = false;
  game.plunge(false);
  syncFlippers();
}
addEventListener("pointerdown", (e) => {
  sound.unlock();
  if (state !== "play" || e.target.closest("button, dialog, .overlay")) return;
  if (game.ready && game.phase === "play" && ![...pointers.values()].includes("P")) {
    pointers.set(e.pointerId, "P");
    game.plunge(true);
  } else {
    pointers.set(e.pointerId, e.clientX < innerWidth / 2 ? "L" : "R");
    syncFlippers();
  }
});
const lift = (e) => {
  const side = pointers.get(e.pointerId);
  if (!side) return;
  pointers.delete(e.pointerId);
  if (side === "P") game.plunge(false);
  else syncFlippers();
};
addEventListener("pointerup", lift);
addEventListener("pointercancel", lift);

const KEYS = { ArrowLeft: "L", KeyZ: "L", ShiftLeft: "L", KeyA: "L", ArrowRight: "R", KeyM: "R", Slash: "R", ShiftRight: "R", KeyL: "R" };
addEventListener("keydown", (e) => {
  sound.unlock();
  if (state === "menu" && e.code === "Enter" && document.activeElement?.tagName !== "BUTTON") return newGame();
  if (state !== "play") return;
  if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) { keys[KEYS[e.code]] = true; syncFlippers(); } }
  else if (e.code === "Space" || e.code === "ArrowDown" || e.code === "Enter") { e.preventDefault(); if (!e.repeat) game.plunge(true); }
  else if (e.code === "Escape" || e.code === "KeyP") setState("pause");
});
addEventListener("keyup", (e) => {
  if (KEYS[e.code]) { keys[KEYS[e.code]] = false; syncFlippers(); }
  else if (e.code === "Space" || e.code === "ArrowDown" || e.code === "Enter") game.plunge(false);
});

// ---- Screens ------------------------------------------------------------------------------------------------
function setState(s) {
  state = s;
  document.body.className = "state-" + s;
  $("menu").hidden = s !== "menu";
  $("result").hidden = s !== "over";
  if (s === "pause") nav.open(); else if (nav.isOpen()) nav.close();
  if (s !== "play") releaseAll();
  placeNav();
  R.layout(s === "menu" ? 0 : bannerBottom(), 0);
  updateHud();
  if (s === "play") startLoop(); else { stopLoop(); renderOnce(); }
}

function newGame(practice = null) {
  sound.unlock();
  game = new Game({ practice });
  $("callouts").replaceChildren();
  setState("play");
}

function finish() {
  if (state !== "play" && state !== "pause") return;
  const prevBest = save.best;
  if (!game.practice) {
    save.games++;
    save.best = Math.max(save.best, game.score);
  }
  writeSave();
  const best = !game.practice && game.score > prevBest && game.score > 0;
  $("resultTitle").textContent = _t(game.practice ? "res.practice" : "res.over");
  $("resultScore").textContent = fmt(game.score);
  const rt = $("resultText");
  rt.className = best ? "best" : "";
  rt.textContent = game.practice ? tableName(game.practice) : best ? _t("res.best") : _t("res.bestWas", { p: fmt(save.best) });
  $("resultStats").innerHTML = (game.practice ? [] : [
    [_t("res.missions"), game.stats.missions], [_t("res.minis"), game.stats.minis], [_t("res.jackpots"), game.stats.jackpots],
  ]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("resultStats").hidden = !!game.practice;
  setState("over");
}

// The start screen: the shared lobby card (one big Play), the six missions, and the bonus tables.
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>';
const MINI_ICON = {
  asteroids: '<svg viewBox="0 0 32 32"><path d="M9 7l8-2 8 4 3 8-3 8-9 3-8-3-4-8z" fill="#8a6a52" stroke="#ffae42" stroke-width="2"/><circle cx="13" cy="13" r="2.5" fill="rgba(0,0,0,.3)"/><circle cx="20" cy="20" r="2" fill="rgba(0,0,0,.3)"/></svg>',
  gravity: '<svg viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="16" rx="14" ry="6" stroke="#b892ff" stroke-width="2"/><ellipse cx="16" cy="16" rx="9" ry="4" stroke="#ff5ad9" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#000" stroke="#ff5ad9"/></svg>',
  ufo: '<svg viewBox="0 0 32 32"><path d="M10 15a6 6 0 0 1 12 0z" fill="rgba(140,255,200,.5)"/><ellipse cx="16" cy="17" rx="14" ry="5" fill="#9aa7bd" stroke="#7dff6a" stroke-width="2"/><circle cx="10" cy="18" r="1.5" fill="#ffd23f"/><circle cx="16" cy="18.5" r="1.5" fill="#ff5ad9"/><circle cx="22" cy="18" r="1.5" fill="#ffd23f"/></svg>',
};
function refreshMenu() {
  const missionsDone = MISSIONS.filter((m) => save.missions[m.id]).length;
  $("lobby").replaceChildren(GameLobby.play({
    title: _t("playTitle"),
    text: save.best ? _t("playText", { p: fmt(save.best) }) : _t("playNew"),
    action: { label: _t("play"), onClick: () => newGame() },
    stats: [[save.games, _t("st.games")], [`${missionsDone}/${MISSIONS.length}`, _t("st.missions")], [Object.keys(save.minis).length + "/" + MINIS.length, _t("st.minis")]],
  }));
  $("missionList").innerHTML = MISSIONS.map((m) => `<li class="${save.missions[m.id] ? "done" : ""}">${STAR_SVG}<span><b>${esc(missionName(m.id))}</b><small>${esc(_t("md." + m.id))}</small></span>` +
    `<span class="to">→ ${esc(tableName(m.mini))}</span></li>`).join("");
  $("miniList").replaceChildren(...MINIS.map((id) => {
    const b = document.createElement("button");
    b.type = "button";
    const open = id in save.minis;
    b.disabled = !open;
    b.innerHTML = `<span class="ico" aria-hidden="true">${MINI_ICON[id]}</span><b>${esc(tableName(id))}</b><small>${esc(open ? _t("bonus.best", { p: fmt(save.minis[id]) }) : _t("bonus.locked"))}</small>`;
    if (open) { b.setAttribute("aria-label", _t("bonus.play", { name: tableName(id) })); b.onclick = () => newGame(id); }
    return b;
  }));
}

// ---- Back (top left) and the menu drawer (top right) --------------------------------------------------------
const nav = GameNav.create({
  title: () => (state === "pause" ? _t("paused") : "Starflip"),
  onOpen: () => { if (state === "play") setState("pause"); },
  onClose: () => { if (state === "pause") setState("play"); },
  items: () => {
    const inGame = state === "pause";
    return [
      inGame && { icon: "play", label: _t("resume"), onSelect() {} },
      inGame && { icon: "restart", label: _t("restart"), onSelect() { newGame(game.practice); } },
      { icon: "sound", label: _t("sound"), checked: save.sound, onToggle(on) { save.sound = sound.on = on; writeSave(); } },
      { icon: "tap", label: _t("haptics"), checked: save.haptics, onToggle(on) { save.haptics = on; writeSave(); } },
      { icon: "help", label: _t("how"), html: "<ul>" + [1, 2, 3, 4, 5].map((n) => "<li>" + _t("how." + n) + "</li>").join("") + "</ul>" },
      state === "menu" && GameNav.language(),
    ];
  },
});
const navBar = GameNav.bar(nav);
document.body.append(navBar);
function toMenu() { refreshMenu(); game = new Game(); setState("menu"); }
function placeNav() {
  if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
  else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
}

$("againBtn").onclick = () => newGame(game.practice);
$("resultMenuBtn").onclick = toMenu;
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") setState("pause"); });
addEventListener("resize", () => { R.layout(state === "menu" ? 0 : bannerBottom(), 0); if (state !== "play") renderOnce(); });

// ---- Start: the menu over the table -------------------------------------------------------------------------
refreshMenu();
setState("menu");
window.Starflip = { get game() { return game; }, get state() { return state; }, newGame, finish, setState, CONFIG };
