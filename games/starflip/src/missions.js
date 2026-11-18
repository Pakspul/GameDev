// The missions on the main table, in the order they're offered. Each is a list of steps; a step
// names one shot and how many times to make it. The banner spells out the current step
// ("Shoot the LEFT ORBIT"), and arrows on the table blink at that shot.
//
// Shots (what rules.js reports when the ball makes them):
//   leftOrbit, rightOrbit   up a side channel (and round the top)
//   pad                     into the launch pad in the middle
//   wormhole                into the wormhole, top left
//   drops                   one asteroid drop target;  dropBank: all three down
//   sat                     a satellite target (right)
//   bumpers                 a pop bumper hit
//   spinner                 one turn of the spinner in the left orbit
//   comet                   whichever shot the comet is on right now (it moves)
//
// `mini` is the bonus table the wormhole leads to once the mission is done.
export const MISSIONS = [
  { id: "liftoff", mini: "asteroids", steps: [{ shot: "bumpers", n: 8 }, { shot: "rightOrbit", n: 1 }] },
  { id: "storm", mini: "asteroids", steps: [{ shot: "dropBank", n: 2 }] },
  { id: "satellite", mini: "ufo", steps: [{ shot: "leftOrbit", n: 1 }, { shot: "sat", n: 3 }, { shot: "pad", n: 1 }] },
  { id: "comet", mini: "gravity", steps: [{ shot: "comet", n: 3, pool: ["leftOrbit", "rightOrbit", "sat", "drops", "pad"] }] },
  { id: "blackhole", mini: "gravity", steps: [{ shot: "leftOrbit", n: 1 }, { shot: "rightOrbit", n: 1 }, { shot: "leftOrbit", n: 1 }, { shot: "rightOrbit", n: 1 }] },
  { id: "contact", mini: "ufo", steps: [{ shot: "spinner", n: 20 }, { shot: "wormhole", n: 1 }] },
];

/** The final mode, once every mission is done: three balls, and every one of these shots is a jackpot. */
export const MOTHERSHIP_SHOTS = ["leftOrbit", "rightOrbit", "pad", "drops", "sat", "spinner"];

/** Which arrow on the table stands for a shot (some shots share one). */
export const ARROW = { dropBank: "drops" };
