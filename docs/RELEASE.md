# How to release

From `npm run build` to a game in the App Store and on Google Play. Chapter 1 covers the **iPhone**, chapter 2 covers **Android**. Both start from the same `dist/` folder and the same Capacitor project, so whatever you do for one platform carries over to the other.

> Store rules change often. Facts below were checked in November 2026. When App Store Connect or Play Console looks different from this guide, the console is right.

## How hard is the iPhone release?

**Technically: not hard. Practically: it needs a Mac, a yearly fee and a few code fixes first.**

The games are plain HTML, CSS and JavaScript that already run offline in Safari on an iPhone. [Capacitor](https://capacitorjs.com) wraps the same `dist/` folder in a native iOS app, exactly as it does for Android. There's no rewrite, and most of the code doesn't change at all.

What makes it more work than Android:

| | iPhone | Android |
|---|---|---|
| Computer | **A Mac with Xcode is required** to build and upload (or a rented cloud Mac) | Any Windows, Mac or Linux computer |
| Cost | **US$99 per year** (€99 incl. VAT in the Netherlands). The app disappears from the store if you stop paying. | US$25 once |
| Code fixes before release | **Yes:** four games have no way back to the hub (iOS has no back button), Outbound's vibration doesn't work on iOS, and saved progress should move to safer storage | Nothing required |
| Testing before release | TestFlight, no minimum. You can release as soon as you're happy. | New personal accounts: **12 testers for 14 days** in a closed test before production |
| Review | Every version is reviewed by a person, usually within 1–2 days | First release reviewed, updates usually faster |
| Your name in the store | Individual account: your **legal name** is shown as the seller | Developer name of your choice |

**Effort estimate** for someone who has done the Android release first:

- Code fixes (chapter 1, step 1): one or two evenings.
- Mac, Xcode, account, first build on your own iPhone: one evening, plus waiting for Apple to approve the account (often the same day, sometimes a few days).
- Store listing, screenshots, forms, upload, review: one or two evenings, plus 1–2 days of review.

So roughly a week of evenings, and no 14-day wait. If you don't own a Mac, budget for one (a second-hand Apple Silicon Mac mini is the cheapest good option) or for a cloud Mac service.

---

## Before either release: shared preparation

Do these once. They apply to both stores.

- [ ] **App ID / bundle ID** chosen, e.g. `io.github.pakspul.arcade`. Use the **same ID on both platforms**. It can never change after the first upload, so keep it name-neutral (see [NAMING.md](NAMING.md)).
- [ ] **App name** chosen. Neither store allows promotional words such as *free*, *no ads*, *best* or *#1* in the name or icon. Put the mission in the description.
- [ ] **Capacitor added** to the project (see [ANDROID.md, part 2](ANDROID.md#part-2-one-time-setup)). The `capacitor.config.json` is shared by Android and iOS.
- [ ] **Final icon:** a 1024×1024 PNG without transparency and without rounded corners (both stores round it for you).
- [ ] **Privacy policy online** at a public URL: [PRIVACY.md](../PRIVACY.md) on GitHub (public repository) or on GitHub Pages / Azure. Update it so it names every game in the app and both the Android and iPhone app.
- [ ] **Support URL:** Apple requires one. The GitHub repository's *Issues* page, or a short page on GitHub Pages, is enough.
- [ ] **Version number** in `package.json` matches what you'll put in the stores (e.g. `0.1.0`).
- [ ] `npm test` is green and you've played every game on a real phone.
- [ ] **EU trader status (DSA).** Both stores ask whether you're a *trader* under the EU Digital Services Act before your app can be shown in EU countries. A free hobby app without income usually means *not a trader*; if you're unsure, read the store's explanation, because a trader's address and phone number are shown publicly.

---

# Chapter 1: iPhone (App Store)

## The big picture

```
 games/ + shared/ + index.html        your code
            │  npm run build
            ▼
          dist/                        the exact files players get
            │  npx cap sync ios
            ▼
          ios/                         an Xcode project that wraps dist/ (on a Mac)
            │  Xcode: Product → Archive → Distribute App
            ▼
     App Store Connect                 upload lands here
            │
            ▼
   TestFlight (you + testers) → submit for review → App Store
```

## Step 1: fix what iOS needs (on any computer)

Do these first. They're good for Android and the browser too, and they're the reasons Apple would reject the app or players would lose progress.

### 1a. A way back to the hub in every game (required)

iPhones have no back button. Inside the app there's also no browser bar, so a player who opens a game is **stuck in it** until they kill the app. Apple rejects apps like that.

Today only Graphite and Camper Crew call `Platform.home()`. Add a "Back to arcade" button to the menu of:

- [ ] Jade Pavilion (`games/jade-pavilion/game.js`)
- [ ] Nuts & Bolts (`games/nuts-and-bolts/game.js`)
- [ ] Outbound (`games/outbound/game.js`)
- [ ] Unscrew (`games/unscrew/game.js`)

Style it the way each game styles its other buttons, add the label to its `strings.js` in English and Dutch, and call `Platform.home()` on tap. This item is already on [TODO.md](../TODO.md).

(Not needed for a standalone single-game app built with `npm run build -- --game <name>`: there is no hub to go back to.)

### 1b. Vibration through the platform layer

Safari on iOS has no `navigator.vibrate`. Outbound calls it directly (`games/outbound/game.js`, search for `navigator.vibrate`). Replace that call with `Platform.haptic(60)`, which uses the native Haptics plugin inside the app and falls back to `navigator.vibrate` in the browser. Install the plugin in step 3.

### 1c. Saved progress that iOS won't delete (strongly recommended)

Every game saves to `localStorage`. Inside an iOS app, that storage lives in the WebView's data folder, and iOS can clear it when the device runs low on space. Players would lose all their stars and levels without warning.

The fix is `@capacitor/preferences`, which stores data in native iOS storage (`UserDefaults`) that isn't cleared. Because the games read their saves synchronously at start-up, the least invasive approach is a *mirror* in `shared/js/platform.js`:

1. When the app starts (on the hub), read all keys from Preferences and write any missing ones back into `localStorage`.
2. Wrap `localStorage.setItem` / `removeItem` so every write also goes to Preferences.

That way the games don't change at all. Test it by playing a level, deleting the WebView data (or reinstalling over a debug build that clears it) and checking that progress comes back. See [ARCHITECTURE.md](ARCHITECTURE.md) for where `Platform.storage` fits in.

### 1d. Things to check once it runs on an iPhone

These already look right in the code, but are classic iOS surprises:

- **Sound:** iOS only starts audio after a tap, and mutes Web Audio when the ring/silent switch is on silent (that's fine for a puzzle game). After returning from the background, the first tap should bring sound back.
- **Safe areas:** every page uses `viewport-fit=cover` and `env(safe-area-inset-*)`, so the notch, Dynamic Island and home indicator should be clear. Check landscape too.
- **Web Workers:** Graphite (`worker.js`) and Nuts & Bolts (a worker built from a Blob) generate puzzles in workers. Confirm they work in the app.
- **Long-press:** holding a finger on a tile should not pop up a text-selection or "copy" menu.
- **Bounce:** if the whole page rubber-bands when you drag, set `"ios": { "scrollEnabled": false }` in `capacitor.config.json` (scrollable panels inside the games keep scrolling).

## Step 2: Mac, Xcode and Apple account

### The Mac

You need macOS with the **current Xcode** from the Mac App Store. Apple requires uploads to be built with a recent iOS SDK, so an old Mac that can't run the current macOS won't do.

No Mac? Options, from simplest to most work:

| Option | Notes |
|---|---|
| Borrow or buy a Mac | A second-hand Apple Silicon (M1 or newer) Mac mini is plenty. The most comfortable route by far. |
| Rent a cloud Mac (e.g. MacinCloud, Scaleway Mac mini) | Pay per hour or month, use it through remote desktop. Fine for a few release sessions. |
| Build in the cloud (GitHub Actions macOS runner with fastlane, Codemagic, Ionic Appflow) | No Mac at all, but signing setup is fiddly, and you still want a Mac once for the first run. A good step *after* the first release. |

You also need an **iPhone** to test on. The Xcode simulator is useful, but WebGL performance, touch and sound only feel real on a device.

### The Apple Developer Program

1. Make sure your Apple Account has two-factor authentication on.
2. Enrol as an **individual** in the **Apple Developer app** on your iPhone (fastest: it scans your ID) or at https://developer.apple.com/programs/enroll/.
3. Pay **US$99 / €99 per year**.

Individual vs. organisation: as an individual, your **legal name** appears as the seller on the store page. To show a company name instead, you need a registered business (e.g. a KvK registration) and a free D-U-N-S number, and enrol as an organisation. For a first hobby release, individual is fine; you can migrate later.

For a **free app** you don't need to fill in tax or banking details. The Free Apps Agreement is accepted automatically.

*Just want it on your own iPhone, without paying?* A free Apple Account can install your app from Xcode on your own phone, but the install expires after 7 days and you can't use TestFlight or the App Store.

## Step 3: add iOS to the Capacitor project (on the Mac)

```bash
git clone <this repository> && cd GameDev
npm install
npm install @capacitor/ios @capacitor/preferences   # @capacitor/haptics and @capacitor/app are already in from the Android setup
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios          # opens Xcode
```

This creates an `ios/` folder. **Commit it** (the `.gitignore` already excludes its build output). Recent Capacitor versions use Swift Package Manager for iOS; if `npx cap add ios` asks for CocoaPods instead, install it with `brew install cocoapods` and run the command again.

In Xcode, select the **App** target:

| Tab | Setting |
|---|---|
| General → Identity | **Display Name**: the name under the icon. **Bundle Identifier**: the same app ID as Android. **Version** `0.1.0`, **Build** `1`. |
| General → Deployment Info | iPhone (and iPad if you want it, see below). Orientations: what your games support. Tick **Requires full screen**. |
| Signing & Capabilities | Tick **Automatically manage signing**, pick your **Team** (your developer account). Xcode creates the certificates and registers the bundle ID for you. |
| Info | Add **App Uses Non-Exempt Encryption** = `NO` (the games use no encryption). Saves you a question on every upload. |

**iPhone only, or iPad too?** iPhone only is simpler: you don't need iPad screenshots. The app still runs on iPads in a phone-sized window, and Apple's reviewers sometimes test on an iPad, so make sure that looks acceptable. Supporting iPad properly means testing every game at tablet size and adding 13-inch iPad screenshots.

**Icon and splash screen:**

```bash
npx capacitor-assets generate --ios     # uses assets/icon-only.png and assets/splash.png, like Android
```

**Privacy manifest:** Apple requires apps to declare why they use certain system APIs. Capacitor ships a `PrivacyInfo.xcprivacy`; open it in Xcode and make sure `NSPrivacyAccessedAPICategoryUserDefaults` is declared with reason `CA92.1` (needed because Preferences uses `UserDefaults`). Declare no tracking and no collected data types.

## Step 4: test on your own iPhone

1. Connect the iPhone with a cable, tap **Trust** on the phone.
2. On the iPhone: *Settings → Privacy & Security → Developer Mode* → on (it appears after Xcode first sees the phone), restart.
3. In Xcode, choose your iPhone at the top and press **▶**. Or from the terminal: `npx cap run ios`.

**Live reload** while developing, just like Android:

```bash
npm run dev                                                # terminal 1
npx cap run ios -l --host 192.168.1.23 --port 8080        # terminal 2: your Mac's IP
```

**See errors (the iOS version of `chrome://inspect`):**

1. iPhone: *Settings → Apps → Safari → Advanced → Web Inspector* → on.
2. Mac: Safari → *Settings → Advanced → Show features for web developers*.
3. Safari's **Develop** menu → your iPhone → the app. You get the console, network and performance tools.

Run the [manual test checklist from the Android guide](ANDROID.md#manual-test-checklist-before-every-store-upload), replacing the back-button item with:

- [ ] In every game, the menu's "Back to arcade" button returns to the hub.
- [ ] Swipe up to the home screen mid-level, open another app, come back: no crash, the game continues, sound comes back after a tap.
- [ ] Ring/silent switch on silent; Low Power Mode on.
- [ ] Larger text (*Settings → Display & Brightness → Text Size*): UI still fits.
- [ ] Progress survives: kill the app, reopen; install a new build over the old one.

## Step 5: create the app in App Store Connect

Go to https://appstoreconnect.apple.com → **Apps → + → New App**.

| Field | What to enter |
|---|---|
| Platform | iOS |
| Name | The store name (max 30 characters, **must be unique on the whole App Store**; check early) |
| Primary language | English (add Dutch as a localisation later in the listing) |
| Bundle ID | Pick the one Xcode registered |
| SKU | Anything for your own bookkeeping, e.g. `arcade-001` |
| User access | Full access |

Then fill in the sections in the left sidebar:

| Section | What to answer |
|---|---|
| **App Information** | Category **Games**, sub-categories **Puzzle** (and e.g. **Board**). Content rights: you have the rights to all content (your own code; three.js is MIT and the fonts are OFL). |
| **Age rating** | Answer the questionnaire honestly: no violence, no gambling, no user-generated content, no web access, no ads. A collection of puzzle games ends up at the lowest age rating. (Camper Crew isn't in production builds; re-check the answers when it ships.) |
| **Pricing and Availability** | Price: **Free**. Availability: all countries, or start with a few. |
| **App Privacy** | Privacy policy URL. Data collection: **"No, we do not collect data from this app."** The store page then shows **Data Not Collected**. |
| **Business → Digital Services Act** | Your trader status (see shared preparation). Without it, the app isn't shown in the EU. |

On the version page (**iOS App → 0.1.0 Prepare for Submission**):

| Item | Notes |
|---|---|
| Screenshots | At least the **6.9-inch iPhone** size (1320×2868 or 1290×2796 portrait). Up to 10 per language. Take them in the simulator (*iPhone 17 Pro Max* or similar, ⌘S) so they have the exact size. Add **13-inch iPad** screenshots only if you support iPad. |
| Promotional text | 170 characters, can be changed any time without review. Good place for "No ads. No tracking. Ever." |
| Description | The mission, the list of games. Dutch description under the Dutch localisation. |
| Keywords | 100 characters, comma-separated, no spaces needed: `mahjong,sudoku,puzzle,logic,nuts,bolts,screw,arrow,offline,no ads` |
| Support URL / Marketing URL | Support is required, marketing optional |
| Copyright | `2026 Your Name` |
| Build | Added after step 6 |
| App Review Information | Your contact details. Notes: *"No account or login needed. All games work offline. No ads, no in-app purchases, no data collection."* |
| Version Release | *Manually release this version* for the first one, so you choose the moment. |

Like Google, Apple's guideline 2.3 doesn't allow prices or words like *free* in the app name, subtitle or icon. The **subtitle** (30 characters) is shown under the name in search: use it for what the app is, e.g. "Calm puzzle games".

## Step 6: build, upload, TestFlight

```bash
npm test
npm run build && npx cap sync ios
```

In Xcode:

1. Raise **Build** (General tab) for every upload: 1, 2, 3… Raise **Version** when players should see a new version.
2. Choose **Any iOS Device (arm64)** as the destination at the top.
3. **Product → Archive.** When it finishes, the Organizer window opens.
4. **Distribute App → App Store Connect → Distribute.** Xcode signs and uploads.

After 10–30 minutes the build appears in App Store Connect under **TestFlight** (you get an email when processing is done).

- **Internal testing:** add yourself (and up to 100 people who are users on your App Store Connect team). Install the **TestFlight** app on your iPhone and accept the invite. Builds are available immediately, no review.
- **External testing:** up to 10,000 testers by email or a **public link**. The first build of each version goes through a short beta review (often less than a day). Great for friends and family. There is no minimum number of testers or days.

Run the checklist again on the TestFlight build. This is the exact binary Apple will review.

## Step 7: submit for review and release

1. On the version page, under **Build**, pick the tested build.
2. **Add for Review → Submit.**
3. Review usually takes **24–48 hours**. You get emails at every status change.
4. Approved → press **Release This Version** (because you chose manual release). The app is live in the App Store within a few hours. 🎉

### If the review is rejected

You get a message in App Store Connect with the guideline number. Common ones for apps like this:

| Guideline | What it means here | Fix |
|---|---|---|
| 4.2 Minimum Functionality | "This is just a website in an app." | Unlikely here: everything ships inside the app and works offline. Reply in Resolution Center explaining that, and mention it in the review notes up front. |
| 2.1 App Completeness | Something crashed or didn't work for the reviewer, often on iPad | Test on an iPad (or simulator), fix, upload a new build |
| 4.0 Design | A screen with no way out | Step 1a |
| 2.3 Accurate Metadata | Screenshots or text don't match the app, or price words in the name | Update the listing; no new build needed |
| 4.3 Spam | Many near-identical apps | Ship **one** collection app, not five similar single-game apps |

You can reply to the reviewer, fix and resubmit as often as needed.

## Updates later

```
change code → npm test → npm run build && npx cap sync ios
→ Xcode: raise Build (and Version) → Archive → Distribute
→ TestFlight check → new version in App Store Connect → "What's New" text → submit
```

Every update is reviewed (usually faster than the first). Copy the "What's New" text from [HISTORY.md](../HISTORY.md). Keep Xcode and Capacitor up to date: Apple raises the minimum SDK for uploads every spring.

## iPhone troubleshooting

| Symptom | Fix |
|---|---|
| Change not visible in the app | `npm run build && npx cap sync ios`, then run again |
| White screen | Safari → Develop → your iPhone → the app → read the console |
| "Untrusted Developer" on the phone | Free Apple Account only: *Settings → General → VPN & Device Management* → trust your account |
| Xcode: "No signing certificate" / "No account for team" | *Xcode → Settings → Accounts* → add your Apple Account, then pick the Team under Signing & Capabilities |
| Upload rejected: "bundle version must be higher" | Raise **Build** |
| Upload rejected: "built with an older SDK" | Update Xcode (and macOS if needed) |
| Live reload doesn't connect | Same Wi-Fi? Allow "Local Network" access when the app asks on the iPhone |
| No sound | Ring/silent switch, then tap once in the game (iOS only starts audio after a tap) |

---

# Chapter 2: Android (Google Play)

The detailed walkthrough, with the full testing ladder and background, is in **[ANDROID.md](ANDROID.md)**. This chapter is the release checklist, in order.

## The big picture

```
 dist/ ──npx cap sync android──▶ android/ ──Android Studio: Generate Signed App Bundle──▶ app-release.aab
                                                                                              │
     Play Console: internal test → closed test (12 testers, 14 days) → production ◀──────────┘
```

## Step 1: tools and project (any computer)

- [ ] Install **Node.js 22+** and **Android Studio** (current stable). Open Android Studio once to download the SDK.
- [ ] Add Capacitor and the Android platform:

```bash
npm install @capacitor/core @capacitor/app @capacitor/haptics
npm install -D @capacitor/cli
npx cap init "Honest Arcade" io.github.yourname.arcade --web-dir dist
npm install @capacitor/android
npm run build
npx cap add android
```

- [ ] Commit `capacitor.config.json` and the `android/` folder.
- [ ] Icon and splash: `npx capacitor-assets generate --android`.

## Step 2: test on your own phone

- [ ] Turn on *Developer options* and *USB debugging* on the phone ([how](ANDROID.md#rung-3-see-your-phones-errors-on-your-computer-remote-debugging)).
- [ ] `npm run build && npx cap sync android && npx cap run android`
- [ ] Errors: `chrome://inspect` in Chrome on your computer.
- [ ] Go through the [manual test checklist](ANDROID.md#manual-test-checklist-before-every-store-upload): back button, kill and reopen, airplane mode, update over the previous version, cheap phone.

## Step 3: Google Play account (start early)

- [ ] Register at https://play.google.com/console: **US$25 once**, plus identity verification with an ID document (can take a few days).
- [ ] Personal account is fine. Fill in the **EU trader status** when asked.
- [ ] **Recruit 12 testers now.** New personal accounts must run a closed test with at least 12 testers who stay opted in for 14 days in a row. Friends, family and colleagues with Android phones, each with a Google account.

## Step 4: signing key and version

- [ ] Android Studio → *Build → Generate Signed App Bundle or APK → Android App Bundle → Create new…* keystore.
- [ ] **Back up the `.jks` file and its passwords** outside the repository (password manager + offline copy). Never commit it.
- [ ] In `android/app/build.gradle`: raise **`versionCode`** (1, 2, 3…) for every upload and set **`versionName`** (`"0.1.0"`).

## Step 5: build the bundle

```bash
npm test
npm run build && npx cap sync android
```

Android Studio → *Build → Generate Signed App Bundle → release* → `android/app/release/app-release.aab`.

Keep Capacitor up to date: new apps and updates must target **Android 16 (API 36)** since 31 August 2026. Play Console tells you when the target is too low.

## Step 6: create the app in Play Console

*Create app* → name, default language, **Game**, **Free** (free is permanent, which fits the mission). Then work through *Dashboard → Set up your app*:

| Section | Answer |
|---|---|
| Privacy policy | Public URL of `PRIVACY.md` |
| Ads | **No, my app does not contain ads** |
| App access | All functionality available without special access |
| Content rating | IARC questionnaire: puzzle games, no violence → Everyone / PEGI 3 |
| Target audience | 13+ is simplest for a first release (under 13 brings in the Families policy) |
| Data safety | **No data collected, no data shared** |
| Store listing | Short description (80 characters), full description with the mission, 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots (9:16) |

## Step 7: test tracks, then production

1. [ ] **Internal testing:** upload the `.aab`, add yourself and a few friends, install it from the Play Store, run the checklist.
2. [ ] **Closed testing:** promote the build, add your **12+ testers**, share the opt-in link. Keep uploading fixes during the 14 days; testers stay opted in.
3. [ ] After 14 days: *Dashboard → Apply for production*, answer the questions about your test (what testers said, what you changed). Approval usually takes a few days.
4. [ ] **Production release** → Google's review → live. 🎉

## Updates later

```
change code → npm test → npm run build && npx cap sync android
→ raise versionCode (and versionName) → Generate Signed App Bundle
→ upload to internal testing → check → promote to production with release notes
```

Release notes come straight from [HISTORY.md](../HISTORY.md). Troubleshooting is in [ANDROID.md](ANDROID.md#troubleshooting).

---

## Which first?

**Android first, iPhone right after** is still the best order for this project:

- It needs no Mac and costs less, and the Capacitor setup, icon, privacy policy and store texts carry straight over to iOS.
- Start the 14-day closed test on Android, and do the iOS code fixes (chapter 1, step 1) while you wait. They improve the Android app too.
- Once the Android app is in production, the iOS release is mostly Xcode, App Store Connect and one review.

Until then, iPhone users can already play: open the GitHub Pages or Azure link in Safari → *Share → Add to Home Screen*. It runs full-screen and offline, like an app.
