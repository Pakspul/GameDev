// Emberholm: every number in one place. See docs/EMBERHOLM.md for what they are for.
// Distances are metres, times seconds, angles radians.

export const CONFIG = {
  seed: 0x45b3a1, // The island. Frozen once released: changing it moves everything under players' saves.

  world: {
    size: 1536,          // the square the island sits in, centred on (0, 0); north is -z
    chunk: 64,           // terrain is built and loaded in squares of this size
    islandRadius: 560,   // roughly where the coast is
    seaFloor: -14,
    deepWater: 1.1,      // you can wade this deep, no further (swimming comes later)
    wadeSlow: 0.6,       // speed in water deeper than 0.3 m
  },

  view: {
    // Quality settings: pixel ratio cap and how far the world is drawn (fog hides the edge).
    quality: {
      low: { dpr: 1, far: 140, lod: [70, 120] },
      medium: { dpr: 1.25, far: 175, lod: [90, 150] },
      high: { dpr: 1.5, far: 210, lod: [110, 180] },
    },
    tuftsWithin: 46,      // grass tufts only this close
    nearNature: 75,       // trees and rocks closer than this get the detailed model
    seeThrough: 1.7,      // radius (m) around the line from camera to player where trees fade out
    fov: 55,
  },

  camera: {
    distance: 9.5,
    pitch: 0.36,          // about 21° looking down: the horizon shows at the top of the screen
    pitchMin: 0.12,
    pitchMax: 1.1,
    lookHeight: 2.1,      // aim just above the head, so more of the world ahead is in view
    dragYaw: 0.0065,      // radians per pixel dragged
    dragPitch: 0.004,
    follow: 1.1,          // how fast the camera swings behind a walking player (rad/s per rad of difference)
    followPause: 1.6,     // seconds after a camera drag before it starts following again
    clearance: 1.4,       // stays this far above the ground
  },

  player: {
    radius: 0.42,
    walk: 4.4,
    run: 7.2,             // stick pushed past `runAt`, or Shift
    runAt: 0.85,
    accel: 12,            // how fast speed follows the stick (per second)
    turn: 12,             // how fast the body turns to face the way it walks
    maxSlope: 0.95,       // rise per metre: steeper than this can't be walked up
    uphillSlow: 0.45,     // speed lost at max slope going straight up
  },

  // A day is 24 minutes of play: 14 of daylight, 10 of night. It only runs while you play.
  time: {
    day: 24 * 60,
    daylight: 14 / 24,    // share of the day that is light
    twilight: 0.025,      // share of the day for dawn and dusk each
    start: 0.06,          // a new game starts early in the morning
  },

  stick: { radius: 52, dead: 0.12 },
  frameCap: 30,           // default; 60 is a setting
  autosave: 10,           // seconds
};
