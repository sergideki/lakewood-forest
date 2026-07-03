#!/usr/bin/env bash
# Lakewood Forest — build + sign + publish a new sideload APK to GitHub Releases in one command.
#
# What it does (in order):
#   1. Bump app.json  expo.version (patch) + expo.android.versionCode (+1)   [skip with --no-bump]
#      — versionCode MUST increase or Android refuses to install over the old build, which also
#        breaks the in-app updater. Use --version X.Y.Z to set the version explicitly.
#   2. expo prebuild -p android  (regenerates native project incl. the new icon from assets/)
#   3. ./gradlew assembleRelease  → app-release.apk (Gradle debug-signs it; we re-sign next)
#   4. zipalign + apksigner sign with the REAL release keystore (~/Documents/lakewood-signing/)
#   5. apksigner verify
#   6. commit the version bump, tag vX.Y.Z, and `gh release create` with the signed APK
#      — steps 1-5 always run; step 6 asks for confirmation first (pass --yes to skip the prompt).
#
# Requires: node, the Android SDK ($ANDROID_HOME) with build-tools, gh (authenticated), and the
# signing material in ~/Documents/lakewood-signing/ (keystore.properties + lakewood-release.jks).
#
# Usage:
#   scripts/release.sh                 # bump patch, build, sign, prompt to publish
#   scripts/release.sh --version 1.3.0 # set an explicit version
#   scripts/release.sh --no-bump       # reuse the current app.json version (must not be released yet)
#   scripts/release.sh --yes           # don't prompt before publishing
#   scripts/release.sh --no-publish    # build + sign only, stop before git/GitHub
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGN_DIR="${LAKEWOOD_SIGNING_DIR:-$HOME/Documents/lakewood-signing}"
SLUG="sergideki/lakewood-forest"
cd "$REPO_ROOT"

BUMP="patch"; EXPLICIT_VERSION=""; ASSUME_YES=0; PUBLISH=1
while [ $# -gt 0 ]; do
  case "$1" in
    --version) EXPLICIT_VERSION="${2:?--version needs X.Y.Z}"; BUMP=""; shift 2;;
    --no-bump) BUMP=""; shift;;
    --yes|-y) ASSUME_YES=1; shift;;
    --no-publish) PUBLISH=0; shift;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

# ---- preflight ------------------------------------------------------------
command -v node >/dev/null || { echo "node not found" >&2; exit 1; }
command -v gh   >/dev/null || { echo "gh (GitHub CLI) not found" >&2; exit 1; }
[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ] || { echo "ANDROID_HOME not set" >&2; exit 1; }
SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
BT="$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)"
[ -n "$BT" ] || { echo "no Android build-tools under $SDK" >&2; exit 1; }
APKSIGNER="${BT}apksigner"; ZIPALIGN="${BT}zipalign"
[ -x "$APKSIGNER" ] && [ -x "$ZIPALIGN" ] || { echo "apksigner/zipalign missing in $BT" >&2; exit 1; }
[ -f "$SIGN_DIR/keystore.properties" ] || { echo "missing $SIGN_DIR/keystore.properties" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$SIGN_DIR/keystore.properties"; set +a   # storeFile keyAlias storePassword keyPassword
KS_PATH="$SIGN_DIR/$(basename "$storeFile")"
[ -f "$KS_PATH" ] || KS_PATH="$storeFile"
[ -f "$KS_PATH" ] || { echo "keystore not found ($storeFile)" >&2; exit 1; }

# ---- version bump ---------------------------------------------------------
node -e '
  const fs="fs", p="./app.json"; const f=require(fs); const j=JSON.parse(f.readFileSync(p,"utf8"));
  const e=j.expo; e.android=e.android||{};
  const arg=process.argv[1], bump=process.argv[2];
  if(arg){ e.version=arg; }
  else if(bump==="patch"){ const s=(e.version||"0.0.0").split(".").map(Number); s[2]=(s[2]||0)+1; e.version=s.join("."); }
  e.android.versionCode=(e.android.versionCode||1)+ (arg||bump?1:0);
  f.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
' "$EXPLICIT_VERSION" "$BUMP"

VERSION="$(node -p "require('./app.json').expo.version")"
VCODE="$(node -p "require('./app.json').expo.android.versionCode")"
TAG="v$VERSION"
echo "==> Releasing $TAG (versionCode $VCODE)"

if gh release view "$TAG" -R "$SLUG" >/dev/null 2>&1; then
  echo "release $TAG already exists — bump the version (or delete the release)" >&2; exit 1
fi

# ---- build ----------------------------------------------------------------
echo "==> expo prebuild"
npx expo prebuild -p android --no-install
echo "==> gradle assembleRelease"
( cd android && ./gradlew assembleRelease )
RAW="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$RAW" ] || { echo "build output not found: $RAW" >&2; exit 1; }

# ---- sign -----------------------------------------------------------------
OUT="$REPO_ROOT/lakewood-$TAG.apk"
ALIGNED="$(mktemp --suffix=.apk)"
echo "==> zipalign + sign"
"$ZIPALIGN" -f -p 4 "$RAW" "$ALIGNED"
STORE_PW="$storePassword" KEY_PW="$keyPassword" "$APKSIGNER" sign \
  --ks "$KS_PATH" --ks-key-alias "$keyAlias" \
  --ks-pass "pass:env:STORE_PW" --key-pass "pass:env:KEY_PW" \
  --out "$OUT" "$ALIGNED"
rm -f "$ALIGNED"
"$APKSIGNER" verify --print-certs "$OUT" >/dev/null && echo "==> signed OK: $OUT"

if [ "$PUBLISH" -eq 0 ]; then
  echo "--no-publish: stopping after sign. APK at $OUT"; exit 0
fi

# ---- publish (confirmation-gated) ----------------------------------------
if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Publish $TAG to github.com/$SLUG and commit the version bump? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "aborted (APK still at $OUT)"; exit 0; }
fi

git add app.json   # android/ and *.apk are gitignored; the version bump is the only tracked change
git commit -m "release: $TAG (versionCode $VCODE)" || true
git tag "$TAG"
git push origin HEAD --tags
gh release create "$TAG" "$OUT" -R "$SLUG" \
  --title "Lakewood Forest $TAG" \
  --notes "Sideload APK. Install over any previous version, or use in-game Settings → Check for updates."
echo "==> published $TAG"
