# Getting Touch Schatzi onto TestFlight

Hand-off checklist. Everything that needs your Apple account is marked **(you)**. No secrets belong in this repository.

## 0. What you need

* A Mac with **Xcode 16 or newer**.
* An **Apple Developer Program** membership **(you)**.
* This repo checked out on the branch you want to ship.

## 1. Check the bundle ID is yours

The project uses `com.touchschatzi.game` (same as Android). If it is unavailable, change `BUNDLE_ID` in
`ios/tools/gen_xcodeproj.py`, run the script, commit.

## 2. Create the app record **(you)**

App Store Connect → **Apps → +** → New App: platform iOS, name **Touch Schatzi**, primary language English,
bundle ID from step 1 (register it under Certificates, Identifiers & Profiles first if it is not in the list), SKU anything.

## 3. Build and upload

Easiest: in Xcode, open `ios/TouchSchatzi.xcodeproj` → target **TouchSchatzi** → *Signing & Capabilities* → choose your
**Team** (automatic signing) → destination **Any iOS Device (arm64)** → **Product → Archive** → **Distribute App →
App Store Connect → Upload**.

Or from Terminal (builds and signs an `.ipa`, then upload it with the free *Transporter* app):

```bash
ios/tools/archive_for_testflight.sh YOURTEAMID
```

Each upload needs a **new build number** (the script uses a timestamp; in Xcode bump *Build* on the target).

## 4. Answer App Store Connect's questions **(you)**

| Question | Suggested answer (verify for yourself) |
|---|---|
| Export compliance | Already answered in the app (`ITSAppUsesNonExemptEncryption = NO`): the app uses no encryption and no network |
| App Privacy | **Data Not Collected** (the app has no network, analytics or accounts); matches `PrivacyInfo.xcprivacy` |
| Age rating | Answer the questionnaire honestly. The game has slot-machine styled dice but **no real-money gambling or prizes**; check how "simulated gambling" is handled in the current questionnaire |
| Privacy policy URL | Required for the App Store and for **external** TestFlight testers; not required for internal testers |
| Content rights | You own the artwork/audio (all art is in this repo; audio is synthesized in code) |

## 5. Test

* **Internal testing** (up to 100 people on your App Store Connect team): available as soon as the build finishes
  processing, no review.
* **External testing:** needs Beta App Review, a privacy policy URL and test information.

## 6. Smoke-test checklist on a real device

- [ ] Launch: purple launch screen → splash art → tap → menu (no white flash)
- [ ] Play a full 13-round game vs. 3 opponents; score card swipe works and doesn't leave the app
- [ ] Sound plays; flipping the silent switch mutes it; music resumes after a phone call / Siri
- [ ] Haptics on reel stops / big wins; Haptics toggle in the pause menu turns them off (iPhone only)
- [ ] Rotate to landscape and back mid-game; lock/unlock mid-game (game is paused, Resume works)
- [ ] Name field: keyboard doesn't zoom the page, Done closes it, name is kept after relaunch
- [ ] Best score is kept after force-quitting the app
- [ ] iPad: menu and game scale sensibly in both orientations (and Split View if you plan to support it)
