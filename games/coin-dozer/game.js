// Coin Dozer: the app shell. Input, the fixed-step loop, the HUD, the four screens (game, Workshop,
// collection, settings), sound, haptics, feedback and saving. The rules live in src/ (machine,
// board, economy); src/render.js draws them.
//
// Shell contract (as the other arcade games): window.CoinDozer = { init, pause, resume, destroy }.
// Save data stays under the "coin-dozer." key in localStorage (src/save.js).
import { CONFIG } from "./src/config.js";
import { initPhysics, isCoin } from "./src/board.js";
import { Machine } from "./src/machine.js";
import * as Eco from "./src/economy.js";
import { makeStorage, loadSave, writeSave, freshSave } from "./src/save.js";
import { Renderer, thumbnail, cachedThumbnail } from "./src/render.js";
import { Sound } from "./src/audio.js";
import { THEMES, THEME_IDS } from "./src/themes.js";
import { GEM_COLOURS } from "./src/shapes.js";
import { Rng, freshSeed } from "./src/rng.js";
import { coinIcon } from "./src/art.js";

const _t = I18n.t;
const $ = (s) => document.querySelector(s);
const F = CONFIG.feedback;

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
const fmt = (n) => Math.round(n).toLocaleString(I18n.lang);
const itemName = (theme, index) => _t(index < 4 ? `gem.${theme}.${GEM_COLOURS[index]}` : `fig.${theme}.${index - 4}`);
const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString(I18n.lang, { day: "numeric", month: "long", year: "numeric" });

// ---- State --------------------------------------------------------------------------------------------------
let storage, save, R, sound, machine, fxRng;
let running = false, rafId = 0, lastTs = 0, acc = 0;
let paused = false, screen = null, returnTo = null;
let aiming = false, ghostFade = 1;
let shownBank = 0, saveT = 0, slowT = 0, fastT = 0;
let started = false, storageWarned = false, pinT = 0;
const listeners = [];
const DT = 1 / CONFIG.physics.hz;

const reducedMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

// ---- Saving -------------------------------------------------------------------------------------------------
function persistNow() {
  if (!machine) return;
  save.board = machine.snapshot();
  const ok = writeSave(storage, save);
  if (!ok && !storageWarned) { storageWarned = true; toast(_t("storage.off"), 4200); }
}
let saveQueued = false;
/** Save off the frame: in idle time when the browser offers it. */
function persist() {
  if (saveQueued) return;
  saveQueued = true;
  const run = () => { saveQueued = false; persistNow(); };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 500 }); else setTimeout(run, 0);
}

// ---- Feedback -----------------------------------------------------------------------------------------------
function haptic(pattern) {
  if (!save.settings.haptics) return;
  try {
    if (window.Platform && Platform.isApp && typeof pattern === "number") Platform.haptic(pattern);
    else if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* unsupported: do nothing */ }
}
function toast(text, ms = 2200) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), ms);
}
const bannerQ = [];
function banner(text, kind = "event") {
  bannerQ.push({ text, kind });
  if (bannerQ.length > 4) bannerQ.splice(1, 1);
  if (!banner.busy) nextBanner();
}
function nextBanner() {
  const b = bannerQ.shift();
  const el = $("#banner");
  if (!b) { banner.busy = false; return; }
  banner.busy = true;
  el.textContent = b.text;
  el.className = "show " + b.kind;
  setTimeout(() => { el.className = b.kind; setTimeout(nextBanner, 220); }, b.kind === "small" ? 1100 : 1900);
}

// Pictures of collection items are drawn on demand (render.js thumbnail), which takes a moment the first
// time. A screen opens at once and its pictures fill in one at a time after it.
const thumbJobs = [];
let thumbBusy = false;
function thumbImg(theme, index, cls = "") {
  const img = h("img", { alt: "", class: cls });
  const url = cachedThumbnail(theme, index);
  if (url) img.src = url;
  else {
    thumbJobs.push([img, theme, index]);
    if (!thumbBusy) { thumbBusy = true; setTimeout(drawThumbs, 30); }
  }
  return img;
}
function drawThumbs() {
  const job = thumbJobs.shift();
  if (!job) { thumbBusy = false; return; }
  const [img, theme, index] = job;
  if (img.isConnected) img.src = thumbnail(theme, index);   // skip pictures on a screen that has closed
  setTimeout(drawThumbs, 0);
}

/** A prize flies from where it fell to the collection counter. */
function flyToCollection(item, theme, index) {
  const from = R.toScreen(item.x, Math.max(item.y, 0), item.z);
  const target = $("#collStat").getBoundingClientRect();
  const img = thumbImg(theme, index, "fly");
  img.style.left = from.x - 28 + "px";
  img.style.top = from.y - 28 + "px";
  document.body.append(img);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    img.style.transform = `translate(${target.left + target.width / 2 - from.x}px, ${target.top + target.height / 2 - from.y}px) scale(.45)`;
    img.style.opacity = "0.4";
  }));
  setTimeout(() => { img.remove(); $("#collStat").classList.remove("pop"); void $("#collStat").offsetWidth; $("#collStat").classList.add("pop"); }, reducedMotion() ? 10 : 720);
}

function onMachine(type, d) {
  const S = save.settings;
  switch (type) {
    case "drop":
      sound.release();
      ghostFade = 0;
      if (!save.hintSeen) { save.hintSeen = true; $("#hint").hidden = true; }
      break;
    case "pin": {
      // Coins rattle down the pins; one clink per 40 ms at most, however many coins are falling.
      if (machine.time - pinT < 0.04 || d.speed < 0.6) break;
      pinT = machine.time;
      sound.pin(fxRng.float(), Math.min(1, d.speed / 6));
      break;
    }
    case "land": {
      const it = d.item;
      if (isCoin(it.kind)) {
        sound.land(fxRng.float(), Math.min(1, d.speed / 8));
        if (d.speed > 3) R.burst(it.x, it.y + 0.05, it.z, 0xffffff, 2, 1, 1);
      } else sound.thud();
      break;
    }
    case "won": {
      const it = d.item, n = d.cascade;
      R.leave(it);
      if (it.kind === "gold" || it.kind === "jackpot") {
        sound.tray(true);
        R.burst(it.x, 0.1, CONFIG.board.depth / 2, 0xffd447, it.kind === "jackpot" ? 40 : 10, 3, 3);
        haptic(F.hapticMedium);
      } else {
        sound.tray(false);
        haptic(F.hapticTick);
      }
      if (n >= CONFIG.events.cascadeMin) {
        const k = Math.min(1, (n - CONFIG.events.cascadeMin) / 10);
        sound.cascade(n - CONFIG.events.cascadeMin + 1);
        haptic(Math.round(F.hapticCascade[0] + (F.hapticCascade[1] - F.hapticCascade[0]) * k));
        R.shake(F.shakeMax * (0.25 + 0.75 * k));
        R.burst(it.x, 0, CONFIG.board.depth / 2, 0xfff1a8, 4, 1.5, 2);
      }
      break;
    }
    case "lost": R.leave(d.item); break;
    case "fade": R.leave({ ...d.item, px: d.item.x, py: d.item.y, pz: d.item.z }, 0.25); break;
    case "prize": {
      R.leave(d.item, 0.5);
      sound.chime();
      haptic(F.hapticDouble);
      flyToCollection(d.item, d.theme, d.index);
      R.burst(d.item.x, 0.2, CONFIG.board.depth / 2, d.item.kind === "gem" ? THEMES[d.theme].gems[d.item.sub] : 0xffffff, 18, 3, 3);
      const name = itemName(d.theme, d.index);
      banner(d.isNew ? _t("banner.new", { name, n: d.credits }) : _t("banner.again", { name, n: d.credits }), "prize");
      persist();
      break;
    }
    case "eventStart":
      sound.fanfare(d.type);
      haptic(d.type === "fever" ? [40, 60, 40, 60, 80] : d.type === "jackpot" ? [80, 50, 80, 50, 120] : d.type === "shower" ? [30, 40, 30, 40, 30] : [30, 50, 30]);
      banner(_t("event." + d.type, { n: CONFIG.events.wideShelfDrops, s: CONFIG.events.fever.seconds }), "event");
      if (d.type === "fever") document.body.classList.add("fever");
      break;
    case "eventEnd":
      if (d.type === "fever") document.body.classList.remove("fever");
      break;
    case "cascadeEnd": banner(_t("banner.cascade", { n: d.n }), "small"); break;
    case "milestone":
      banner(_t("banner.milestone", { name: _t("ms." + d.id), n: d.credits }), "prize");
      sound.buy();
      persist();
      break;
    case "lifeline": banner(_t("banner.lifeline", { n: d.coins }), "small"); break;
    case "nudge":
      sound.nudge();
      R.shake(F.shakeMax * 0.8);
      haptic(40);
      break;
    case "autoOff": updateControls(); toast(_t("auto.empty")); break;
    case "bomb": banner(_t("banner.bomb", { n: d.coins }), "small"); break;
    case "newBoard": shownBank = machine.bank; break;
  }
}

// ---- Machines: the pin wall and the classic drop ------------------------------------------------------------
/**
 * Switch machines. The board you leave is parked in the save as it is, and the other machine's
 * board comes back as you left it (or a fresh one the first time). Your bank comes along: the
 * coins are yours, not the machine's.
 */
function switchMachine(type) {
  if (type === machine.type || !CONFIG.machines.includes(type)) return;
  const bank = machine.bank;
  save.parked[machine.type] = machine.snapshot();
  const parked = save.parked[type];
  delete save.parked[type];
  let restored = false;
  if (parked) { try { machine.restore(parked); restored = true; } catch (e) { restored = false; } }
  if (!restored) { machine.setType(type); machine.newBoard(freshSeed()); }
  machine.bank = bank;
  machine.setAuto(false);
  shownBank = bank;
  save.machine = type;
  R.setMachine(type);
  showHint();
  persistNow();
  hudCache = "";
  toast(_t("machine.switched", { name: _t("machine." + type), n: fmt(bank) }));
  if (paused) draw(0);
}

/** The machine choice, two cards side by side (the pause card shows it). */
function machinePicker(onChoose) {
  return h("div", { class: "machines", role: "radiogroup", "aria-label": _t("machine") }, ...CONFIG.machines.map((id) =>
    h("button", { type: "button", role: "radio", class: "machine " + id, "aria-checked": String(machine.type === id), onclick: () => { if (machine.type !== id) { switchMachine(id); onChoose(); } } },
      h("i", { class: "pic", "aria-hidden": "true" }), h("b", null, _t("machine." + id)), h("small", null, _t("machine." + id + ".desc")))));
}

function showHint() {
  const el = $("#hint");
  el.textContent = _t(machine.type === "pins" ? "hint.pins" : "hint");
  el.hidden = !!save.hintSeen;
}

// ---- Layout and the loop --------------------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth, hgt = window.innerHeight;
  const top = $("#top").getBoundingClientRect().bottom;
  const bottom = hgt - $("#controls").getBoundingClientRect().top;
  R.resize(w, hgt, top, bottom);
  if (!running && machine) draw(0);
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
  const ms = ts - lastTs;
  const dt = Math.min(0.25, Math.max(0, ms / 1000));
  lastTs = ts;
  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < CONFIG.physics.maxStepsPerFrame) { machine.step(); acc -= DT; n++; }
    if (n === CONFIG.physics.maxStepsPerFrame) acc = Math.min(acc, DT);   // a very slow frame: let time slow down, don't spiral
    saveT += dt;
    if (saveT >= CONFIG.performance.saveEvery) { saveT = 0; persist(); }
    adaptQuality(ms);
  }
  ghostFade = Math.min(1, ghostFade + dt / CONFIG.drop.minInterval);
  updateHud(dt);
  draw(dt);
}

function draw(dt) {
  const fever = machine.fever > 0 ? Math.min(1, machine.fever / 1.5) : 0;
  R.ghost.material.opacity = 0.5 * ghostFade;
  R.render(machine.board, paused ? 1 : Math.min(1, acc / DT), paused ? 0 : dt, {
    aim: machine.aim, showAim: !paused, fever, wide: machine.wide > 0, time: machine.time,
  });
}

/** Particles thin out when frames are slow for a while, and come back when they're quick again. */
function adaptQuality(ms) {
  const P = CONFIG.performance;
  if (ms > P.slowFrameMs) { slowT += ms / 1000; fastT = 0; }
  else if (ms < P.fastFrameMs) { fastT += ms / 1000; slowT = Math.max(0, slowT - ms / 1000); }
  if (slowT >= P.slowSeconds) { slowT = 0; R.setQuality(R.quality + 1); }
  if (fastT >= P.slowSeconds && R.quality > 0) { fastT = 0; R.setQuality(R.quality - 1); }
}

// ---- HUD ------------------------------------------------------------------------------------------------------
let hudCache = "";
function updateHud(dt) {
  // The bank counts toward its value, never jumps; a quiet tick at most 10 times a second.
  const target = machine.bank;
  if (shownBank !== target) {
    const diff = target - shownBank;
    const rate = Math.max(F.counterRate, Math.abs(diff) * 4);
    const stepTo = Math.abs(diff) <= rate * dt ? target : shownBank + Math.sign(diff) * rate * dt;
    if (Math.floor(stepTo) !== Math.floor(shownBank)) sound.tick();
    shownBank = stepTo;
  }
  const P = save.progress;
  const key = [Math.floor(shownBank), P.credits, Eco.collectionCount(P, P.theme), machine.nudges, machine.auto, machine.maxNudges].join("|");
  if (key === hudCache) return;
  hudCache = key;
  $("#bank").textContent = fmt(Math.floor(shownBank));
  $("#credits").textContent = fmt(P.credits);
  $("#collCount").textContent = `${Eco.collectionCount(P, P.theme)}/${CONFIG.economy.setSize}`;
  updateControls();
}

function updateControls() {
  const n = machine.nudges;
  $("#nudgeCount").textContent = n;
  $("#nudgeBtn").setAttribute("aria-label", _t("nudge.aria", { n, max: machine.maxNudges }));
  $("#nudgeBtn").classList.toggle("empty", n < 1);
  $("#autoBtn").setAttribute("aria-pressed", String(machine.auto));
  $("#autoBtn").classList.toggle("on", machine.auto);
}

// ---- Input: a press anywhere on the board drops a coin there at once; dragging moves the aim ------------------
// The coin drops on the press, not the release, so a tap or a click answers straight away. On the pin wall
// the press picks the nearest slot. A mouse moves the aim without a press too, so the see-through coin shows
// where the next one goes.
function onPointerDown(e) {
  sound.unlock();
  if (paused || screen) return;
  aiming = e.pointerId;
  try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  e.preventDefault();
  machine.setAim(R.aimFromScreen(e.clientX));
  if (!machine.drop()) { if (machine.bank < 1) sound.denied(); }
}
function onPointerMove(e) {
  if (paused || screen) return;
  if (aiming === e.pointerId || (e.pointerType === "mouse" && aiming === false)) machine.setAim(R.aimFromScreen(e.clientX));
}
function onPointerUp(e) { if (aiming === e.pointerId) aiming = false; }
function onPointerCancel(e) { if (aiming === e.pointerId) aiming = false; }

// ---- Pause and screens ----------------------------------------------------------------------------------------
function pauseGame() {
  if (paused) return;
  paused = true;
  aiming = false;
  stopLoop();
  sound.suspend();
  persist();
  draw(0);
}
function resumeGame() {
  if (!paused || document.visibilityState === "hidden") return;
  paused = false;
  closeOverlay();
  sound.resume();
  startLoop();
}

function overlay(children, cls = "") {
  const o = $("#overlay");
  o.replaceChildren(h("div", { class: "sheet " + cls }, children));
  o.hidden = false;
  o.scrollTop = 0;
  const first = o.querySelector("button");
  if (first && matchMedia("(hover: hover)").matches) first.focus({ preventScroll: true });
}
function closeOverlay() {
  $("#overlay").hidden = true;
  $("#overlay").replaceChildren();
  screen = null;
}
const back = (fn) => h("button", { class: "back", type: "button", onclick: fn }, _t("back"));

function showPause() {
  pauseGame();
  screen = "pause";
  overlay([
    h("h2", null, _t("paused")),
    h("h3", null, _t("machine")),
    machinePicker(showPause),
    h("div", { class: "stack" },
      h("button", { class: "primary", type: "button", onclick: resumeGame }, _t("resume")),
      h("button", { type: "button", onclick: () => { returnTo = showPause; showWorkshop(); } }, _t("workshop")),
      h("button", { type: "button", onclick: () => { returnTo = showPause; showCollection(); } }, _t("collection")),
      h("button", { type: "button", onclick: () => { returnTo = showPause; showSettings(); } }, _t("settings")),
      h("button", { type: "button", onclick: exitToArcade }, _t("exit"))),
    h("p", { class: "fine" }, _t("promise")),
  ], "pause");
}
function leaveScreen() { const r = returnTo; returnTo = null; if (r) r(); else resumeGame(); }
function exitToArcade() { persistNow(); if (window.Platform) Platform.home(); }

// Workshop: upgrades and themes. A purchase takes one confirm tap.
let armed = null;
function buyButton(id, label, cost, onBuy) {
  const b = h("button", { class: "buy", type: "button" }, label);
  b.addEventListener("click", () => {
    if (save.progress.credits < cost) {
      sound.denied();
      toast(_t("need.credits", { n: cost - save.progress.credits }));
      b.classList.remove("nope"); void b.offsetWidth; b.classList.add("nope");
      return;
    }
    if (armed !== id) {
      armed = id;
      b.textContent = _t("confirm", { n: fmt(cost) });
      b.classList.add("armed");
      clearTimeout(buyButton.timer);
      buyButton.timer = setTimeout(() => { if (armed === id) { armed = null; if (screen === "workshop") showWorkshop(); } }, 3000);
      return;
    }
    armed = null;
    onBuy();
  });
  return b;
}

function showWorkshop() {
  pauseGame();
  screen = "workshop";
  const P = save.progress;
  const ups = Eco.UPGRADES.map((id) => {
    const lvl = P.workshop[id], max = CONFIG.economy.workshop[id].costs.length, cost = Eco.upgradeCost(P, id);
    return h("li", { class: "row" },
      h("div", { class: "txt" }, h("b", null, _t("up." + id)), h("small", null, _t("up." + id + ".desc")),
        h("span", { class: "dots", "aria-label": _t("level", { n: lvl, max }) }, ...Array.from({ length: max }, (_, i) => h("i", { class: i < lvl ? "on" : "" })))),
      cost == null ? h("span", { class: "maxed" }, _t("maxed"))
        : buyButton("up:" + id, h("span", { class: "cr" }, fmt(cost)), cost, () => {
          const r = Eco.buyUpgrade(P, id);
          if (!r.ok) return;
          if (id === "nudges") machine.nudges = Math.min(machine.maxNudges, machine.nudges + 1);
          if (id === "luckyRate") machine.luckyAt = Math.min(machine.luckyAt, machine.nextLucky());
          sound.buy();
          toast(_t("bought", { name: _t("up." + id) }));
          persistNow();
          hudCache = "";
          showWorkshop();
        }));
  });
  const themes = THEME_IDS.map((id) => {
    const T = THEMES[id], owned = !!P.themes[id], sel = P.theme === id, cost = Eco.themeCost(id);
    const preview = h("div", { class: "preview", style: `background:linear-gradient(135deg, ${T.css.panel}, ${T.css.bg}); border-color:${T.css.accent}` },
      ...[4, 5, 6].map((i) => thumbImg(id, i, owned ? "" : "locked")));
    let action;
    if (sel) action = h("span", { class: "maxed" }, _t("selected"));
    else if (owned) action = h("button", { class: "buy", type: "button", onclick: () => { Eco.selectTheme(P, id); applyTheme(); persistNow(); showWorkshop(); } }, _t("select"));
    else action = buyButton("th:" + id, h("span", { class: "cr" }, fmt(cost)), cost, () => {
      const r = Eco.buyTheme(P, id);
      if (!r.ok) return;
      Eco.selectTheme(P, id);
      applyTheme();
      sound.buy();
      toast(_t("unlocked", { name: _t("theme." + id) }));
      persistNow();
      showWorkshop();
    });
    return h("li", { class: "row theme" + (sel ? " sel" : "") }, preview,
      h("div", { class: "txt" }, h("b", null, _t("theme." + id)), h("small", null, owned ? _t("theme.owned") : _t("theme.locked"))), action);
  });
  overlay([
    h("div", { class: "head" }, back(leaveScreen), h("h2", null, _t("workshop")), h("span", { class: "bal" }, h("span", { class: "cr" }, fmt(P.credits)))),
    h("p", { class: "fine" }, _t("workshop.intro")),
    h("h3", null, _t("upgrades")), h("ul", { class: "list" }, ups),
    h("h3", null, _t("themes")), h("ul", { class: "list" }, themes),
  ], "workshop");
}

let collTheme = null;
function showCollection(themeId) {
  pauseGame();
  screen = "collection";
  const P = save.progress;
  collTheme = themeId || collTheme || P.theme;
  const set = P.collection[collTheme] || {};
  const detail = h("p", { class: "detail", "aria-live": "polite" }, _t("coll.tap"));
  const tabs = h("div", { class: "tabs", role: "tablist" }, ...THEME_IDS.map((id) =>
    h("button", { type: "button", role: "tab", "aria-selected": String(id === collTheme), onclick: () => showCollection(id) },
      _t("theme." + id), " ", h("small", null, `${Eco.collectionCount(P, id)}/12`))));
  const grid = h("div", { class: "grid" }, ...Array.from({ length: CONFIG.economy.setSize }, (_, i) => {
    const has = i in set;
    return h("button", { type: "button", class: "slot" + (has ? " has" : ""), "aria-label": has ? itemName(collTheme, i) : _t("coll.unknown"),
      onclick: () => { detail.textContent = has ? _t("coll.won", { name: itemName(collTheme, i), date: fmtDate(set[i]) }) : _t("coll.notyet"); } },
      thumbImg(collTheme, i));
  }));
  overlay([
    h("div", { class: "head" }, back(leaveScreen), h("h2", null, _t("collection")), h("span", { class: "bal" }, `${Eco.collectionCount(P, collTheme)}/12`)),
    tabs,
    !P.themes[collTheme] ? h("p", { class: "fine" }, _t("coll.lockedTheme")) : collTheme !== P.theme ? h("p", { class: "fine" }, _t("coll.otherTheme")) : null,
    grid, detail,
    h("p", { class: "fine" }, _t("coll.intro")),
  ], "collection");
}

function toggle(key, label, note) {
  const S = save.settings;
  const b = h("button", { type: "button", role: "switch", "aria-checked": String(!!S[key]), class: "switch" }, h("span", null, label), h("i", null));
  b.addEventListener("click", () => {
    S[key] = !S[key];
    b.setAttribute("aria-checked", String(S[key]));
    applySettings();
    persistNow();
  });
  return h("li", { class: "row" }, b, note ? h("small", { class: "note" }, note) : null);
}

function showSettings() {
  pauseGame();
  screen = "settings";
  let resetStage = 0;
  const reset = h("button", { type: "button", class: "danger" }, _t("reset"));
  reset.addEventListener("click", () => {
    resetStage++;
    if (resetStage === 1) reset.textContent = _t("reset.1");
    else if (resetStage === 2) reset.textContent = _t("reset.2");
    else {
      const keepSettings = save.settings;
      save = freshSave();
      save.settings = keepSettings;
      save.hintSeen = true;
      machine.progress = save.progress;
      machine.setType(save.machine);
      R.setMachine(save.machine);
      machine.newBoard(freshSeed());
      applyTheme();
      persistNow();
      toast(_t("reset.done"));
      showSettings();
    }
  });
  let fresh = false;
  const newBoard = h("button", { type: "button" }, _t("newBoard"));
  newBoard.addEventListener("click", () => {
    if (!fresh) { fresh = true; newBoard.textContent = _t("newBoard.confirm", { n: Eco.startBank(save.progress) }); return; }
    machine.newBoard(freshSeed());
    machine.setAuto(save.settings.autoDefault);
    persistNow();
    toast(_t("newBoard.done"));
    leaveScreen();
  });
  overlay([
    h("div", { class: "head" }, back(leaveScreen), h("h2", null, _t("settings"))),
    h("ul", { class: "list" },
      toggle("sound", _t("set.sound")),
      toggle("haptics", _t("set.haptics"), navigator.vibrate ? null : _t("set.haptics.none")),
      toggle("shake", _t("set.shake"), reducedMotion() ? _t("set.shake.reduced") : null),
      toggle("autoDefault", _t("set.auto"))),
    h("div", { class: "stack" }, newBoard, reset,
      h("button", { type: "button", onclick: exitToArcade }, _t("arcade"))),
    h("p", { class: "fine" }, _t("set.saved")),
  ], "settings");
}

function applySettings() {
  const S = save.settings;
  sound.setOn(S.sound);
  R.shakeOn = S.shake && !reducedMotion();
}

function applyTheme() {
  const id = save.progress.theme, T = THEMES[id];
  R.setTheme(id);
  sound.setPalette(T.sound);
  const st = document.documentElement.style;
  st.setProperty("--bg", T.css.bg); st.setProperty("--panel", T.css.panel); st.setProperty("--accent", T.css.accent); st.setProperty("--ink", T.css.ink);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", T.css.bg);
  hudCache = "";
}

// ---- Back (top left) and the menu drawer (top right), shared/js/gamenav.js --------------------------------
// Back leaves for the arcade (the game opens straight into play, so there's no menu screen to go back
// to). The drawer pauses the board while it's open, like the pause card, and holds the same things.
let nav = null;
function makeNav() {
  nav = GameNav.create({
    title: () => _t("paused"),
    onOpen() { pauseGame(); },
    // Closing plays on, unless the chosen item opened a screen (it runs right after onClose).
    onClose() { queueMicrotask(() => { if (paused && !screen) resumeGame(); }); },
    items: () => [
      { icon: "play", label: _t("resume"), onSelect() {} },
      { icon: "view", label: _t("machine"), value: machine.type, options: CONFIG.machines.map((id) => ({ value: id, label: _t("machine." + id) })), onChoose(v) { switchMachine(v); nav.refresh(); } },
      { icon: "shop", label: _t("workshop"), onSelect() { returnTo = null; showWorkshop(); } },
      { icon: "trophy", label: _t("collection"), onSelect() { returnTo = null; showCollection(save.progress.theme); } },
      { icon: "gear", label: _t("settings"), onSelect() { returnTo = null; showSettings(); } },
      GameNav.language(),
    ],
  });
  nav.setBack(exitToArcade, _t("exit"));
  $("#top").prepend(nav.back);
  $("#top").append(nav.menu);
}

// ---- Start-up -------------------------------------------------------------------------------------------------
function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); listeners.push([el, ev, fn, opts]); }

async function init() {
  if (started) return;
  started = true;
  storage = makeStorage();
  save = loadSave(storage);
  R = new Renderer($("#cv"));
  document.documentElement.style.setProperty("--coin-face", `url(${coinIcon("coin")})`);
  sound = new Sound();
  applyTheme();
  applySettings();
  await initPhysics();
  machine = new Machine({ progress: save.progress, type: save.machine, onEvent: (t, d) => onMachine(t, d) });
  let restored = false;
  if (save.board) {
    try { machine.restore(save.board); restored = true; } catch (e) { restored = false; }
  }
  if (!restored) { machine.setType(save.machine); machine.newBoard(freshSeed()); machine.setAuto(save.settings.autoDefault); }
  save.machine = machine.type;
  R.setMachine(machine.type);
  fxRng = new Rng(machine.seed ^ 0x5f3759df);
  shownBank = machine.bank;
  showHint();
  document.body.classList.remove("loading");
  if (storage.volatile) { storageWarned = true; setTimeout(() => toast(_t("storage.off"), 4200), 600); }

  const cv = $("#cv");
  on(cv, "pointerdown", onPointerDown);
  on(cv, "pointermove", onPointerMove);
  on(cv, "pointerup", onPointerUp);
  on(cv, "pointercancel", onPointerCancel);
  on(document, "dblclick", (e) => e.preventDefault());
  on(document, "touchmove", (e) => { if (!e.target.closest("#overlay, .gnav-drawer")) e.preventDefault(); }, { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault());
  on($("#pauseBtn"), "click", () => { sound.unlock(); showPause(); });
  on($("#collBtn"), "click", () => { sound.unlock(); returnTo = null; showCollection(save.progress.theme); });
  on($("#nudgeBtn"), "click", () => { sound.unlock(); if (!paused && !machine.nudge()) { sound.denied(); toast(_t("nudge.empty")); } updateControls(); });
  on($("#autoBtn"), "click", () => {
    sound.unlock();
    if (paused) return;
    if (!machine.auto && machine.bank < 1) { sound.denied(); toast(_t("auto.empty")); return; }
    machine.setAuto(!machine.auto);
    updateControls();
  });
  on($("#overlay"), "click", (e) => { if (e.target.id === "overlay" && screen === "pause") resumeGame(); });
  on(window, "resize", resize);
  on(window, "orientationchange", () => setTimeout(resize, 200));
  on(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") { if (!paused) showPause(); persistNow(); }
  });
  on(window, "pagehide", persistNow);
  on(document, "keydown", (e) => {
    if (e.key === "Escape" || e.key === "p" || e.key === "P") { if (screen) leaveScreen(); else showPause(); }
  });
  if (window.matchMedia) {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.addEventListener) on(mq, "change", applySettings);
  }
  makeNav();
  resize();
  updateControls();
  startLoop();

  if ("serviceWorker" in navigator && !(window.Platform && Platform.isApp) && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

function destroy() {
  stopLoop();
  persistNow();
  for (const [el, ev, fn, opts] of listeners) el.removeEventListener(ev, fn, opts);
  listeners.length = 0;
  sound.stopAll();
  started = false;
}

window.CoinDozer = { init, pause: showPause, resume: resumeGame, destroy, get machine() { return machine; }, get save() { return save; }, get renderer() { return R; }, get ready() { return !!machine && running; } };
init().catch((e) => {
  console.error(e);
  const el = $("#loading");
  if (el) el.textContent = _t("loadFailed");
});
