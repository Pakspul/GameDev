// Every number that shapes a match, in one place. Distances are in cells (the board is a grid of
// N × N cells), times in seconds.
export const CONFIG = {
  N: 220,                 // board size in cells
  hz: 60,                 // fixed simulation steps per second
  speed: 9,               // cells per second, the same for everyone
  turnRate: 6,            // radians per second: how tight a turn can be
  startRadius: 4.6,       // the disc of land you start with
  headOn: false,          // heads that touch: only trails count (true: the one off its land is out)
  headRadius: 0.75,       // for head-on collisions
  spawnMargin: 14,        // no spawning this close to the edge
  selfGrace: 3,           // the last few trail cells can't kill you (corners on a grid)

  // Bots per difficulty, and how sharp they are (see src/bots.js).
  difficulty: {
    easy:   { bots: 5,  think: 0.16, caution: 1.6, hunt: 0.4, noise: 0.35, reach: [5, 13], width: [4, 11] },
    normal: { bots: 8,  think: 0.12, caution: 1.35, hunt: 0.8, noise: 0.22, reach: [6, 17], width: [5, 14] },
    hard:   { bots: 11, think: 0.08, caution: 1.2, hunt: 1.2, noise: 0.12, reach: [7, 22], width: [6, 18] },
  },

  // One colour per player; index 0 is "nobody". The player is always 1.
  colors: [
    "#000000",
    "#2f6fec", // you: ink blue
    "#e8504a", "#f2a33a", "#3dbb6b", "#a45ee5", "#1fb5c4", "#ef6fae",
    "#8a6d4b", "#7fbf3a", "#d9c23a", "#5b6b8a", "#e07c4f", "#4a9e9e",
  ],
  names: [
    "Inky", "Smudge", "Blotto", "Quill", "Doodle", "Splat", "Margo", "Scribbs",
    "Nib", "Pippa", "Fennel", "Rook", "Wisp", "Tansy", "Bramble", "Juniper",
  ],
};
