// Menus: the rules screen (MATH-06, PAY-01), settings (PERS-04), profile and stats (PROG-05),
// the refill offer (ECO-04) and the session reminder (FAIR-06).
import { h, icon, symbolSvg } from "./dom.js";
import { openModal, ask, fmt, toast } from "./overlays.js";
import { formatDuration } from "../core/format.js";
import * as P from "../core/profile.js";
import { jackpotAmounts } from "../engine/jackpot.js";
import { unitValue } from "../engine/evaluate.js";
import { prepare } from "../engine/config.js";
import { choiceSpins } from "../engine/features.js";
import { xpMeter, rankName } from "./xp.js";
import { gemsRow, framePicker } from "./quests.js";

// ---- rules and paytable -------------------------------------------------------------------------------
/** Everything on this screen is built from the machine's config, so it always matches the math (MATH-06). */
export function showInfo(app, screen) {
  const cfg = screen.cfg, t = app.t;
  const prep = prepare(cfg);
  const tabs = ["pay", "lines", "features", "jackpots"];
  let tab = "pay";
  const body = h("div", { class: "info" });
  const nav = h("div", { class: "tabs", role: "tablist" });
  const betValue = h("b", { text: "" });
  const stepBtn = (dir, ic) => h("button", { type: "button", class: "round-btn", "aria-label": t(dir > 0 ? "betUp" : "betDown"), onclick: () => screen.stepBet(dir) }, icon(ic, 18));
  const betRow = h("div", { class: "info-bet" }, h("span", { text: t("bet") }), stepBtn(-1, "minus"), betValue, stepBtn(1, "plus"));
  const bet = () => screen.bet;
  const money = (n) => fmt(app, n);
  const unit = () => unitValue(prep, bet());
  const art = (id) => symbolSvg(cfg.symbols[id].art, "info-sym");

  function payTab() {
    const rows = [];
    const ids = Object.keys(cfg.paytable).filter((id) => cfg.symbols[id].kind === "regular").sort((a, b) => Math.max(...Object.values(cfg.paytable[b])) - Math.max(...Object.values(cfg.paytable[a])));
    for (const id of ids) {
      const table = cfg.paytable[id];
      rows.push(h("div", { class: "pay-row" }, art(id), h("div", { class: "pay-vals" }, Object.keys(table).sort((a, b) => b - a).map((c) => h("div", {}, h("span", { text: c + "×" }), h("b", { text: money(Math.floor(table[c] * unit() + 1e-9)) }))))));
    }
    const out = [h("p", { class: "note", text: t(cfg.mode === "ways" ? "info.paysWays" : "info.paysLines") }), h("div", { class: "pay-grid" }, rows)];
    const special = [];
    for (const [id, s] of Object.entries(cfg.symbols)) {
      if (s.kind === "regular") continue;
      let text = "";
      if (s.kind === "wild") text = s.expanding ? t("info.wildExpanding") : s.multiplier ? t("info.wildMult", { x: s.multiplier, how: t("info.combine." + (prep.combine)) }) : t("info.wild");
      else if (s.kind === "scatter") text = t("info.scatter", { min: cfg.features.freeSpins ? cfg.features.freeSpins.trigger.minCount : 3 }) + " " + Object.keys(cfg.paytable[id]).sort((a, b) => b - a).map((c) => `${c}×: ${money(cfg.paytable[id][c] * bet())}`).join(", ");
      else if (s.kind === "coin") text = t("info.coin", { n: cfg.features.holdSpin.trigger.count });
      else if (s.kind === "bonus") text = t("info.bonus", { reels: cfg.features.pick.trigger.reels.map((r) => r + 1).join(", ") });
      else if (s.kind === "collect") text = t("info.collect", { n: cfg.meter.target });
      special.push(h("div", { class: "special" }, art(id), h("span", { text })));
    }
    out.push(h("div", { class: "specials" }, special));
    return out;
  }

  function linesTab() {
    if (cfg.mode === "ways") return [h("p", { text: t("info.ways", { ways: Math.pow(cfg.grid.rows, cfg.grid.reels), reels: cfg.grid.reels, rows: cfg.grid.rows }) })];
    const colors = ["#ffd35a", "#6fd0ff", "#ff6fb7", "#7dffb0", "#b07cff", "#ff9d3d"];
    const minis = cfg.paylines.map((line, i) => {
      const w = cfg.grid.reels, hh = cfg.grid.rows, cell = 14;
      const svg = h("svg", { viewBox: `0 0 ${w * cell} ${hh * cell}`, class: "mini", "aria-label": t("info.line", { n: i + 1 }) });
      for (let r = 0; r < w; r++) for (let row = 0; row < hh; row++) svg.append(h("rect", { x: r * cell + 1, y: row * cell + 1, width: cell - 2, height: cell - 2, rx: 2, fill: "rgba(255,255,255,.12)" }));
      svg.append(h("polyline", { points: line.map((row, r) => `${r * cell + cell / 2},${row * cell + cell / 2}`).join(" "), fill: "none", stroke: colors[i % colors.length], "stroke-width": 2.4, "stroke-linejoin": "round" }));
      return h("div", { class: "mini-wrap" }, h("span", { class: "mini-num", style: { background: colors[i % colors.length] }, text: String(i + 1) }), svg);
    });
    return [h("p", { class: "note", text: t("info.linesNote", { n: cfg.paylines.length }) }), h("div", { class: "mini-grid" }, minis)];
  }

  function featuresTab() {
    const f = cfg.features, out = [];
    const sec = (title, lines) => out.push(h("section", { class: "rule" }, h("h3", { text: title }), lines.map((l) => h("p", { text: l }))));
    if (f.freeSpins) {
      const fs = f.freeSpins, aw = fs.trigger.awards, lines = [];
      lines.push(t("info.fs.trigger", { list: Object.keys(aw).map((c) => `${c} → ${aw[c]}`).join(", ") }));
      if (fs.choice) lines.push(t("info.fs.choice", { list: fs.choice.map((o) => t("info.fs.optionItem", { spins: choiceSpins(prep, o, fs.trigger.minCount), m: o.multiplier })).join(" / ") }));
      lines.push(t("info.fs.bet"));
      if (fs.retrigger && fs.retrigger.enabled) lines.push(t("info.fs.retrigger", { n: fs.retrigger.spins, cap: fs.retrigger.cap }));
      if (fs.modifiers && fs.modifiers.stickyWilds) lines.push(t("info.fs.sticky"));
      if (fs.modifiers && fs.modifiers.multiplier > 1) lines.push(t("info.fs.mult", { x: fs.modifiers.multiplier }));
      if (fs.modifiers && fs.modifiers.progressive) lines.push(t("info.fs.prog", { step: fs.modifiers.progressive.step, max: fs.modifiers.progressive.max, per: t("info.per." + fs.modifiers.progressive.per) }));
      if (cfg.strips.free) lines.push(t("info.fs.strips"));
      sec(t("fs.title"), lines);
    }
    if (f.holdSpin) {
      const hs = f.holdSpin;
      const vals = hs.coinValues.filter((c) => c.value).map((c) => c.value);
      sec(t("hs.title"), [t("info.hs.trigger", { n: hs.trigger.count }), t("info.hs.respins", { n: hs.respins }), t("info.hs.values", { min: Math.min(...vals), max: Math.max(...vals) }), t("info.hs.grand")]);
    }
    if (f.pick) {
      const pk = f.pick;
      sec(t("pick.title"), [t("info.pick.trigger", { reels: pk.trigger.reels.map((r) => r + 1).join(", ") }), t("info.pick.rules", { items: pk.items, picks: pk.startPicks }), t("info.pick.fair")]);
    }
    if (cfg.cascade && cfg.cascade.enabled) sec(t("info.cascade"), [t("info.cascade.text", { list: cfg.cascade.multipliers.map((m) => "×" + m).join(", ") })]);
    if (cfg.meter) sec(t("meter"), [t("info.meter", { n: cfg.meter.target, reward: t("info.meter." + cfg.meter.reward.type, { n: cfg.meter.reward.spins || 0 }) })]);
    sec(t("info.limits"), [t("info.maxwin", { x: money(cfg.maxWin), coins: money(cfg.maxWin * bet()) }), t("info.rtp", { rtp: (cfg.targets.rtp * 100).toFixed(2) }), t("info.nomoney")]);
    return out;
  }

  function jackpotTab() {
    if (!cfg.jackpots) return [h("p", { text: t("info.noJackpots") })];
    const amounts = jackpotAmounts(cfg, screen.session.state.pools, bet());
    return [h("p", { class: "note", text: t("info.jp.note") }), ...["mini", "minor", "major", "grand"].map((tier) => {
      const j = cfg.jackpots[tier];
      return h("div", { class: "jp-row jp-" + tier }, h("span", { text: t("jp." + tier) }), h("em", { text: j.type === "fixed" ? t("info.jp.fixed", { x: j.value }) : t("info.jp.prog", { seed: j.seed }) }), h("b", { text: money(amounts[tier]) }));
    }), h("p", { class: "note", text: t("info.jp.how") })];
  }

  const renderers = { pay: payTab, lines: linesTab, features: featuresTab, jackpots: jackpotTab };
  const update = () => {
    betValue.textContent = money(bet());
    nav.replaceChildren(...tabs.map((id) => h("button", { type: "button", role: "tab", class: "tab" + (id === tab ? " on" : ""), "aria-selected": String(id === tab), text: t("info.tab." + id), onclick: () => { tab = id; update(); } })));
    body.replaceChildren(...renderers[tab]());
  };
  const m = openModal(app, { title: cfg.name + " · " + t("info"), body: h("div", {}, betRow, nav, body), wide: true });
  app.infoOpen = { update };
  m.onClose = () => { app.infoOpen = null; };
  update();
}

// ---- settings (PERS-04) ------------------------------------------------------------------------------------
export function showSettings(app) {
  const s = app.profile.settings, t = app.t;
  const apply = () => { app.audio.applySettings(); app.applyMotion(); app.persist(); };
  const slider = (key, label) => {
    const input = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: s[key], "aria-label": label });
    input.oninput = () => { s[key] = Number(input.value); apply(); };
    input.onchange = () => app.audio.sfx("tap");
    return h("label", { class: "field" }, h("span", { text: label }), input);
  };
  const toggle = (key, label, note, after) => {
    const input = h("input", { type: "checkbox", role: "switch" });
    input.checked = !!s[key];
    input.onchange = async () => { s[key] = input.checked; if (after) await after(input); apply(); };
    return h("label", { class: "field check" }, h("span", {}, h("b", { text: label }), note ? h("small", { text: note }) : null), input);
  };
  const lang = h("select", { class: "select", "aria-label": t("language") }, I18n.languages.map((l) => h("option", { value: l.code, text: l.name, selected: l.code === I18n.lang })));
  lang.onchange = () => I18n.set(lang.value);
  const remind = h("select", { class: "select", "aria-label": t("set.reminder") }, app.game.sessionReminder.choices.map((m) => h("option", { value: m, text: m ? t("set.every", { m }) : t("set.off"), selected: m === s.reminderMinutes })));
  remind.onchange = () => { s.reminderMinutes = Number(remind.value); apply(); };
  const body = h("div", { class: "settings" },
    slider("musicVolume", t("set.music")), slider("sfxVolume", t("set.sfx")),
    toggle("muted", t("set.mute")), toggle("haptics", t("set.haptics")), toggle("turbo", t("set.turbo"), t("set.turbo.note")),
    toggle("reducedMotion", t("set.motion"), t("set.motion.note")),
    toggle("gamble", t("set.gamble"), t("set.gamble.note")),
    h("label", { class: "field" }, h("span", { text: t("language") }), lang),
    h("label", { class: "field" }, h("span", {}, h("b", { text: t("set.reminder") }), h("small", { text: t("set.reminder.note") })), remind),
    toggle("bonusReminder", t("set.bonusReminder"), t("set.bonusReminder.note"), async (input) => {
      if (input.checked) {
        let ok = false;
        try { ok = "Notification" in window && (await Notification.requestPermission()) === "granted"; } catch (e) { ok = false; }
        if (!ok) { input.checked = false; s.bonusReminder = false; toast(app, t("set.noNotify"), "info"); }
      }
    }),
    h("div", { class: "field" }, h("span", {}, h("b", { text: t("set.export") }), h("small", { text: t("set.export.note") })),
      h("button", { type: "button", class: "pill-btn", text: t("set.export.open"), onclick: () => showExport(app) })),
    h("div", { class: "danger-zone" }, h("button", { type: "button", class: "btn danger", text: t("set.reset"), onclick: async () => {
      const i = await ask(app, { title: t("set.reset"), body: h("p", { text: t("set.reset.confirm") }), buttons: [{ label: t("cancel") }, { label: t("set.reset.do"), danger: true }], dismissible: true });
      if (i === 1) app.resetProgress();
    } })),
    h("p", { class: "fine", text: t("set.promise") }));
  openModal(app, { title: t("settings"), body });
}

// ---- export the profile as JSON ------------------------------------------------------------------------------
/** Copy text to the clipboard; falls back to selecting it in a hidden field where the clipboard API is blocked. */
async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* not allowed here: try the old way */ }
  try { fallbackEl.focus(); fallbackEl.select(); return document.execCommand("copy"); } catch (e) { return false; }
}

export function showExport(app) {
  const t = app.t;
  const json = JSON.stringify(P.exportProfile(app.profile, app.game), null, 2);
  const box = h("textarea", { class: "export-box", readonly: true, rows: 9, spellcheck: "false", "aria-label": t("set.export") }, json);
  const copy = h("button", { type: "button", class: "btn primary", text: t("set.export.copy") });
  copy.onclick = async () => {
    const ok = await copyText(json, box);
    app.audio.sfx("tap");
    if (ok) { copy.textContent = t("set.export.copied"); setTimeout(() => { copy.textContent = t("set.export.copy"); }, 2000); }
    else { box.focus(); box.select(); toast(app, t("set.export.manual"), "info", 4500); }
  };
  openModal(app, { title: t("set.export"), body: h("div", { class: "export" }, h("p", { class: "note", text: t("set.export.text") }), box, h("div", { class: "export-actions" }, copy)) });
}

// ---- profile, missions and achievements (PROG-04, PROG-05) ------------------------------------------------
export function showProfile(app) {
  const t = app.t, p = app.profile, g = app.game;
  const day = P.localDay();
  const row = (a, b) => h("div", { class: "stat" }, h("span", { text: a }), h("b", { text: b }));
  const stats = [
    row(t("stats.xp"), fmt(app, Math.floor(P.totalXp(p)))), row(t("stats.spins"), fmt(app, p.totals.spins)),
    row(t("stats.wagered"), fmt(app, p.totals.wagered)), row(t("stats.won"), fmt(app, p.totals.won)),
    row(t("stats.return"), p.totals.wagered ? (P.actualReturn(p) * 100).toFixed(1) + "%" : "-"),
  ];
  const perMachine = Object.values(app.machines).map((cfg) => {
    const st = (p.machines[cfg.id] || {}).stats || { spins: 0, biggestWin: 0, features: 0, jackpots: 0 };
    const prog = P.xpProgress(g, P.machineXp(p, cfg.id)), rank = P.rankFor(g, prog.level);
    const meter = xpMeter(app, cfg.id, { text: false });
    return h("section", { class: "rule" }, h("h3", { text: cfg.name }), meter.el,
      row(t("stats.level"), `${prog.level} · ${rankName(app, rank)}`), row(t("stats.machineXp"), fmt(app, Math.floor(P.machineXp(p, cfg.id)))),
      row(t("stats.nextLevel"), t("stats.xpToGo", { n: fmt(app, Math.ceil(prog.to - P.machineXp(p, cfg.id))) })), gemsRow(app, cfg.id), row(t("stats.spins"), fmt(app, st.spins)), row(t("stats.biggest"), fmt(app, st.biggestWin)), row(t("stats.features"), fmt(app, st.features)), row(t("stats.jackpots"), fmt(app, st.jackpots)));
  });
  const missions = P.activeMissions(p, g, day).map((m) => h("div", { class: "mission" }, h("span", { text: t("mission." + m.id) }), h("div", { class: "bar" }, h("i", { style: { width: Math.round((m.progress / m.target) * 100) + "%" } })), h("small", { text: `${m.progress}/${m.target} · +${fmt(app, m.reward)}` })));
  const ach = g.achievements.map((a) => {
    const when = p.achievements[a.id];
    return h("div", { class: "ach" + (when ? " got" : "") }, icon(when ? "trophy" : "lock", 20), h("span", {}, h("b", { text: t("ach." + a.id) }), h("small", { text: when ? new Date(when).toLocaleDateString(app.locale) : t("ach.locked") })));
  });
  const body = h("div", { class: "profile" }, h("h3", { text: t("stats.title") }), h("div", { class: "stats" }, stats), perMachine, h("h3", { text: t("frames.title") }), framePicker(app, () => { if (app.screen) app.screen.applyFrame(); }), h("h3", { text: t("missions") }), missions, h("h3", { text: t("achievements") }), h("div", { class: "achs" }, ach));
  openModal(app, { title: t("profile"), body, wide: true });
}

// ---- refill (ECO-04) -------------------------------------------------------------------------------------------
export function showRefill(app, status, done) {
  const t = app.t;
  const body = h("div", { class: "refill" }, h("p", { text: t("refill.text") }), h("p", { class: "fine", text: t("refill.free") }));
  const take = h("button", { type: "button", class: "btn primary", text: t("refill.take", { n: fmt(app, status.amount) }) });
  const wait = h("p", { class: "countdown" });
  const m = openModal(app, { title: t("refill.title"), body: h("div", {}, body, wait, take), dismissible: true });
  const tick = () => {
    const left = status.availableAt - Date.now();
    const ready = left <= 0;
    take.disabled = !ready;
    wait.textContent = ready ? "" : t("refill.wait", { time: formatDuration(left) });
    if (!ready) timer = setTimeout(tick, 500);
  };
  let timer = 0;
  tick();
  m.onClose = () => clearTimeout(timer);
  take.onclick = () => {
    const got = P.claimRefill(app.profile, app.game, app.currentLowestBet(), Date.now());
    if (got) { app.audio.sfx("level"); app.persist(); toast(app, t("refill.got", { n: fmt(app, got) }), "level"); m.close(); if (done) done(); }
  };
}

// ---- session reminder (FAIR-06) -----------------------------------------------------------------------------------
export async function showReminder(app, goLobby) {
  const t = app.t, p = app.profile;
  const net = p.totals.won - p.totals.wagered - (app.sessionStart.won - app.sessionStart.wagered);
  const i = await ask(app, {
    title: t("remind.title"),
    body: h("div", {}, h("p", { text: t("remind.time", { time: formatDuration(Date.now() - app.sessionStart.time) }) }),
      h("p", { class: net < 0 ? "neg" : "pos", text: t("remind.net", { n: (net >= 0 ? "+" : "−") + fmt(app, Math.abs(net)) }) })),
    buttons: [{ label: t("remind.keep"), primary: true }, { label: t("remind.off") }, { label: t("remind.lobby") }],
  });
  if (i === 1) { p.settings.reminderMinutes = 0; app.persist(); }
  if (i === 2) goLobby();
}
