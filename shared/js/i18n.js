// Languages: one tiny translation layer for the hub and every game.
// Each page loads its own dictionary (games/<name>/strings.js) and looks text up by key:
//
//   I18n.add({ en: { "menu.play": "Play" }, nl: { "menu.play": "Spelen" } });
//   I18n.t("menu.play")                         → "Play"
//   I18n.t("score.best", { n: 12 })             → "Best: 12"     ("Best: {n}")
//   "lives": (v) => v.n === 1 ? "1 life" : `${v.n} lives`         (a function for plurals etc.)
//
// Markup is translated by attributes, filled in by I18n.apply():
//   <h2 data-i18n="menu.title"></h2>                 textContent
//   <p data-i18n-html="menu.intro"></p>              innerHTML (for strings with <b>, <br>)
//   <button data-i18n-attr="aria-label:menu.close"> attributes, ";"-separated
//
// The choice is shared by the whole app (one localStorage key) and defaults to English.
// Changing it reloads the page: every game builds a lot of its text in code, and a reload
// is the one way to be sure nothing is left in the old language. Progress is already saved.
//
// Loaded as a classic script right after platform.js. The page's own strings.js comes next
// and ends with I18n.apply(), so the markup is translated before game.js runs (and game.js
// can still overwrite any of it).
(function () {
  "use strict";
  var KEY = "honest-arcade.lang";
  var LANGS = [
    { code: "en", name: "English" },
    { code: "nl", name: "Nederlands" },
  ];
  var dict = { en: {}, nl: {} };
  var warned = {};

  function load() {
    try {
      var v = localStorage.getItem(KEY);
      for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === v) return v;
    } catch (e) { /* storage blocked: fall back to English */ }
    return "en";
  }
  var lang = load();
  document.documentElement.lang = lang;

  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
  }

  var I18n = {
    /** "en" | "nl" */
    lang: lang,
    /** [{code, name}], names in their own language */
    languages: LANGS,
    /** Merge a page's dictionary: { en: {...}, nl: {...} }. */
    add: function (d) {
      for (var l in d) {
        if (!dict[l]) dict[l] = {};
        for (var k in d[l]) dict[l][k] = d[l][k];
      }
    },
    /** Text for a key in the current language (English if it's missing, the key itself as a last resort). */
    t: function (key, vars) {
      var v = dict[lang][key];
      if (v === undefined) {
        v = dict.en[key];
        if (!warned[key]) { warned[key] = 1; console.warn("i18n: missing " + lang + " text for \"" + key + "\""); }
        if (v === undefined) return key;
      }
      return typeof v === "function" ? v(vars || {}) : fill(v, vars);
    },
    /** True when the key exists (handy for optional texts). */
    has: function (key) { return key in dict.en; },
    /** Translate every data-i18n* attribute inside root (default: the whole document). */
    apply: function (root) {
      root = root || document;
      var els = root.querySelectorAll("[data-i18n]");
      for (var i = 0; i < els.length; i++) els[i].textContent = I18n.t(els[i].getAttribute("data-i18n"));
      els = root.querySelectorAll("[data-i18n-html]");
      for (i = 0; i < els.length; i++) els[i].innerHTML = I18n.t(els[i].getAttribute("data-i18n-html"));
      els = root.querySelectorAll("[data-i18n-attr]");
      for (i = 0; i < els.length; i++) {
        var pairs = els[i].getAttribute("data-i18n-attr").split(";");
        for (var j = 0; j < pairs.length; j++) {
          var p = pairs[j].split(":");
          if (p.length === 2) els[i].setAttribute(p[0].trim(), I18n.t(p[1].trim()));
        }
      }
    },
    /** Switch language for the whole app and reload the page. */
    set: function (code) {
      if (code === lang) return;
      try { localStorage.setItem(KEY, code); } catch (e) { /* ignore */ }
      location.reload();
    },
    /** Keys that one language has and another lacks: used by the tests, should be []. */
    missing: function () {
      var out = [];
      for (var a in dict) for (var b in dict) {
        if (a === b) continue;
        for (var k in dict[a]) if (!(k in dict[b])) out.push(b + ": " + k);
      }
      return out;
    },
  };

  window.I18n = I18n;
})();
