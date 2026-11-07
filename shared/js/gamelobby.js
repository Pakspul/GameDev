// GameLobby: the parts of a game's own menu (its lobby), laid out the same way in every game, so a
// player who knows one game knows where to look in the next:
//
//   [←]                   [◆ 120] [☰]     back to the arcade, the balance (opens the shop), the menu (GameNav)
//   Title
//   [ Daily challenge ...... Play ]        GameLobby.daily()    if the game has one
//   [ Variant A | Variant B ]              GameLobby.choice()   if it has variants
//   [Easy] [Medium] [Hard] [Expert] →      GameLobby.tabs()     if it has difficulties
//   ┌ Medium · level 12        [▶ Play] ┐  GameLobby.play()     where you are, one tap to go on
//   └ 11 cleared   28 stars             ┘
//   Levels                    ‹ 1–20 ›     GameLobby.levels()   every level with its stars
//   [1 ★★★] [2 ★★☆] [3] [4 🔒] …
//
// Like GameNav, the plumbing is shared and the look is not: shared/css/gamelobby.css draws a neutral
// version from --gn-* variables (the same ones as the back button and the drawer), and each game sets
// them in its own style.css. Every function returns a plain element; a game rebuilds its lobby when
// something changes (a tab chosen, a level won), and puts the parts in its own markup in this order.
//
// Loaded as a classic script after i18n.js (it brings its own few texts).
(function () {
  "use strict";

  I18n.add({
    en: {
      "lobby.levels": "Levels",
      "lobby.prev": "Previous levels",
      "lobby.next": "Next levels",
      "lobby.level": "Level {n}",
      "lobby.levelStars": "Level {n}, {s} of 3 stars",
      "lobby.levelNext": "Level {n}, next up",
      "lobby.levelLocked": "Level {n}, locked",
      "lobby.new": "New",
      "lobby.shop": "Shop",
      "lobby.cleared": "cleared",
      "lobby.stars": "stars",
      "lobby.perfect": "perfect",
    },
    nl: {
      "lobby.levels": "Levels",
      "lobby.prev": "Vorige levels",
      "lobby.next": "Volgende levels",
      "lobby.level": "Level {n}",
      "lobby.levelStars": "Level {n}, {s} van 3 sterren",
      "lobby.levelNext": "Level {n}, nu aan de beurt",
      "lobby.levelLocked": "Level {n}, nog op slot",
      "lobby.new": "Nieuw",
      "lobby.shop": "Winkel",
      "lobby.cleared": "gehaald",
      "lobby.stars": "sterren",
      "lobby.perfect": "perfect",
    },
  });
  var t = I18n.t;

  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l12.5-7.5z"/></svg>';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function button(cls, html, onClick) {
    var b = el("button", cls, html);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  /** Three stars, `n` of them lit. */
  function stars(n, of) {
    var s = "";
    for (var i = 0; i < (of || 3); i++) s += '<i class="' + (i < n ? "on" : "") + '">' + STAR + "</i>";
    return '<span class="lob-stars" aria-hidden="true">' + s + "</span>";
  }

  /** Variants, side by side: { label, value, options: [{ value, label, note?, icon? (svg html) }], onChoose(v) } */
  function choice(o) {
    var box = el("div", "lob-choice");
    box.setAttribute("role", "radiogroup");
    if (o.label) box.setAttribute("aria-label", o.label);
    o.options.forEach(function (op) {
      var b = button("", (op.icon || "") + '<span class="lob-txt"><b>' + esc(op.label) + "</b>" + (op.note ? "<small>" + esc(op.note) + "</small>" : "") + "</span>", function () {
        if (op.value !== o.value) o.onChoose(op.value);
      });
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(op.value === o.value));
      box.appendChild(b);
    });
    return box;
  }

  /** Difficulties, a row of tabs that scrolls sideways when it doesn't fit:
   *  { label, value, options: [{ value, label, icon? (html), meta?, pips?: [n, of], note? }], onChoose(v) } */
  function tabs(o) {
    var box = el("div", "lob-tabs");
    box.setAttribute("role", "tablist");
    if (o.label) box.setAttribute("aria-label", o.label);
    var on = null;
    o.options.forEach(function (op) {
      var pips = "";
      if (op.pips) for (var i = 0; i < op.pips[1]; i++) pips += '<i class="' + (i < op.pips[0] ? "on" : "") + '"></i>';
      var b = button("lob-tab", "<b>" + (op.icon ? '<span class="lob-ico">' + op.icon + "</span>" : "") + esc(op.label) + "</b>" + (pips ? '<span class="lob-pips" aria-hidden="true">' + pips + "</span>" : "") +
        (op.note ? "<small class=\"lob-note\">" + esc(op.note) + "</small>" : "") + (op.meta != null ? "<small>" + op.meta + "</small>" : ""), function () {
        if (op.value !== o.value) o.onChoose(op.value);
      });
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(op.value === o.value));
      if (op.value === o.value) on = b;
      box.appendChild(b);
    });
    // Keep the chosen tab in view (it may be off to the right on a phone).
    if (on) requestAnimationFrame(function () {
      var l = on.offsetLeft - box.offsetLeft, r = l + on.offsetWidth;
      if (r > box.scrollLeft + box.clientWidth || l < box.scrollLeft) box.scrollLeft = l - 16;
    });
    return box;
  }

  /** Where you are, and one tap to go on:
   *  { eyebrow?, title, text?, action: { label, sub?, onClick }, more?: [{ label, sub?, onClick }], stats?: [[value, label]] } */
  function play(o) {
    var card = el("section", "lob-card lob-play");
    var head = el("div", "lob-play-head");
    head.appendChild(el("div", "lob-play-text", (o.eyebrow ? '<span class="lob-eyebrow">' + esc(o.eyebrow) + "</span>" : "") +
      "<h2>" + esc(o.title) + "</h2>" + (o.text ? "<p>" + esc(o.text) + "</p>" : "")));
    var acts = el("div", "lob-actions");
    if (o.action) acts.appendChild(button("lob-go", PLAY + "<span>" + esc(o.action.label) + (o.action.sub ? "<small>" + esc(o.action.sub) + "</small>" : "") + "</span>", o.action.onClick));
    (o.more || []).forEach(function (m) {
      if (m) acts.appendChild(button("lob-alt", "<span>" + esc(m.label) + (m.sub ? "<small>" + esc(m.sub) + "</small>" : "") + "</span>", m.onClick));
    });
    head.appendChild(acts);
    card.appendChild(head);
    if (o.stats && o.stats.length) {
      card.appendChild(el("div", "lob-stats", o.stats.map(function (s) {
        return "<span><b>" + esc(s[0]) + "</b> " + esc(s[1]) + "</span>";
      }).join("")));
    }
    return card;
  }

  /** The daily challenge: { eyebrow, title, meta?, icon? (html), done?, label, onClick } */
  function daily(o) {
    var card = el("section", "lob-card lob-daily" + (o.done ? " done" : ""));
    if (o.icon) card.appendChild(el("span", "lob-ico", o.icon));
    card.appendChild(el("div", "lob-daily-text", '<span class="lob-eyebrow">' + esc(o.eyebrow) + "</span><strong>" + esc(o.title) + "</strong>" +
      (o.meta ? "<small>" + esc(o.meta) + "</small>" : "")));
    card.appendChild(button("lob-go", "<span>" + esc(o.label) + "</span>", o.onClick));
    return card;
  }

  /** Every level as a tile with its stars, a page at a time.
   *  { title?, count? (default: endless), last: the highest level that can be played, next?: the one to play
   *    next (highlighted; default `last`), stars(n) → 0..3, onPick(n), perPage? (20),
   *    locked?(n) for levels below `last` that are still shut, playable?(n) (default: not locked),
   *    label?(n) for a tile's own text instead of the number, aria?(n) for what a screen reader says }
   *  Levels up to `last` that aren't playable (a game with runs, say) show their stars but can't be tapped. */
  function levels(o) {
    var per = o.perPage || 20, count = o.count || Infinity, last = Math.max(1, o.last), next = o.next || last;
    var shut = function (n) { return n > last || !!(o.locked && o.locked(n)); };
    var playable = o.playable || function (n) { return !shut(n); };
    var pages = Math.max(1, Math.ceil((count === Infinity ? Math.max(last, next) : count) / per));
    var page = Math.min(pages - 1, Math.floor((next - 1) / per));

    var box = el("section", "lob-levels");
    var head = el("div", "lob-levels-head", "<h3>" + esc(o.title || t("lobby.levels")) + "</h3>");
    var pager = el("div", "lob-pager");
    var prev = button("", CHEV, function () { page--; draw(); });
    var label = el("span");
    var fwd = button("lob-fwd", CHEV, function () { page++; draw(); });
    prev.setAttribute("aria-label", t("lobby.prev"));
    fwd.setAttribute("aria-label", t("lobby.next"));
    pager.appendChild(prev); pager.appendChild(label); pager.appendChild(fwd);
    if (pages > 1) head.appendChild(pager);
    var grid = el("div", "lob-grid");
    box.appendChild(head);
    box.appendChild(grid);

    function draw() {
      var from = page * per + 1, to = Math.min(count, from + per - 1);
      label.textContent = from + "–" + to;
      prev.disabled = page <= 0;
      fwd.disabled = page >= pages - 1;
      grid.innerHTML = "";
      for (var n = from; n <= to; n++) {
        var locked = shut(n), st = (!locked && o.stars(n)) || 0, can = !locked && playable(n);
        var cls = "lob-lvl" + (locked ? " locked" : can ? "" : " past") + (n === next ? " next" : "") + (st === 3 ? " perfect" : "");
        var name = o.label ? o.label(n) : String(n);
        var tile = button(cls, '<span class="lob-n">' + esc(name) + "</span>" + (locked ? '<span class="lob-lock">' + LOCK + "</span>" : st ? stars(st) : ""));
        tile.setAttribute("aria-label", o.aria ? o.aria(n) : locked ? t("lobby.levelLocked", { n: n }) : st ? t("lobby.levelStars", { n: n, s: st }) : n === next ? t("lobby.levelNext", { n: n }) : t("lobby.level", { n: n }));
        if (n === next) tile.setAttribute("aria-current", "step");
        if (!can) tile.setAttribute("aria-disabled", "true");
        else tile.addEventListener("click", o.onPick.bind(null, n));
        grid.appendChild(tile);
      }
    }
    draw();
    return box;
  }

  /** The balance as a chip that opens the shop: { value, icon? (html), label? (default "Shop"), onClick } */
  function wallet(o) {
    var b = button("lob-wallet", (o.icon || '<i class="lob-coin" aria-hidden="true"></i>') + "<b>" + esc(o.value) + "</b>", o.onClick);
    b.setAttribute("aria-label", (o.label || t("lobby.shop")) + ": " + o.value);
    return b;
  }

  window.GameLobby = { choice: choice, tabs: tabs, play: play, daily: daily, levels: levels, wallet: wallet, stars: stars };
})();
