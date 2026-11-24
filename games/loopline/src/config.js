// Every number that shapes Loopline, in one place.

export const CONFIG = {
  lapSeconds: 3.0,   // one lap round the picture takes this long, whatever its size
  spacing: 2,        // track steps between two movers on the loop
  belt: 4,           // at most this many movers on the loop (or waiting to get on) at once
  launchTween: 0.3,  // seconds from the yard or a bay to the loop's entrance
  // A sure win plays itself out (Critters and Orbit): the last block pops after about finishPop seconds,
  // at most finishMaxSpeed times faster or finishMaxSlow times slower than normal, and the result shows
  // finishSeconds after it started at the earliest (the celebration runs that long).
  finishPop: 4,
  finishSeconds: 5,
  finishMaxSpeed: 12,
  finishMaxSlow: 3,
  orbit: {
    lapSeconds: 3.4, // Orbit: one lap round the sculpture
  },
  depot: {
    tick: 0.15,      // seconds per spot the crowd walks round the loop (a calm walk, not a rush)
    transit: 7,      // ticks a vehicle takes from the car park to its bay
  },
};

// The colours a picture can use. A cell stores its colour's index + 1 (0 is empty). Pictures are
// written with these letters (see pictures.js). The order is part of every level: append only.
export const PALETTE = [
  { key: "R", hex: "#e5484d", name: "red" },
  { key: "O", hex: "#f7802b", name: "orange" },
  { key: "Y", hex: "#ffcb3d", name: "yellow" },
  { key: "L", hex: "#9ccf4a", name: "lime" },
  { key: "G", hex: "#2f9e5f", name: "green" },
  { key: "T", hex: "#14a8a0", name: "teal" },
  { key: "S", hex: "#62b6f0", name: "sky" },
  { key: "B", hex: "#3d5fd6", name: "blue" },
  { key: "P", hex: "#8f52c9", name: "purple" },
  { key: "K", hex: "#f48bbd", name: "pink" },
  { key: "N", hex: "#8f5b3a", name: "brown" },
  { key: "F", hex: "#f4c6a0", name: "peach" },
  { key: "W", hex: "#f6f2ea", name: "white" },
  { key: "E", hex: "#9aa1aa", name: "grey" },
  { key: "D", hex: "#33343d", name: "dark" },
];
export const COLOR_OF = Object.fromEntries(PALETTE.map((p, i) => [p.key, i + 1]));
