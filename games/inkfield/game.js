// Inkfield: the app shell. Input, the fixed-step loop, the HUD, the menu and the result screen,
// sound and saving. The rules live in src/sim.js, the computer players in src/bots.js, and
// src/render.js draws it all with three.js.
//
// Saves under "inkfield.v1" in localStorage: the chosen difficulty, a few stats per difficulty,
// and the sound and vibration switches.
import { CONFIG } from "./src/config.js";
import { World } from "./src/sim.js";
import { makeBots } from "./src/bots.js";
import { Rng, freshSeed } from "./src/rng.js";
import { Renderer, Minimap } from "./src/render.js";
import { Sound } from "./src/audio.js";

const _t = I18n.t;
const $ = (id) => document.getElementById(id);
const DIFFS = ["easy", "normal", "hard"];
const DT = 1 / CONFIG.hz;
const pct = (x, d = 2) => (100 * x).toFixed(d);

// ---- Saving -------------------------------------------------------------------------------------------------
const SAVE_KEY = "inkfield.v1";
function loadSave() {
  const fresh = { diff: "normal", stats: {}, sound: true, haptics: true };
  try { return Object.assign(fresh, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { return fresh; }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }
const save = loadSave();
const statsFor = (d) => (save.stats[d] = save.stats[d] || { games: 0, wins: 0, best: 0, kills: 0 });

// ---- State --------------------------------------------------------------------------------------------------
let state = "menu";          // menu | play | pause | over
let world = null, bots = [], me = null, diff = DIFFS.includes(save.diff) ? save.diff : "normal";
let rafId = 0, lastTs = 0, acc = 0, hudT = 0, endT = -1, peak = 0;
const sound = new Sound();
sound.on = save.sound;
const R = new Renderer($("cv"), $("labels"));
const mini = new Minimap($("mini"));

function haptic(ms) { if (save.haptics) Platform.haptic(ms); }

// ---- A match ------------------------------------------------------------------------------------------------
function newMatch() {
  const seed = freshSeed();
  const n = CONFIG.difficulty[diff].bots;
  const rng = new Rng(seed ^ 0x2545f491);
  const pool = CONFIG.names.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  world = new World({ seed, players: n + 1, names: [_t("you"), ...pool] });
  bots = makeBots(world, diff, rng);
  me = world.players[1];
  peak = 0; endT = -1; acc = 0;
  R.setWorld(world, CONFIG.colors);
  mini.setWorld(world, CONFIG.colors);
  $("feed").replaceChildren();
  input.dir = null;
  updateHud(true);
}

function step() {
  if (state === "play" && input.dir != null && me.alive) me.target = input.dir;
  else if (state === "play" && me.alive) me.target = keyDir() ?? mouseDir() ?? me.target;
  for (const b of bots) b.update(DT);
  world.step(DT);
  for (const e of world.events) onEvent(e);
  world.events.length = 0;
  peak = Math.max(peak, world.share(me));
}

function onEvent(e) {
  const P = world.players;
  if (e.type === "capture") {
    if (e.id === 1 && e.gained > 0) {
      sound.claim(e.gained);
      haptic(10);
      const share = e.gained / (world.N * world.N);
      if (share >= 0.0005) feed(_t("feed.claim", { p: pct(share, 2) }), "claim"); // tiny claims aren't news
    }
    return;
  }
  // Someone is out.
  const v = P[e.id], k = P[e.by];
  if (e.id === 1) {
    sound.out();
    haptic(60);
    endT = 1.1; // let it sink in, then show the result
    return;
  }
  if (e.by === 1) {
    sound.cut();
    haptic(25);
    feed(_t(e.how === "land" ? "feed.youTook" : "feed.youCut", { name: v.name }), "kill");
  } else if (e.how === "self") feed(_t("feed.self", { name: v.name }));
  else if (k) feed(_t(e.how === "land" ? "feed.took" : e.how === "head" ? "feed.head" : "feed.cut", { a: e.how === "head" ? v.name : k.name, b: e.how === "head" ? k.name : v.name }));
  if (me.alive && world.winner() === me) { sound.win(); haptic(40); endT = 0.9; }
}

function feed(text, kind) {
  const el = document.createElement("div");
  el.textContent = text;
  if (kind) el.className = kind;
  const f = $("feed");
  f.prepend(el);
  while (f.children.length > 3) f.lastChild.remove();
  setTimeout(() => el.classList.add("gone"), 2200);
  setTimeout(() => el.remove(), 2700);
}

// ---- Loop ---------------------------------------------------------------------------------------------------
function frame(ts) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - (lastTs || ts)) / 1000);
  lastTs = ts;
  if (state === "play") {
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 8) { step(); acc -= DT; }
    if (n >= 8) acc = 0;
    if (endT >= 0 && (endT -= dt) < 0) finish();
  }
  R.draw(dt, me.alive ? me : null);
  mini.draw(dt, { x: R.cam.x, y: R.cam.y, w: R.w / R.ppc, h: R.h / R.ppc });
  hudT -= dt;
  if (hudT <= 0) { hudT = 0.15; updateHud(); }
}
function startLoop() { if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(frame); } }
function stopLoop() { cancelAnimationFrame(rafId); rafId = 0; }
function renderOnce() { R.draw(1, me); mini.t = 0; mini.draw(0); }

// ---- HUD ----------------------------------------------------------------------------------------------------
let lastRanks = "";
function updateHud() {
  if (!world) return;
  const s = world.share(me);
  $("share").textContent = pct(s) + "%";
  $("shareBar").style.width = Math.min(100, 100 * s * 4) + "%"; // full bar at 25%
  $("kills").textContent = me.kills;
  $("left").textContent = world.alive.filter((p) => p !== me).length;
  const top = world.alive.slice().sort((a, b) => b.area - a.area);
  const rows = top.slice(0, 5);
  if (me.alive && !rows.includes(me)) rows.push(me);
  const html = rows.map((p) => `<li class="${p === me ? "me" : ""}" style="--c:${CONFIG.colors[p.id]}"><span>${top.indexOf(p) + 1}</span><b>${esc(p.name)}</b><i>${pct(world.share(p), 1)}%</i></li>`).join("");
  if (html !== lastRanks) { $("ranks").innerHTML = html; lastRanks = html; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Input: drag anywhere (a floating stick), keys, or the mouse -------------------------------------------
const input = { id: null, ox: 0, oy: 0, dir: null, mx: null, my: null };
const STICK = 46; // px: how far the stick's centre trails behind the finger
const cv = $("cv");
cv.addEventListener("pointerdown", (e) => {
  sound.unlock();
  if (state !== "play" || input.id != null) return;
  if (e.pointerType === "mouse") return; // the mouse steers by pointing, see mouseDir
  input.id = e.pointerId; input.ox = e.clientX; input.oy = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  showStick(e.clientX, e.clientY, e.clientX, e.clientY);
});
cv.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") { input.mx = e.clientX; input.my = e.clientY; return; }
  if (e.pointerId !== input.id) return;
  let dx = e.clientX - input.ox, dy = e.clientY - input.oy;
  const len = Math.hypot(dx, dy);
  if (len > 8) input.dir = Math.atan2(dy, dx); // screen and board both have y pointing down
  if (len > STICK) { input.ox = e.clientX - (dx / len) * STICK; input.oy = e.clientY - (dy / len) * STICK; }
  showStick(input.ox, input.oy, e.clientX, e.clientY);
});
const release = (e) => { if (e.pointerId === input.id) { input.id = null; $("stick").classList.remove("on"); } };
cv.addEventListener("pointerup", release);
cv.addEventListener("pointercancel", release);
cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") input.mx = null; });
function showStick(ox, oy, x, y) {
  const s = $("stick");
  s.classList.add("on");
  s.style.transform = `translate(${ox}px, ${oy}px)`;
  const dx = x - ox, dy = y - oy, len = Math.hypot(dx, dy), k = len > 30 ? 30 / len : 1;
  $("knob").style.transform = `translate(${dx * k}px, ${dy * k}px)`;
}
function mouseDir() {
  if (input.mx == null || !me) return null;
  const s = R.project(me.x, me.y);
  const dx = input.mx - s.x, dy = input.my - s.y;
  return Math.hypot(dx, dy) > 12 ? Math.atan2(dy, dx) : null;
}
const keys = {};
function keyDir() {
  const x = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const y = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  return x || y ? Math.atan2(y, x) : null;
}
addEventListener("keydown", (e) => {
  sound.unlock();
  if (e.code.startsWith("Arrow")) e.preventDefault();
  keys[e.code] = true;
  if (e.code.startsWith("Arrow") || /^Key[WASD]$/.test(e.code)) input.dir = null, input.mx = null;
  if (state === "menu" && e.code === "Enter" && document.activeElement?.tagName !== "BUTTON") play();
  else if (state === "play" && (e.code === "Escape" || e.code === "KeyP")) setState("pause");
});
addEventListener("keyup", (e) => { keys[e.code] = false; });

// ---- Screens ------------------------------------------------------------------------------------------------
function setState(s) {
  state = s;
  document.body.className = "state-" + s;
  $("menu").hidden = s !== "menu";
  $("result").hidden = s !== "over";
  if (s === "pause") nav.open(); else if (nav.isOpen()) nav.close();
  placeNav();
  if (s === "play") startLoop(); else { stopLoop(); renderOnce(); }
}

function play() {
  sound.unlock();
  newMatch();
  setState("play");
}

function finish() {
  endT = -1;
  const won = me.alive;
  const st = statsFor(diff);
  st.games++;
  if (won) st.wins++;
  st.best = Math.max(st.best, peak);
  st.kills = Math.max(st.kills, me.kills);
  writeSave();
  const killer = world.players[me.killedBy];
  $("resultTitle").textContent = _t(won ? "res.win" : "res.out");
  $("resultText").textContent = won ? _t("res.winText") : _t("res." + (me.how || "cut"), { name: killer ? killer.name : "" });
  const place = won ? 1 : world.alive.length + 1;
  const secs = Math.round(won ? world.time : me.diedAt);
  $("resultStats").innerHTML = [
    [_t("res.share"), pct(peak) + "%"], [_t("res.kills"), me.kills],
    [_t("res.time"), `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`],
    [_t("res.place"), `${place}/${world.players.length - 1}`],
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  setState("over");
}

// The start screen is the lobby (shared/js/gamelobby.js): difficulty tabs and one big Play.
function refreshMenu() {
  const st = statsFor(diff);
  const n = CONFIG.difficulty[diff].bots;
  $("lobby").replaceChildren(
    GameLobby.tabs({
      label: _t("diff"), value: diff,
      options: DIFFS.map((d) => ({ value: d, label: _t("diff." + d), meta: _t("diff.bots", { n: CONFIG.difficulty[d].bots }) })),
      onChoose: (d) => { diff = save.diff = d; writeSave(); refreshMenu(); },
    }),
    GameLobby.play({
      title: _t("playTitle", { d: _t("diff." + diff) }),
      text: st.best ? _t("playText", { p: pct(st.best, 1) }) : _t("playNew", { n }),
      action: { label: _t("play"), onClick: play },
      stats: [[st.games, _t("st.games")], [st.wins, _t("st.wins")], [st.kills, _t("st.kills")]],
    }));
}

// ---- Back (top left) and the menu drawer (top right) ------------------------------------------------------
const nav = GameNav.create({
  title: () => (state === "pause" ? _t("paused") : "Inkfield"),
  onOpen: () => { if (state === "play") setState("pause"); },
  onClose: () => { if (state === "pause") setState("play"); },
  items: () => {
    const inMatch = state === "pause";
    return [
      inMatch && { icon: "play", label: _t("resume"), onSelect() {} },
      inMatch && { icon: "restart", label: _t("restart"), onSelect() { play(); } },
      { icon: "sound", label: _t("sound"), checked: save.sound, onToggle(on) { save.sound = sound.on = on; writeSave(); } },
      { icon: "tap", label: _t("haptics"), checked: save.haptics, onToggle(on) { save.haptics = on; writeSave(); } },
      { icon: "help", label: _t("how"), html: "<ul>" + [1, 2, 3, 4, 5].map((n) => "<li>" + _t("how." + n) + "</li>").join("") + "</ul>" },
      state === "menu" && GameNav.language(),
    ];
  },
});
const navBar = GameNav.bar(nav);
document.body.append(navBar);
function toMenu() { refreshMenu(); newMatch(); setState("menu"); }
function placeNav() {
  if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
  else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
}

$("againBtn").onclick = play;
$("resultMenuBtn").onclick = toMenu;
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") setState("pause"); });
addEventListener("resize", () => { R.resize(); if (state !== "play") renderOnce(); });

// ---- Start: the menu over a fresh board ---------------------------------------------------------------------
refreshMenu();
newMatch();
setState("menu");
window.Inkfield = { get world() { return world; }, get state() { return state; }, play, finish, setState };
