#!/usr/bin/env bash
# Builds a signed App Store / TestFlight .ipa on YOUR Mac (needs Xcode 16+ and an Apple Developer account
# signed in under Xcode > Settings > Accounts). Nothing here stores or needs secrets in the repo.
#
#   ios/tools/archive_for_testflight.sh <TEAM_ID> [BUILD_NUMBER]
#
# Then upload build/export/TouchSchatzi.ipa with Transporter (free, Mac App Store), or run:
#   xcrun altool --upload-app -f build/export/TouchSchatzi.ipa -t ios --apiKey <KEY> --apiIssuer <ISSUER>
set -euo pipefail
TEAM="${1:?usage: archive_for_testflight.sh <TEAM_ID> [BUILD_NUMBER]}"
BUILD="${2:-$(date +%Y%m%d%H%M)}"
cd "$(dirname "$0")/.."
mkdir -p build
cp ExportOptions.plist build/ExportOptions.plist
/usr/libexec/PlistBuddy -c "Set :teamID $TEAM" build/ExportOptions.plist

xcodebuild archive \
  -project TouchSchatzi.xcodeproj -scheme TouchSchatzi -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/TouchSchatzi.xcarchive \
  DEVELOPMENT_TEAM="$TEAM" CURRENT_PROJECT_VERSION="$BUILD" -allowProvisioningUpdates

xcodebuild -exportArchive \
  -archivePath build/TouchSchatzi.xcarchive -exportPath build/export \
  -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates

echo "Done: $(pwd)/build/export/TouchSchatzi.ipa  (build $BUILD)"
