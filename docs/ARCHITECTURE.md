# Architecture

How the repository is organised, why, and how to improve it step by step without breaking four games that already work.

## Folder structure

```
.
├── index.html               Hub: the start screen of the app, links to every game
├── manifest.webmanifest     Lets the browser version be "installed" to a home screen (PWA)
├── games/                   One folder per game. Each game keeps its own look and feel.
│   ├── jade-pavilion/
│   │   ├── index.html       Markup only
│   │   ├── style.css        The game's own design (colours, layout, fonts)
│   │   ├── levels.js        Level generator (pure logic, no rendering)
│   │   ├── game.js          Rendering, input, UI, saving
│   │   └── fonts/           Self-hosted fonts + their licences
│   ├── nuts-and-bolts/
│   ├── outbound/
│   ├── unscrew/
│   └── graphite/            levels/ holds one generator per puzzle type; worker.js runs them off the main thread
├── shared/                  Things every game uses, kept in exactly one place
│   ├── vendor/three/        three.js r128 (the 3D engine), served locally
│   └── icons/               App icon
├── scripts/                 Developer tools (never shipped to players)
│   ├── serve.mjs            npm run dev: local server, also reachable from your phone
│   ├── build.mjs            npm run build: assembles dist/
│   └── vendor-fonts.mjs     npm run fonts: downloads a game's Google Fonts into its fonts/ folder
├── tests/smoke.mjs          npm test: opens every game in a headless phone browser
├── tests/puzzles.mjs        npm test: Graphite's generators give unique puzzles, and the same ones every time
├── docs/                    Guides (this file, Android publishing, roadmap)
├── dist/                    (generated) the exact files that go into the app; not committed
└── android/                 (generated once by Capacitor, then committed) the Android project
```

The rule of thumb: **`games/<name>/` holds everything that makes a game *that* game. `shared/` holds only what is truly identical.** A game folder can be zipped up and still make sense on its own. That is also what makes a standalone single-game app possible later (`npm run build -- --game outbound`).

## Where we started (analysis of the original four files)

The four games began life as single, self-contained HTML files (built as Claude artifacts). That is a great way to prototype, but it had three problems for an app:

| Problem | Why it matters on a phone | What was done |
|---|---|---|
| three.js loaded from a CDN (`cdnjs.cloudflare.com`) | The app would show a blank screen without internet, and every launch made a network request: against the mission, and slower. | Vendored into `shared/vendor/three/`, loaded once from the app itself. |
| Fonts loaded from Google Fonts | Same offline problem. Google also sees every launch. | Self-hosted per game in `games/<name>/fonts/` (Latin subsets only, about 50–150 KB per game), with their OFL licences. |
| 3,000-line files mixing HTML, CSS and JS | Hard to edit, hard to review in git, no syntax highlighting. | Split into `index.html` / `style.css` / `levels.js` / `game.js`. The code itself is **unchanged** (verified byte for byte). |

Each game's inline `<script>` blocks became external classic `<script src>` files in the same order. Classic scripts share one global scope, so behaviour is identical.

### The games at a glance

| Game | Language | JS lines | Rendering | Saves under (localStorage) | Notable |
|---|---|---|---|---|---|
| Jade Pavilion | English | ~610 | three.js 3D table | `jade-pavilion-v1` | Seeded generator, daily challenge, table themes |
| Nuts & Bolts | English | ~1,320 | three.js + 2D canvas particles | `nutsbolts:*` | Solver runs in a Web Worker (built from a Blob), washers currency |
| Outbound | English | ~2,650 | 2D canvas, three.js loaded on demand for 3D modes | `outbound.*` | Three level generators (flat, box, shapes), light/dark theme, haptics, shop |
| Unscrew | **Dutch** | ~790 | three.js 3D objects | `unscrew.v2` | 2D plates + 3D object generators, coins and shop |
| Graphite | English | ~2,200 | 2D canvas, redraws only on change | `graphite.v1` | Four logic puzzle types, generators in a Web Worker, logic-based hints, four dailies |
| Camper Crew | English | ~1,250 | three.js 3D (r128), renders only while playing | `camper-crew.v1` | Grey-box action prototype; seeded roads in `levels.js`; touch stick, keyboard and gamepad |

Graphite came later and was written for this repository directly, not as an artifact. It already uses `Platform.home()` and `Platform.haptic()`, draws nothing while the board is idle, and has no three.js at all.

All five save under different keys, so they can safely share one app (one "origin") without overwriting each other's progress.

### What's duplicated (and what to do about it)

Every game re-implements the same small building blocks:

| Building block | Where | Same code? |
|---|---|---|
| Seeded random (`hashStr`, `mulberry32`, `shuffle`) | all four, **three copies inside Outbound's `levels.js` alone** | **No.** Different hash functions per game. |
| localStorage load/save wrapper with try/catch | all four | Same idea, different shape |
| Sound effects synthesised with WebAudio (no audio files) | all four | Different sounds per game (that's look and feel) |
| WebGL renderer setup, pixel-ratio cap (`min(dpr, 2)`), resize | the 3D games | Nearly identical |
| Touch input: tap vs. drag, pinch-zoom, orbit camera | Jade, Unscrew, Outbound 3D | Similar |
| Tweens / easing, toast messages, overlays | all four | Similar |
| `window.claude.hot` hooks | all four | Leftovers from the artifact environment. Harmless no-ops in a browser or app. |

**Important: do not "deduplicate" the level generators' random functions.** For Graphite this is enforced: `tests/puzzles.mjs` stores a fingerprint of the first levels of every type and tier, and fails if they change. Every level and every daily puzzle is computed from a seed. Swap one hash function for another and every level changes: players' saved progress ("level 37, 3 stars") would then point at a different puzzle. Treat each game's generator as frozen unless you bump its save version on purpose.

## How to improve it from here

### 1. A small shared *platform* layer (do this first)

What really should be shared are the things that talk to the **device**, because those change when you go from browser to Android to iOS:

```
shared/js/platform.js
  Platform.storage    get/set progress (localStorage today; Capacitor Preferences later, see the Android guide)
  Platform.haptics    vibrate on supported devices (Outbound already does this; others could too)
  Platform.onPause    app goes to background → pause music/timers, save
  Platform.home()     back to the hub (needed on iOS, which has no back button)
  Platform.isApp      true inside the Android/iOS app, false in the browser
```

Each game then calls `Platform.home()` from **its own** menu, styled in its own way. The look stays separate; only the plumbing is shared.

### 2. Extract when you touch, not in one big refactor

The games work. A big-bang refactor of ~6,900 lines would mostly create bugs. Instead:

- When you fix or extend something in a game, and it's identical in another game, move it to `shared/js/` and make both use it.
- New games start from the shared pieces (renderer setup, input, tweens, sfx helpers).
- Keep `npm test` green after every step: it catches JS errors and missing files in every game.

### 3. three.js version: stay on r128 for now

r128 is from 2021; current three.js is far newer. Upgrading is **not** a drop-in change:

- The global `THREE` script build was removed (r160). Newer versions are ES modules only, so the games would need `import` statements and, realistically, a bundler.
- Colour management changed (r152): `outputEncoding` / `sRGBEncoding` became `outputColorSpace`, and the defaults shifted. Jade and Unscrew would look subtly different.
- Several APIs used here were renamed.

So: keep r128 for these four games. When you start a **new** game, or decide to modernise one, move that one game to ES modules + [Vite](https://vitejs.dev) + current three.js, and compare screenshots (`npm test` saves them) before and after. Both versions can live side by side in `shared/vendor/` during the transition.

### 4. When to add a bundler

Not yet. Plain files keep the setup simple: edit, refresh, done. Add Vite when one of these becomes true: you want ES modules or npm packages in the games, you want minification (the whole app is only ~1.4 MB, so this matters little), or you upgrade three.js.

### 5. Languages

Unscrew is in Dutch, the others in English. For a store release, pick one of these:

- **Simple:** translate Unscrew to English.
- **Better:** a tiny `strings.js` per game with `en` and `nl`, chosen from `navigator.language`. The hub and store listing can be translated the same way (Play Console supports per-language listings).

## Why links say `index.html` explicitly

The hub links to `games/outbound/index.html`, not `games/outbound/`. Inside the Android/iOS app, Capacitor answers requests for paths without a file extension with the *root* `index.html` (that's how single-page apps get routed), so a link to a folder would land back on the hub. Always link to the file.
