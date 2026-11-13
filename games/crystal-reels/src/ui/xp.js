// Level and XP, shown the same way everywhere: a badge with the machine's level (its colour follows the
// rank), a bar to the next level and, optionally, the numbers. XP and levels belong to one machine.
import { h } from "./dom.js";
import { formatCoins } from "../core/format.js";
import * as P from "../core/profile.js";

/** "Legend", "Legend II", ... */
export function rankName(app, rank) {
  const base = app.t("rank." + rank.id);
  return rank.tier ? `${base} ${P.toRoman(rank.tier + 1)}` : base;
}

/** Badge, bar and (when `text`) "340 / 450 XP" for one machine. `update()` re-reads the profile. */
export function xpMeter(app, machineId, { text = true } = {}) {
  const fmt = (a, n) => formatCoins(n, a.locale);
  const badge = h("span", { class: "level-badge" });
  const fill = h("i");
  const bar = h("div", { class: "xp-bar", role: "progressbar", "aria-label": app.t("xp"), "aria-valuemin": "0", "aria-valuemax": "100" }, fill);
  const label = text ? h("small", { class: "xp-text" }) : null;
  const el = h("div", { class: "xp-row" }, badge, bar, label);
  const update = () => {
    const xp = P.xpProgress(app.game, P.machineXp(app.profile, machineId));
    const rank = P.rankFor(app.game, xp.level);
    badge.textContent = String(xp.level);
    badge.className = "level-badge rank-" + Math.min(rank.index, 7) + (String(xp.level).length > 2 ? " wide" : "");
    badge.title = rankName(app, rank);
    const pct = Math.round(xp.fraction * 100);
    fill.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", String(pct));
    bar.title = `${fmt(app, Math.floor(xp.into))} / ${fmt(app, xp.needed)} XP`;
    if (label) label.textContent = `${fmt(app, Math.floor(xp.into))}/${fmt(app, xp.needed)}`;
  };
  update();
  return { el, update };
}
