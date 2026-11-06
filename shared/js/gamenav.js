// GameNav: the same two corner buttons in every game, so a player always knows the way out.
//
//   top left    back: from a level to the game's own menu, from that menu to the arcade
//   top right   the game's menu: a drawer from the right (like the hub's), with options for that game
//
// The plumbing is shared, the look is not. shared/css/gamenav.css draws a neutral version from
// --gn-* variables; every game sets those in its own style.css (and may restyle .gnav-btn further),
// so the buttons sit in the same place everywhere but look like they belong to that game.
// The Android back button does exactly what the top-left button does (see Platform.onBack).
//
// Loaded as a classic script after i18n.js (it brings its own few texts):
//
//   const nav = GameNav.create({
//     title: "Graphite",                    heading of the drawer (or a function, read on every open)
//     items: () => [ ... ],                 drawer contents, rebuilt on every open (so they show the current state)
//     onOpen() {}, onClose() {},            e.g. pause the game while the drawer is open
//   });
//   header.prepend(nav.back); header.append(nav.menu);    put the buttons in your own top bar,
//   document.body.append(GameNav.bar(nav));               or in a bar of their own (screens without a header)
//   nav.setBack(() => showMenu(), _t("backToMenu"));      in a level: back to the game's menu
//   nav.setBack();                                         on the game's menu: back to the arcade
//
// Drawer items:
//   { icon: "restart", label: "Restart", onSelect() {} }                      closes the drawer, then runs
//   { icon: "sound", label: "Sound", note: "…", checked: true, onToggle(on) {} }   a switch; the drawer stays open
//   { icon: "theme", label: "Theme", value: "dark", options: [{ value, label }], onChoose(v) {} }
//   { icon: "help", label: "How to play", html: "<p>…</p>" }                  folds open in place
//   { heading: "Settings" }      "-" (a line)      GameNav.language() (the shared language switch)
// "Back to arcade" is always at the bottom.
(function () {
  "use strict";

  I18n.add({
    en: {
      "nav.arcade": "Back to arcade",
      "nav.back": "Back",
      "nav.menu": "Menu",
      "nav.close": "Close menu",
      "nav.language": "Language",
    },
    nl: {
      "nav.arcade": "Terug naar de arcade",
      "nav.back": "Terug",
      "nav.menu": "Menu",
      "nav.close": "Menu sluiten",
      "nav.language": "Taal",
    },
  });
  var t = I18n.t;

  // 24×24 line icons; the stroke width comes from CSS (--gn-stroke), so each game can make them bolder.
  var ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    home: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 9.5V20h11V9.5"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4"/><path d="M12 17h.01"/>',
    theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shop: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    view: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/>',
    glow: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/><circle cx="12" cy="12" r="6.5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
    levels: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
    tap: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5a1.5 1.5 0 0 1 3 0V12M15 11.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.8-2.4L4.5 15.6a1.6 1.6 0 0 1 2.4-2.1L9 15.5"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
    mistakes: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    dots: '<circle cx="7" cy="7" r="1.3"/><circle cx="12" cy="7" r="1.3"/><circle cx="17" cy="7" r="1.3"/><circle cx="7" cy="12" r="1.3"/><circle cx="17" cy="12" r="1.3"/><circle cx="7" cy="17" r="1.3"/><circle cx="12" cy="17" r="1.3"/><circle cx="17" cy="17" r="1.3"/><path d="M10 10.5l1.2 2.5 3.3-4"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16"/>',
  };
  function icon(name) {
    return ICONS[name] ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>" : "";
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function labelHtml(it) {
    return '<span class="gnav-ico">' + icon(it.icon) + '</span><span class="gnav-label">' + esc(it.label) +
      (it.note ? "<small>" + esc(it.note) + "</small>" : "") + "</span>";
  }
  function home() { if (window.Platform) Platform.home(); }

  var current = null; // the one nav on this page, for the Android back button

  function create(opts) {
    opts = opts || {};
    var backFn = null, pending = null, seq = 0;

    var back = el("button", "gnav-btn gnav-back", '<span class="gnav-face">' + icon("back") + "</span>");
    back.type = "button";
    var menu = el("button", "gnav-btn gnav-menu", '<span class="gnav-face">' + icon("menu") + "</span>");
    menu.type = "button";
    menu.setAttribute("aria-haspopup", "dialog");
    menu.setAttribute("aria-label", t("nav.menu"));
    menu.title = t("nav.menu");

    var drawer = el("dialog", "gnav-drawer");
    var titleId = "gnav-title";
    drawer.setAttribute("aria-labelledby", titleId);
    drawer.innerHTML = '<div class="gnav-inner"><div class="gnav-head"><h2 id="' + titleId + '"></h2>' +
      '<button type="button" class="gnav-btn gnav-close" aria-label="' + esc(t("nav.close")) + '"><span class="gnav-face">' + icon("close") + "</span></button></div>" +
      '<div class="gnav-items"></div><div class="gnav-foot"></div></div>';
    var list = drawer.querySelector(".gnav-items");
    var heading = drawer.querySelector("h2");
    var foot = drawer.querySelector(".gnav-foot");
    var arcade = el("button", "gnav-item", labelHtml({ icon: "home", label: t("nav.arcade") }));
    arcade.type = "button";
    arcade.addEventListener("click", function () { close(home); });
    foot.appendChild(arcade);
    document.body.appendChild(drawer);

    function isOpen() { return drawer.open; }

    function render() {
      heading.textContent = (typeof opts.title === "function" ? opts.title() : opts.title) || document.title;
      var items = (typeof opts.items === "function" ? opts.items() : opts.items) || [];
      list.innerHTML = "";
      items.forEach(function (it) {
        if (!it) return;
        if (it === "-") { list.appendChild(el("div", "gnav-sep")); return; }
        if (it.heading) { list.appendChild(el("p", "gnav-heading")).textContent = it.heading; return; }
        var row;
        if (it.options) {
          row = el("div", "gnav-item gnav-choice", labelHtml(it));
          var id = "gnav-l" + (++seq);
          row.querySelector(".gnav-label").id = id;
          var seg = el("div", "gnav-seg");
          seg.setAttribute("role", "radiogroup");
          seg.setAttribute("aria-labelledby", id);
          it.options.forEach(function (o) {
            var b = el("button");
            b.type = "button";
            b.setAttribute("role", "radio");
            b.setAttribute("aria-checked", String(o.value === it.value));
            if (o.lang) b.lang = o.lang;
            b.textContent = o.label;
            b.addEventListener("click", function () {
              seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
              if (o.value !== it.value) { it.value = o.value; it.onChoose(o.value); }
            });
            seg.appendChild(b);
          });
          row.appendChild(seg);
        } else if (it.html) {
          row = el("details", "gnav-item gnav-more");
          var sum = el("summary", "", labelHtml(it) + '<span class="gnav-chev">' + icon("back") + "</span>");
          row.appendChild(sum);
          row.appendChild(el("div", "gnav-text", it.html));
        } else if ("checked" in it) {
          row = el("button", "gnav-item", labelHtml(it) + '<span class="gnav-switch"></span>');
          row.type = "button";
          row.setAttribute("role", "switch");
          row.setAttribute("aria-checked", String(!!it.checked));
          row.addEventListener("click", function () {
            it.checked = !it.checked;
            row.setAttribute("aria-checked", String(it.checked));
            it.onToggle(it.checked);
          });
        } else {
          row = el("button", "gnav-item", labelHtml(it));
          row.type = "button";
          row.addEventListener("click", function () { close(it.onSelect); });
        }
        if (it.disabled && row.tagName === "BUTTON") row.disabled = true;
        list.appendChild(row);
      });
    }

    function open() {
      if (drawer.open) return;
      render();
      if (opts.onOpen) opts.onOpen();
      drawer.showModal();
      drawer.scrollTop = 0;
    }
    // Close first, then run the chosen action, so the game's onClose (say, "resume") never undoes it.
    function close(then) {
      if (!drawer.open) { if (then) then(); return; }
      pending = then || null;
      drawer.close();
    }
    drawer.addEventListener("close", function () {
      var then = pending;
      pending = null;
      if (opts.onClose) opts.onClose();
      if (then) then();
    });
    // A tap on the dimmed backdrop (the dialog itself, outside .gnav-inner) closes it.
    drawer.addEventListener("click", function (e) { if (e.target === drawer) close(); });
    // Keys typed in the drawer stay there: the game's own shortcuts mustn't fire behind it.
    drawer.addEventListener("keydown", function (e) { e.stopPropagation(); });
    drawer.querySelector(".gnav-close").addEventListener("click", function () { close(); });

    function goBack() {
      if (drawer.open) return close();
      (backFn || home)();
    }
    back.addEventListener("click", goBack);
    menu.addEventListener("click", open);

    var nav = {
      back: back,
      menu: menu,
      drawer: drawer,
      /** Where the top-left button goes: a function and its label, or nothing for "back to the arcade". */
      setBack: function (fn, label) {
        backFn = fn || null;
        label = fn ? label || t("nav.back") : t("nav.arcade");
        back.setAttribute("aria-label", label);
        back.title = label;
        back.classList.toggle("gnav-to-arcade", !fn);
      },
      goBack: goBack,
      open: open,
      close: function () { close(); },
      isOpen: isOpen,
      /** Rebuild the drawer's items (when something they show changed while it's open). */
      refresh: function () { if (drawer.open) render(); },
    };
    nav.setBack(opts.back, opts.backLabel);
    current = nav;
    return nav;
  }

  // The Android back button follows the top-left button (closing the drawer first).
  if (window.Platform && Platform.onBack) Platform.onBack(function () {
    if (!current) return false;
    current.goBack();
    return true;
  });

  window.GameNav = {
    create: create,
    icon: icon,
    /** A bar of its own for the two buttons, fixed to the top corners; taps pass through the middle. */
    bar: function (nav) {
      var b = el("div", "gnav-bar");
      b.appendChild(nav.back);
      b.appendChild(nav.menu);
      return b;
    },
    /** The language switch, shared with the hub and every game. Switching reloads the page. */
    language: function () {
      return {
        icon: "language", label: t("nav.language"), value: I18n.lang,
        options: I18n.languages.map(function (l) { return { value: l.code, label: l.name, lang: l.code }; }),
        onChoose: function (v) { I18n.set(v); },
      };
    },
  };
})();
