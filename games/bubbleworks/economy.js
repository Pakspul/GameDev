// Every number of Bubbleworks' stardust. The rules behind them: docs/ECONOMY.md.
const ECO = Economy.register("bubbleworks", {
  // Stardust for a first 3-star clear. Levels 1–15 are Easy, 16–40 Medium, 41–80 Hard, then Expert
  // (src/levels.js tierOf). The daily level is priced and paid as Hard. A Classic stage or an Endless
  // milestone you reach for the first time pays like a level of its tier (game.js).
  rewards: { easy: 20, medium: 35, hard: 60, expert: 100 },
  anchor: "medium",
  items: {
    aim: "peek",    // Aim+: the whole aim line and where the bubble will stick, for the rest of the level
    shots: "boost", // +5 shots
  },
});
