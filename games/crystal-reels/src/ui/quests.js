// The quest screens: challenges, level chests, the lucky wheel, the weekly chain, gems, reel frames and the
// double-or-collect offer. All the rules live in core/quests.js; this file only shows them and asks the player.
import { h, icon, sleep } from "./dom.js";
import { openModal, toast, fmt } from "./overlays.js";
import { formatCoins } from "../core/format.js";
import * as P from "../core/profile.js";
import * as Q from "../core/quests.js";
import { Rng } from "../engine/rng.js";

// ---- small helpers ---------------------------------------------------------------------------------------

/** "1,500 coins", "1× free-spins voucher", "Reel frame: Ruby" */
export function prizeText(app, prize) {
  if (prize.type === "coins") return app.t("prize.coins", { n: fmt(app, prize.amount) });
  if (prize.type === "voucher") return app.t("prize.voucher", { n: prize.count });
  return app.t("prize.frame", { name: app.t("frame." + prize.id) });
}

function prizeIcon(app, prize) {
  if (prize.type === "frame") {
    const f = app.game.frames.find((x) => x.id === prize.id);
    return h("span", { class: "frame-swatch", style: { "--c": f.color, "--g": f.glow } });
  }
  return icon(prize.type === "coins" ? "trophy" : "gift", 28);
}

export function challengeText(app, c) {
  return app.t("ch." + c.metric, { n: c.target, bet: c.bet == null ? "" : fmt(app, c.bet) });
}

const pct = (n, of) => Math.max(0, Math.min(100, Math.round((n / of) * 100)));
const progressBar = (n, of) => h("div", { class: "bar" }, h("i", { style: { width: pct(n, of) + "%" } }));

/** Chests (and the Q&A of what is in them) are rolled with a fresh generator, never the machine's. */
const freshRng = () => new Rng();

// ---- the machine's quest strip ----------------------------------------------------------------------------------

/**
 * A slim row between the jackpots and the reels: the running challenge (or a button to pick one), and a
 * small button for each kind of prize that is waiting: free-spin vouchers, chests, wheel spins.
 */
export function questStrip(app, screen) {
  const t = app.t;
  const chip = h("button", { type: "button", class: "q-chip q-main", "aria-label": t("quest.chip.aria"), onclick: () => screen.openQuests() });
  const voucher = h("button", { type: "button", class: "q-chip q-small q-voucher", onclick: () => screen.useVoucher() });
  const chest = h("button", { type: "button", class: "q-chip q-small q-chest", onclick: () => screen.openChests() });
  const wheel = h("button", { type: "button", class: "q-chip q-small q-wheel", onclick: () => screen.openWheel() });
  const el = h("div", { class: "quest-strip" }, chip, voucher, chest, wheel);
  const update = (enabled) => {
    const p = app.profile, c = p.challenge;
    if (c && c.machine === screen.cfg.id) {
      const def = app.game.challenges.pool.find((x) => x.id === c.id);
      chip.replaceChildren(icon("target", 18), h("span", { class: "q-text" }, h("b", { text: challengeText(app, { ...def, bet: def.minStep == null ? null : screen.cfg.betLevels[def.minStep] }) }),
        h("small", { text: `${c.progress}/${c.target} · ${t("quest.left", { n: c.left })}` })), h("div", { class: "q-bar" }, h("i", { style: { width: pct(c.progress, c.target) + "%" } })));
      chip.classList.add("active");
    } else {
      chip.replaceChildren(icon("target", 18), h("span", { class: "q-text" }, h("b", { text: t("quest.chip") })));
      chip.classList.remove("active");
    }
    const small = (btn, ic, n, aria) => {
      btn.hidden = !n;
      btn.replaceChildren(icon(ic, 18), h("b", { text: String(n) }));
      btn.setAttribute("aria-label", aria);
    };
    small(voucher, "gift", p.vouchers, t("voucher.aria", { n: p.vouchers }));
    small(chest, "chest", p.chests.length, t("chest.count", { n: p.chests.length }));
    small(wheel, "wheel", p.wheel.spins, t("wheel.aria", { n: p.wheel.spins }));
    for (const b of [chip, voucher, chest, wheel]) b.disabled = !enabled;
  };
  return { el, update };
}

// ---- challenges -------------------------------------------------------------------------------------------------

export function showChallenges(app, cfg, { onChange } = {}) {
  const { t } = app, p = app.profile;
  const body = h("div", { class: "quests" });
  let modal;
  const render = () => {
    body.replaceChildren();
    const c = p.challenge;
    if (c && c.machine === cfg.id) {
      const def = app.game.challenges.pool.find((x) => x.id === c.id);
      const text = challengeText(app, { ...def, bet: def.minStep == null ? null : cfg.betLevels[def.minStep] });
      body.append(h("p", { class: "note", text: t("ch.active") }), h("div", { class: "quest-card running" }, h("b", { text }),
        progressBar(c.progress, c.target), h("small", { text: `${c.progress}/${c.target} · ${t("ch.spinsLeft", { n: c.left })}` }),
        h("small", { text: t("ch.reward", { prize: prizeText(app, Q.describeReward(app.game, p, def.reward)) }) })),
        h("button", { type: "button", class: "btn", text: t("ch.abandon"), onclick: () => { Q.abandonChallenge(p); app.persist(); onChange && onChange(); render(); } }));
      return;
    }
    const offers = Q.challengeOffers(app.game, p, cfg);
    body.append(h("p", { class: "note", text: t("ch.intro") }));
    if (!offers.length) body.append(h("p", { class: "fine", text: t("ch.none") }));
    for (const o of offers) {
      body.append(h("div", { class: "quest-card" },
        h("div", { class: "quest-head" }, h("b", { text: challengeText(app, o) }), h("small", { text: t("ch.window", { n: o.spins }) })),
        h("div", { class: "quest-foot" }, h("span", { class: "quest-prize" }, prizeIcon(app, o.reward), h("span", { text: prizeText(app, o.reward) })),
          h("button", { type: "button", class: "btn primary", text: t("ch.start"), onclick: () => {
            if (!Q.startChallenge(app.game, p, cfg, o.id)) return;
            app.audio.sfx("tap"); app.persist(); onChange && onChange(true); modal.close();
          } }))));
    }
    if (offers.some(Q.isBetQuest)) body.append(h("p", { class: "fine", text: t("ch.betNote") }));
  };
  render();
  modal = openModal(app, { title: t("ch.title"), body, wide: true });
  return modal;
}

// ---- level chests ----------------------------------------------------------------------------------------------------

function chestSource(app, chest) {
  const t = app.t;
  if (chest.source === "level") return t("chest.from.level", { level: chest.level, machine: app.machines[chest.machine].name });
  if (chest.source === "gems") return t("chest.from.gems", { machine: app.machines[chest.machine].name });
  return t("chest.from.chain");
}

/** Open the oldest chest: three boxes, pick one; the other two show what they held. */
export function showChest(app, { onChange } = {}) {
  const { t } = app, p = app.profile;
  if (!p.chests.length) { toast(app, t("chest.none", { n: app.game.chests.everyLevels }), "info"); return null; }
  const chest = p.chests[0];
  const prizes = Q.rollChest(app.game, p, freshRng());
  const body = h("div", { class: "chest" }, h("p", { class: "note", text: chestSource(app, chest) }), h("p", { class: "chest-pick", text: t("chest.pick") }));
  const row = h("div", { class: "chest-row" });
  const out = h("div", { class: "chest-out", "aria-live": "polite" });
  let opened = false;
  prizes.forEach((prize, i) => {
    const box = h("button", { type: "button", class: "chest-box", "aria-label": t("chest.pick") + " " + (i + 1) }, icon("chest", 44));
    box.onclick = () => {
      if (opened) return;
      opened = true;
      const got = Q.openChest(app.game, p, prizes, i);
      app.persist(); app.audio.sfx("level"); app.fx.burst(window.innerWidth / 2, window.innerHeight * 0.4, 50, 1);
      [...row.children].forEach((b, k) => {
        b.disabled = true; b.classList.add(k === i ? "chosen" : "other");
        b.replaceChildren(prizeIcon(app, prizes[k]), h("small", { text: prizeText(app, prizes[k]) }));
      });
      out.replaceChildren(h("b", { text: t("chest.got", { prize: prizeText(app, got) }) }), h("small", { text: t("chest.others") }));
      if (onChange) onChange();
      if (p.chests.length) foot.replaceChildren(h("button", { type: "button", class: "btn primary", text: t("chest.next"), onclick: () => { modal.close(); showChest(app, { onChange }); } }));
      else foot.replaceChildren(h("button", { type: "button", class: "btn primary", text: t("ok"), onclick: () => modal.close() }));
    };
    row.append(box);
  });
  const foot = h("div", { class: "chest-foot" });
  body.append(row, out, foot);
  const modal = openModal(app, { title: t("chest.title"), body });
  return modal;
}

// ---- the lucky wheel --------------------------------------------------------------------------------------------------

function wheelSvg(app) {
  const slices = app.game.wheel.slices, n = slices.length, R = 96, ns = "http://www.w3.org/2000/svg";
  const svg = h("svg", { viewBox: "-100 -100 200 200", class: "wheel-svg", "aria-hidden": "true" });
  const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [Math.cos(a) * r, Math.sin(a) * r]; };
  const colors = ["#7d4dff", "#ff4fb4", "#27c9f3", "#ffb43a"];
  slices.forEach((s, i) => {
    const a0 = (360 / n) * i, a1 = (360 / n) * (i + 1);
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M0 0L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z`);
    path.setAttribute("fill", s.voucher ? "#2fe39b" : colors[i % colors.length]);
    path.setAttribute("stroke", "#120c3d"); path.setAttribute("stroke-width", "1.5");
    svg.append(path);
    const mid = (a0 + a1) / 2, [tx, ty] = pt(mid, 64);
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", tx); label.setAttribute("y", ty);
    label.setAttribute("transform", `rotate(${mid} ${tx} ${ty})`);
    label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("class", "wheel-label");
    label.textContent = s.voucher ? "★" : formatCoins(P.scaledReward(app.game, app.profile, s.coins), app.locale);
    svg.append(label);
  });
  return svg;
}

export function showWheel(app, { onChange } = {}) {
  const { t } = app, p = app.profile;
  const svg = wheelSvg(app);
  const disc = h("div", { class: "wheel-disc" }, svg);
  const left = h("p", { class: "note" });
  const out = h("div", { class: "chest-out", "aria-live": "polite" });
  const go = h("button", { type: "button", class: "btn primary", text: t("wheel.spin") });
  const body = h("div", { class: "wheel" }, h("div", { class: "wheel-box" }, h("i", { class: "wheel-pointer" }), disc), left, out, go);
  let turns = 0, busy = false;
  const refresh = () => {
    left.textContent = p.wheel.spins ? t("wheel.spinsLeft", { n: p.wheel.spins }) : t("wheel.none");
    go.disabled = busy || p.wheel.spins < 1;
  };
  go.onclick = async () => {
    if (busy || p.wheel.spins < 1) return;
    busy = true; go.disabled = true; out.replaceChildren();
    const res = Q.spinWheel(app.game, p, freshRng());
    app.persist(); app.audio.sfx("spin");
    const n = app.game.wheel.slices.length;
    turns += 5;
    const angle = turns * 360 - (res.index * (360 / n) + 180 / n);
    const still = document.body.classList.contains("reduced-motion");
    disc.style.transition = still ? "none" : "transform 4s cubic-bezier(.12,.6,.1,1)";
    disc.style.transform = `rotate(${angle}deg)`;
    await sleep(still ? 50 : 4100);
    app.audio.sfx("level"); app.fx.burst(window.innerWidth / 2, window.innerHeight * 0.35, 40, 1);
    out.replaceChildren(h("b", { text: t("wheel.got", { prize: prizeText(app, res.prize) }) }));
    busy = false; refresh();
    if (onChange) onChange();
  };
  refresh();
  return openModal(app, { title: t("wheel.title"), body });
}

// ---- weekly chain, as a card in the lobby --------------------------------------------------------------------------------

export function chainCard(app) {
  const t = app.t, st = Q.chainStatus(app.profile, app.game);
  const steps = st.def.steps.map((s, i) => {
    const state = st.done || i < st.step ? "done" : i === st.step ? "now" : "next";
    const reward = P.scaledReward(app.game, app.profile, s.reward);
    return h("div", { class: "chain-step " + state },
      h("span", { class: "chain-dot", text: state === "done" ? "✓" : String(i + 1) }),
      h("span", { class: "chain-text" }, h("b", { text: t("chain." + s.metric, { n: s.target }) }),
        state === "now" ? h("div", { class: "bar" }, h("i", { style: { width: pct(st.progress, s.target) + "%" } })) : null,
        h("small", { text: state === "now" ? `${st.progress}/${s.target} · ${t("chain.reward", { n: fmt(app, reward) })}` : t("chain.reward", { n: fmt(app, reward) }) })));
  });
  return h("section", { class: "chain", "aria-label": t("chain.title") },
    h("h2", { class: "section-title", text: t("chain.title") + " · " + t("chainname." + st.def.id) }), ...steps,
    h("small", { class: "fine", text: st.done ? t("chain.done") : t("chain.final", { coins: fmt(app, st.final.coins) }) }));
}

/** The lobby cards for waiting prizes: wheel spins and chests. */
export function prizeCards(app, onChange) {
  const t = app.t, p = app.profile;
  const wheel = h("button", { type: "button", class: "bonus-card prize", onclick: () => showWheel(app, { onChange }) }, icon("wheel", 26),
    h("span", {}, h("b", { text: t("wheel.title") }), h("small", { text: p.wheel.spins ? t("wheel.spinsLeft", { n: p.wheel.spins }) : t("wheel.none") })));
  wheel.classList.toggle("ready", p.wheel.spins > 0);
  const chest = h("button", { type: "button", class: "bonus-card prize", onclick: () => showChest(app, { onChange }) }, icon("chest", 26),
    h("span", {}, h("b", { text: t("chest.title") }), h("small", { text: p.chests.length ? t("chest.count", { n: p.chests.length }) : t("chest.none", { n: app.game.chests.everyLevels }) })));
  chest.classList.toggle("ready", p.chests.length > 0);
  return [wheel, chest];
}

// ---- gems and frames (profile) -------------------------------------------------------------------------------------------

export function gemsRow(app, machineId) {
  const t = app.t, g = app.game, owned = Q.gemsOf(app.profile, machineId);
  const items = g.gems.list.map((x) => h("div", { class: "gem" + (owned.includes(x.id) ? " got" : "") },
    h("span", { class: "gem-ico gem-" + x.id }, owned.includes(x.id) ? "◆" : "◇"), h("span", {}, h("b", { text: t("gem." + x.id) }), h("small", { text: t("gemhow." + x.id) }))));
  return h("div", { class: "gems" }, h("small", { class: "fine", text: t("gems.count", { n: owned.length, total: g.gems.list.length }) + (Q.gemSetComplete(g, app.profile, machineId) ? " · " + t("gems.setDone") : "") }), h("div", { class: "gem-grid" }, items));
}

export function framePicker(app, onChange) {
  const t = app.t, p = app.profile, owned = Q.ownedFrames(p);
  const wrap = h("div", { class: "frames" });
  const draw = () => {
    wrap.replaceChildren();
    const opt = (id, label, f) => h("button", { type: "button", class: "frame-opt" + (p.cosmetics.frame === id ? " on" : ""), "aria-pressed": String(p.cosmetics.frame === id),
      onclick: () => { Q.equipFrame(p, app.game, id); app.persist(); draw(); if (onChange) onChange(); } },
      h("span", { class: "frame-swatch", style: f ? { "--c": f.color, "--g": f.glow } : {} }), h("small", { text: label }));
    wrap.append(opt(null, t("frames.default"), null));
    for (const id of owned) wrap.append(opt(id, t("frame." + id), app.game.frames.find((f) => f.id === id)));
  };
  draw();
  return h("div", {}, owned.length ? null : h("p", { class: "fine", text: t("frames.none") }), wrap);
}

// ---- double or collect --------------------------------------------------------------------------------------------------------

/**
 * Offered after a small base-game win when the player turned it on in the settings. Resolves with the win that
 * stays after the player has collected (or been through every round the rules allow).
 */
export async function offerGamble(app, session, { maxRounds, onValue }) {
  const t = app.t;
  for (let round = 0; round < maxRounds && session.canGamble(); round++) {
    const amount = session.state.pending.outcome.totalWin;
    const pick = await new Promise((resolve) => {
      const card = (i, label, cls) => h("button", { type: "button", class: "gamble-card " + cls, onclick: () => { m.close(); resolve(i); } }, h("b", { text: label }), h("span", { text: i === 0 ? "♦" : "♣" }));
      const body = h("div", { class: "gamble" }, h("p", { text: t("gamble.note", { amount: fmt(app, amount) }) }),
        h("div", { class: "gamble-row" }, card(0, t("gamble.red"), "red"), card(1, t("gamble.black"), "black")),
        h("button", { type: "button", class: "btn primary", text: t("gamble.collect", { amount: fmt(app, amount) }), onclick: () => { m.close(); resolve(-1); } }));
      const m = openModal(app, { title: t("gamble.title"), body, dismissible: false });
    });
    if (pick < 0) break;
    const res = session.gamble(pick);
    app.audio.sfx(res.won ? "level" : "error");
    if (onValue) onValue(res.total);
    toast(app, res.won ? t("gamble.won", { amount: fmt(app, res.total) }) : t("gamble.lost"), res.won ? "level" : "info", 1800);
    app.persist();
    await sleep(900);
    if (!res.won) break;
  }
  return session.state.pending.outcome.totalWin;
}

