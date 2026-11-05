# Touch Schatzi

A Yahtzee-style game where the dice are a slot machine. Built as web tech (vanilla ES modules) inside native shells: an Android WebView app (`app/`) and an iPhone/iPad app (`ios/`, see [ios/README.md](ios/README.md)). Both run the same game code in `app/src/main/assets/www`.

**Honest note:** the game was tested in a browser (Chromium, portrait and landscape, full simulated games, rules tests). The Android shell (Java/Gradle) could not be compiled where it was written, so the first APK build is the first compile. If the build fails, paste the log to get a quick fix.

## Get an APK (GitHub)
1. Create a GitHub repo and push this folder's contents (the `.github` folder must be at the repo root).
2. Open the **Actions** tab, then **Build APK**, then **Run workflow** (it also runs on every push).
3. When it finishes, download the `TouchSchatzi-debug-apk` artifact, unzip it and install `app-debug.apk` (allow "install unknown apps").

Android Studio also works: open this folder and Run.

## Play in a browser
`cd app/src/main/assets/www && python3 -m http.server 8765`, then open http://localhost:8765/index.html
Extras: `?screen=play&opp=lily,max&diff=hard`

## Swapping art
Every image is wired by slot ID in `www/assets/manifest.json` (`bg.gameplay`, `char.girl`, `ui.slotMachine`, ...). Replace a file, or add `manifest.override.json` with the same keys. `.landscape` variants are optional. Missing files fall back to placeholders, so the app never breaks. Optional audio samples can override the synthesized sounds.

## Config (no code changes needed)
- `config/game.json`: rounds, bonuses, difficulty, pacing
- `config/characters.json`: names, colors, face anchors, sprite sheets
- `config/trashtalk.json`: lines per event and personality
- `config/layout.json`: character seats and machine placement
- `config/scorecard.json`: score card box coordinates

## Reusable modules (copy into other apps)
- `js/lib/slotmachine/SlotMachine.js`: canvas reel machine with art, lever, hold, hints, anticipation and events
- `js/lib/audio.js`: synth-first audio engine with sample override, buses, ducking and music
- `js/lib/assets.js`, `haptics.js`, `util.js`
- `js/game/rules.js` and `ai.js`: pure Yahtzee rules and expectimax AI
