# How to release

From `npm run build` to a game on Google Play and in the App Store. **Android comes first** (chapter 1). The iPhone (chapter 2) is on hold because of Apple's US$99 yearly fee, but its code fixes are worth doing anyway.

> Store rules change often. Facts below were checked in November 2026. When Play Console or App Store Connect looks different from this guide, the console is right.

## How to read the tables

Each chapter starts with one table: the whole release, step by step. The sections below the table explain each step in detail.

**Who?**

| Who | Meaning |
|---|---|
| **You** | Needs you: your computer, your phone, your accounts, your money, your decisions. |
| **Claude** | Can be done in a Claude Code session in this repository: code, texts, config files. Just ask. |
| **Testers** | Friends, family, colleagues with a phone. |
| **Google** / **Apple** | You wait for their review or approval. |

**State:** ✅ done · ⬜ to do · ⏸️ on hold

Update the *State* column when a step is done, and mention it in [HISTORY.md](../HISTORY.md). Code issues found along the way are on the backlog in [TODO.md](../TODO.md#release-issues).

---

# Chapter 1: Android (Google Play), priority 1

```
 dist/ ──npx cap sync android──▶ android/ ──Android Studio: Generate Signed App Bundle──▶ app-release.aab
                                                                                              │
     Play Console: internal test → closed test (12 testers, 14 days) → production ◀──────────┘
```

| # | Step | Who? | State | Remark |
|---|---|---|---|---|
| 1 | Games work offline, `dist/` build, automatic tests | Claude | ✅ | `npm run build`, `npm test` (fails on any internet request) |
| 2 | Android back button handled in code | Claude | ✅ | `shared/js/platform.js`. Starts working once `@capacitor/app` is installed (step 9). |
| 3 | English and Dutch in every game | Claude | ✅ | The store listing can be in both languages too |
| 4 | Create Google Play developer account | You | ⬜ | US$25 once, plus ID verification that can take a few days. **Start early.** |
| 5 | Find 12 testers | You | ⬜ | Needed for the 14-day closed test (step 18). **Start now.** Each needs an Android phone and a Google account. |
| 6 | Choose the app ID | You | ⬜ | **Permanent** after the first upload. Suggestion: `io.github.pakspul.arcade` |
| 7 | Choose the app name | You | ⬜ | Can change later; see [NAMING.md](NAMING.md). No *free*, *no ads*, *best* in the title or icon. |
| 8 | Install Node.js 22+ and Android Studio | You | ⬜ | On your own computer. Claude's cloud machine has no Android Studio. |
| 9 | Add Capacitor and the `android/` project | Claude | ⬜ | Needs the app ID (step 6). Commands below. |
| 10 | Final icon and splash screen | You + Claude | ⬜ | You design (or pick) it; Claude generates all sizes. Now a placeholder SVG. |
| 11 | Privacy policy up to date and online | Claude + You | ⬜ | Claude updates the text (it misses Graphite, see backlog); you make it public (public repo or GitHub Pages). |
| 12 | Debug build on your own phone + checklist | You | ⬜ | Report bugs to Claude via [TODO.md](../TODO.md#bugs--notes) |
| 13 | Create the signing key and **back it up** | You | ⬜ | Never commit it and never share it, also not with Claude |
| 14 | Store texts and screenshots | Claude + You | ⬜ | Claude drafts the texts (EN + NL) and can make 9:16 screenshots with the test browser; you check them |
| 15 | Create the app in Play Console + forms | You | ⬜ | Answers are in the table under step 15 below |
| 16 | Build the signed `.aab` | You | ⬜ | Raise `versionCode` for every upload |
| 17 | Internal test | You | ⬜ | Install from the Play Store, run the checklist |
| 18 | Closed test: 12 testers × 14 days | Testers + You | ⬜ | Keep uploading fixes during the 14 days |
| 19 | Apply for production | You → Google | ⬜ | Google asks what testers said and what you changed. Approval takes days. |
| 20 | Production release 🎉 | You → Google | ⬜ | Google reviews; then it's live |

The detailed walkthrough, with the full testing ladder and background, is in **[ANDROID.md](ANDROID.md)**. Below is the short version per step.

### Steps 4–5: account and testers (start these first)

They take the longest, and you can do everything else while you wait.

- Register at https://play.google.com/console. A personal account is fine. When asked for your **EU trader status** (Digital Services Act): a free hobby app without income usually means *not a trader*. A trader's address and phone number are shown publicly, so read Google's explanation if you're unsure.
- New personal accounts must run a **closed test with at least 12 testers who stay opted in for 14 days in a row** before production. Ask people now, so they're ready when the first build is.

### Steps 6–7: app ID and name

The app ID (e.g. `io.github.pakspul.arcade`) can never change after the first upload. Use the same one for the iPhone later. The name can still change; "Honest Arcade" is fine for testing.

### Step 8: tools

- **Node.js 22 LTS or newer**: https://nodejs.org
- **Android Studio** (current stable): https://developer.android.com/studio. Open it once and let it download the SDK.

### Step 9: add Capacitor

```bash
npm install @capacitor/core @capacitor/app @capacitor/haptics
npm install -D @capacitor/cli
npx cap init "Honest Arcade" io.github.pakspul.arcade --web-dir dist
npm install @capacitor/android
npm run build
npx cap add android
```

Commit `capacitor.config.json` and the `android/` folder. `@capacitor/app` makes the back button work, `@capacitor/haptics` gives better vibration.

### Step 10: icon and splash

```bash
npm install -D @capacitor/assets
# assets/icon-only.png (1024×1024, no transparency, square corners) and assets/splash.png (2732×2732)
npx capacitor-assets generate --android
```

### Step 11: privacy policy

[PRIVACY.md](../PRIVACY.md) must be reachable at a public URL: on GitHub (the repository must be public) or via GitHub Pages / Azure. It must name every game in the app.

### Step 12: test on your own phone

1. Phone: *Settings → About phone →* tap **Build number** 7 times, then *Developer options →* **USB debugging** on. Connect with USB.
2. `npm run build && npx cap sync android && npx cap run android`
3. Errors: open `chrome://inspect` in Chrome on your computer.
4. Run the [manual test checklist](ANDROID.md#manual-test-checklist-before-every-store-upload): back button, kill and reopen, airplane mode, install over the previous version, a cheap phone.

### Step 13: signing key

Android Studio → *Build → Generate Signed App Bundle or APK → Android App Bundle → Create new…* keystore. Store the `.jks` file **and** its passwords outside the repository (password manager + an offline copy). Google keeps the real signing key (*Play App Signing*); yours is the upload key. Losing it means a slow reset through Google support.

### Step 14: store texts and screenshots

Short description (80 characters), full description with the mission, 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots in 9:16. Add a Dutch translation of the listing as well.

### Step 15: create the app in Play Console

*Create app* → name, default language, **Game**, **Free** (free is permanent, which fits the mission). Then *Dashboard → Set up your app*:

| Section | Answer |
|---|---|
| Privacy policy | The public URL from step 11 |
| Ads | **No, my app does not contain ads** |
| App access | All functionality is available without special access |
| Content rating | IARC questionnaire: puzzle games, no violence → Everyone / PEGI 3 |
| Target audience | 13+ is simplest for a first release (under 13 brings in the Families policy) |
| Data safety | **No data collected, no data shared** |
| Store listing | The texts and images from step 14 |

### Step 16: build the bundle

```bash
npm test
npm run build && npx cap sync android
```

In `android/app/build.gradle`, raise **`versionCode`** (1, 2, 3…) and set **`versionName`** (`"0.1.0"`). Then Android Studio → *Build → Generate Signed App Bundle → release* → `android/app/release/app-release.aab`.

New apps and updates must target **Android 16 (API 36)** since 31 August 2026. Keep Capacitor up to date; Play Console tells you when the target is too low.

### Steps 17–20: test tracks, then production

1. **Internal testing:** upload the `.aab`, add yourself, install from the Play Store, run the checklist.
2. **Closed testing:** promote the build, add your 12+ testers, share the opt-in link.
3. After 14 days: *Dashboard → Apply for production*.
4. **Production release** → Google's review → live.

### Updates later

```
change code → npm test → npm run build && npx cap sync android
→ raise versionCode (and versionName) → Generate Signed App Bundle
→ internal testing → check → promote to production, release notes from HISTORY.md
```

Troubleshooting: [ANDROID.md](ANDROID.md#troubleshooting).

---

# Chapter 2: iPhone (App Store), on hold

## How hard is it?

**The coding is not hard, but you need a Mac, a yearly fee and a few code fixes first.** Capacitor wraps the same `dist/` in an iPhone app; no rewrite.

| | iPhone | Android |
|---|---|---|
| Computer | **A Mac with Xcode** (or a rented cloud Mac) | Any computer |
| Cost | **US$99 per year** (€99 incl. VAT). The app leaves the store when you stop paying. | US$25 once |
| Code fixes first | **Yes**, steps 1–3 below | None |
| Testing before release | TestFlight, no minimum | 12 testers × 14 days |
| Review | Every version, by a person, usually 1–2 days | First release; updates usually faster |
| Seller name (individual account) | Your **legal name** | Developer name of your choice |

Until then, iPhone users can already play: open the GitHub Pages or Azure link in Safari → *Share → Add to Home Screen*. It runs full-screen and offline, like an app, and costs nothing.

```
 dist/ ──npx cap sync ios──▶ ios/ (Xcode, on a Mac) ──Archive → Distribute──▶ App Store Connect
                                                                                    │
                       TestFlight (you + testers) → submit for review → App Store ◀─┘
```

| # | Step | Who? | State | Remark |
|---|---|---|---|---|
| 0 | Free alternative: play from the home screen | You | ⬜ | Works once GitHub Pages or Azure is live (see [TODO.md](../TODO.md)) |
| 1 | "Back to arcade" button in four games | Claude | ⬜ | **Required by Apple.** Backlog item 1. Also nice on Android. |
| 2 | Outbound vibration via `Platform.haptic()` | Claude | ⬜ | Backlog item 2 |
| 3 | Saves that iOS can't clear | Claude | ⬜ | Backlog item 3 |
| 4 | Get a Mac with current Xcode | You | ⏸️ | Buy, borrow or rent; see below |
| 5 | Join the Apple Developer Program | You | ⏸️ | **US$99 per year.** This is the decision that's on hold. |
| 6 | Add iOS to the project | You (on the Mac) | ⏸️ | `npx cap add ios`; commit `ios/` |
| 7 | Xcode settings, icon, privacy manifest | You + Claude | ⏸️ | Claude can edit the config files once `ios/` exists; signing is you |
| 8 | Test on your own iPhone | You | ⏸️ | Safari's Develop menu replaces `chrome://inspect` |
| 9 | Create the app in App Store Connect + forms | You | ⏸️ | Answers in the tables below |
| 10 | Store texts and screenshots | Claude + You | ⏸️ | Mostly reused from Android step 14; different sizes |
| 11 | Archive and upload | You (on the Mac) | ⏸️ | Raise the **Build** number every upload |
| 12 | TestFlight | You + Testers | ⏸️ | No minimum testers or days |
| 13 | Submit for review | You → Apple | ⏸️ | Usually 24–48 hours |
| 14 | Release 🎉 | You | ⏸️ | Choose *manual release* for the first version |

Steps 1–3 cost nothing and make the Android app better too, so they don't need to wait for the decision on steps 4–5.

### Step 1: a way back to the hub in every game

iPhones have no back button, and the app has no browser bar. A player who opens Jade Pavilion, Nuts & Bolts, Outbound or Unscrew is **stuck in it** until they kill the app; Apple rejects apps like that. Graphite and Camper Crew already call `Platform.home()`.

### Step 2: vibration

Safari on iOS has no `navigator.vibrate`. Outbound calls it directly; `Platform.haptic()` uses the native Haptics plugin in the app and falls back to `navigator.vibrate` in the browser.

### Step 3: saves that iOS can't clear

Every game saves to `localStorage`. In an iOS app, iOS can clear that when the phone runs low on space, and players lose their progress. The fix: mirror every `localStorage` write to `@capacitor/preferences` in `shared/js/platform.js`, and restore missing keys from there when the app starts. The games themselves don't change.

### Step 4: a Mac

| Option | Notes |
|---|---|
| Buy or borrow a Mac | A second-hand Apple Silicon (M1 or newer) Mac mini is plenty. The most comfortable route. |
| Rent a cloud Mac (e.g. MacinCloud, Scaleway) | Pay per hour or month, use it via remote desktop. Fine for a few release sessions. |
| Build in the cloud (GitHub Actions macOS + fastlane, Codemagic) | No Mac at all, but signing setup is fiddly. A good step *after* a first release. |

Apple requires uploads built with a recent Xcode, so the Mac must run a current macOS. You also need an iPhone to test on.

### Step 5: Apple Developer Program

Turn on two-factor authentication for your Apple Account, then enrol as an **individual** in the Apple Developer app on your iPhone (fastest) or at https://developer.apple.com/programs/enroll/. For a free app, no tax or bank details are needed. (A company name instead of your legal name needs a registered business and a D-U-N-S number.)

*Only for your own phone, no fee:* a free Apple Account can install the app from Xcode on your own iPhone, but it expires after 7 days. No TestFlight, no App Store.

### Step 6: add iOS (on the Mac)

```bash
npm install @capacitor/ios @capacitor/preferences
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Commit the `ios/` folder. If `npx cap add ios` asks for CocoaPods, install it with `brew install cocoapods` and run it again.

### Step 7: Xcode settings, icon, privacy manifest

Select the **App** target:

| Tab | Setting |
|---|---|
| General → Identity | Display Name; **Bundle Identifier** = the Android app ID; Version `0.1.0`, Build `1` |
| General → Deployment Info | iPhone (iPad optional: then also iPad screenshots); orientations; **Requires full screen** |
| Signing & Capabilities | **Automatically manage signing**, pick your Team |
| Info | **App Uses Non-Exempt Encryption** = `NO` |

- Icon and splash: `npx capacitor-assets generate --ios`
- Privacy manifest (`PrivacyInfo.xcprivacy`): declare `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` (Preferences uses it), no tracking, no collected data.

### Step 8: test on your own iPhone

1. Connect with a cable, tap **Trust**. Turn on *Settings → Privacy & Security → Developer Mode*.
2. Xcode: choose your iPhone, press **▶** (or `npx cap run ios`).
3. Errors: iPhone *Settings → Apps → Safari → Advanced → Web Inspector* on; Mac Safari → *Develop* → your iPhone → the app.
4. Run the [manual test checklist](ANDROID.md#manual-test-checklist-before-every-store-upload), with "Back to arcade" instead of the back button. Also check: sound after returning from the background (tap once), the ring/silent switch, the notch and home indicator in portrait and landscape, puzzle generation in Graphite and Nuts & Bolts (Web Workers), and no copy menu when long-pressing a tile.

### Step 9: App Store Connect

https://appstoreconnect.apple.com → **Apps → + → New App**: platform iOS, name (max 30 characters, **unique on the whole App Store**), language, bundle ID, any SKU.

| Section | Answer |
|---|---|
| App Information | Category **Games**, sub-category **Puzzle**. Content rights: yes, you own or license everything (three.js MIT, fonts OFL). |
| Age rating | No violence, gambling, user content, web access or ads → lowest rating |
| Pricing and Availability | **Free**, all countries |
| App Privacy | Privacy policy URL; **"No, we do not collect data"** → *Data Not Collected* |
| Business → Digital Services Act | Trader status (same answer as on Google Play); otherwise no EU availability |
| App Review Information | *"No login needed. All games work offline. No ads, no in-app purchases, no data collection."* |

Apple also requires a **support URL** (the GitHub Issues page is enough). No prices or *free* in the name, subtitle or icon.

### Step 10: store texts and screenshots

Reuse the Android texts. Apple-specific: subtitle (30 characters), promotional text (170, changeable without review), keywords (100 characters). Screenshots: at least the **6.9-inch iPhone** size (1320×2868 or 1290×2796), easiest from the simulator with ⌘S.

### Steps 11–14: upload, TestFlight, review, release

1. `npm test && npm run build && npx cap sync ios`
2. Xcode: raise **Build**, destination **Any iOS Device (arm64)**, **Product → Archive → Distribute App → App Store Connect**.
3. After 10–30 minutes the build is in **TestFlight**. Internal testers (up to 100 team members) get it immediately; external testers (up to 10,000, by email or public link) after a short beta review.
4. Version page → pick the build → **Add for Review → Submit**. Usually 24–48 hours.
5. Approved → **Release This Version**.

If it's rejected, you get the guideline number:

| Guideline | Meaning here | Fix |
|---|---|---|
| 4.0 Design | A screen with no way out | Step 1 |
| 4.2 Minimum Functionality | "Just a website in an app" | Reply that everything ships inside the app and works offline |
| 2.1 App Completeness | Something broke for the reviewer, often on iPad | Test on an iPad or simulator, new build |
| 2.3 Accurate Metadata | Screenshots or text don't match, or price words in the name | Update the listing |
| 4.3 Spam | Many near-identical apps | One collection app, not five single-game apps |

### iPhone troubleshooting

| Symptom | Fix |
|---|---|
| Change not visible in the app | `npm run build && npx cap sync ios`, run again |
| White screen | Safari → Develop → your iPhone → the app → console |
| No signing certificate | *Xcode → Settings → Accounts* → add your Apple Account, pick the Team |
| Upload: "bundle version must be higher" | Raise **Build** |
| Upload: "built with an older SDK" | Update Xcode (and macOS) |
| No sound | Ring/silent switch; tap once in the game |
