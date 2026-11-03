# Roadmap, tips and game ideas

## Next steps

The concrete, tickable list lives in **[TODO.md](../TODO.md)**, and what has been done per day is in **[HISTORY.md](../HISTORY.md)**. In short: play it on your phone, make the few permanent decisions (app ID, licence; the name can wait, see [NAMING.md](NAMING.md)), recruit 12 testers early, then follow the [Android guide](ANDROID.md).

## Tips

**Process**
- **Run `npm test` before every commit.** It takes seconds, and GitHub runs it again on every push. The screenshots are a quick visual diff between versions.
- **Small commits, one idea each.** Git is your undo button across days, not just minutes.
- **Write a few lines in [HISTORY.md](../HISTORY.md) at the end of each session.** Play Console asks "what's new" on every release, and you'll already have the answer.
- **Back up the signing key** the day you create it.
- **Bump the save version on purpose.** Each game stores progress under a versioned key (`unscrew.v2`, `jade-pavilion-v1`…). If you change level generation, migrate or bump deliberately; never break players' progress by accident.

**Design**
- **Watch someone else play without helping.** Five minutes of watching shows more than any amount of playing yourself.
- **Your games don't need a server, so keep it that way.** Levels come from seeds and the daily puzzle from the date (already how all four work), so there are no servers to pay for and nothing to shut down.
- **Feedback without tracking:** a "Send feedback" link (email or GitHub issue) in the hub instead of analytics.
- **Accessibility is a feature:** colour-blind players need more than colour. Nuts & Bolts already puts icons on nuts; consider the same for Unscrew's screws and boxes. Also respect "reduce motion" (most games already do) and large font sizes.
- **Battery:** stop the render loop when nothing moves or when the app is in the background. Mobile players notice a warm phone.

**Technical**
- Stay on three.js r128 for these four games (see [ARCHITECTURE.md](ARCHITECTURE.md)); start new games on modern three.js + Vite.
- New game? Copy the structure: `games/<slug>/index.html, style.css, levels.js, game.js, fonts/`, add a card to the hub, and `npm test` picks it up automatically.
- Fonts: put the Google Fonts URL in `games/<slug>/fonts/google-fonts.txt` and run `npm run fonts`.

## Game ideas

**Done: Graphite** (the logic grid collection): Sudoku, Takuzu, Star Battle and Calcudoku share one board, input, hint, undo, timer and daily engine. A new grid puzzle type is now mostly a generator in `games/graphite/levels/` plus a draw function. Candidates for the next types, all with free-to-use rules and generatable with exactly one solution:

| Puzzle | Note |
|---|---|
| **Nonograms (picross)** | Also on the list below. Fits Graphite's grid and line solver. |
| **Kakuro** | Sudoku's maths cousin; reuses Calcudoku's cage-tuple solver. |
| **Hashi (bridges)**, **Slitherlink**, **Nurikabe** | Nikoli classics. The rules are free, but check each name for trademarks before using it in the store. |
| **Killer Sudoku**, **Jigsaw Sudoku** | Sudoku variants: Calcudoku's cages, or irregular boxes from Star Battle's region grower. |

**Naming and copyright, in short:** game rules can't be copyrighted, so a puzzle our own generator makes is ours. Names can be trademarks: "Sudoku" is a Nikoli trademark in Japan (generic elsewhere), "KenKen" and LinkedIn's "Queens"/"Tango" are brand names, which is why Graphite says Calcudoku, Star Battle and Takuzu. Never copy puzzles from books, newspapers or other apps. Not legal advice; check before a store release.

**Later, more original: a whodunit logic grid.** Murdoku (a branded puzzle series of books and an app) made "place the suspects in the rooms, find the murderer" popular. The name, its puzzles, characters and art are off-limits, but the idea is free. Our own version would need its own name and setting, a clue generator plus a solver that checks the clues are enough for one answer, and some writing and art. It's a bigger, more creative project than another grid type.

### More ideas

Good candidates share three traits: **the store versions are notoriously ad-heavy** (so your version makes a point), **levels can be generated from a seed** (endless content, no server), and they **reuse what you already built**.

| Idea | Why it fits | Reuses |
|---|---|---|
| **Solitaire collection** (Klondike, FreeCell, Spider) | Probably the most ad-infested genre there is. Rules are centuries old and free to use. Seeded deals give a daily deal. | Card rendering like Jade's tiles; Jade's undo/hint flow |
| **Triple tile match** (pick tiles into a 7-slot tray, match three) | Huge, ad-heavy genre | Jade's 3D tile stack, faces and free-tile logic |
| **Sliding-car parking puzzle** (slide blocks to free the exit) | Same "free the right piece first" logic as Outbound, and just as ad-heavy in the stores | Outbound's solver approach; Unscrew's 3D toy look |
| **Minesweeper on 3D shapes** | Classic logic, fresh twist | Outbound's surface generator (cube and shape surfaces with neighbours) |
| **Pipe / flow connect** | Calm, generated, great on touch | Outbound's grid and path partitioning (`partition`, `step`) |
| **Water / ball sort** | A sibling of Nuts & Bolts | Nuts & Bolts' generator and solver almost one-to-one |
| **Nonograms (picross)**, also as a 3D carving variant | Endless generated puzzles, satisfying reveal | Seeded RNG, Unscrew's 3D object shapes as pictures |
| **Untangle** (drag points until no lines cross) | Pure touch, tiny code | Touch input and tweens |
| **Hexa stack sort** | Trending ad-heavy genre | Nuts & Bolts' stacking logic in a hex grid |
| **Word game in Dutch and English** | Few good ad-free Dutch word games exist | Needs open word lists; daily seed like the others |

**For the whole collection**
- A **"Today" row** on the hub: the daily puzzle of every game in one place, with a calm streak (the mission says streaks reward, never punish).
- A **"Continue"** button on the hub that resumes the last game played.
- An **offline stats page**: total levels cleared and time played, stored on the device only.
