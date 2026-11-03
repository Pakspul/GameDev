# Naming the collection

**Status: undecided.** "Honest Arcade" is a working title. Notes to pick up later.

## How much time do we have?

Plenty. What is permanent and what isn't:

| Thing | Can it change later? | Decide before… |
|---|---|---|
| **App ID** (`io.github.pakspul.arcade`) | **Never**, once uploaded to Google Play | the first upload to Play Console (internal testing) |
| App name on the Play Store | Yes, with every store-listing update | going public (production), but ideally before the closed test so testers see the real name |
| Name on the home-screen icon | Yes, with an app update | the same |
| Developer name (shown under the app in the store) | Yes, in Play Console settings | creating the developer account |

**Tip: keep the app ID name-neutral**, for example `io.github.pakspul.arcade` or `io.github.pakspul.games`. Then the display name can change as often as we like, and the permanent part never has to.

## What the name has to do

- **Short.** The Play Store title allows at most 30 characters, and a home-screen icon shows about 12 before it gets cut off (that's the `short_name` in `manifest.webmanifest`).
- **Easy to say and spell** in both Dutch and English.
- **No promotional words.** Google Play does not allow *free*, *no ads*, *best*, *#1*, *top* or similar in the title or icon. The mission goes in the description and tagline, not the name.
- **Not someone else's.** Check before deciding:
  - Search the Play Store and App Store for the name
  - Trademarks: [BOIP](https://www.boip.int) (Benelux), [EUIPO](https://euipo.europa.eu/eSearch/) (EU), [WIPO Global Brand Database](https://branddb.wipo.int) (worldwide)
  - Is a domain or a GitHub name free, if we ever want a website?
- **Big enough for future games.** A name that only fits mahjong or only fits screws gets awkward once game five or six arrives.
- **Works as an icon.** Can the name, or one letter of it, become a recognisable icon?

## Directions to explore

None of these are checked for availability yet. They're a starting point.

**1. Say the mission (gently)**
- Honest Arcade *(current working title)*
- Open Arcade
- Plain Play
- Quiet Arcade
- No Strings Games
- Kind Games

**2. A place you visit** (a "pavilion" or "workshop" where the games live)
- Puzzle Pavilion: echoes Jade Pavilion
- Puzzle Workshop: fits Nuts & Bolts and Unscrew (bolts, screws, tools)
- Tinker Table
- Rainy Day Puzzles

**3. Dutch roots**
- Puzzelkist ("puzzle chest")
- Speelkwartier ("playtime" at school)
- Gewoon Spelen ("just play"): says the mission without a forbidden word

**4. A personal brand.** Use **Pakspul** (or another studio name) as the **developer name**, so the store shows "*\<app name\>* by Pakspul". Then the app name can be simple, and every future app carries the same brand.

## Shortlist (fill in when ready)

| Name | Short (≤ 12)? | NL + EN ok? | Play Store free? | Trademark free? | Domain/GitHub? | Gut feeling (1–5) |
|---|---|---|---|---|---|---|
| | | | | | | |

## Where the name currently appears

Change all of these when the name is decided:

- `index.html`: `<title>` and the `<h1>` on the hub
- `manifest.webmanifest`: `name` and `short_name`
- `package.json` / `package-lock.json`: `name` (lower-case with dashes)
- `README.md`: the heading
- `PRIVACY.md`: first paragraph
- `docs/ANDROID.md`: examples
- *Later:* `capacitor.config.json` (`appName`), `android/app/src/main/res/values/strings.xml` (`app_name`), and the Play Console store listing

## Decision log

| Date | Decision |
|---|---|
| 2026-11-03 | "Honest Arcade" used as a working title; final name postponed. |
