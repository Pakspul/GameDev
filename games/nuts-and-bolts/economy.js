// Every number of the washer economy. The rules behind them: docs/ECONOMY.md.
const ECO = Economy.register("nuts-and-bolts", {
  // Washers for a first 3-star clear. Each star pays a third, and only new stars pay.
  rewards: { easy: 24, medium: 45, hard: 75, expert: 120 },
  anchor: "medium",
  daily: "hard",                       // the daily puzzle is a Hard level
  items: { hint: "peek", spare: "boost" }
});
