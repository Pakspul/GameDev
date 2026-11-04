// Every number of the coin economy. The rules behind them: docs/ECONOMY.md.
const ECO = Economy.register("unscrew", {
  // Coins for a first 3-star clear of a level. Each star pays a third, and only new stars pay,
  // so replaying the early levels of a new run earns nothing until you improve on them.
  rewards: { easy: 20, normal: 35, hard: 60, expert: 100 },
  anchor: "normal",
  items: { xray: "peek", drill: "boost", magnet: "boost", hammer: "heavy", chest: "heavy" }
});
// Prices before tools were paid on use. Only used once, to refund tools a player had stocked.
const LEGACY_TOOL_PRICE = { drill: 60, hammer: 120, chest: 150, magnet: 80, xray: 40 };
