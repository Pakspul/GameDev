// Crystal Reels: boot and app shell. Loads the game data and machine configs, restores the save,
// then shows the lobby (or resumes an interrupted spin or feature, PERS-02).
import { h } from "./src/ui/dom.js";
import { AudioEngine } from "./src/ui/audio.js";
import { Fx, Haptics, prefersReducedMotion } from "./src/ui/fx.js";
import { Skipper, openModal, toast, levelUp, fmt } from "./src/ui/overlays.js";
import { Lobby } from "./src/ui/lobby.js";
import { MachineScreen } from "./src/ui/machine-screen.js";
import { showInfo, showSettings, showProfile, showRefill, showReminder } from "./src/ui/menus.js";
import { validateMachine } from "./src/engine/config.js";
import { SaveStore } from "./src/core/save.js";
import { deviceLocale } from "./src/core/format.js";
import * as P from "./src/core/profile.js";

const _t = I18n.t;

/** localStorage can be blocked (private windows); the game then keeps working without saving. */
function makeStorage() {
  try {
    const k = "honest-arcade.slots.probe";
    localStorage.setItem(k, "1"); localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k), volatile: true };
  }
}

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

async function boot() {
  const root = document.getElementById("app");
  const game = await getJson("data/game.json");
  const machines = {};
  await Promise.all(game.machines.map(async (m) => {
    const cfg = await getJson(m.file);
    const errors = validateMachine(cfg);
    if (errors.length) throw new Error(`Machine ${m.id} is invalid:\n` + errors.join("\n"));
    machines[m.id] = cfg;
  }));

  const storage = makeStorage();
  const store = new SaveStore(storage);
  const loaded = store.load();
  const profile = loaded.profile ? P.normaliseProfile(loaded.profile, game) : P.newProfile(game);
  const now = Date.now();

  const app = {
    game, machines, profile, store, root,
    t: _t, locale: deviceLocale(),
    skipper: new Skipper(),
    screen: null, lobby: null, infoOpen: null,
    sessionStart: { time: now, won: profile.totals.won, wagered: profile.totals.wagered },
    remindedAt: now,
  };
  app.audio = new AudioEngine(() => profile.settings);
  app.fx = new Fx(document.getElementById("fx"), () => profile.settings);
  app.haptics = new Haptics(() => profile.settings);

  app.persist = () => {
    if (!store.save(profile) && !app.saveWarned) { app.saveWarned = true; toast(app, _t("save.failed"), "info", 5000); }
  };
  app.applyMotion = () => document.body.classList.toggle("reduced-motion", !!(profile.settings.reducedMotion || prefersReducedMotion()));
  app.currentLowestBet = () => (app.screen ? app.screen.cfg.betLevels[0] : machines[game.machines[0].id].betLevels[0]);
  app.showInfo = (screen) => showInfo(app, screen);
  app.showSettings = () => showSettings(app);
  app.showProfile = () => showProfile(app);
  app.showRefill = (status, done) => showRefill(app, status, done);
  app.maybeRemind = (mins) => {
    if (Date.now() - app.remindedAt < mins * 60000) return;
    app.remindedAt = Date.now();
    showReminder(app, () => app.openLobby());
  };
  app.resetProgress = () => { store.clear(); location.reload(); };

  app.handleEvents = (events) => {
    for (const e of events) {
      if (e.type === "levelUp") levelUp(app, e);
      else if (e.type === "mission") { app.audio.sfx("level"); toast(app, _t("toast.mission", { name: _t("mission." + e.id), n: fmt(app, e.reward) }), "level"); }
      else if (e.type === "achievement") { app.audio.sfx("level"); toast(app, _t("toast.achievement", { name: _t("ach." + e.id) }), "level"); }
    }
    if (events.length && app.screen) app.screen.refresh();
  };

  app.scheduleBonusReminder = () => {
    clearTimeout(app.bonusTimer);
    if (!profile.settings.bonusReminder || !("Notification" in window) || Notification.permission !== "granted") return;
    const wait = Math.min(2147483000, profile.timedBonus.nextAt - Date.now());
    if (wait <= 0) return;
    // Only while the app is open: the browser version cannot wake itself up. Opt-in and off by default (ECO-05).
    app.bonusTimer = setTimeout(() => { try { new Notification(_t("title"), { body: _t("bonus.notify") }); } catch (e) { /* ignore */ } }, wait);
  };

  app.openLobby = () => {
    if (app.screen) { app.screen.alive = false; app.screen = null; }
    if (app.lobby) app.lobby.close();
    app.lobby = new Lobby(app);
    app.lobby.open();
  };

  app.openMachine = async (id) => {
    if (app.lobby) { app.lobby.close(); app.lobby = null; }
    app.audio.unlock();
    profile.last = id;
    const screen = new MachineScreen(app, machines[id]);
    app.screen = screen;
    await screen.open();
    app.persist();
  };

  // sound can only start after the first tap
  const unlock = () => { app.audio.unlock(); window.removeEventListener("pointerdown", unlock); };
  window.addEventListener("pointerdown", unlock);
  document.addEventListener("visibilitychange", () => { if (document.hidden) app.persist(); });
  window.addEventListener("pagehide", () => app.persist());

  app.applyMotion();
  if (window.matchMedia) { try { window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", app.applyMotion); } catch (e) { /* old browsers */ } }
  window.slotsApp = app;

  // <debug>
  if (location.search.includes("debug")) {
    // Development builds only: scripts/build.mjs removes this block and the debug folder from release builds (TOOL-03).
    import("./src/debug/debug.js").then((m) => m.install(app)).catch(() => { /* not in this build */ });
  }
  // </debug>

  // first launch: say plainly that this is play money only (FAIR-07)
  if (!profile.acknowledged) {
    app.openLobby();
    await new Promise((resolve) => {
      const body = h("div", { class: "welcome" }, h("p", { text: _t("welcome.p1") }), h("p", { text: _t("welcome.p2") }), h("p", { class: "fine", text: _t("welcome.p3") }));
      openModal(app, { title: _t("welcome.title"), body, dismissible: false, buttons: [{ label: _t("welcome.ok"), primary: true, onClick: () => { profile.acknowledged = true; app.persist(); app.audio.unlock(); resolve(); } }] });
    });
  }
  if (loaded.recovered) toast(app, _t("save.recovered"), "info", 6000);
  if (loaded.corrupt) toast(app, _t("save.corrupt"), "info", 6000);
  if (storage.volatile) toast(app, _t("save.volatile"), "info", 6000);
  app.scheduleBonusReminder();

  // resume an interrupted spin or feature exactly where it stopped (PERS-02)
  const last = profile.last && machines[profile.last] ? profile.machines[profile.last] : null;
  const st = last && last.state;
  if (st && (st.pending || st.feature || st.queue.length)) await app.openMachine(profile.last);
  else app.openLobby();
}

boot().catch((e) => {
  console.error(e);
  const root = document.getElementById("app");
  root.replaceChildren(h("div", { class: "boot-error" }, h("h1", { text: "Crystal Reels" }), h("p", { text: String(e.message || e) })));
});
