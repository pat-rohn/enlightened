#!/usr/bin/env bash
#
# Build the Android APK from the command line, without opening Android Studio.
#
#   ./build-apk.sh            # debug APK (default)
#   ./build-apk.sh release    # release APK (unsigned unless signing is configured)
#
# Steps: build the Angular web app -> sync into the native project -> assemble.
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 

export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  "platforms;android-35" "build-tools;35.0.0" "platform-tools"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
set -euo pipefail

# Always run relative to this script's directory (the project root).
cd "$(dirname "$0")"

VARIANT="${1:-debug}"
case "$VARIANT" in
  debug)   GRADLE_TASK="assembleDebug" ;;
  release) GRADLE_TASK="assembleRelease" ;;
  *) echo "Unknown variant '$VARIANT' (use 'debug' or 'release')" >&2; exit 1 ;;
esac

echo "==> 1/3 Building web app (ng build)"
npm run build

echo "==> 2/3 Syncing web assets into Android project (cap sync)"
npx cap sync android

echo "==> 3/3 Assembling $VARIANT APK (gradle $GRADLE_TASK)"
( cd android && ./gradlew "$GRADLE_TASK" )

APK_DIR="android/app/build/outputs/apk/$VARIANT"
APK="$APK_DIR/app-$VARIANT.apk"
if [ -f "$APK" ]; then
  echo
  echo "APK built in folder: $(cd "$APK_DIR" && pwd)"
  echo "APK file:            $(cd "$APK_DIR" && pwd)/app-$VARIANT.apk"
  echo "Install on a connected device with:"
  echo "  \$ANDROID_HOME/platform-tools/adb install -r $APK"
  # Drop a copy in the shared folder for transfer to the device. The .zip
  # extension is deliberate -- Nextcloud will not hand out a bare .apk -- so
  # rename it back to .apk on the device before installing. Override the
  # destination with SHARE_DIR=... ./build.sh
  SHARE_DIR="${SHARE_DIR:-$HOME/Nextcloud/Shared}"
  if [ -d "$SHARE_DIR" ]; then
    cp "$APK" "$SHARE_DIR/enlightened.zip" 
    cp "$APK" "$SHARE_DIR/enlightened.apk"
    echo "Shared copy:         $SHARE_DIR/enlightened.zip (rename to .apk on the device)"
  else
    echo "Note: share dir '$SHARE_DIR' does not exist; skipping copy." >&2
  fi
else
  echo "Build finished but expected APK not found at $APK" >&2
  exit 1
fi
