// Overlays: modals, toasts, the win celebration with its tiers (WIN-01..03), the jackpot
// sequence (JP-02) and feature announcements. Everything takes the `app` object for sound,
// effects, translation and number formatting.
import { rankName } from "./xp.js";
import { h, tween, sleep, ease, icon, timing } from "./dom.js";
import { formatCoins } from "../core/format.js";
import { tierOf } from "../engine/tiers.js";

export const fmt = (app, n) => formatCoins(n, app.locale);

// ---- skipping ---------------------------------------------------------------------------------------
/** Anything that counts up registers here, so one tap (REEL-04 / WIN-02) can finish it. */
export class Skipper {
  constructor() { this.fns = new Set(); }
  add(fn) { this.fns.add(fn); return () => this.fns.delete(fn); }
  fire() { const had = this.fns.size > 0; for (const f of [...this.fns]) f(); return had; }
}

/** Count from `from` to `to` over `ms`; resolves when done or skipped. */
export function countUp(app, { from = 0, to, ms, onValue, onTick }) {
  if (to <= from || ms <= 0) { onValue(to); return Promise.resolve(); }
  let lastTick = -1;
  const run = tween(ms, (t) => {
    const v = Math.floor(from + (to - from) * t);
    onValue(v);
    const step = Math.floor(t * 28);
    if (step !== lastTick) { lastTick = step; if (onTick) onTick(t); else app.audio.sfx("tick", t); }
  }, ease.outCubic);
  const off = app.skipper.add(() => run.cancel(true));
  return run.then(() => { off(); onValue(to); });
}

// ---- toasts -------------------------------------------------------------------------------------------
export function toast(app, text, kind = "info", ms = 3200) {
  const root = document.getElementById("toasts");
  const el = h("div", { class: "toast " + kind, role: "status", text });
  root.append(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 400); }, ms / timing.speed);
  return el;
}

// ---- modals ---------------------------------------------------------------------------------------------
/**
 * openModal({ title, body, buttons: [{label, primary, onClick}], dismissible, wide })
 * Returns { el, close }. A button's onClick may return false to keep the modal open.
 */
export function openModal(app, { title, body, buttons = [], dismissible = true, wide = false, className = "" }) {
  const root = document.getElementById("modal-root");
  let closed = false;
  const close = () => { if (closed) return; closed = true; el.classList.remove("in"); setTimeout(() => el.remove(), 200); if (opts.onClose) opts.onClose(); };
  const opts = {};
  const head = h("header", { class: "modal-head" }, h("h2", { text: title || "" }),
    dismissible ? h("button", { type: "button", class: "icon-btn", "aria-label": app.t("close"), onclick: close }, icon("close")) : null);
  const foot = buttons.length ? h("footer", { class: "modal-foot" }, buttons.map((b) => h("button", {
    type: "button", class: "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : ""), text: b.label,
    onclick: () => { app.audio.sfx("tap"); if (b.onClick && b.onClick() === false) return; close(); },
  }))) : null;
  const card = h("div", { class: "modal-card" + (wide ? " wide" : "") + " " + className, role: "dialog", "aria-modal": "true", "aria-label": title || "" }, title ? head : null, h("div", { class: "modal-body" }, body), foot);
  const el = h("div", { class: "modal", onclick: (e) => { if (dismissible && e.target === el) close(); } }, card);
  root.append(el);
  requestAnimationFrame(() => el.classList.add("in"));
  const first = card.querySelector("button.primary") || card.querySelector("button");
  if (first) first.focus({ preventScroll: true });
  return { el, close, set onClose(fn) { opts.onClose = fn; } };
}

/** A modal that resolves with the index of the button pressed (or -1 when dismissed). */
export function ask(app, { title, body, buttons, dismissible = false }) {
  return new Promise((resolve) => {
    const m = openModal(app, {
      title, body, dismissible,
      buttons: buttons.map((b, i) => ({ ...b, onClick: () => { resolve(i); } })),
    });
    m.onClose = () => resolve(-1);
  });
}

// ---- win celebration -------------------------------------------------------------------------------------
const TIER_TITLES = { big: "tier.big", mega: "tier.mega", epic: "tier.epic" };

/**
 * Big Win / Mega Win / Epic Win overlay. The count-up passes through the tiers in order as thresholds
 * are crossed, with a sting at each step (WIN-03). Tapping skips to the final amount (WIN-02).
 * Resolves once the overlay has closed; the caller credits the balance then.
 */
export async function celebrateWin(app, { amount, bet, cfg, tier, turbo }) {
  const ms = app.game.countUpMs[tier] / (turbo ? 3 : 1);
  const t = cfg.winTiers;
  const el = h("div", { class: "celebrate " + tier });
  const title = h("div", { class: "celebrate-title", text: "" });
  const num = h("div", { class: "celebrate-amount", text: "0" });
  const sub = h("div", { class: "celebrate-sub", text: app.t("tapToSkip") });
  el.append(h("div", { class: "celebrate-rays" }), title, num, sub);
  document.getElementById("app").append(el);
  requestAnimationFrame(() => el.classList.add("in"));
  let shown = 0;
  const order = ["big", "mega", "epic"];
  const reach = (level) => {
    if (level <= shown) return;
    shown = level;
    const name = order[level - 1];
    title.textContent = app.t(TIER_TITLES[name]).toUpperCase();
    title.className = "celebrate-title lvl" + level;
    title.style.animation = "none"; void title.offsetWidth; title.style.animation = "";
    app.audio.sfx("sting", level);
    app.fx.burst(window.innerWidth / 2, window.innerHeight * 0.45, 30 + level * 25, 1 + level * 0.3);
    if (level >= 2) app.fx.shake(document.getElementById("app"), 500, 4 + level * 2);
    if (level === 1) app.haptics.pattern();
  };
  app.audio.music("win");
  app.fx.rain(Math.min(ms, 4000), tier === "epic" ? 2 : 1);
  await countUp(app, {
    to: amount, ms,
    onValue: (v) => {
      num.textContent = fmt(app, v);
      const m = v / bet;
      if (m >= t.epic) reach(3); else if (m >= t.mega) reach(2); else if (m >= t.big) reach(1);
    },
    onTick: (p) => app.audio.sfx("tick", p),
  });
  // a skipped count-up still shows the tier the final amount belongs to, with the sting
  reach(order.indexOf(tier) + 1);
  sub.textContent = "";
  await sleep(app.skipper.fns.size ? 600 : 900);
  await new Promise((resolve) => { const off = app.skipper.add(() => { off(); resolve(); }); setTimeout(() => { off(); resolve(); }, 1400 / timing.speed); });
  el.classList.remove("in");
  await sleep(250);
  el.remove();
}

/** The dedicated jackpot sequence, above Epic Win (JP-02). */
export async function celebrateJackpot(app, { tier, amount, bet }) {
  const el = h("div", { class: "celebrate jackpot jp-" + tier });
  const num = h("div", { class: "celebrate-amount", text: "0" });
  el.append(h("div", { class: "celebrate-rays" }), h("div", { class: "celebrate-kicker", text: app.t("jp.won") }),
    h("div", { class: "celebrate-title lvl3", text: app.t("jp." + tier).toUpperCase() }), num, h("div", { class: "celebrate-sub", text: app.t("tapToSkip") }));
  document.getElementById("app").append(el);
  requestAnimationFrame(() => el.classList.add("in"));
  app.audio.sfx("jackpot");
  app.haptics.pattern();
  app.fx.rain(5000, 2);
  app.fx.burst(window.innerWidth / 2, window.innerHeight * 0.4, 120, 1.6);
  app.fx.shake(document.getElementById("app"), 700, 8);
  await countUp(app, { to: amount, ms: app.game.countUpMs.jackpot, onValue: (v) => (num.textContent = fmt(app, v)) });
  await new Promise((resolve) => { const off = app.skipper.add(() => { off(); resolve(); }); setTimeout(() => { off(); resolve(); }, 1800 / timing.speed); });
  el.classList.remove("in");
  await sleep(250);
  el.remove();
}

// ---- announcements and summaries -----------------------------------------------------------------------------
/** A transition screen: continues on tap, or by itself after `ms` (default 3 s, FS-01). */
export async function announce(app, { title, subtitle, big, ms = 3000, kind = "" }) {
  const el = h("div", { class: "announce " + kind },
    h("div", { class: "announce-card" }, h("div", { class: "announce-title", text: title }), big ? h("div", { class: "announce-big", text: big }) : null,
      subtitle ? h("div", { class: "announce-sub", text: subtitle }) : null, h("div", { class: "announce-hint", text: app.t("tapToContinue") })));
  document.getElementById("app").append(el);
  requestAnimationFrame(() => el.classList.add("in"));
  app.audio.sfx("win", 1);
  await new Promise((resolve) => {
    const done = () => { el.removeEventListener("pointerdown", done); resolve(); };
    el.addEventListener("pointerdown", done);
    setTimeout(done, ms / timing.speed);
  });
  el.classList.remove("in");
  await sleep(220);
  el.remove();
}

/**
 * Feature summary (FS-06, HS-05, PICK-04): total won and a few facts; the total uses the celebration
 * tier of the whole feature (WIN-01). Resolves when the player closes it.
 */
export async function summary(app, { title, total, bet, cfg, lines = [], turbo }) {
  const tier = tierName(cfg, total / bet);
  const big = ["big", "mega", "epic"].includes(tier);
  if (big) await celebrateWin(app, { amount: total, bet, cfg, tier, turbo });
  const num = h("div", { class: "summary-amount", text: "0" });
  const body = h("div", { class: "summary" }, num, h("div", { class: "summary-lines" }, lines.map((l) => h("div", { text: l }))));
  const done = new Promise((resolve) => {
    const m = openModal(app, { title, body, dismissible: false, buttons: [{ label: app.t("continue"), primary: true, onClick: () => { resolve(); } }] });
    m.onClose = () => resolve();
  });
  await countUp(app, { to: total, ms: big ? 400 : Math.min(app.game.countUpMs[tier] || 800, 1600) / (turbo ? 3 : 1), onValue: (v) => (num.textContent = fmt(app, v)) });
  await done;
}

export function tierName(cfg, multiple) { return tierOf(cfg, multiple); }

/** A short level-up celebration (PROG-01). */
export function levelUp(app, { machine, level, coins, rank, chest }) {
  app.audio.sfx("level");
  app.fx.burst(window.innerWidth / 2, 120, 60, rank ? 1.4 : 1);
  const name = app.machines[machine] ? app.machines[machine].name : "";
  let text = coins ? app.t("levelUp", { machine: name, level, coins: fmt(app, coins) }) : app.t("levelUp.plain", { machine: name, level });
  if (rank) text += " " + app.t("levelUp.rank", { rank: rankName(app, rank) });
  if (chest) text += " " + app.t("levelUp.chest");
  return toast(app, text, "level", rank || chest ? 5200 : 3800);
}
