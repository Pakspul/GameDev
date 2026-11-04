// Every number of the points economy. The rules behind them: docs/ECONOMY.md.
const ECO = Economy.register("outbound", {
  // Points for a first 3-star clear. Seven flat tiers and two five-tier tracks (Boxes, Shapes)
  // with smaller steps than a four-tier game, because each step is a smaller jump in effort.
  rewards: {
    easy: 10, medium: 20, hard: 30, extra: 45, insane: 65, master: 90, grandmaster: 120,
    "c-easy": 15, "c-medium": 25, "c-hard": 40, "c-extra": 55, "c-insane": 75,
    "s-easy": 20, "s-medium": 35, "s-hard": 50, "s-extra": 70, "s-insane": 95
  },
  tracks: [
    ["easy", "medium", "hard", "extra", "insane", "master", "grandmaster"],
    ["c-easy", "c-medium", "c-hard", "c-extra", "c-insane"],
    ["s-easy", "s-medium", "s-hard", "s-extra", "s-insane"]
  ],
  anchor: "medium",
  items: { probe: "peek", heart: "boost", skip: "skip" }
});
// Outbound's own extra: the first clear without losing a heart adds a quarter of the tier's pay.
const FLAWLESS_BONUS = 0.25;
// Prices from when power-ups were bought ahead and stocked. Only used to account for old saves.
const LEGACY_ITEM_PRICE = { probe: 40, heart: 60, skip: 120 };
