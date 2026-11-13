// Coin Dozer's numbers: the feel of the physics, the board, drop rules, prizes, bonus events,
// anti-stall, the economy, feedback and performance limits. Every number a player can feel lives
// here and nowhere else, so tuning is an edit to this one file (docs/COIN-DOZER.md, design pillar 5).
//
// Units: one world unit is one coin diameter. Times are in seconds. The shelf top is y = 0, the
// front edge (where coins are won) is at z = +depth/2, the back wall at z = -depth/2, x runs left
// to right with 0 in the middle.
//
// Bump `version` when you change something that makes an old board snapshot meaningless (the
// shelf size, say): save.js then starts a fresh board and keeps credits and collections.

export const CONFIG = deepFreeze({
  version: 1,

  physics: {
    hz: 60,                   // fixed physics step, independent of the frame rate
    maxStepsPerFrame: 4,      // a slow frame catches up at most this many steps (then time slows)
    gravity: 38,              // coin diameters per second²: heavier than "real" 1 unit = 1 m, so coins feel coin-sized
    solverIterations: 6,
    pgsIterations: 1,
    coin: { friction: 0.6, restitution: 0.04, density: 1, linearDamping: 0.05, angularDamping: 0.6 },
    shelf: { friction: 0.4, restitution: 0.02 },
    pusher: { friction: 0.25 },
    wall: { friction: 0.15 },
    coinBorder: 0.015,        // rounded edge of the coin collider: smoother stacking and tipping
    ccd: true,                // continuous collision for coins: a falling coin can't pass through a thin one
  },

  board: {
    width: 7,                 // shelf width, in coin diameters
    depth: 10,                // shelf depth, including the pusher's travel
    stroke: 3,                // pusher stroke
    cycle: 2.4,               // seconds for one full advance and retract; constant speed, no pause
    pusherHeight: 0.62,       // the top of the pusher block; coins can ride on it
    sideOpenFrom: 1.6,        // side rails run from the back wall to this z; in front of it the sides are open (gutters)
    railHeight: 1.6,
    dropHeight: 3.2,          // a dropped coin starts this high above the shelf...
    dropZ: -3.6,              // ...over this z (above the pusher's travel, at the back of the shelf)
    dropJitter: 0.15,         // ± this much sideways, seeded, so drops never land identically
    aimMargin: 0.5,           // the aim clamps this far inside the shelf edges
    wonBelow: -0.6,           // a body that falls below this height is off the board: won (front) or lost (sides)
    killBelow: -3,            // hard floor: anything below here is removed whatever happened
    maxCoins: 250,            // active coins; beyond this the oldest settled coin farthest from the edge fades out
  },

  // The machines a player can choose (docs/COIN-DOZER.md, "Machines"). They share the shelf, the
  // pusher and every rule; only the way a coin gets onto the board differs:
  //   pins      three slots at the top of a wall of pins: the coin bounces down and lands somewhere
  //   classic   you aim along the width and the coin drops where you aimed
  machines: ["pins", "classic"],
  defaultMachine: "pins",

  // The pin wall (the "pins" machine): a coin falls on its edge in a thin plane just in front of the
  // back wall, held in that plane, and bounces off the pins until it drops out of the bottom onto the
  // pusher. The pins are spaced so a coin always fits between two of them (no coin can wedge).
  pinWall: {
    slots: [-2.1, 0, 2.1],    // x of the three coin slots at the top
    z: -4.84,                 // the plane the coins fall in (the back wall's face is at -depth/2)
    top: 7.0,                 // a coin enters here...
    bottom: 1.75,             // ...and leaves the wall when its centre passes this height
    rowTop: 6.2, rowGap: 1.0, // the first row of pins, and the distance between rows
    rows: [[-2.1, 0, 2.1], [-1.4, 0, 1.4], [-2.1, -0.7, 0.7, 2.1], [-1.4, 0, 1.4], [-2.1, -0.7, 0.7, 2.1]],
    pinRadius: 0.06,
    bumpers: [1, 3, 4],         // rows with a half-round bumper on each side wall, so coins don't slide down the walls
    bumperRadius: 0.22,
    restitution: 0.45,        // pins are bouncier than the shelf (the higher of the two values counts)
    gravityScale: 0.75,       // coins fall a little slower in the wall, so you can watch them bounce
    jitter: [0.06, 0.2],      // a coin enters this far left or right of the slot's centre, seeded, never dead centre
    exitSpeed: 1.2,           // a small push toward the player as a coin leaves, so it tips onto the pile
    stuckSeconds: 0.6,        // a coin that hardly moves this long in the wall gets a sideways kick
    stuckKick: 2.2,
  },

  coin: {
    thickness: 0.12,          // of the diameter
    jackpotDiameter: 1.9, jackpotThickness: 0.2, jackpotDensity: 1.4,
  },

  prizes: {
    gem: { size: 0.82, height: 0.6, density: 3.2, friction: 0.55 },
    figure: { radius: 0.45, height: 1.32, density: 2.6, friction: 0.6 }, // figures are modelled at radius 0.3 × height 0.88 and scaled to this
    gemsMin: 2, gemsMax: 4,
    replenishEvery: 4,        // seconds between machine drops of a missing prize
    figureDelay: 6,           // a new figure drops this long after one is won
    unownedWeight: 3,         // a figure you don't have yet is this many times as likely to be picked
    luckyEvery: 180,          // seconds of play between lucky coins (on average)
    luckySpread: 0.35,        // ± this share of luckyEvery, seeded
  },

  start: {
    coins: 60,                // pre-placed loose pile on a new board
    gems: 2, figures: 1,
    settleSeconds: 3,         // simulated before the board is shown, so it opens settled
    bank: 50,
  },

  values: { coin: 1, gold: 5, lucky: 1, jackpot: 50, bombPenalty: 5 }, // lucky: its bonus is the shower; the 1 is so the bank still ticks

  drop: {
    minInterval: 0.25,        // a second drop within this is ignored
    autoInterval: 0.8,
    goldChance: 0.04,         // about 1 in 25 dropped coins turns gold
    lifeline: 10,             // bank 0 and nothing in flight → this many coins, instantly, always
  },

  nudge: { charges: 3, rechargeSeconds: 60, impulse: 0.35, lift: 0.25 },

  events: {
    cascadeMin: 5,            // coins over the edge in one advance for a "cascade"
    showerCascade: 15,        // a cascade this big starts a coin shower...
    cascadeCooldown: 40,      // ...unless one ended less than this long ago (stops shower → cascade → shower loops)
    shower: { seconds: 6, coinsMin: 30, coinsMax: 40 },
    fever: { gems: 3, window: 60, seconds: 15, speed: 1.25, multiplier: 2 },
    wideShelfDrops: 10,
    maxQueued: 2,             // rain-type events waiting behind the one that plays
  },

  antiStall: {
    cycles: 3,                // nothing over the front edge for this many pusher cycles → settle nudge
    settleCoins: 10, settleImpulse: 0.06,
    coinsAfter: 2,            // still stalled this many cycles later → free coins at the back
    freeCoins: 3,
    prizeCycles: 5,           // a prize that hasn't moved for this many cycles gets a small sideways push
    prizeMoved: 0.05,
    prizeImpulse: 0.5,
  },

  economy: {
    credits: { gem: 10, figure: 25 },
    milestones: [
      { id: "won100", credits: 20 },
      { id: "cascade10", credits: 20 },
      { id: "fever", credits: 30 },
      { id: "jackpot", credits: 50 },
      { id: "fullSet", credits: 100 },
    ],
    workshop: {
      startBank: { costs: [40, 80, 160], per: 25 },     // +25 coins in the bank at a new game
      goldChance: { costs: [50, 100, 200], per: 0.01 }, // +1% gold coin chance
      nudges: { costs: [40, 80, 160], per: 1 },         // +1 nudge charge
      luckyRate: { costs: [60, 120, 240], per: 0.15 },  // lucky coins 15% more often
    },
    themes: { classic: 0, space: 150, candy: 300, ocean: 500 },
    setSize: 12,
  },

  feedback: {
    voices: 12,               // simultaneous sounds; the quietest is dropped first
    tickPerSecond: 10,        // bank counter tick sound
    cascadeSteps: 8,          // rising clinks cap at this many steps
    hapticTick: 10, hapticCascade: [20, 60], hapticMedium: 30, hapticDouble: [25, 60, 25],
    shakeMax: 0.12,           // camera shake cap, world units
    counterRate: 12,          // the bank display catches up at least this many coins per second
  },

  performance: {
    slowFrameMs: 20, slowSeconds: 2,   // particles thin out when frames take this long for this long...
    fastFrameMs: 14,                   // ...and come back when they're this quick again
    particleLevels: [1, 0.5, 0.2],
    saveEvery: 10,                     // autosave every this many seconds of play
  },

  hazard: { enabled: false, bombChance: 0.03 },   // post-v1: bomb tokens (the physics supports them)
});

function deepFreeze(o) {
  Object.freeze(o);
  for (const k of Object.keys(o)) if (o[k] && typeof o[k] === "object" && !Object.isFrozen(o[k])) deepFreeze(o[k]);
  return o;
}
