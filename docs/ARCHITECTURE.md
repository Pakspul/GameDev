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
│   ├── unscrew/             models/ holds the 3D models: kit.js (building blocks), one file per category, order.js (level order); dev/inspector.js is the model inspector (?models, left out of builds)
│   ├── graphite/            levels/ holds one generator per puzzle type; worker.js runs them off the main thread
│   └── wallbreaker/         src/ holds the engine, generator, modes, economy (config.js has every number), renderer and save
├── shared/                  Things every game uses, kept in exactly one place
│   ├── js/                  platform.js, i18n.js (languages), economy.js (shared currency rules, see ECONOMY.md)
│   ├── vendor/three/        three.js r128 (the 3D engine), served locally
│   └── icons/               App icon
├── scripts/                 Developer tools (never shipped to players)
│   ├── serve.mjs            npm run dev: local server, also reachable from your phone
│   ├── build.mjs            npm run build: assembles dist/
│   ├── vendor-fonts.mjs     npm run fonts: downloads a game's Google Fonts into its fonts/ folder
│   └── unscrew-models.mjs   npm run unscrew:models: screws and kept parts per Unscrew 3D model, plus screenshots
├── tests/smoke.mjs          npm test: opens every game in a headless phone browser
├── tests/puzzles.mjs        npm test: Graphite's generators give unique puzzles, and the same ones every time
├── tests/economy.mjs        npm test: every game's prices and rewards follow docs/ECONOMY.md
├── tests/unscrew.mjs        npm test: every Unscrew model is loaded, in the fixed level order, and named in every language
├── tests/wallbreaker/       npm test: Wallbreaker's acceptance criteria (rules.test.mjs in Node, e2e.mjs in a phone browser)
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
| Jade Pavilion | English + Dutch | ~610 | three.js 3D table | `jade-pavilion-v1` | Seeded generator, daily challenge, table themes |
| Nuts & Bolts | English + Dutch | ~1,320 | three.js + 2D canvas particles | `nutsbolts:*` | Solver runs in a Web Worker (built from a Blob), washers currency |
| Outbound | English + Dutch | ~2,650 | 2D canvas, three.js loaded on demand for 3D modes | `outbound.*` | Three level generators (flat, box, shapes), light/dark theme, haptics, shop |
| Unscrew | English + Dutch | ~1,120 (of which ~650 in `models/`) | three.js 3D objects | `unscrew.v2` | 2D plates + 3D object generators (see [UNSCREW-MODELS.md](UNSCREW-MODELS.md)), coins and shop |
| Graphite | English + Dutch | ~2,200 | 2D canvas, redraws only on change | `graphite.v1` | Four logic puzzle types, generators in a Web Worker, logic-based hints, four dailies |
| Wallbreaker | English + Dutch | ~3,300 (ES modules) | 2D canvas, frame loop only while a level is played | `wallbreaker.save` | Brick breaker, seven modes on one engine (`src/engine.js`, fixed 120 Hz, swept collision); seeded levels; its own economy in `src/config.js`; service worker for offline install. See [WALLBREAKER.md](WALLBREAKER.md) |
| Crystal Reels | English + Dutch | ~6,000 (ES modules) | DOM + SVG, no canvas except particles; frame loop only while something moves | `honest-arcade.slots.save.0/1` | Slot machines with play money; maths engine + simulator in `games/slots/src/engine`, see [SLOTS.md](SLOTS.md) |
| Camper Crew | English + Dutch | ~1,250 | three.js 3D (r128), renders only while playing | `camper-crew.v1` | Grey-box action prototype; seeded roads in `levels.js`; touch stick, keyboard and gamepad |

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

Every page is in English (the default) and Dutch. The player picks the language on the hub (Graphite's Settings has the same switch), and every game follows it.

- `shared/js/i18n.js` is the shared part: `I18n.t(key, vars)`, the `data-i18n` attributes for markup, and the stored choice (`honest-arcade.lang` in localStorage). Switching reloads the page, so nothing stays behind in the old language.
- Each game keeps its text in `games/<name>/strings.js`, with `en` and `nl` side by side. Game code uses a local alias, `const _t = I18n.t`. Plurals and word order that differ per language are small functions in the dictionary.
- Never translate anything that feeds a seed. Jade Pavilion's level names, for example, are stored as word indices (`"3.5.2"`), and `strings.js` turns those into "Floating Pavilion of Quiet Rain" or "Het Zwevende Paviljoen van Stille Regen".
- To add a language: add it to `LANGS` in `i18n.js`, then add a block to every `strings.js`. `npm test` opens every page in every language and fails on a missing key.


## Why links say `index.html` explicitly

The hub links to `games/outbound/index.html`, not `games/outbound/`. Inside the Android/iOS app, Capacitor answers requests for paths without a file extension with the *root* `index.html` (that's how single-page apps get routed), so a link to a folder would land back on the hub. Always link to the file.
