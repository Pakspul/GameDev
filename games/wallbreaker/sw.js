// Offline support for the browser version: the first visit stores every file the game needs, and
// after that it plays with no network at all. Inside the Android/iOS app the files are already
// local, so game.js doesn't register this there.
//
// Bump VERSION when FILES changes (a file added or removed); edits are picked up from the network.
const VERSION = "wallbreaker-v1";
const FILES = [
  "./", "index.html", "style.css", "strings.js", "game.js", "manifest.webmanifest", "icon.svg",
  "src/audio.js", "src/collide.js", "src/config.js", "src/economy.js", "src/engine.js", "src/levels.js",
  "src/modes.js", "src/puzzle-play.js", "src/puzzles.gen.js", "src/render.js", "src/rng.js", "src/run.js",
  "src/save.js", "src/walls.js",
  "../../shared/js/platform.js", "../../shared/js/i18n.js",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("wallbreaker-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, so an edit or an update shows at once; with no network, the stored copy.
self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET" || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(fetch(ev.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(ev.request, copy)); }
    return res;
  }).catch(() => caches.match(ev.request, { ignoreSearch: true }).then((hit) => hit || Response.error())));
});
