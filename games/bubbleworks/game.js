// Bubbleworks: the app shell. Aiming and firing, the frame loop, the HUD, the power tray, help in
// Levels, stardust, the lobby and the result screen, sound and saving. The rules live in src/engine.js
// and src/grid.js, the boards in src/levels.js, src/render.js draws it all, and economy.js holds every
// price (rules: docs/ECONOMY.md).
//
// Saves under "bubbleworks.v1" in localStorage: the chosen mode, stardust, Levels' stars, the best
// Classic and Endless runs (and how far they have paid), the daily level, and the sound switches.
import { CONFIG } from "./src/config.js";
import { makeLevel, makeDaily, levelGame, classicGame, endlessGame, tierOf, INTRO } from "./src/levels.js";
import { Renderer, COLOURS, powerSvg, pathLength } from "./src/render.js";
import { Sound } from "./src/audio.js";

const _t = I18n.t;
const $ = (id) => document.getElementById(id);
const { width: W, launchY } = CONFIG;
const DUST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z" fill="currentColor"/></svg>';
const ALIEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5L7.5 3M15 6.5L16.5 3" stroke="#7dff9a" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="12" cy="13" rx="7.5" ry="7" fill="#7dff9a"/><ellipse cx="9.3" cy="12" rx="1.6" ry="2.2" fill="#0b3d1c"/><ellipse cx="14.7" cy="12" rx="1.6" ry="2.2" fill="#0b3d1c"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" class="{c}"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>';
const MODES = ["classic", "levels", "endless"];

// ---- Saving -------------------------------------------------------------------------------------------------
const SAVE_KEY = "bubbleworks.v1";
function loadSave() {
  const fresh = {
    mode: "classic", dust: ECO.start, sound: true, haptics: true,
    levels: { best: 0, stars: {} },
    classic: { score: 0, stage: 0, paid: 0 },
    endless: { score: 0, rows: 0, paid: 0 },
    daily: { date: "", stars: 0, streak: 0, last: "" },
    tips: {},
  };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) for (const k in fresh) if (k in s) fresh[k] = typeof fresh[k] === "object" && !Array.isArray(fresh[k]) ? Object.assign(fresh[k], s[k]) : s[k];
  } catch (e) { /* storage blocked or broken: start fresh */ }
  return fresh;
}
const save = loadSave();
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

// ---- State --------------------------------------------------------------------------------------------------
let state = "menu";          // menu | play | pause | over
let mode = MODES.includes(save.mode) ? save.mode : "classic";
let kind = mode;              // what's being played: classic | levels | endless | daily
let game = null, level = null, levelN = 1;
let flight = null;            // { tr, shot, t0, dur, bounces: [fractions], next }
let aiming = false, angle = null, kbAngle = 0;
let aimFull = false, helped = false, used = {};
let earned = 0;               // stardust earned in this Classic or Endless run
let session = 0;              // bumped on every start, so a late timer from an old game does nothing
let raf = 0, toastTimer = 0;
const sound = new Sound();
sound.on = save.sound;
const R = new Renderer($("cv"));
const now = () => performance.now() / 1000;
function haptic(ms) { if (save.haptics) Platform.haptic(ms); }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const tier = () => (kind === "daily" ? "hard" : tierOf(levelN));
const classicTier = (s) => (s <= 3 ? "easy" : s <= 7 ? "medium" : s <= 12 ? "hard" : "expert");
const endlessTier = (m) => (m <= 10 ? "easy" : m <= 20 ? "medium" : m <= 40 ? "hard" : "expert");
const fmt = (n) => Number(n).toLocaleString(I18n.lang);

// ---- Starting a game ----------------------------------------------------------------------------------------
function start(k, n = 1) {
  sound.unlock();
  session++;
  kind = k; levelN = n; level = null;
  flight = null; aiming = false; angle = null; kbAngle = 0;
  aimFull = false; helped = false; used = {}; earned = 0;
  clearTimeout(toastTimer); $("toast").classList.remove("on"); // nothing left over from the last game
  const seed = (Math.random() * 4294967296) >>> 0;
  if (k === "classic") game = classicGame(seed);
  else if (k === "endless") game = endlessGame(seed);
  else {
    level = k === "daily" ? makeDaily(today()) : makeLevel(n);
    game = levelGame(level);
  }
  setState("play");
  layout();
  R.setGame(game);
  updateHud(); updateTray(); updateHelps();
  showTip();
  redraw();
}
function restart() { start(kind, levelN); }

/** The first time something new shows up in Levels, say what it is. */
function showTip() {
  if (kind !== "levels") { if (kind !== "daily" && !save.tips[kind]) { save.tips[kind] = 1; writeSave(); toast(_t("tip." + kind), 3600); } return; }
  const key = levelN === 1 ? "first" : Object.keys(INTRO).find((k) => INTRO[k] === levelN);
  if (key && I18n.has("tip." + key)) toast(_t("tip." + key), 4200);
}

// ---- Aiming and firing --------------------------------------------------------------------------------------
function angleTo(f) {
  const a = Math.atan2(f.x - W / 2, launchY - f.y);
  return Math.max(-CONFIG.maxAngle, Math.min(CONFIG.maxAngle, a));
}
const canAct = () => state === "play" && game && game.status === "play" && !flight;
function nearLauncher(f) {
  return Math.hypot(f.x - W / 2, f.y - launchY) < CONFIG.R + 12 || Math.hypot(f.x - (W / 2 - 64), f.y - (launchY + 18)) < CONFIG.R + 10 || Math.hypot(f.x - (W / 2 - 34), f.y - (launchY + 10)) < 14;
}

function fire(a) {
  if (!canAct()) return false;
  const f = game.fire(a);
  if (!f) return false;
  const len = pathLength(f.tr.pts);
  // Where along the path it touches a wall, for the click.
  const bounces = [];
  let walked = 0;
  for (let i = 1; i < f.tr.pts.length - 1; i++) { walked += Math.hypot(f.tr.pts[i][0] - f.tr.pts[i - 1][0], f.tr.pts[i][1] - f.tr.pts[i - 1][1]); bounces.push(walked / len); }
  flight = { tr: f.tr, shot: f.shot, t0: now(), dur: Math.max(0.08, len / CONFIG.speed), bounces, next: 0 };
  angle = null;
  drain();
  kick();
  return true;
}
function swap() {
  if (!canAct()) return;
  if (game.swap()) { drain(); redraw(); }
  else if (game.armed >= 0) toast(_t("toast.armedSwap"));
}
function arm(i) {
  if (!canAct()) return;
  if (game.arm(i)) { drain(); updateTray(); redraw(); }
}

const cv = $("cv");
let pointerId = null;
cv.addEventListener("pointerdown", (e) => {
  sound.unlock();
  if (!canAct() || pointerId !== null) return;
  const f = R.toField(e.clientX, e.clientY);
  if (nearLauncher(f)) { swap(); return; }
  if (f.y > launchY + 30) return;
  pointerId = e.pointerId;
  cv.setPointerCapture?.(e.pointerId);
  aiming = true;
  angle = f.y < launchY - 4 ? angleTo(f) : null;
  redraw();
});
cv.addEventListener("pointermove", (e) => {
  if (!aiming || e.pointerId !== pointerId) return;
  const f = R.toField(e.clientX, e.clientY);
  angle = f.y < launchY - 4 ? angleTo(f) : null; // drag back below the launcher to cancel
  redraw();
});
function endAim(e, cancel) {
  if (!aiming || e.pointerId !== pointerId) return;
  pointerId = null;
  aiming = false;
  const a = angle;
  angle = null;
  if (!cancel && a != null) fire(a); else redraw();
}
cv.addEventListener("pointerup", (e) => endAim(e, false));
cv.addEventListener("pointercancel", (e) => endAim(e, true));

addEventListener("keydown", (e) => {
  if (state === "menu" && e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") { play(); return; }
  if (state !== "play" || !game) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    kbAngle = Math.max(-CONFIG.maxAngle, Math.min(CONFIG.maxAngle, kbAngle + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 0.01 : 0.04)));
    angle = kbAngle; redraw();
  } else if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); if (fire(kbAngle)) angle = null; }
  else if (e.key === "x" || e.key === "X" || e.key === "s" || e.key === "S") swap();
  else if (e.key >= "1" && e.key <= "3") arm(Number(e.key) - 1);
  else if (e.key === "r" || e.key === "R") restart();
});

// ---- Events from the game -----------------------------------------------------------------------------------
function drain() {
  const t = now(), ev = game.events.slice();
  game.events.length = 0;
  R.onEvents(ev, t, game);
  const id = session;
  for (const e of ev) {
    sound.play(e);
    if (e.type === "pop") haptic(e.power ? 40 : 14);
    else if (e.type === "drop" && e.list.length >= 4) haptic(24);
    else if (e.type === "power") toast(e.kept ? _t(e.bonus ? "toast.bonusPower" : "toast.power", { p: _t("power." + e.p) }) : _t("toast.trayFull"));
    else if (e.type === "free") haptic(20);
    else if (e.type === "freeze") toast(_t("toast.freeze", { n: CONFIG.powers.freezeShots }));
    else if (e.type === "ceiling") { haptic(50); if (game.room() <= 1) toast(_t("toast.danger")); }
    else if (e.type === "push") { payEndless(); if (game.room() <= 1) toast(_t("toast.danger")); }
    else if (e.type === "stage") {
      payStage(e.stage);
      toast(_t("toast.stage", { n: e.stage, bonus: fmt(e.bonus) }), CONFIG.classic.stageBreak * 1000, true);
      setTimeout(() => { if (id !== session || !game || game.status !== "stage") return; game.advance(); drain(); kick(); }, CONFIG.classic.stageBreak * 1000);
    } else if (e.type === "won" || e.type === "lost") {
      haptic(e.type === "won" ? 30 : 60);
      setTimeout(() => { if (id === session && game.status === e.type) finish(); }, e.type === "won" ? 1100 : 800);
    }
  }
  updateHud(); updateTray(); updateHelps();
}

// ---- Stardust -----------------------------------------------------------------------------------------------
function payStage(stage) {
  // A stage you clear for the first time ever pays like a level of its tier.
  if (stage <= save.classic.paid) return;
  const pay = ECO.reward(classicTier(stage));
  save.classic.paid = stage;
  save.dust += pay; earned += pay;
  writeSave();
}
function payEndless() {
  // Every ten rows past your best pays once.
  const m = Math.floor(game.pushed / 10) * 10;
  if (m <= save.endless.paid || m === 0) return;
  for (let k = save.endless.paid + 10; k <= m; k += 10) { const pay = ECO.reward(endlessTier(k)); save.dust += pay; earned += pay; }
  save.endless.paid = m;
  writeSave();
  toast(_t("toast.rows", { n: m }));
}
function spend(cost) { save.dust -= cost; writeSave(); updateHud(); }
function poor(cost) { sound.play({ type: "nope" }); toast(_t("toast.poor", { cost, have: save.dust })); }

// ---- Help (Levels and the daily) ----------------------------------------------------------------------------
const price = (item) => ECO.price(item, tier(), used[item] || 0);
function helpAim() {
  if (!game || game.mode !== "levels" || aimFull || state !== "play") return;
  const cost = price("aim");
  if (save.dust < cost) { poor(cost); return; }
  spend(cost); used.aim = (used.aim || 0) + 1; aimFull = true; helped = true;
  toast(_t("toast.aim"));
  updateHelps(); redraw();
}
function helpShots() {
  if (!game || game.mode !== "levels" || (game.status !== "play" && !(game.status === "lost" && game.lost === "shots"))) return false;
  const cost = price("shots");
  if (save.dust < cost) { poor(cost); return false; }
  spend(cost); used.shots = (used.shots || 0) + 1; helped = true;
  game.addShots(CONFIG.levels.extraShots);
  toast(_t("toast.shots", { n: CONFIG.levels.extraShots }));
  updateHud(); updateHelps();
  return true;
}
$("aimBtn").addEventListener("click", () => { sound.unlock(); helpAim(); });
$("shotsBtn").addEventListener("click", () => { sound.unlock(); helpShots(); });

// ---- HUD and tray -------------------------------------------------------------------------------------------
function updateHud() {
  if (!game) return;
  const title = kind === "classic" ? _t("hud.stage", { n: game.stage }) : kind === "endless" ? _t("mode.endless") : kind === "daily" ? _t("daily") : _t("hud.level", { n: levelN });
  $("hudTitle").textContent = title;
  $("hudScore").textContent = fmt(game.score);
  const goal = $("hudGoal");
  goal.className = "goal";
  if (game.goal) {
    const G = game.goal;
    if (G.type === "top") goal.textContent = _t("goal.top.short", { n: game.grid.count() });
    else if (G.type === "rescue") goal.innerHTML = ALIEN + `<span>${Math.min(G.have, G.n)}/${G.n}</span>`;
    else goal.innerHTML = `<i style="background:${COLOURS[G.colour].fill}"></i><span>${Math.min(G.have, G.n)}/${G.n}</span>`;
    goal.setAttribute("aria-label", goalText(G));
    goal.classList.toggle("done", game.goalDone());
  } else goal.textContent = "";
  const box = $("hudShotsBox");
  box.classList.remove("low");
  if (game.mode === "levels") {
    $("hudShotsLabel").textContent = _t("hud.shots");
    $("hudShots").textContent = Math.max(0, game.shotsLeft);
    box.classList.toggle("low", game.shotsLeft <= 3);
  } else if (game.mode === "endless") {
    $("hudShotsLabel").textContent = _t("hud.rows");
    $("hudShots").textContent = game.pushed;
  } else {
    $("hudShotsLabel").textContent = _t("hud.best");
    $("hudShots").textContent = fmt(Math.max(save.classic.score, game.score));
  }
  $("hudDust").textContent = fmt(save.dust);
}
function goalText(G) {
  if (G.type === "top") return _t("goal.top");
  if (G.type === "rescue") return _t("goal.rescue", { n: G.n });
  return _t("goal.collect", { n: G.n, colour: _t("colour." + COLOURS[G.colour].name) });
}
function updateTray() {
  const tray = $("tray");
  const slots = [];
  for (let i = 0; i < CONFIG.powers.slots; i++) {
    const p = game && game.tray[i];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (p ? "" : " empty") + (game && game.armed === i ? " armed" : "");
    if (p) {
      b.innerHTML = powerSvg(p) + `<span class="name">${_t("power." + p)}</span>`;
      b.setAttribute("aria-label", _t("power." + p) + ": " + _t("power." + p + ".what"));
      b.setAttribute("aria-pressed", String(game.armed === i));
      b.onclick = () => { sound.unlock(); arm(i); };
    } else {
      b.setAttribute("aria-label", _t("tray.empty"));
      b.disabled = true;
    }
    slots.push(b);
  }
  tray.replaceChildren(...slots);
}
function updateHelps() {
  const on = game && game.mode === "levels";
  $("helps").hidden = !on;
  if (!on) return;
  const aimCost = price("aim"), shotsCost = price("shots");
  $("aimCost").innerHTML = aimFull ? "" : DUST + aimCost;
  $("shotsCost").innerHTML = DUST + shotsCost;
  $("aimBtn").classList.toggle("on", aimFull);
  $("aimBtn").classList.toggle("short", !aimFull && save.dust < aimCost);
  $("shotsBtn").classList.toggle("short", save.dust < shotsCost);
  $("aimBtn").setAttribute("aria-label", _t("help.aim.what") + (aimFull ? "" : " · " + aimCost));
  $("shotsBtn").setAttribute("aria-label", _t("help.shots.what", { n: CONFIG.levels.extraShots }) + " · " + shotsCost);
}

function toast(text, ms = 1800, big = false) {
  const el = $("toast");
  el.textContent = text;
  el.classList.toggle("big", big);
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), ms);
}

// ---- Frame loop: only while something moves -----------------------------------------------------------------
function frame(ts) {
  raf = 0;
  const t = ts / 1000;
  if (flight) {
    const a = (t - flight.t0) / flight.dur;
    while (flight.next < flight.bounces.length && a >= flight.bounces[flight.next]) { flight.next++; sound.play({ type: "bounce" }); }
    if (a >= 1) { flight = null; game.land(); drain(); }
  }
  R.draw(game, ui(), t);
  if (flight || R.busy(t) || aiming) raf = requestAnimationFrame(frame);
}
function ui() {
  let danger = 0;
  if (game && game.mode !== "levels" && game.status === "play") {
    const room = game.room();
    danger = room <= 0 ? 1 : room === 1 && game.shotsToMove() <= 2 ? 0.6 : 0;
  }
  return { angle: aiming || (angle != null && state === "play") ? angle : null, full: aimFull, flight, danger };
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function redraw() { kick(); }

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
function layout() {
  const hud = $("hud").getBoundingClientRect();
  R.top = Math.round(hud.bottom + 2);
  R.bottom = Math.round(window.innerHeight - $("tools").getBoundingClientRect().top + 14);
  R.resize();
}

function finish() {
  if (!game) return;
  const main = $("resultMain"), alt = $("resultAlt");
  const won = game.status === "won";
  $("resultStars").innerHTML = "";
  $("resultDust").innerHTML = "";
  $("resultNote").textContent = "";
  $("resultScore").textContent = fmt(game.score);
  alt.hidden = false;
  if (kind === "classic" || kind === "endless") {
    const best = save[kind];
    const newBest = game.score > best.score;
    best.score = Math.max(best.score, game.score);
    if (kind === "classic") best.stage = Math.max(best.stage, game.stage);
    else best.rows = Math.max(best.rows, game.pushed);
    writeSave();
    $("resultEyebrow").textContent = _t("mode." + kind);
    $("resultTitle").textContent = _t("res.over");
    $("resultText").textContent = kind === "classic" ? _t("res.classicText", { n: game.stage }) : _t("res.endlessText", { n: game.pushed });
    $("resultNote").textContent = newBest ? _t("res.newBest") : _t("res.best", { n: fmt(best.score) });
    if (earned) $("resultDust").innerHTML = DUST + "+" + earned;
    main.textContent = _t("again"); main.onclick = restart;
    alt.textContent = _t("menu"); alt.onclick = toMenu;
  } else if (won) {
    const stars = Economy.helped(game.stars(), helped);
    let pay;
    if (kind === "daily") {
      const d = save.daily, date = today();
      const prev = d.date === date ? d.stars : 0;
      const streak = prev ? d.streak : d.last === yesterday() ? d.streak + 1 : 1;
      pay = ECO.dailyPay("hard", stars, prev, streak);
      if (!prev) { d.streak = streak; d.last = date; }
      d.date = date; d.stars = Math.max(prev, stars);
      $("resultEyebrow").textContent = _t("daily") + " · " + _t("daily.streak", { n: d.streak });
      main.textContent = _t("menu"); main.onclick = toMenu;
      alt.textContent = _t("again"); alt.onclick = restart;
    } else {
      const prev = save.levels.stars[levelN] || 0;
      pay = ECO.levelPay(tier(), stars, prev);
      save.levels.stars[levelN] = Math.max(prev, stars);
      save.levels.best = Math.max(save.levels.best, levelN);
      $("resultEyebrow").textContent = _t("hud.level", { n: levelN });
      main.textContent = _t("next"); main.onclick = () => start("levels", levelN + 1);
      alt.textContent = _t("menu"); alt.onclick = toMenu;
    }
    save.dust += pay;
    writeSave();
    $("resultStars").innerHTML = [0, 1, 2].map((i) => STAR.replace("{c}", i < stars ? "on" : "")).join("");
    $("resultTitle").textContent = _t("res.won");
    $("resultText").textContent = _t("res.wonText", { n: Math.max(0, game.shotsLeft) });
    if (pay) $("resultDust").innerHTML = DUST + "+" + pay;
    $("resultNote").textContent = helped ? _t("res.helped") : "";
  } else {
    $("resultEyebrow").textContent = kind === "daily" ? _t("daily") : _t("hud.level", { n: levelN });
    $("resultTitle").textContent = _t("res.out");
    $("resultText").textContent = goalText(game.goal) + " · " + progressText(game.goal);
    const cost = price("shots");
    if (save.dust >= cost) {
      main.innerHTML = _t("res.more", { n: CONFIG.levels.extraShots }) + ` <span class="cost">${DUST}${cost}</span>`;
      main.onclick = () => { if (helpShots()) { setState("play"); redraw(); } };
      alt.textContent = _t("again"); alt.onclick = restart;
      $("resultNote").textContent = _t("res.helpStar");
    } else {
      main.textContent = _t("again"); main.onclick = restart;
      alt.textContent = _t("menu"); alt.onclick = toMenu;
    }
  }
  setState("over");
  main.focus({ preventScroll: true, focusVisible: false });
}
function progressText(G) {
  if (G.type === "top") return _t("goal.left", { n: game.grid.count() });
  return `${Math.min(G.have, G.n)}/${G.n}`;
}

// ---- The lobby ----------------------------------------------------------------------------------------------
const ICON = {
  classic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4h18v4H3z" fill="currentColor" opacity=".35"/><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M12 22v-4"/></svg>',
  levels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 3.5L16 11H5"/></svg>',
  endless: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7.5 15.5a3.5 3.5 0 1 1 0-7c3.5 0 5.5 7 9 7a3.5 3.5 0 1 0 0-7c-3.5 0-5.5 7-9 7z"/></svg>',
  daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="currentColor" stroke="none"/></svg>',
};
function play() {
  if (mode === "levels") start("levels", save.levels.best + 1);
  else start(mode);
}
function refreshMenu() {
  const d = save.daily, doneToday = d.date === today() && d.stars > 0;
  const items = [
    GameLobby.daily({
      eyebrow: _t("daily"), title: new Date().toLocaleDateString(I18n.lang, { weekday: "long", day: "numeric", month: "long" }),
      meta: doneToday ? _t("daily.done", { s: d.stars }) : d.streak && d.last === yesterday() ? _t("daily.keep", { n: d.streak }) : _t("daily.note"),
      icon: ICON.daily, done: doneToday, label: doneToday ? _t("again") : _t("play"), onClick: () => start("daily"),
    }),
    GameLobby.choice({
      label: _t("mode"), value: mode,
      options: MODES.map((m) => ({ value: m, label: _t("mode." + m), note: _t(`mode.${m}.note`), icon: ICON[m] })),
      onChoose: (m) => { mode = save.mode = m; writeSave(); refreshMenu(); },
    }),
  ];
  if (mode === "levels") {
    const next = save.levels.best + 1, stars = Object.values(save.levels.stars).reduce((a, b) => a + b, 0);
    items.push(GameLobby.play({
      eyebrow: _t("mode.levels"), title: _t("hud.level", { n: next }), text: _t("play.levels"),
      action: { label: _t("play"), onClick: () => start("levels", next) },
      stats: [[save.levels.best, _t("st.cleared")], [stars, _t("st.stars")], [fmt(save.dust), _t("st.dust")]],
    }));
    items.push(GameLobby.levels({ last: next, stars: (n) => save.levels.stars[n] || 0, onPick: (n) => start("levels", n) }));
  } else {
    const b = save[mode];
    items.push(GameLobby.play({
      eyebrow: _t("mode." + mode), title: _t("play." + mode + ".title"), text: _t("play." + mode),
      action: { label: _t("play"), onClick: () => start(mode) },
      stats: mode === "classic"
        ? [[fmt(b.score), _t("st.best")], [b.stage, _t("st.stage")], [fmt(save.dust), _t("st.dust")]]
        : [[fmt(b.score), _t("st.best")], [b.rows, _t("st.rows")], [fmt(save.dust), _t("st.dust")]],
    }));
  }
  $("lobby").replaceChildren(...items);
}

// ---- Back (top left) and the menu drawer (top right) ------------------------------------------------------
const nav = GameNav.create({
  title: () => (state === "pause" ? _t("paused") : "Bubbleworks"),
  onOpen: () => { if (state === "play") setState("pause"); },
  onClose: () => { if (state === "pause") setState("play"); },
  items: () => {
    const inGame = state === "pause";
    return [
      inGame && { icon: "play", label: _t("resume"), onSelect() {} },
      inGame && { icon: "restart", label: _t("restart"), onSelect() { restart(); } },
      { icon: "sound", label: _t("sound"), checked: save.sound, onToggle(on) { save.sound = sound.on = on; writeSave(); } },
      { icon: "tap", label: _t("haptics"), checked: save.haptics, onToggle(on) { save.haptics = on; writeSave(); } },
      { icon: "help", label: _t("how"), html: "<ul class=\"how\">" + [1, 2, 3, 4, 5].map((n) => "<li>" + _t("how." + n) + "</li>").join("") + "</ul>" },
      { icon: "info", label: _t("modes"), html: "<ul class=\"how\">" + MODES.map((m) => `<li><b>${_t("mode." + m)}</b>: ${_t("modes." + m)}</li>`).join("") + `<li><b>${_t("daily")}</b>: ${_t("modes.daily")}</li></ul>` },
      { icon: "glow", label: _t("powers"), html: "<p>" + _t("powers.intro") + "</p><ul class=\"how\">" + ["bomb", "prism", "laser", "comet", "blackhole", "freeze"].map((p) => `<li><b>${_t("power." + p)}</b>: ${_t("power." + p + ".what")}</li>`).join("") + "</ul>" },
      { icon: "shop", label: _t("dust"), html: "<p>" + _t("dust.how") + "</p>" },
      state === "menu" && GameNav.language(),
    ];
  },
});
const navBar = GameNav.bar(nav);
document.body.append(navBar);
function toMenu() {
  session++;
  flight = null; aiming = false;
  refreshMenu();
  setState("menu");
  showBehind();
}
function placeNav() {
  if (state === "menu") { navBar.append(nav.back, nav.menu); nav.setBack(); }
  else { $("hud").prepend(nav.back); $("hud").append(nav.menu); nav.setBack(toMenu, _t("backToMenu")); }
}
/** Behind the menu: the first Classic stage, quietly. */
function showBehind() {
  game = classicGame(1);
  kind = "classic";
  layout();
  R.setGame(game);
  redraw();
}

document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") setState("pause"); });
addEventListener("resize", () => { if (!game) return; layout(); redraw(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (state !== "menu") layout(); redraw(); });

// ---- Start: the menu over a board ---------------------------------------------------------------------------
refreshMenu();
setState("menu");
showBehind();
updateTray();

window.Bubbleworks = {
  get state() { return state; }, get game() { return game; }, get kind() { return kind; }, get level() { return levelN; },
  get flying() { return !!flight; }, get aimFull() { return aimFull; },
  start, fire, swap, arm, restart, toMenu, helpAim, helpShots,
  refresh() { updateHud(); updateTray(); updateHelps(); redraw(); },
  get dust() { return save.dust; }, set dust(n) { save.dust = n; writeSave(); updateHud(); updateHelps(); },
  get save() { return save; },
  /** A field point in page pixels (for the tests' taps). */
  toPage: (x, y) => R.toPage(x, y),
  launcher: () => R.toPage(W / 2, launchY),
};
