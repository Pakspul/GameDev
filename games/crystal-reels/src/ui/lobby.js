// The machine lobby (PROG-02), timed bonus (ECO-05), daily missions (PROG-04).
import { h, icon, symbolSvg } from "./dom.js";
import { openModal, fmt, toast } from "./overlays.js";
import { formatDuration } from "../core/format.js";
import * as P from "../core/profile.js";
import { installArt } from "./art.js";
import { initialPools, jackpotAmount } from "../engine/jackpot.js";

export class Lobby {
  constructor(app) { this.app = app; this.alive = true; }

  open() {
    const { app } = this, t = app.t, p = app.profile, g = app.game;
    installArt(Object.values(app.machines).flatMap((c) => Object.values(c.symbols).map((s) => s.art)));
    app.audio.music("lobby");
    const xp = P.xpProgress(g, p.xp);
    this.balance = h("b", { text: fmt(app, p.balance) });
    this.levelEl = h("span", { class: "level-badge", text: String(xp.level) });
    this.xpFill = h("i", { style: { width: Math.round(xp.fraction * 100) + "%" } });
    app.nav.setBack();
    app.nav.back.disabled = false;
    const top = h("header", { class: "topbar lobby-top" }, app.nav.back,
      h("div", { class: "topbar-mid" }, h("div", { class: "machine-name", text: t("title") }), h("div", { class: "xp-row" }, this.levelEl, h("div", { class: "xp-bar", role: "progressbar", "aria-label": t("xp") }, this.xpFill))),
      h("div", { class: "balance" }, symbolSvg("coin", "coin-icon"), this.balance),
      app.nav.menu);

    this.bonusBtn = h("button", { type: "button", class: "bonus-card", onclick: () => this.collect() });
    this.missionsEl = h("section", { class: "missions", "aria-label": t("missions") });
    this.tiles = h("div", { class: "tiles" });
    const scroll = h("main", { class: "lobby-scroll" }, h("p", { class: "lobby-note", text: t("lobby.note") }), this.bonusBtn, this.missionsEl, h("h2", { class: "section-title", text: t("machines") }), this.tiles);
    this.el = h("section", { class: "lobby" }, top, scroll);
    app.root.replaceChildren(this.el);
    this.renderTiles(); this.renderMissions(); this.renderBonus();
    this.timer = setInterval(() => { if (!document.body.contains(this.el)) return clearInterval(this.timer); this.renderBonus(); }, 1000);
  }

  close() { clearInterval(this.timer); this.alive = false; }

  renderBonus() {
    const { app } = this, t = app.t;
    const st = P.timedBonusStatus(app.profile, app.game);
    if (!st.enabled) { this.bonusBtn.hidden = true; return; }
    this.bonusBtn.disabled = !st.ready;
    this.bonusBtn.classList.toggle("ready", st.ready);
    this.bonusBtn.replaceChildren(icon("gift", 26), h("span", {}, h("b", { text: st.ready ? t("bonus.ready", { n: fmt(app, st.amount) }) : t("bonus.title") }),
      h("small", { text: st.ready ? t("bonus.tap") : t("bonus.next", { time: formatDuration(st.nextAt - Date.now()) }) })));
  }

  collect() {
    const { app } = this;
    const got = P.claimTimedBonus(app.profile, app.game);
    if (!got) return;
    app.audio.sfx("level");
    app.fx.burst(window.innerWidth / 2, 200, 50, 1);
    app.persist();
    this.balance.textContent = fmt(app, app.profile.balance);
    toast(app, app.t("bonus.got", { n: fmt(app, got) }), "level");
    this.renderBonus();
    app.scheduleBonusReminder();
  }

  renderMissions() {
    const { app } = this, t = app.t;
    const list = P.activeMissions(app.profile, app.game, P.localDay());
    this.missionsEl.replaceChildren(h("h2", { class: "section-title", text: t("missions") }), ...list.map((m) => h("div", { class: "mission" },
      h("span", { text: t("mission." + m.id) }), h("div", { class: "bar" }, h("i", { style: { width: Math.round((m.progress / m.target) * 100) + "%" } })), h("small", { text: `${m.progress}/${m.target} · +${fmt(app, m.reward)}` }))));
  }

  renderTiles() {
    const { app } = this, t = app.t, p = app.profile, g = app.game;
    this.tiles.replaceChildren();
    for (const m of g.machines) {
      const cfg = app.machines[m.id];
      const unlocked = P.machineUnlocked(g, p, m.id);
      const entry = p.machines[m.id];
      const pools = entry && entry.state ? entry.state.pools : initialPools(cfg);
      const bet = entry && entry.state ? entry.state.bet : cfg.defaultBet;
      const grand = cfg.jackpots ? jackpotAmount(cfg, pools, "grand", bet) : 0;
      const th = cfg.theme;
      const tile = h("button", { type: "button", class: "tile" + (unlocked ? "" : " locked") + (p.last === m.id ? " last" : ""), style: { "--accent": th.accent, "--accent2": th.accent2, "--bg-top": th.bgTop, "--bg-bottom": th.bgBottom },
        onclick: () => (unlocked ? app.openMachine(m.id) : this.showLocked(m, cfg)) },
        h("div", { class: "tile-art" }, ...[...new Set(Object.values(cfg.symbols).map((s) => s.art))].slice(0, 5).map((a) => symbolSvg(a, "tile-sym"))),
        h("div", { class: "tile-name", text: cfg.name }),
        h("div", { class: "tile-info" }, cfg.jackpots ? h("span", {}, t("jp.grand") + " ", h("b", { text: fmt(app, grand) })) : null, h("small", { text: t(cfg.mode === "ways" ? "tile.ways" : "tile.lines", { n: cfg.mode === "ways" ? Math.pow(cfg.grid.rows, cfg.grid.reels) : cfg.paylines.length }) })),
        p.last === m.id && unlocked ? h("span", { class: "badge", text: t("tile.last") }) : null,
        unlocked ? null : h("div", { class: "lock" }, icon("lock", 28), h("b", { text: t("tile.level", { n: m.unlockLevel }) })));
      this.tiles.append(tile);
    }
  }

  showLocked(m, cfg) {
    const { app } = this, t = app.t;
    const need = m.unlockLevel, xp = P.xpProgress(app.game, app.profile.xp);
    const next = app.game.xp.thresholds[need - 1] - app.profile.xp;
    openModal(app, { title: cfg.name, body: h("div", {}, h("p", { text: t("locked.text", { n: need }) }), h("p", { class: "fine", text: t("locked.xp", { xp: fmt(app, Math.max(0, Math.ceil(next))), level: xp.level }) })), buttons: [{ label: t("ok"), primary: true }] });
  }
}
