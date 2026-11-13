// Platform layer: the one place that knows whether we run in a browser or inside the
// Android/iOS app (Capacitor). Games stay platform-agnostic and call Platform.* instead.
// In a normal browser everything here is a harmless no-op.
//
// Loaded as a classic script by the hub and by every game:
//   <script src="../../shared/js/platform.js"></script>
(function () {
  "use strict";
  var cap = window.Capacitor;
  var isApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var plugins = (cap && cap.Plugins) || {};
  var here = document.currentScript && document.currentScript.src;
  // platform.js lives in shared/js/, so the hub is two folders up.
  var hubUrl = here ? new URL("../../index.html", here).href : "/index.html";
  var onHub = location.href.split(/[?#]/)[0] === hubUrl;
  var backHandler = null;

  // Keep the screen awake while a game is open (the Screen Wake Lock API), so the phone doesn't dim and
  // lock in the middle of a round. On by default; the player can turn it off in any game's menu
  // (gamenav.js), and the choice is shared by every game (one localStorage key). The browser drops the
  // lock whenever the page is hidden (app switch, locked phone), so it is asked for again when the page
  // comes back, and on the first tap or key press in case the browser wants a gesture first.
  var awake = (function () {
    var KEY = "arcade.keepAwake", want = true, lock = null, asking = false;
    try { want = localStorage.getItem(KEY) !== "0"; } catch (e) { /* storage blocked: stay on */ }
    var supported = !!navigator.wakeLock;
    function acquire() {
      if (!want || onHub || !supported || lock || asking || document.visibilityState !== "visible") return;
      asking = true;
      navigator.wakeLock.request("screen").then(function (l) {
        asking = false;
        if (!want) { l.release().catch(function () {}); return; }
        lock = l;
        l.addEventListener("release", function () { if (lock === l) lock = null; });
      }, function () { asking = false; /* refused (battery saver, no gesture yet): the next tap tries again */ });
    }
    function release() {
      var l = lock;
      lock = null;
      if (l) l.release().catch(function () {});
    }
    document.addEventListener("visibilitychange", acquire);
    ["pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, acquire, { passive: true, capture: true }); });
    acquire();
    return {
      /** false where the browser has no Wake Lock API (the menu then hides its switch) */
      supported: supported,
      enabled: function () { return want; },
      set: function (on) {
        want = !!on;
        try { localStorage.setItem(KEY, want ? "1" : "0"); } catch (e) { /* ignore */ }
        if (want) acquire(); else release();
      },
    };
  })();

  var Platform = {
    /** true inside the Android/iOS app, false in a browser */
    isApp: isApp,
    /** "android" | "ios" | "web" */
    os: isApp ? cap.getPlatform() : "web",
    /** Go back to the hub. Games call this from their own menu (iOS has no back button). */
    home: function () {
      if (!onHub) location.href = hubUrl;
    },
    /** Short vibration on devices that support it; silently ignored elsewhere. */
    haptic: function (ms) {
      try {
        if (plugins.Haptics) plugins.Haptics.impact({ style: "LIGHT" });
        else if (navigator.vibrate) navigator.vibrate(ms || 12);
      } catch (e) { /* ignore */ }
    },
    /** Keep-screen-on: { supported, enabled(), set(on) }. Automatic and on by default, see above. */
    keepAwake: awake,
    /** What the Android back button does in this page: fn() returns true when it handled it.
     *  shared/js/gamenav.js sets this, so the back button does what the top-left button does. */
    onBack: function (fn) { backHandler = fn; },
  };

  // Android back button / back gesture (needs the @capacitor/app plugin, see docs/ANDROID.md):
  // inside a game → whatever the game's back button does (see onBack), else back to where you
  // came from (normally the hub); on the hub → close the app.
  if (isApp && plugins.App) {
    plugins.App.addListener("backButton", function (ev) {
      if (backHandler && backHandler()) return;
      if (onHub) plugins.App.exitApp();
      else if (ev && ev.canGoBack) history.back();
      else location.replace(hubUrl);
    });
  }

  window.Platform = Platform;
})();
