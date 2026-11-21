// Every number of Loopline's coins. The rules behind them: docs/ECONOMY.md.
const ECO = Economy.register("loopline", {
  // Coins for a first 3-star clear. Depot and Critters share one set of tiers; Orbit's sculptures of
  // 10,000+ blocks take two to three times as long to clear, so Orbit pays about twice as much.
  rewards: {
    easy: 20, medium: 35, hard: 60,
    "orbit-easy": 40, "orbit-medium": 70, "orbit-hard": 120
  },
  tracks: [
    ["easy", "medium", "hard"],
    ["orbit-easy", "orbit-medium", "orbit-hard"]
  ],
  anchor: "medium",
  items: {
    hint: "peek",    // rings the mover to send next
    rewind: "peek",  // undo on Hard (free on Easy and Medium)
    bay: "boost",    // one more bay (Critters, Orbit) or dock (Depot) for the rest of the level
    pick: "boost",   // send any critter from a lane, not just the front one; Depot: tow any bus out
    zap: "heavy"     // Laser: the next critter pops its colour through others; Depot: Magnet bus
  }
});
