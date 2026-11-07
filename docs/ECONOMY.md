# Economy

How coins, washers and points work in every game, and why. Read this before you add a currency to a game, add something to a shop, or change a price.

The short version: **every price is counted in levels of the tier you're playing.** Getting unstuck on a Hard level takes about the effort of clearing two Hard levels, or three or four Medium ones, or six Easy ones. That holds whichever game you're in and whatever its currency is called.

## The problem this solves

Before November 2026 every game had fixed prices: a hint cost 15 washers, a spare bolt 40, a skip 120 points, whatever level you were on. Harder levels paid more, though, so help got 4 to 12 times cheaper as you moved up:

| Game | Item (old price) | Easy | Medium | Hard | Top tier |
|---|---|---|---|---|---|
| Nuts & Bolts | Spare bolt (40) | 1.7 levels | 0.9 | **0.5** | 0.3 |
| Unscrew | Drill (60) | 2.9 | 1.7 | 1.1 | 0.7 |
| Outbound | Skip (120) | **12** | 6 | 4 | **1.0** |

(Each cell is the price divided by what one level of that tier paid.)

So on Hard, one cleared level paid for a spare bolt with washers left over, and help cost no effort at all. On Outbound's Easy tier it was the opposite: a skip took twelve levels, and new players started with nothing. A fixed price can't be right on every tier.

## The rules

All of them live in [`shared/js/economy.js`](../shared/js/economy.js). Each currency game keeps its own numbers in `games/<name>/economy.js`, and `npm test` (`tests/economy.mjs`) checks those numbers against the rules.

### 1. Each tier has a reward, and everything is measured against it

`reward(tier)` is what a **first clear with 3 stars** pays on that tier. It should follow how long a level of that tier takes:

- in a four-tier game, about ×1.6–1.9 per step (Nuts & Bolts: 24 → 45 → 75 → 120);
- in a game with more tiers, the steps are smaller (Outbound's seven flat tiers go 10 → 120 in steps of ×1.3–2).

The test allows ×1.25 to ×2.1 per step.

### 2. Stars pay, and only new stars pay

A clear pays `reward × stars / 3`: two thirds for 2 stars. Replaying a level pays only for the stars you didn't have yet, so a level you've already perfected pays nothing. That stops farming easy levels, and it means coins always stand for effort you haven't spent before.

A skipped level (Outbound) counts as 1 star and pays nothing.

### 3. Help costs a star

Any help, free or paid, takes one star off that level: a hint, a spare bolt, a probe, a drill, an extra heart. A helped level can never get 3 stars. This is on purpose:

- you can always get unstuck and keep going;
- a completionist has a reason to come back and do it without help, and the third star pays the last third of the reward when they do.

Each game can take a star for its own reasons as well (going over par in Nuts & Bolts, running out of time bonus in Unscrew), but help always takes one. `Economy.helped(stars, usedHelp)` does the sum.

### 4. Help is priced in levels of the tier you're playing

| Kind | Costs | Examples | Repeated in the same level |
|---|---|---|---|
| **peek**: shows something, solves nothing | ½ level | Nuts & Bolts hint, Unscrew X-ray, Outbound probe | same price |
| **boost**: makes the level easier | 2 levels | spare bolt, drill, magnet, extra heart | doubles each time |
| **heavy**: removes part of the puzzle | 3 levels | hammer, chest | doubles each time |
| **skip**: leave the level unsolved | 5 levels | Outbound skip | same price; pays nothing |

`ECO.price(item, tier, nth)` gives the price, where `nth` is how many times the item was already used in this level. Prices are tidied: whole numbers below 20, multiples of 5 above.

The daily puzzle is priced at its own tier (Nuts & Bolts: Hard; Outbound: whatever the weekday's tier is).

### 5. Pay when you use it, never stock up

Help is paid at the moment it's used, at that level's price. There's no stock of hints or tools to buy ahead, because a stock would let you buy at Easy prices and use them on Expert. When Unscrew and Outbound moved to this, any stocked items were refunded at what they had cost.

### 6. The daily puzzle and streaks

A daily pays **twice** a normal level of its tier (again, two thirds for 2 stars). The first clear of the day adds **10% of that per day of streak after the first, up to +50%**. Missing a day only stops the bonus growing. Nothing is taken away (see [MISSION.md](../MISSION.md)).

### 7. Starting balance

A new player starts with **one boost at the anchor tier**, the "typical" tier (Medium or Normal). That's enough to get unstuck once before they've earned anything.

### 8. Cosmetics and permanent unlocks have fixed prices

Boards, finishes, skins and Outbound's lane trace aren't tied to being stuck, so they keep fixed prices. Today they cost between 3 and 20 Medium levels' pay (Nuts & Bolts 150–800 washers, Outbound skins 150–250 and lane trace 300 points). Keep new ones in that range.

### 9. Never for sale

Currency is earned by playing and only by playing. It can never be bought, doubled or topped up for money or an ad. That's [the mission](../MISSION.md); this document only decides how much of it things cost.

## The numbers per game

The tables below come from the `economy.js` files. If you change a number there, update the table too. Prices are for the first use in a level.

### Nuts & Bolts: washers ([`economy.js`](../games/nuts-and-bolts/economy.js))

| | Easy | Medium | Hard | Expert |
|---|---|---|---|---|
| 3-star clear pays | 24 | 45 | 75 | 120 |
| Hint (peek) | 12 | 25 | 40 | 60 |
| Spare bolt (boost), one per level | 50 | 90 | 150 | 240 |

The daily is a Hard level: 150 for 3 stars, plus 15 per streak day up to +75. Players start with 90. Stars: within par 3, help −1, more than 1.5× par another −1.

### Unscrew: coins ([`economy.js`](../games/unscrew/economy.js))

| | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| 3-star clear pays | 20 | 35 | 60 | 100 |
| X-ray (peek) | 10 | 18 | 30 | 50 |
| Drill, magnet (boost) | 40 | 70 | 120 | 200 |
| Hammer, chest (heavy) | 60 | 105 | 180 | 300 |

Stars per level: 3, −1 for any tool, −1 if the time bonus ran out. Stars are kept per mode, difficulty and level number. Every run starts at level 1, so levels you've already perfected pay nothing on the next run, and coins come from new levels or from improving old ones. Players start with 70.

### Outbound: points ([`economy.js`](../games/outbound/economy.js))

| Tier | Pays | Probe (peek) | Extra heart (boost) | Skip |
|---|---|---|---|---|
| Easy | 10 | 5 | 20 | 50 |
| Medium | 20 | 10 | 40 | 100 |
| Hard | 30 | 15 | 60 | 150 |
| Extra Hard | 45 | 25 | 90 | 225 |
| Insane | 65 | 35 | 130 | 325 |
| Master | 90 | 45 | 180 | 450 |
| Grandmaster | 120 | 60 | 240 | 600 |

Boxes (15–75) and Shapes (20–95) work the same way, see the file. The free hint (one per level) also costs a star. Outbound's own extra is that the first clear without losing a heart adds 25% of the tier's pay. Players start with 40.

Outbound works out the balance from the save every time (what you've earned minus what you've spent), so a change to these numbers changes old saves too. When the rules above came in, `Store.migrate()` worked out what each save was worth under the old formulas and kept any difference as `carry`, so no balance went down. **If you change Outbound's numbers again, do the same:** bump `ver` and carry the difference.

## Games without a currency

- **Graphite**: hints are free and unlimited, and they cost stars (3 with none, 2 with one or two, 1 with more). Its hints explain the logic, so they're part of learning the puzzles, and there's nothing to buy.
- **Jade Pavilion**: each tier gives a set number of hints and shuffles per level. An extra shuffle costs score, not currency.
- **Camper Crew**: no help to buy.

All three already follow rule 3 in spirit (help shows in your result). If one of them ever gets a currency, give it an `economy.js` and follow this document.

## Wallbreaker: its own economy

Wallbreaker (credits) follows its own plan rather than this document: fixed prices for boosts, Workshop upgrades and cosmetics, and pay per level from `10 + 2 × √level`. It has no help to buy and no tiers, so "levels of the tier" doesn't fit. Its numbers live in `games/wallbreaker/src/config.js` and are tested by `tests/wallbreaker/rules.test.mjs`; the reasons, and the two places it differs from the rules above (boosts are bought ahead; a 3-star replay pays 50%), are in [WALLBREAKER.md](WALLBREAKER.md#where-wallbreaker-differs-from-docseconomymd). Rule 9 holds as everywhere: credits can never be bought.

## Coin Dozer: its own economy

Coin Dozer has two currencies, both earned only by playing: **coins** (the bank you play with; an empty bank with nothing falling gets 10 coins at once, always) and **credits** (from prizes and one-time milestones, spent on four Workshop upgrades and three machine themes, at fixed prices). It has no help to buy and no tiers, so like Wallbreaker it keeps its numbers in `games/coin-dozer/src/config.js`, tested by `tests/coin-dozer/rules.test.mjs`. Upgrade costs (40–240) and theme prices (150–500) are starting values from the spec. Rule 9 holds: neither coins nor credits can be bought. See [COIN-DOZER.md](COIN-DOZER.md).

## Adding a currency to a game, or a new item

1. Create `games/<name>/economy.js` with `Economy.register("<name>", { rewards, anchor, items })`, and load it in `index.html` after `../../shared/js/economy.js` and before `game.js`.
2. Pay rewards with `ECO.levelPay(tier, stars, previousBest)` and `ECO.dailyPay(...)`, never a number of your own.
3. Charge help with `ECO.price(item, tier, usesThisLevel)` at the moment it's used, and take a star with `Economy.helped`.
4. Show the real price on the button, and in a shop say that prices follow the tier.
5. Run `node tests/economy.mjs`.
