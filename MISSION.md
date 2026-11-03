# Mission: games that are actually free

Open almost any "free" puzzle game on your phone and count. Finish a level: ad. Lose a level: ad. Want a hint: watch an ad. Some games show you more seconds of advertising than seconds of play. They aren't free. You pay with your time and your attention, and often with data you never agreed to share.

**This project does it the other way round.** These games are free because they are free. Nothing is held back, nothing interrupts you, and nobody makes money from you while you play.

## The promise

1. **No ads. Ever.** No banners, no interstitials, no "watch a video to continue", no "remove ads" purchase.
2. **No tracking.** No analytics, no advertising IDs, no third-party SDKs, no accounts. Your progress stays on your device.
3. **No pay-to-win.** Nothing in a game can be bought with real money. Coins, washers, points and other in-game rewards are earned by playing and only by playing.
4. **No dark patterns.** No energy bars or timers that stop you playing, no fake urgency, no guilt-trips, no begging for ratings. Streaks reward you for coming back. They never punish you for missing a day.
5. **Works offline, respects your phone.** Everything ships inside the app: no internet needed, no extra permissions, a small download, and as little battery use as possible.
6. **Open.** The source code is public, so anyone can check this promise, learn from it, or build on it.

## What this means when building

Every change to this repository is checked against the promise. Before merging, ask:

- [ ] Does it add a network request? (`npm test` fails if it does.) If it really needs one, it must be optional, explained, and contain no personal data.
- [ ] Does it add a library or SDK? Check that it doesn't phone home.
- [ ] Does it make the player wait, or nudge them to come back, for any reason other than fun?
- [ ] Could anything in it ever be sold? Then it doesn't belong in the game.

## Where the line is

| Fine | Never |
|---|---|
| In-game currency you earn by playing and spend on hints | Selling that currency, or "doubling" rewards for an ad or a payment |
| A daily puzzle with a streak counter | Losing your streak unless you pay or watch something |
| Lives or hearts *within one level* as a game mechanic | Lives that refill on a real-time timer |
| A link to the source code or a donation page **outside** the game (website, store description) | A donation or upgrade nag inside the game |
| Opt-in feedback ("send us an email", a GitHub issue) | Analytics "to improve the experience" |

## How it stays sustainable

This is a hobby project, made for the joy of making games and to show that it can be done. If it ever needs money (store fees, a domain), that money comes from optional, no-strings support offered *outside* the games, and supporting never unlocks anything. Everyone plays the same game.
