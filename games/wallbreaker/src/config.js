// Wallbreaker's numbers: prices, rewards, drop rates, durations, caps and the feel of the ball.
// Every number a player can feel lives here and nowhere else, so tuning after a playtest is an
// edit to this one file. Bump `version` when you change something that matters to a save
// (save.js keeps the version it was written with).
//
// All of these are starting values from the game plan (docs/WALLBREAKER.md); tune after the
// slice 3 playtest. Times are in seconds, distances in world units (the playfield is 360 × 640).

export const CONFIG = deepFreeze({
  version: 1,

  world: {
    W: 360, H: 640,
    cols: 12, cellW: 28, cellH: 14,
    left: 12, right: 348,     // inner side walls
    top: 58,                  // inner top wall
    gridTop: 76,              // y of brick row 0 (a gap above it lets balls run behind the wall)
    paddleY: 584,             // top edge of the paddle
    netY: 616,                // the Safety Net
    launchY: 572,             // Descent and Puzzle launcher
  },

  physics: {
    hz: 120,
    ballRadius: 6,
    baseSpeed: 390,           // level 1
    speedPerLevel: 0.01,      // +1% of the base speed per level...
    speedCap: 540,            // ...until this (reached at level 39)
    maxBounceDeg: 60,         // paddle edge sends the ball this far from vertical
    edgeGrace: 3,             // a ball clipping the paddle edge within this still counts as a hit
    stallSeconds: 2,          // near-horizontal for this long...
    stallDeg: 12,             // ("near" = within this many degrees of horizontal)...
    nudgeDeg: 24,             // ...gets nudged to this angle from horizontal
    slowMoScale: 0.3,         // the "fair miss" beat: time runs at 30%...
    slowMoBelow: 10,          // ...once the last ball is this far below the paddle top
    lostPause: 0.6,           // pause after a lost ball before the next one is served
    paddleWidth: 66, paddleHeight: 12,
    capsuleSpeed: 125, capsuleW: 30, capsuleH: 13,
    laserSpeed: 720, laserPerSecond: 3,
    splitDeg: 16,             // Multiball spreads new balls by this much
    maxBalls: 12,
    steerMagnet: 1.4,         // radians per second of turn toward the paddle (Magnet)
    steerGravity: 1.1,        // ...toward the densest cluster (Gravity Pull)
    loopSeconds: 10,          // a ball that touches nothing useful for this long gets a small random turn
    huntBricks: 3, huntAfter: 15, steerHunt: 0.8, // last-brick hunt: with ≤ 3 bricks left and none broken for 15 s, the ball leans toward the nearest
    autoLaunch: 1.4,          // seconds before the ball launches itself (if the setting is on)
    maxFlight: 18,            // Descent and Puzzle: a ball still flying after this fades out
    descentSpeed: 540,
    descentFastAfter: 5,      // after this long a volley plays at double speed
    volleyGap: 0.075,         // seconds between balls of one volley
  },

  bricks: {
    toughHits: [2, 3],
    regenSeconds: 6,
    ghostVisible: 1,
    explosionDelay: 0.07,     // between links of a chain reaction, for the eye
    movingSpeed: 38,
    bossPeriod: 7,            // seconds for the boss to sweep across and back
    coreHp: { base: 14, perLevel: 0.6, max: 60 },
    weakMultiplier: 2,
    steelShareMax: 0.15,
  },

  // When things first show up (level numbers). Changing these changes generated levels.
  intro: { tough: 2, goodDrops: 4, moving: 6, steel: 8, boss: 10, risky: 10, explosive: 12, portal: 15, regen: 20, ghost: 25 },

  drops: {
    chance: 0.08,             // per breakable brick
    pity: 15,                 // a guaranteed drop after this many bricks without one
    riskyShare: 1 / 6,        // of all drops, from intro.risky, in Classic and Run only
    good: {                   // relative weights of the good capsules
      multi2: 10, multi3: 5, sticky: 7, fire: 6, big: 7, slow: 7, magnet: 6, wide: 9,
      laser: 6, twin: 5, net: 6, bomb: 6, lightning: 5, gravity: 5, score2: 6, life: 3,
    },
    descent: { multi2: 10, multi3: 5, fire: 7, bomb: 7, lightning: 6 }, // Descent: ball power-ups only
    risky: { surge: 6, tiny: 6, armor: 4, blackout: 5, wild: 6, allin: 2 },
    level1Gift: "wide",       // what level 1's gift brick teaches you to catch
  },

  // Good capsules. seconds: how long it lasts (before Long Lasting); null = instant or until used.
  capsules: {
    multi2: { seconds: null, split: 1 },
    multi3: { seconds: null, split: 2 },
    sticky: { seconds: 20, catches: 3 },
    fire: { seconds: 8 },
    big: { seconds: 12, radius: 10 },
    slow: { seconds: 10, speed: 0.7 },
    magnet: { seconds: 12 },
    wide: { seconds: 15, width: 1.5 },
    laser: { seconds: 10 },
    twin: { seconds: 12 },
    net: { seconds: null },
    bomb: { seconds: null },
    lightning: { seconds: 10, chain: 2 },
    gravity: { seconds: 10 },
    score2: { seconds: 10, factor: 2 },
    life: { seconds: null },
  },

  // Risky capsules: the risk, and what it adds to the brick-credit multiplier (above ×1).
  risky: {
    surge: { seconds: 15, speed: 1.4, bonus: 1 },
    tiny: { seconds: 15, width: 0.5, bonus: 1 },
    armor: { seconds: 20, damage: 0.5, bonus: 1.5 },
    blackout: { seconds: 15, bonus: 1 },
    wild: { seconds: 15, degrees: 8, bonus: 0.5 },
    allin: { seconds: null, bonus: 2 },   // lasts the whole level
  },
  multiplierCap: 4,

  credits: {
    base: 10, perSqrtLevel: 2,               // 10 + 2 × √level
    brick: { normal: 0.25, moving: 0.25, gift: 0.25, ghost: 0.25, tough: 0.5, regen: 0.5, explosive: 1, core: 1 },
    star2: 5, star3: 5,
    replay3Star: 0.5,                        // replaying a level you already have 3 stars on
    zen: 0.25,
    daily: 25,                               // fixed, once per date
    puzzleRepeat: 0.5,
    timeAttack: { bronze: 5, silver: 10, gold: 15 }, // paid once per medal you improve to
  },

  stars: {
    parBase: 30, parPerBrick: 1.3, parPerCoreHp: 1,    // "speed target" in seconds
  },

  lives: { classic: 3, run: 3, daily: 3 },
  checkpointEvery: 5,

  boosts: {
    maxEquipped: 3,
    items: {
      multiStart: { price: 60, modes: ["classic", "descent"] },
      life: { price: 80, modes: ["classic", "descent"] },
      wideStart: { price: 40, seconds: 30, modes: ["classic"] },
      netStart: { price: 50, modes: ["classic"] },
      stickyStart: { price: 40, catches: 3, modes: ["classic"] },
      lucky: { price: 70, goodBonus: 0.5, modes: ["classic", "descent"] },
    },
  },

  workshop: {
    growth: 1.6,
    items: {
      longLasting: { per: 0.10, max: 5, base: 150 },   // timed capsules +10% per level
      luckyCharm: { per: 0.05, max: 5, base: 150 },    // good capsule chance +5% (relative)
      steadyHands: { per: 0.04, max: 5, base: 200 },   // paddle width +4%
      scavenger: { per: 0.05, max: 5, base: 300 },     // credits earned +5%
      secondWind: { per: 1, max: 1, base: 1500 },      // start Classic and Run with 4 lives
    },
  },

  // 24 cosmetics for sale, 4 per shelf, plus a free default per shelf. Tiers: 1 = 150–300,
  // 2 = 500–800, 3 = 1,200–2,000.
  cosmetics: {
    ball: [["ball.classic", 0], ["ball.pearl", 150], ["ball.ember", 250], ["ball.ringed", 600], ["ball.star", 1400]],
    paddle: [["paddle.classic", 0], ["paddle.mint", 150], ["paddle.candy", 300], ["paddle.chrome", 700], ["paddle.aurora", 1600]],
    trail: [["trail.none", 0], ["trail.line", 200], ["trail.dots", 250], ["trail.ribbon", 650], ["trail.comet", 1500]],
    bricks: [["bricks.neon", 0], ["bricks.pastel", 200], ["bricks.earth", 300], ["bricks.glass", 800], ["bricks.gold", 2000]],
    theme: [["theme.night", 0], ["theme.ocean", 250], ["theme.dusk", 300], ["theme.forest", 600], ["theme.space", 1200]],
    sound: [["sound.arcade", 0], ["sound.marimba", 150], ["sound.chip", 200], ["sound.glass", 500], ["sound.drums", 1200]],
  },

  descent: {
    shotsPerRow: 5,
    rowH: 28,                 // Descent bricks are square: 28 × 28
    startRows: 7,             // rows visible at the start; the rest wait above the top
    failY: 556,               // a breakable brick reaching this line ends the level
    plusChance: 0.07,         // share of cells that hold a +1 ball pickup
  },

  puzzle: { maxFlight: 18 },

  timeAttack: { lostBallPenalty: 5 },

  run: {
    offers: 3,
    perks: {
      wide: { max: 3, width: 0.15 },
      net: { max: 1 },
      multi: { max: 1 },
      slow: { max: 2, speed: 0.92 },
      fire: { max: 2, seconds: 6 },
      life: { max: 9 },
      luck: { max: 3, goodBonus: 0.3 },
      long: { max: 3, duration: 0.25 },
      laser: { max: 2, seconds: 8 },
      magnet: { max: 2, seconds: 12 },
      sticky: { max: 2, catches: 2 },
      bomb: { max: 1 },
      haul: { max: 3, credits: 0.1 },
    },
    // Starting options, unlocked by milestones: [option, milestone kind, value]
    starts: [["wide", "level", 5], ["net", "level", 10], ["multi", "boss", 1], ["life", "level", 20], ["fire", "boss", 2]],
  },

  daily: { levelMin: 8, levelSpan: 12 },     // the daily wall is built like Classic level 8–19
});

function deepFreeze(o) {
  for (const k of Object.keys(o)) if (o[k] && typeof o[k] === "object") deepFreeze(o[k]);
  return Object.freeze(o);
}
