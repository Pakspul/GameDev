// Economy: one set of rules for every game that has a currency (washers, coins, points...).
// The why, and the numbers each rule came from, are in docs/ECONOMY.md. Read that first.
//
// The idea in one line: every price is counted in levels of the tier you're playing, never in
// a fixed amount. A spare bolt costs "two levels' pay" whether you're on Easy or Expert, so
// getting unstuck always takes some effort, and you can earn it on easier levels if you like.
//
// Each game keeps all its numbers in games/<name>/economy.js:
//
//   const ECO = Economy.register("nuts-and-bolts", {
//     rewards: { easy: 24, medium: 45, hard: 75, expert: 120 },  // pay for a first 3-star clear
//     anchor: "medium",                                          // the "typical" tier (starting balance)
//     items: { hint: "peek", spare: "boost" },                   // what kind of help each item is
//   });
//   ECO.price("spare", "hard", 1)      → 300  (the second spare bolt in one Hard level)
//   ECO.levelPay("hard", 3, 2)         → 25   (improving a Hard level from 2 to 3 stars)
//
// Loaded as a classic script before the game's own economy.js. Also works under Node, so
// tests/economy.mjs can check every game against the rules.
(function (root) {
  "use strict";

  // What one use of each kind of help costs, as a multiple of the current tier's reward.
  var KIND = {
    peek: 0.5,   // shows something, solves nothing: a hint, x-ray, probe. Same price every time.
    boost: 2,    // makes the level easier: spare bolt, drill, extra heart. Doubles per extra use.
    heavy: 3,    // removes part of the puzzle: hammer, chest. Doubles per extra use.
    skip: 5      // leave the level unsolved. A skipped level pays nothing.
  };
  var DAILY = 2;          // a daily puzzle pays twice a normal level of its tier
  var STREAK_STEP = 0.1;  // +10% of that for every day of streak after the first...
  var STREAK_DAYS = 5;    // ...up to +50%. Missing a day never takes anything away.

  // Round to a tidy number: whole units below 20, multiples of 5 above. Never below 5.
  function tidy(x) { return Math.max(5, x < 20 ? Math.round(x) : Math.round(x / 5) * 5); }
  function starPay(r, stars) { return Math.round(r * Math.max(0, Math.min(3, stars)) / 3); }

  var games = {};
  var Economy = {
    KIND: KIND, DAILY: DAILY, STREAK_STEP: STREAK_STEP, STREAK_DAYS: STREAK_DAYS,
    games: games,
    tidy: tidy,
    /** Stars for a cleared level: help of any kind (free or paid) always takes one star. */
    helped: function (stars, usedHelp) { return Math.max(1, usedHelp ? Math.min(stars, 3) - 1 : Math.min(stars, 3)); },

    register: function (id, cfg) {
      var R = cfg.rewards;
      function reward(tier) {
        if (!(tier in R)) throw new Error("economy: " + id + " has no tier " + tier);
        return R[tier];
      }
      var E = {
        id: id, rewards: R, anchor: cfg.anchor, items: cfg.items || {}, tracks: cfg.tracks || [Object.keys(R)],
        reward: reward,
        /** Price of the (nth + 1)-th use of an item in one level (nth = 0 for the first). */
        price: function (item, tier, nth) {
          var kind = E.items[item];
          if (!(kind in KIND)) throw new Error("economy: " + id + " item " + item + " has no kind");
          var steps = kind === "peek" || kind === "skip" ? 0 : Math.max(0, nth || 0);
          return tidy(KIND[kind] * reward(tier) * Math.pow(2, steps));
        },
        /** Pay for clearing a level with `stars`, when the best so far was `prev` (0 if new). */
        levelPay: function (tier, stars, prev) {
          return stars > (prev || 0) ? starPay(reward(tier), stars) - starPay(reward(tier), prev || 0) : 0;
        },
        /** Pay for a daily puzzle. The streak bonus comes once, with the first clear of the day. */
        dailyPay: function (tier, stars, prev, streak) {
          if (stars <= (prev || 0)) return 0;
          var base = DAILY * reward(tier);
          var pay = starPay(base, stars) - starPay(base, prev || 0);
          if (!prev) pay += Economy.streakBonus(tier, streak, E);
          return pay;
        },
        /** A new player starts with exactly one Boost at the anchor tier. */
        start: tidy(KIND.boost * reward(cfg.anchor))
      };
      games[id] = E;
      return E;
    },
    streakBonus: function (tier, streak, E) {
      var days = Math.max(0, Math.min(STREAK_DAYS, (streak || 1) - 1));
      return Math.round(DAILY * E.reward(tier) * STREAK_STEP) * days;
    }
  };

  root.Economy = Economy;
  if (typeof module !== "undefined" && module.exports) module.exports = Economy;
})(typeof window !== "undefined" ? window : globalThis);
