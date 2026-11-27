// Emberholm: the app shell. Renderer and frame loop, the start screen, the HUD, the map, settings
// and saving. The island comes from src/world (pure maths), walking from src/sim/player.js,
// day and night from src/sim/time.js; src/render draws it all with three.js r186.
//
// This is milestone M0 of docs/EMBERHOLM.md: walk around the island at 30 fps on a phone.
//
// Saves under "emberholm.v1" in localStorage: where you are, the time of day, the places you've
// found, and the settings.
import * as THREE from "../../shared/vendor/three-r186/three.module.js";
import { CONFIG } from "./src/config.js";
import { Player } from "./src/sim/player.js";
import { Clock, sky } from "./src/sim/time.js";
import { START, PLACES, FELLS_Z } from "./src/world/places.js";
import { WorldView } from "./src/render/world.js";
import { Hero } from "./src/render/hero.js";
import { ChaseCamera } from "./src/render/camera.js";
import { Controls } from "./src/ui/controls.js";
import { IslandMap } from "./src/ui/map.js";

const _t = I18n.t;
const $ = (id) => document.getElementById(id);
const DT = 1 / 60;
const isTouch = matchMedia("(pointer: coarse)").matches;
const portrait = matchMedia("(orientation: portrait) and (pointer: coarse)");
const SUBTITLES = new Set(["wreck", "brandvik", "fells"]);

// ---- Saving -------------------------------------------------------------------------------------------------
const SAVE_KEY = "emberholm.v1";
function loadSave() {
  const fresh = {
    v: 1, started: false, x: START.x, z: START.z, yaw: START.yaw, t: CONFIG.time.start, day: 1, seen: [],
    settings: { quality: "medium", fps: CONFIG.frameCap, perf: false, full: true },
  };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 1) { s.settings = Object.assign(fresh.settings, s.settings || {}); return Object.assign(fresh, s); }
  } catch (e) { /* storage blocked or broken: start fresh */ }
  return fresh;
}
const save = loadSave();
if (/[?&]debug\b/.test(location.search)) save.settings.perf = true;
function writeSave() {
  Object.assign(save, { x: +player.x.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(3), t: +clock.t.toFixed(5), day: clock.day, seen: [...seen] });
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ }
}

// ---- The scene ----------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $("cv"), antialias: false, powerPreference: "high-performance" });
const scene = new THREE.Scene();
const view = new WorldView(scene, save.settings.quality);
const hero = new Hero();
scene.add(hero.root);
const chase = new ChaseCamera(innerWidth / innerHeight);
let player = new Player(save.x, save.z, save.yaw);
const clock = new Clock(save.t, save.day);
const seen = new Set(save.seen);
const map = new IslandMap();
const controls = new Controls($("touch"), $("stick"), $("knob"));
chase.snap(player);

function resize() {
  const q = CONFIG.view.quality[save.settings.quality] || CONFIG.view.quality.medium;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.dpr));
  renderer.setSize(innerWidth, innerHeight, false);
  chase.cam.aspect = innerWidth / innerHeight;
  // In portrait (the start screen on a phone) widen the view a little so the island still fits.
  chase.cam.fov = CONFIG.view.fov * (chase.cam.aspect < 1 ? 1.35 : 1);
  chase.cam.updateProjectionMatrix();
}
resize();

// ---- The frame loop -----------------------------------------------------------------------------------------
let state = "menu";       // menu | play | pause
let mapOpen = false;
let raf = 0, last = 0, acc = 0, hudT = 0, miniT = 0, saveT = 0, idleT = 0;
const perf = { frames: 0, t: 0, work: 0, text: "" };

function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

function frame(ts) {
  raf = requestAnimationFrame(frame);
  const cap = state === "play" ? save.settings.fps : 30;
  if (last && ts - last < 1000 / cap - 3) return;
  const dt = last ? Math.min(0.1, (ts - last) / 1000) : 1 / 30;
  last = ts;
  const t0 = performance.now();
  tick(dt);
  perf.work += performance.now() - t0;
  perf.frames++; perf.t += dt;
  if (perf.t >= 0.5) showPerf();
}

function tick(dt) {
  const playing = state === "play" && !mapOpen && !portrait.matches;
  const input = playing ? controls.read() : { x: 0, y: 0, run: false, camX: 0, camY: 0 };
  if (playing) {
    acc += dt;
    while (acc >= DT) {
      player.step(DT, chase.toWorld(input.x, input.y), input.run);
      clock.advance(DT);
      acc -= DT;
    }
    if ((saveT += dt) > CONFIG.autosave) { saveT = 0; writeSave(); }
    checkPlace();
  } else acc = 0;
  const drag = playing ? controls.takeDrag() : (controls.takeDrag(), [state === "menu" ? -dt * 12 : 0, 0]);
  chase.update(dt, player, drag, input, (performance.now() - controls.lastLook) / 1000);

  hero.root.position.set(player.x, player.y - Math.min(player.depth, 0.5) * 0.4, player.z);
  hero.root.rotation.y = player.yaw;
  hero.update(dt, playing ? player.speed : 0, player.depth > 0.3);

  const settled = view.update(player.x, player.z, state === "play" ? 2 : 4);
  view.frame(dt, performance.now() / 1000, sky(clock.t), player.x, player.y, player.z, chase.cam.position);
  renderer.render(scene, chase.cam);

  if (!map.done) map.work(state === "play" ? 4 : 12);
  if ((hudT += dt) > 0.5) { hudT = 0; updateHud(); }
  if ((miniT += dt) > 0.2 && state !== "menu") { miniT = 0; map.drawMini($("miniCv"), player); }
  // On the start screen, stop drawing once the island is built: no need to warm the phone.
  if (state === "menu" && settled && map.done) { if ((idleT += dt) > 6) stopLoop(); } else idleT = 0;
}

function showPerf() {
  const info = renderer.info.render;
  const fps = perf.frames / perf.t, ms = perf.work / perf.frames;
  perf.frames = 0; perf.t = 0; perf.work = 0;
  if (!save.settings.perf) return;
  const n = view.nature, f = view.natureFar;
  const trees = n.pine.count + n.birch.count + n.deadtree.count + f.pine.count + f.birch.count + f.deadtree.count;
  $("perf").textContent =
    `${fps.toFixed(0)} fps  ${ms.toFixed(1)} ms/frame\n` +
    `${info.calls} draws  ${(info.triangles / 1000).toFixed(0)}k tris\n` +
    `${view.chunks.size} chunks  ${trees} trees  ${n.rock.count + f.rock.count} rocks  ${view.tufts.count} grass\n` +
    `${save.settings.quality} · dpr ${renderer.getPixelRatio().toFixed(2)} · ${player.x.toFixed(0)}, ${player.z.toFixed(0)}`;
}

function updateHud() {
  $("clock").textContent = clock.text;
  $("dayNo").textContent = _t("day", { d: clock.day });
  $("sunIcon").toggleAttribute("hidden", clock.night);   // SVG elements have no .hidden property
  $("moonIcon").toggleAttribute("hidden", !clock.night);
}

// ---- Places: their name shows when you walk in -----------------------------------------------------------------
let here = null, nameTimer = 0;
function placeAt(x, z) {
  if (z < FELLS_Z) return "fells";
  let best = null, bd = Infinity;
  for (const p of PLACES) {
    if (!p.name) continue;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.name && d < bd) { best = p.id; bd = d; }
  }
  return best;
}
function checkPlace() {
  const id = placeAt(player.x, player.z);
  if (id === here) return;
  here = id;
  if (!id) return;
  seen.add(id);
  const el = $("placeName");
  el.querySelector("b").textContent = _t("place." + id);
  el.querySelector("span").textContent = SUBTITLES.has(id) ? _t("sub." + id) : "";
  el.classList.add("on");
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => el.classList.remove("on"), 3200);
}

// ---- The map ------------------------------------------------------------------------------------------------
function openMap() {
  if (state !== "play") return;
  mapOpen = true;
  controls.release();
  $("mapView").hidden = false;
  const cv = $("mapCv"), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(cv.clientWidth * dpr);
  cv.height = Math.round(cv.clientHeight * dpr);
  while (!map.done) map.work(32);
  map.drawFull(cv, player, (id) => _t("place." + id), seen);
}
function closeMap() { mapOpen = false; $("mapView").hidden = true; }
$("mini").addEventListener("click", openMap);
$("mapClose").addEventListener("click", closeMap);
$("mapView").addEventListener("click", (e) => { if (e.target === $("mapView")) closeMap(); });
controls.onKey = (code) => {
  if (code === "KeyM") mapOpen ? closeMap() : openMap();
  else if (code === "Escape") mapOpen ? closeMap() : setState("pause");
};

// ---- Full screen and landscape on phones --------------------------------------------------------------------
async function goFull() {
  if (!isTouch || !save.settings.full) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
  } catch (e) { /* not allowed here (iPhone, desktop): the "turn your phone" screen does the job */ }
}
function leaveFull() {
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
portrait.addEventListener("change", () => { controls.release(); resize(); });

// ---- Screens ------------------------------------------------------------------------------------------------
function setState(s) {
  state = s;
  document.body.className = "state-" + s;
  $("menu").hidden = s !== "menu";
  controls.enabled = s === "play";
  if (s !== "play") controls.release();
  if (s === "pause") nav.open(); else if (nav.isOpen()) nav.close();
  placeNav();
  if (s === "menu") refreshMenu();
  if (s === "pause") writeSave();
  startLoop();
}

function play() {
  if (!save.started) { save.started = true; chase.snap(player); }
  here = null;
  setState("play");
  goFull();
  updateHud();
  map.drawMini($("miniCv"), player);
}

function toMenu() { writeSave(); closeMap(); leaveFull(); setState("menu"); }

function restart() {
  player = new Player(START.x, START.z, START.yaw);
  clock.t = CONFIG.time.start; clock.day = 1;
  chase.snap(player);
  here = null;
  writeSave();
}

function refreshMenu() {
  const lobby = $("lobby");
  const text = save.started
    ? { title: _t("contTitle", { d: clock.day, time: clock.text }), text: _t("contText", { place: placeAt(player.x, player.z) ? _t("place." + placeAt(player.x, player.z)) : _t("wilds") }), label: _t("cont") }
    : { title: _t("beginTitle"), text: _t("beginText"), label: _t("begin") };
  lobby.replaceChildren(GameLobby.play({ title: text.title, text: text.text, action: { label: text.label, onClick: play } }));
}

// ---- Back (top left) and the menu drawer (top right) ------------------------------------------------------
const HOURS = { morning: 8, noon: 13, evening: 19.3, night: 23.5 };
const nav = GameNav.create({
  title: () => (state === "pause" ? _t("paused") : "Emberholm"),
  onOpen: () => { if (state === "play") setState("pause"); },
  onClose: () => { if (state === "pause") setState("play"); },
  items: () => {
    const h = clock.hours;
    const nowTime = Object.keys(HOURS).find((k) => Math.abs(h - HOURS[k]) < 0.6) || "";
    return [
      state === "pause" && { icon: "play", label: _t("resume"), onSelect() {} },
      { heading: _t("set") },
      {
        icon: "view", label: _t("quality"), note: _t("qualityNote"), value: save.settings.quality,
        options: ["low", "medium", "high"].map((v) => ({ value: v, label: _t("q." + v) })),
        onChoose(v) { save.settings.quality = v; view.setQuality(v); resize(); writeSave(); },
      },
      {
        icon: "timer", label: _t("fps"), note: _t("fpsNote"), value: String(save.settings.fps),
        options: [{ value: "30", label: _t("fps.30") }, { value: "60", label: _t("fps.60") }],
        onChoose(v) { save.settings.fps = +v; writeSave(); },
      },
      isTouch && { icon: "fullscreen", label: _t("full"), checked: save.settings.full, onToggle(on) { save.settings.full = on; writeSave(); if (!on) leaveFull(); } },
      { icon: "info", label: _t("perf"), note: _t("perfNote"), checked: save.settings.perf, onToggle(on) { save.settings.perf = on; $("perf").hidden = !on; writeSave(); } },
      { heading: _t("tools") },
      {
        icon: "theme", label: _t("time"), value: nowTime,
        options: Object.keys(HOURS).map((k) => ({ value: k, label: _t("t." + k) })),
        onChoose(v) { clock.setHours(HOURS[v]); updateHud(); startLoop(); },
      },
      { icon: "restart", label: _t("restart"), note: _t("restartNote"), onSelect() { restart(); if (state === "menu") refreshMenu(); startLoop(); } },
      { icon: "help", label: _t("how"), html: "<ul>" + [1, 2, 3, 4, 5].map((n) => "<li>" + _t("how." + n) + "</li>").join("") + "</ul>" },
      state === "menu" && GameNav.language(),
    ];
  },
});
const navBar = GameNav.bar(nav);
document.body.append(navBar);
function placeNav() {
  if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
  else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (state === "play") setState("pause"); else writeSave(); stopLoop(); }
  else startLoop();
});
addEventListener("pagehide", () => writeSave());
addEventListener("resize", () => { resize(); startLoop(); });

// ---- Start: the start screen over the island ------------------------------------------------------------------
$("perf").hidden = !save.settings.perf;
updateHud();
setState("menu");
window.Emberholm = {
  get player() { return player; }, get state() { return state; }, get mapOpen() { return mapOpen; },
  clock, view, renderer, controls, chase, play, setState, openMap, closeMap,
};
