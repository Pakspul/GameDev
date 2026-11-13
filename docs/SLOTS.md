# Crystal Reels (slot machines)

A free-to-play slot game with **play money only**: no ads, no purchases, no paid coins, no tracking. It lives in [`games/crystal-reels/`](../games/crystal-reels) and is built from the acceptance criteria in *Slot Machine Game — Acceptance Criteria* (story IDs such as `REEL-01` below refer to that document).

Two machines ship, so every engine feature is reachable in play:

| | **Crystal Fortune** | **Neon Tumble** |
|---|---|---|
| Layout | 5×3, 20 paylines | 5×3, 243 ways |
| Unlocks | level 1 | Crystal Fortune level 4 |
| Wilds | standard (reels 2–4), multiplier wilds in free spins | expanding wild (reels 2–4) |
| Features | free spins (sticky wilds), Hold & Spin | free spins with a choice of 3 options, pick bonus |
| Extras | Mini/Minor fixed + Major/Grand progressive jackpots, collection meter → free spins | cascading reels (×1 ×2 ×3 ×5), collection meter → pick bonus, jackpots inside the pick bonus |
| RTP / hit frequency / free spins | 97.5% / 31% / 1 in 176 | 97.5% / 32% / 1 in 158 |

## Running it

```bash
npm run dev                  # http://localhost:8080/games/crystal-reels/index.html   (add ?debug=1 for the debug menu)
npm run test:slots           # validate configs, unit tests, 1M-spin check of every machine
node tests/slots/e2e.mjs     # play it in a headless phone browser (needs Playwright, see the README)
npm run slots:sim            # the math simulator, see below
npm run slots:verify         # release gate: 10 million spins per machine, RTP within ±0.5 points
```

## How it is built

No bundler, no libraries, no network: plain ES modules, SVG symbols drawn in code, and every sound synthesised with Web Audio. Text is in English and Dutch through the shared `I18n` layer (`strings.js`).

```
games/crystal-reels/
  index.html, style.css, strings.js, game.js     page, look, text, boot
  machines/*.json                                 one versioned config per machine: ALL odds live here
  data/game.json                                  economy, XP, missions, achievements
  src/engine/                                     the math: no DOM, no storage, no clock, no player state
    rng.js          seeded PRNG (sfc32), seed from crypto.getRandomValues
    config.js       validation (fails the build) + prepared lookups
    evaluate.js     paylines, ways, wilds, scatters: pure functions of grid + config
    spin.js         one call decides a whole spin: stops, expansion, cascades, wins, triggers
    features.js     free spins, Hold & Spin, pick bonus: each planned completely when it starts
    jackpot.js      fixed and progressive jackpots, stored as multiples of the bet
    anticipation.js which reels spin longer (decided only from reels that already stopped)
    simulate.js     the math simulator
  src/core/         Session (the one implementation of the rules), spin state machine, saves,
                    profile (XP, missions, achievements, stats, refill, timed bonus), number formatting
  src/ui/           reels, machine screen, lobby, overlays, menus, audio, effects
  src/debug/        development-only debug menu (left out of release builds)
scripts/slots-sim.mjs, slots-validate.mjs           simulator CLI and config validator
tests/slots/                                        unit, math, i18n, release and end-to-end tests
```

**The outcome is decided before anything moves** (MATH-01). `Session.spin(bet)` deducts the bet, asks the engine for the complete outcome (stops, every win, cascades, triggered features, new balance) and stores it as `state.pending`. The screen only animates that object. Features work the same way: a feature is *planned in full* when it starts (the whole free-spins run, every Hold & Spin respin, the pick bonus prizes), saved as JSON, and then merely revealed step by step. That is what makes resuming after the app was killed exact (PERS-02), and what makes a session replayable from its seed and input log (TOOL-04).

The game, the simulator and the replay tool all drive the same `Session` class, so there is no second implementation of the maths (TOOL-01).

### Spin state machine (REEL-06)

`Idle → Spinning → Stopping → Evaluating → Presenting → (Feature) → Idle`. Each state accepts a fixed set of inputs ([`src/core/state-machine.js`](../games/crystal-reels/src/core/state-machine.js)); everything else is dropped, not queued. The per-line win cycle keeps running in Idle and is cancelled the moment a new spin starts (PAY-05).

### Machine config

A machine is one JSON file. The validator (`npm run slots:validate`, also run by `npm run build` and `npm test`) refuses unknown symbols, paylines outside the grid, missing paytable entries, bet levels that don't divide into the line bet, wilds on reels that may not carry them, and more. To add a machine: copy a config, edit the strips, paytable, features and targets, add its id to `data/game.json`, add its art keys to `src/ui/art.js`, then tune it with the simulator.

Tuning knobs that move the RTP in small steps: paytable multipliers, free-spin awards, Hold & Spin `landChance` and coin weights, the pick prize weights, the meter `target`, jackpot contributions. The strips set frequencies of triggers.

## Quests: things to do besides pressing Spin

Everything below is play money and cosmetics, defined in `data/game.json`, with the rules in `src/core/quests.js` and the screens in `src/ui/quests.js`. None of it reaches the engine, so the odds never change (FAIR-03), and nothing punishes a player who ignores it: a challenge that runs out, a chain that is not finished and a chest that is never opened all cost nothing.

| What | How it works |
|---|---|
| **Live challenges** | A strip above the reels. The player picks one of three offers ("win on 4 spins within 10", "land 5 wilds", …), plays it by hand and gets coins or a free-spins voucher. One at a time, per machine, dropped for free. Machines get their own kinds (lantern meter on Crystal Fortune, cascades and expanding wilds on Neon Tumble). |
| **Bet quests** | At least one offer asks the player to use the bet buttons ("8 spins at bet 100 or more", "play 3 different bets"). It is only offered when that bet is a small share of the balance (`riskyBetShare`), so it never nudges anyone into a bet that would be flagged as large. |
| **Autoplay and challenges** | Starting autoplay while a challenge runs asks whether to play the challenge by hand first. |
| **Level chests** | Every 5th level of a machine (`chests.everyLevels`) leaves a chest. Three boxes, pick one: coins, a free-spins voucher or a reel frame. Chests wait until opened; the weekly chain and a complete gem set give one too. This is what endless levels earn beyond the rank. |
| **Lucky wheel** | One spin of the wheel for every daily mission that is finished. |
| **Free-spins vouchers** | 5 free spins (`voucher.spins`) at the third bet step of the machine, started from the strip when idle. It is queued as an ordinary free-spins feature, so it is planned in full, saved, resumed and paid like one. Worth about 800 coins on Crystal Fortune and 1,800 on Neon Tumble. A voucher round stays out of the return, missions, chain and challenges, since it cost nothing. |
| **Reel frames** | Six cosmetic reel-frame colours, found in chests and equipped in the profile. |
| **Gems** | Six per machine, each from one accomplishment (a 20× win, a bonus feature, 3 wilds in a spin, 200 spins, level 10, a 100× win). The full set pays coins and a chest, once. Shown in the profile. |
| **Weekly chain** | Three linked goals that unlock one after the other, each paying coins, with coins and a chest at the end. The chain is one of three, picked by the ISO week (`chains` in game.json), and starts fresh every week. |
| **Double or collect** | Off by default (Settings). After a plain base-game win of 1× to 10× the bet, while the win is under 10% of the balance, never during autoplay: a fair 50/50 (red or black) that doubles the win or loses it, at most twice in a row. The coin is flipped with a generator derived from the session state, so it never changes the spins that follow and a replay gives the same flip (`Session.gamble`). |

### Left out on purpose

An "active-play bonus" (paying more when the player taps Spin than when autoplay runs) was proposed and not built: a payout that depends on how the player plays is adaptive odds, which FAIR-03 forbids, and it would punish the players who prefer autoplay. Autoplay is nudged towards hands-on play by the challenge prompt instead.

## The simulator (TOOL-01, TOOL-02)

```bash
node scripts/slots-sim.mjs crystal-fortune --spins 10000000 --seed 2026
node scripts/slots-sim.mjs neon-tumble --fs-option 2     # scripted player: always pick option 3
node scripts/slots-sim.mjs --check                       # what CI runs: 1M spins per machine
node scripts/slots-sim.mjs --verify                      # 10M spins, plain ±0.5-point tolerance
```

The report gives RTP in total and per feature, hit frequency, trigger rates, the win distribution per celebration tier, the largest win, jackpot frequencies and a volatility index. 10 million spins take about a minute on this machine (the requirement is under ten minutes).

* **RTP counts progressives that have not been won yet** as returned to players, because they will be paid eventually (JP-03). Without that a rare Grand makes a finite simulation look stingy.
* **Volatility** is the standard deviation of one round's return in bets: below 4 is *low*, below 12 *medium*, otherwise *high*. A machine declares its class in `targets.volatility` and the check fails if the simulation disagrees.
* **`--check` allows the tolerance plus two standard errors**, because one million spins cannot measure an RTP to ±0.5 points (the standard error is about 0.8). `--verify` uses the plain tolerance with ten million spins, as MATH-04 asks. CI runs `--check` on every push; run `--verify` before releasing a changed config.
* The cap (MATH-05) applies to **one spin or one feature**, so a round (a spin plus the feature it started) can legitimately pay a little more than the cap; the simulator checks the cap per spin and per feature.

Measured with the shipped configs (10 million spins, seed 2026):

| | RTP | hit frequency | free spins | volatility index |
|---|---|---|---|---|
| Crystal Fortune | 97.3% (± 0.3) | 31.2% | 1 in 176 | 8.5 (medium) |
| Neon Tumble | 97.5% (± 0.2) | 31.7% | 1 in 158 | 7.6 (medium) |

The three free-spins options of Neon Tumble are worth 41.6× the bet each (FS-04 allows ±2%).

## Fairness, enforced by tests (FAIR-*)

* **FAIR-01/02** no ads, no purchases, no tracking: a source scan fails on ad or analytics SDKs, web addresses, or purchase code anywhere in the game; the end-to-end test also blocks all network requests.
* **FAIR-03 no adaptive odds**: the engine never mentions balance, wallet, level, history, clock or `Math.random` (source scan), and two sessions with the same seed but very different balances and histories produce identical outcomes (test).
* **FAIR-04** a win smaller than the bet gets no celebration and is shown against the bet ("Win 4 · Bet 10").
* **FAIR-05** the symbols around the grid are the real strip at the real stops (test over thousands of spins). Anticipation is decided only from reels that have already stopped, so it is the same whether or not the trigger will land.
* **FAIR-06** an optional session reminder with time played and net result (default 60 min, can be turned off).
* **FAIR-07** a first-launch screen says it is play money only; store listing and age rating are below.

### Where this departs from the specification, on purpose

* **The refill has no waiting time.** ECO-04 allows "immediately or after a short cooldown (default 10 min)". The project mission rules out timers that stop you playing, so `data/game.json` sets `refill.cooldownMinutes` to 0. Set it to 10 to get the specification default; the screen and tests support both.
* **The target RTP is 97.5%, not the specification's 96%** (ECO-08). A player who had lost steadily at 96% asked for a kinder game; the paytable's 3-of-a-kind pays of the lowest symbols were raised (Crystal Fortune: Ten and Jack 10 → 11; Neon Tumble: Circle 3 → 4, Triangle 3 → 4, Square 5 → 6, Hex 7 → 8, Ring 9 → 10) and `targets.rtp` set to 0.975 in both configs. The hit frequency and volatility class are unchanged. The profile's "return" is cash only, so it reads a little below the target while the progressive jackpots have not been won.
* **Every machine has its own level, and levels never end** (PROG-01). XP is earned on the machine the bet was placed on (`profile.machines[id].xp`); `profile.xp` is only the running total shown in the profile. Bet sizes unlock with that machine's own level (`betUnlockLevels`), and a machine opens when another reaches a level (`unlock: {machine, level}` in `data/game.json`: Neon Tumble needs Crystal Fortune level 4). `xp.thresholds` holds the hand-tuned XP for levels 1–30; beyond that each level costs `xp.beyondStep` (30) XP more than the one before, in closed form (`xpForLevel`, `levelForXp` in `core/profile.js`), so there is no top level. A save from before this change keeps what it had: a machine that was played starts with the player's old total XP (nothing is locked again), a machine never played starts at 0.
* **Past level 30 a level earns a rank, not coins** (PROG-01). Coin rewards are listed for levels 2–30 only. Every level shows in the badge; ranks (`xp.ranks`: Rookie, Apprentice, Challenger, Veteran, Expert, Master, Champion, Legend) change the title and badge colour, and after Legend a Roman numeral is added every `ranks.repeatEvery` levels (Legend II, III, …). The profile shows XP, level, rank and XP to the next level per machine.
* **Rewards grow with the level** (ECO-07), up to `economy.rewardLevelCap` (30). A level-up reward is the base amount in `data/game.json` times `1 + economy.rewardPerLevel × (level − 1)` (0.25 per level: ×8.25 at level 30), rounded to tens (`rewardScale`, `scaledReward`). A mission reward, the timed bonus and the refill follow the highest machine level. Past the cap the scale stops growing, so infinite levels do not inflate the economy.
* **Max bet is capped** (ECO-08). It picks the highest unlocked bet that is at most `economy.maxBetShare` (2%) of the balance, not the highest the balance can pay, and a toast says so when the cap held back a higher bet. The + button still reaches every unlocked bet.
* **Loss warnings** (ECO-09). A bet above `economy.riskyBetShare` (5%) of the balance turns orange and says what share of the coins it is. Once per session, when the net loss passes `economy.sessionLossWarn` (50%) of the starting balance, a message appears and autoplay stops.
* **Autoplay can be unlimited** (REEL-05): ∞ next to 10 / 25 / 50 / 100 (`autoplay.infinite`), with an optional stop when a chosen share of the coins is lost (`autoplay.lossLimits`). Unlimited autoplay still stops for a feature, when the coins run out, and when the session reminder is due.
* **Export profile** (PERS-06): Settings → Export shows the profile as JSON (level, balance, totals, the return so far, per-machine stats) with a Copy button, for sharing or for checking the actual return.
* **Autoplay stops when a feature triggers** (REEL-05), so PICK-04's "during autoplay items are picked automatically every second" is offered as an *Auto-pick* switch inside the pick bonus instead.
* **Scatter, coin and bonus triggers are read from the grid as it landed**, not from cascade refills.
* **The bonus-reminder notification is opt-in and off by default, but only works while the game is open**: a browser page cannot wake itself up. A native build could use a local notification plugin.

## Store listing text (FAIR-07)

Put this in the store description: *"Crystal Reels uses play money only. There is no real-money gambling, coins cannot be bought, sold or cashed out, and there are no ads or purchases."* Answer the content rating questionnaires honestly for **simulated gambling** (for Google Play, IARC "simulated gambling"; for Apple, the "simulated gambling" frequency question). That rating is required; the game does not try to avoid it.

## Open decisions, as taken here

| Decision | Taken |
|---|---|
| Platform and tech | Web technology without a bundler, like the other games; Capacitor packaging as for the rest of the arcade |
| Monetization | none (FAIR-02) |
| Cloud save and accounts | not built (PERS-06 stays out of scope) |
| Analytics | none |
| Theme and art direction | a crystal machine and a neon machine; symbols drawn in code, so they are easy to restyle |
| Social features | not built |

## Not verified here

These need a real device or real players and could not be measured in a headless test environment:

* **NFR-01/02/03** 60 fps, the 100 ms input latency and the start-up times on a three-year-old phone. The design keeps the work small (CSS transforms on 25 cells, a frame loop only while something moves, nothing at all when idle) and the end-to-end test measures that reels move right after the tap, but nobody has timed it on the reference phone.
* **NFR-12** crash-free sessions: a post-release measure.
* **FEEL-03/04/05** how the synthesised music loops, haptics and the silent-mode switch *sound and feel*. The code paths run in the browser test (without audio output), the experience is for a human to judge.
* **NFR-08** contrast was designed to AA (light text on dark panels) but not run through a checker.

## Requirement map

| Story | Where |
|---|---|
| REEL-01..06 | `ui/machine-screen.js`, `ui/reels.js`, `core/state-machine.js`; tests: `core.test`, `e2e` |
| MATH-01..06 | `engine/spin.js`, `engine/rng.js`, `engine/config.js`, `engine/simulate.js`, `ui/menus.js` (rules screen); tests: `engine.test`, `math.test`, `scripts/slots-sim.mjs` |
| PAY-01..06 | `engine/evaluate.js`; a fixture test for every paytable entry plus the edge cases |
| WIN-01..04 | `engine/tiers.js`, `ui/overlays.js`, `core/format.js` |
| FEEL-01..06 | `engine/anticipation.js`, `ui/audio.js`, `ui/fx.js`, `ui/reels.js` |
| WILD-01..04, CASC-01..02 | `engine/spin.js` (expanding, sticky, multiplier wilds, cascades) |
| FS-01..06 | `engine/features.js` (`planFreeSpins`), `ui/machine-screen.js` (`runFreeSpins`) |
| HS-01..05 | `engine/features.js` (`planHoldSpin`), `ui/machine-screen.js` (`runHoldSpin`) |
| PICK-01..04 | `engine/features.js` (`planPick`), `ui/machine-screen.js` (`runPick`) |
| JP-01..03 | `engine/jackpot.js`, jackpot panel and `celebrateJackpot` |
| ECO-01..09 | `core/profile.js` (rewards, `maxBetFor`, `betIsRisky`), `data/game.json` (`economy`, `autoplay`), `ui/machine-screen.js` (Max bet, loss checks, autoplay) |
| PROG-01..05 | `core/profile.js`, `ui/lobby.js`, `ui/menus.js`; meter in `core/session.js` |
| PERS-01..06 | `core/save.js` (atomic double slot, checksum, versioned migrations), `core/session.js`; PERS-06 the profile export: `exportProfile` in `core/profile.js`, `showExport` in `ui/menus.js` |
| FAIR-01..07 | see above |
| NFR-04..07, 09..11 | install size 270 KB; no loop runs when idle; safe-area insets and 44 px targets in `style.css`; no animation faster than about 1 Hz; all strings in `strings.js`; no network |
| TOOL-01..05 | `scripts/slots-sim.mjs`, `src/debug/debug.js`, `Session.replay`; TOOL-05: `npm run dev` serves configs from disk, so a config edit needs only a refresh |
