// Every number that shapes how Starflip plays, in one place. World units: the table is 560 × 1000,
// y points down the table (towards the flippers), time is in seconds.
export const CONFIG = {
  hz: 600,                 // physics steps per second: at the top speed a ball moves under half its radius per step
  W: 560, H: 1000,
  ball: { r: 10, vmax: 2900 },
  gravity: 1500,           // along +y (the table's slope)
  flipper: { len: 88, r1: 13, r2: 7, rest: 0.52, up: -0.44, wUp: 26, wDown: 15, e: 0.32 },
  wall: { e: 0.42, f: 0.015 },
  bumper: { kick: 1050, e: 0.6 },
  sling: { kick: 720, e: 0.45, minHit: 90 },
  plunger: { min: 1650, max: 2300, charge: 1.1 }, // launch speed range (soft: top lanes, full: round the orbit); seconds to full power
  rest: 45,                // a contact slower than this (units/s) doesn't bounce: balls settle instead of jittering

  balls: 3,
  ballSave: 10,            // seconds of ball save after every launch
  skillTime: 6,            // seconds the skill shot stays lit after a launch
  holdPad: 1.4,            // seconds a ball rests in the launch pad when a mission starts
  holdShort: 0.7,          // seconds in a hole when nothing special happens
  multMax: 5,
  missionTime: 75,         // seconds per mission (the clock only runs while a ball is in play, and carries over to the next ball)
  cometMove: 7,            // seconds before the comet moves to another shot
  stuck: 4,                // seconds a ball may sit still (outside the flippers and holes) before it gets a nudge

  mini: { time: 30, save: 5 },

  score: {
    bumper: 1000, sling: 100, drop: 5000, dropBank: 25000, standup: 3000, lane: 2000, lanes: 25000,
    spin: 250, orbit: 10000, hole: 5000, skill: 100000,
    step: 25000,           // a mission shot (× the mission round)
    mission: 250000,       // a completed mission (× the mission round)
    jackpot: 200000, superJackpot: 1000000,
    bonus: { bumper: 50, drop: 500, standup: 300, lane: 1000, orbit: 2000, mission: 25000 },
    // bonus tables
    rockHit: 5000, rockBreak: 25000, starHit: 2000, starLit: 50000, supernova: 300000, core: 100000,
    ufoHit: 40000, ufoDown: 250000, alien: 10000, aliens: 100000, miniBumper: 1000,
  },
};
