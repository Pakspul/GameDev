// Debug menu (TOOL-03). Development builds only: scripts/build.mjs leaves this folder out of dist/,
// and tests/slots/release.test.mjs checks that nothing in a release build refers to it.
// Open the game with ?debug=1. It never touches the engine: forcing works by choosing an RNG seed
// whose next spin produces what you asked for, so the engine code stays free of any forcing logic.
import { h, timing } from "../ui/dom.js";
import { openModal, toast } from "../ui/overlays.js";
import { Rng } from "../engine/rng.js";
import { Session } from "../core/session.js";
import * as P from "../core/profile.js";

const clone = (o) => JSON.parse(JSON.stringify(o));

export function install(app) {
  const btn = h("button", { type: "button", id: "debug-btn", text: "DBG", style: { position: "fixed", left: "6px", bottom: "6px", zIndex: 95, minWidth: "44px", minHeight: "44px", opacity: ".6", borderRadius: "10px", border: "1px solid #888", background: "#222", color: "#fff", fontSize: "11px" } });
  btn.onclick = () => open(app);
  document.body.append(btn);
  window.slotsDebug = { app, setSpeed: (x) => { timing.speed = x; }, forceFeature: (t, j) => forceFeature(app, t, j), forceStops: (s) => forceStops(app, s) };
}

/** Pretend to spin with many seeds until one produces the wanted feature (and jackpot); then use that seed. */
function forceFeature(app, type, jackpotTier) {
  const screen = app.screen;
  if (!screen) return toast(app, "Open a machine first");
  const { cfg } = screen;
  for (let i = 0; i < 400000; i++) {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const s = new Session(cfg, { rng: new Rng(seed), wallet: { balance: 1e9 }, state: clone(screen.session.state), record: false });
    const o = s.spin(screen.bet);
    if (!o.features.some((f) => f.type === type)) continue;
    if (jackpotTier) {
      s.settle();
      let hit = false;
      while (s.hasFeature()) { const f = s.nextFeature(); if (f.plan && (f.plan.jackpotsWon || []).includes(jackpotTier)) hit = true; s.finishFeature(); }
      if (!hit) continue;
    }
    screen.session.rng = new Rng(seed);
    return toast(app, `Forced ${type}${jackpotTier ? " + " + jackpotTier : ""}: press Spin (seed ${seed})`);
  }
  toast(app, "No seed found");
}

function forceStops(app, stops) {
  const screen = app.screen;
  const real = screen.session.rng;
  let n = 0;
  screen.session.rng = { seed: real.seed, int: (k) => (n < stops.length ? stops[n++] % k : real.int(k)), float: () => real.float(), weighted: (w) => real.weighted(w), state: () => real.state() };
  toast(app, "Next spin uses stops " + stops.join(","));
}

function open(app) {
  const screen = app.screen;
  const p = app.profile;
  const body = h("div", { class: "settings" });
  const row = (label, ...kids) => body.append(h("div", { class: "field" }, h("span", { text: label }), h("div", {}, ...kids)));
  const b = (text, fn) => h("button", { type: "button", class: "pill-btn", text, onclick: fn });
  row("RNG seed", h("code", { text: screen ? screen.session.rng.seed.join(",") : "-" }));
  if (screen) {
    for (const t of Object.keys(screen.cfg.features)) row("Force " + t, b("go", () => forceFeature(app, t)));
    if (screen.cfg.features.holdSpin) row("Force jackpot", b("major", () => forceFeature(app, "holdSpin", "major")), b("mini", () => forceFeature(app, "holdSpin", "mini")));
    const stops = h("input", { value: "0,0,0,0,0", style: { width: "110px" } });
    row("Force stops", stops, b("set", () => forceStops(app, stops.value.split(",").map(Number))));
    row("Meter", b("almost full", () => { const m = screen.session.state.meter; m.count = screen.cfg.meter.target - 1; m.betSum = m.count * screen.bet; screen.refresh(); app.persist(); }));
  }
  row("Balance", b("+100k", () => { p.balance += 100000; if (screen) screen.refresh(); app.persist(); }), b("0", () => { p.balance = 0; if (screen) screen.refresh(); app.persist(); }), b("30", () => { p.balance = 30; if (screen) screen.refresh(); app.persist(); }));
  if (screen) row("Level (this machine)", b("+5", () => { const e = P.machineEntry(p, screen.cfg.id); e.xp = P.xpForLevel(app.game, P.machineLevel(app.game, p, screen.cfg.id) + 5); p.xp = P.totalXp(p); screen.refresh(); app.persist(); }));
  row("Speed", ...[1, 3, 10].map((x) => b("×" + x, () => { timing.speed = x; })));
  openModal(app, { title: "Debug (development build)", body, buttons: [{ label: "Close", primary: true }] });
}
