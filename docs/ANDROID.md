# From browser to Google Play (and later the App Store)

A step-by-step guide for a first Android release, with **testing at every step**. Read it top to bottom once; after that, use it as a checklist.

> Store rules change often. Facts below were checked in November 2026. When something in Play Console looks different, Play Console is right.

## The big picture

```
 games/ + shared/ + index.html        your code: plain HTML, CSS, JS
            │  npm run build
            ▼
          dist/                        the exact files players get
            │  npx cap sync
            ▼
         android/                      a real Android Studio project that wraps dist/
            │  Android Studio: "Generate Signed App Bundle"
            ▼
        app-release.aab                what you upload
            │
            ▼
   Play Console: internal test → closed test (12 testers, 14 days) → production
```

The tool that does the wrapping is **[Capacitor](https://capacitorjs.com)**. It puts the web game inside a native Android app (a full-screen WebView, which is Chrome under the hood). The files ship *inside* the app, so it works offline. The same project can later produce an iOS app too.

### Why Capacitor (and not something else)?

| Option | Verdict |
|---|---|
| **Capacitor** | ✅ Recommended. Files ship inside the app (offline), Android + iOS from one project, modern and maintained, easy access to native features (haptics, back button). |
| Trusted Web Activity (Bubblewrap / PWABuilder) | Lighter, but the app is really your *website* in Chrome: you need hosting forever, and iOS isn't covered. |
| Cordova | Capacitor's predecessor. Works, but it's legacy. |
| Rewrite in Unity/Godot | No. Your games are already built and work well on phones. |

### One app with all games, or one app per game?

**Start with one app (the collection).** Here's why:

- **Size is not a problem.** All four games together are about **1.4 MB** (three.js is 0.6 MB of that, and it's shared). With the Capacitor shell, the download will be a few MB. Separate apps would each carry their own copy of three.js and the runtime, so four apps are *bigger* in total.
- **One release process to learn.** Every Play app needs its own store listing, screenshots, privacy and content forms, and (for a new personal account) its **own 12-tester closed test**. Doing that once is enough work for a first time.
- **The downside:** discoverability. People search the store for "mahjong", not for a collection. A dedicated "Jade Pavilion" app would rank better for that.

**You don't have to choose forever.** The build already supports standalone apps: `npm run build -- --game jade-pavilion` makes a `dist/` with only that game, opening straight into it. Later you can create a second Capacitor project (different `appId`) from the same source for any game that deserves its own listing.

---

## Part 1: Testing ladder (use it all the time, not just at the end)

Each rung is slower but closer to the real thing. Most of your time should be on rungs 1–2.

### Rung 0: automatic smoke test (every change)

```bash
npm install                          # once
npx playwright install chromium      # once: downloads the test browser
npm test
```

This builds `dist/`, opens the hub and every game in a headless phone-sized browser, taps the screen, and fails on JavaScript errors, missing files, or **any request to the internet** (the offline guarantee). Screenshots go to `test-results/`. GitHub runs the same test on every push (see the *Actions* tab; screenshots are attached to each run).

### Rung 1: desktop browser

```bash
npm run dev
```

Open http://localhost:8080. Press **F12 → device toolbar** (Ctrl+Shift+M) to simulate a phone screen and touch. Edit a file, refresh, and you see the change.

### Rung 2: your own phone, over Wi-Fi (no install needed)

`npm run dev` also prints a line like:

```
  On your phone:     http://192.168.1.23:8080/   (same Wi-Fi)
```

Open that address in Chrome on your phone. You're now playing your latest code on real hardware: real touch, real GPU, real screen notch.

*Doesn't load?* Phone and computer must be on the same network (not a guest network). On Windows, allow Node.js through the firewall when asked (or in *Windows Defender Firewall → Allow an app*).

### Rung 3: see your phone's errors on your computer (remote debugging)

1. On the phone: *Settings → About phone →* tap **Build number** 7 times. This unlocks *Developer options*.
2. *Settings → System → Developer options →* turn on **USB debugging**.
3. Connect the phone with USB and accept the prompt on the phone.
4. On the computer, open `chrome://inspect` in Chrome. Your phone's tabs (and later the app itself) appear; click **inspect** to get full DevTools: console, performance, everything.

### Rung 4: share a link (GitHub Pages)

Every push to `main` publishes the games to `https://<your-github-name>.github.io/<repo-name>/`. One-time setup: *repo Settings → Pages → Source: **GitHub Actions***. (Free for public repositories.) Now you can test anywhere and send friends a link. In Chrome on Android, *⋮ → Add to Home screen* installs it like an app.

### Rung 5: the real Android app on your phone (Part 2 sets this up)

```bash
npm run build && npx cap sync && npx cap run android
```

It installs a debug build on your USB-connected phone (or an emulator). With live reload you don't even need to rebuild:

```bash
npm run dev                                               # terminal 1
npx cap run android -l --host 192.168.1.23 --port 8080   # terminal 2: your computer's IP
```

The app now loads from your dev server; save a file and it reloads on the phone. (Over USB without Wi-Fi: `npx cap run android -l --host localhost --port 8080 --forwardPorts 8080:8080`.)

### Rung 6: real testers through Google Play

- **Internal testing:** up to 100 people, available within minutes, no review. Use this for yourself and close friends.
- **Closed testing:** required for new personal accounts. **At least 12 testers opted in for 14 days in a row** before you can apply for production. Start this **as early as possible** (an early build is fine; you can keep uploading updates during the 14 days).
- **Production:** everyone, after Google's review.

### Manual test checklist (before every store upload)

Do this on a real phone, ideally also on a cheap or old one.

- [ ] Fresh install: hub appears, every game opens and is playable.
- [ ] Finish a level in each game. **Kill the app** (swipe it away) and reopen: progress is still there.
- [ ] Install the new version *over* the previous one: progress survives the update.
- [ ] **Back button / back gesture:** in a game, back returns to the hub; on the hub, back closes the app.
- [ ] Press Home mid-level, wait, come back: no crash, sound behaves, the game continues.
- [ ] **Airplane mode:** everything still works.
- [ ] Notch / camera cutout and gesture bar: nothing important hidden under them.
- [ ] Sound on/off toggle; phone on silent.
- [ ] Big system font size (*Settings → Display → Font size*): UI still fits.
- [ ] Play 10 minutes on a low-end phone: smooth enough? Phone not hot?
- [ ] `npm test` is green.

---

## Part 2: one-time setup

### Install the tools

1. **Node.js 22 LTS or newer**: https://nodejs.org
2. **Android Studio** (current stable): https://developer.android.com/studio. It includes the Android SDK and the Java version Capacitor needs. Open it once and let it finish downloading components.
3. **Git**, which you already use.

### Choose your app ID (this one is permanent!)

Every Android app has a unique ID like `io.github.yourname.arcade`. **It can never change after the first upload to Play.** Use a domain you control, reversed. If you have none, `io.github.<your-github-username>.<appname>` is a common, safe choice.

Also decide on the **app name**. "Honest Arcade" is a working title; notes, candidates and the list of files to change are in [NAMING.md](NAMING.md). Unlike the app ID, the store name can still change later, so keep the app ID name-neutral (e.g. `io.github.pakspul.arcade`). ⚠️ Google Play does not allow promotional words like *free*, *no ads*, *best* or *#1* in the app **title** or icon. Put the mission in the **description** instead.

### Add Capacitor

From the repository root:

```bash
npm install @capacitor/core @capacitor/app @capacitor/haptics
npm install -D @capacitor/cli
npx cap init "Honest Arcade" io.github.yourname.arcade --web-dir dist
npm install @capacitor/android
npm run build
npx cap add android
```

This creates `capacitor.config.json` and an `android/` folder. **Commit both.** The `.gitignore` already excludes Android build output and signing keys.

- `@capacitor/app` makes the **back button** work: `shared/js/platform.js` already uses it to go game → hub and hub → exit. (Without it, Android's back button closes the whole app, even in the middle of a game.)
- `@capacitor/haptics` gives better vibration than the web API (`Platform.haptic()`).

### Run it

```bash
npx cap run android      # pick your phone or an emulator from the list
npx cap open android     # or open the project in Android Studio and press ▶
```

Emulator: Android Studio → *Device Manager* → create a Pixel device. It's fine for quick checks, but performance and touch only feel real on a real phone.

### Your daily loop from now on

```
edit code → npm run dev → test in browser / on phone (rungs 1–3)
          → npm test
          → npm run build && npx cap sync && npx cap run android   (rung 5, when needed)
```

`npx cap sync` copies `dist/` into the Android project. Forgetting it is the #1 reason for "my change isn't in the app".

### App icon and splash screen

The placeholder icon is `shared/icons/icon.svg`. Export a 1024×1024 PNG of your final icon, then:

```bash
npm install -D @capacitor/assets
# put assets/icon-only.png (1024×1024) and assets/splash.png (2732×2732) in place, then:
npx capacitor-assets generate --android
```

---

## Part 3: the first release

### 1. Google Play developer account

- Sign up at https://play.google.com/console: a **one-time US$25** fee, plus identity verification with a government ID. It can take a few days.
- A **personal** account is fine for a hobby project. (Organisation accounts need a D-U-N-S number but skip the 12-tester rule.)

### 2. Create a signing key: BACK IT UP

In Android Studio: *Build → Generate Signed App Bundle or APK → Android App Bundle → Create new…* keystore.

- Store the `.jks` file **and** its passwords somewhere safe *outside* this repo (password manager + an offline copy). Never commit it.
- Google Play uses *Play App Signing*: your key is the **upload key**, and Google holds the real app signing key. If you lose the upload key, Google support can reset it, but that takes time and hassle. Don't lose it.

### 3. Version number

In `android/app/build.gradle`, raise **`versionCode`** (an integer: 1, 2, 3…) for every upload, and set **`versionName`** ("0.1.0") to what players see.

### 4. Build the bundle

```bash
npm test                       # green?
npm run build && npx cap sync
```

Then in Android Studio: *Build → Generate Signed App Bundle → release*. The output is `android/app/release/app-release.aab`.

### 5. Create the app in Play Console

*Create app* → name, default language, **Game**, **Free**. (Free is permanent: an app can never become paid later. That fits the mission.)

Then work through **Dashboard → "Set up your app"**:

| Section | What to answer |
|---|---|
| Privacy policy | URL of `PRIVACY.md` on GitHub (the repository must be public), or publish it on GitHub Pages |
| Ads | **No, my app does not contain ads.** Players see that on the store page. |
| App access | All functionality is available without special access |
| Content rating | Fill in the IARC questionnaire (puzzle game, no violence) → usually rated "Everyone / PEGI 3" |
| Target audience | Choosing ages under 13 brings in the *Families* policy: more review, but no problem without ads or data. Choosing 13+ is simpler for a first release. |
| Data safety | **No data collected, no data shared.** |
| Store listing | Short description (80 characters), full description (put the mission here), 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots (aspect ratio at most 2:1, so crop to 9:16) |

### 6. Testing tracks → production

1. **Internal testing:** create a release, upload the `.aab`, add yourself and friends by email, and share the opt-in link. Install it from the Play Store on your phone and run the checklist above.
2. **Closed testing:** create a release (you can promote the internal one). Add **at least 12 testers**: friends, family, colleagues with Android phones. Each must open the opt-in link, accept, install, and *stay opted in for 14 days*. Ask them for feedback; Google asks about it later.
3. After 14 days: *Dashboard → Apply for production*, answer the questions about your test, wait for approval (usually days).
4. **Production release** → review → live. 🎉

---

## Part 4: other ways to share (all fit the mission)

- **GitHub Pages:** already set up. The fastest way to share with anyone, on any phone, including iPhones.
- **itch.io:** zip `dist/` and upload it as an HTML5 game. A big indie audience, and you can set the price to $0 with no ads.
- **F-Droid:** the open-source Android store. No tracking allowed, which matches this project perfectly. It requires an open-source licence for all code and assets (three.js is MIT and the fonts are OFL, so that's fine) and builds the app from your source. More setup work; a good step after Google Play.
- **APK on GitHub Releases:** Google is rolling out *developer verification* for apps installed outside Play (first in a few countries from late 2026, globally from 2027), including a free "limited distribution" option for hobbyists. Check the current status at https://developer.android.com/developer-verification before relying on this route.

---

## Part 5: iPhone later (what changes)

The same Capacitor project produces an iOS app. The full step-by-step iPhone release is chapter 1 of **[RELEASE.md](RELEASE.md)**. In short, what's different:

| Topic | iOS |
|---|---|
| Hardware | You need a **Mac** with Xcode (or a cloud Mac build service). |
| Account | **Apple Developer Program: US$99 per year.** A free Apple ID can install on your own iPhone, but the app expires after 7 days. |
| Setup | `npm install @capacitor/ios && npx cap add ios && npx cap open ios` |
| Testing | **TestFlight**: up to 100 internal testers immediately, and up to 10,000 external testers via a public link (after a short beta review). No 12-tester rule. |
| Debugging | Safari on the Mac → *Develop* menu → your iPhone (the equivalent of `chrome://inspect`). |
| **No back button** | Each game **must** have a visible way back to the hub in its own menu: call `Platform.home()`. Do this before the iOS port (it's good on Android too). |
| Saving | iOS may clear a WebView's localStorage when the device is low on space. Before an iOS release, add a `Platform.storage` backed by `@capacitor/preferences` and let the games save through it (see [ARCHITECTURE.md](ARCHITECTURE.md)). |
| Review | Apple reviews every update by hand (usually 1–2 days). Complete, offline, ad-free games pass easily. |

**Free alternative today:** iPhone users can open the GitHub Pages link in Safari → *Share → Add to Home Screen*. It runs full-screen like an app.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Change not visible in the app | `npm run build && npx cap sync`, then run again |
| White screen in the app | `chrome://inspect` → inspect the app → read the console |
| Live reload: `ERR_CLEARTEXT_NOT_PERMITTED` | Add `"server": { "cleartext": true }` to `capacitor.config.json` **while developing only**, or use the USB `--forwardPorts` variant |
| Phone can't reach `npm run dev` | Same Wi-Fi? Firewall allows Node? Try the exact IP printed by the server |
| Back button closes the app from a game | `npm install @capacitor/app && npx cap sync` |
| Gradle / Java errors | Android Studio → *Settings → Build Tools → Gradle → Gradle JDK*: use the bundled JDK. Then run *File → Sync Project with Gradle Files*. |
| Play Console rejects the bundle: "version code already used" | Raise `versionCode` in `android/app/build.gradle` |
| Play Console: "target API level too low" | Update Capacitor (`npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest`, then `npx cap sync`). New apps and updates must target Android 16 (API 36) from August 31, 2026. |
