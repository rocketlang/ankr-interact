#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ANKR Interact — Local Android APK Builder
#
# Builds a signed or unsigned APK without an EAS account.
# Suitable for self-hosters, F-Droid reproducible builds, and CI environments
# that don't have access to Expo's hosted CI service.
#
# Usage:
#   ./scripts/build-apk-local.sh                  # unsigned APK
#   ./scripts/build-apk-local.sh --sign            # signed APK (keystore required)
#   ./scripts/build-apk-local.sh --server-url https://interact.example.com
#
# Requirements:
#   - Node.js 22+
#   - JDK 17+ (JAVA_HOME must be set)
#   - Android SDK (ANDROID_HOME must be set, or android SDK auto-installed)
#
# Output:
#   ./build/ankr-interact-<version>.apk
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$ROOT_DIR/mobile"
BUILD_DIR="$ROOT_DIR/build"

# ─── Parse args ───────────────────────────────────────────────────────────────
SIGN=false
SERVER_URL="https://interact.ankrlabs.in"
KEYSTORE_PATH=""
KEYSTORE_PASS=""
KEY_ALIAS="ankr-interact"
KEY_PASS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --sign) SIGN=true; shift ;;
    --server-url) SERVER_URL="$2"; shift 2 ;;
    --keystore) KEYSTORE_PATH="$2"; shift 2 ;;
    --keystore-pass) KEYSTORE_PASS="$2"; shift 2 ;;
    --key-alias) KEY_ALIAS="$2"; shift 2 ;;
    --key-pass) KEY_PASS="$2"; shift 2 ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# *//'
      exit 0
      ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC} $*"; exit 1; }

# ─── Pre-flight checks ────────────────────────────────────────────────────────
info "ANKR Interact — Local APK Build"
echo ""

command -v node >/dev/null 2>&1 || error "Node.js not found. Install from https://nodejs.org/"
command -v java >/dev/null 2>&1 || error "Java not found. Install JDK 17: sudo apt-get install openjdk-17-jdk"

NODE_VER=$(node -e "process.exit(+process.versions.node.split('.')[0] < 18 ? 1 : 0)" 2>&1 || echo "old")
if [[ "$NODE_VER" == "old" ]]; then
  error "Node.js 18+ required. Current: $(node -v)"
fi

JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
if [[ "${JAVA_VER:-0}" -lt 17 ]]; then
  warn "JDK 17+ recommended. Found: $(java -version 2>&1 | head -1)"
fi

VERSION=$(node -p "require('${MOBILE_DIR}/package.json').version")
info "Building ANKR Interact v${VERSION}"
info "Server URL: ${SERVER_URL}"

mkdir -p "$BUILD_DIR"

# ─── Install dependencies ─────────────────────────────────────────────────────
info "Installing npm dependencies..."
cd "$MOBILE_DIR"
npm ci --prefer-offline 2>&1 | tail -3

# ─── Configure server URL ─────────────────────────────────────────────────────
info "Patching server URL into app.json..."
node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  cfg.expo.extra.apiUrl = '${SERVER_URL}';
  cfg.expo.extra.bundleSpecVersion = '2.0';
  cfg.expo.extra.selfHosted = '${SERVER_URL}' !== 'https://interact.ankrlabs.in';
  fs.writeFileSync('app.json', JSON.stringify(cfg, null, 2));
  console.log('  apiUrl ->', cfg.expo.extra.apiUrl);
"

# ─── Expo prebuild → generate android/ ───────────────────────────────────────
info "Running expo prebuild (generates android/ Gradle project)..."
EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --clean 2>&1 | tail -5

# ─── Gradle build ─────────────────────────────────────────────────────────────
info "Building APK with Gradle..."
cd "$MOBILE_DIR/android"

# Use Gradle wrapper; download if missing
if [[ ! -f "./gradlew" ]]; then
  error "gradlew not found in android/. Run: cd mobile && npx expo prebuild --platform android"
fi
chmod +x ./gradlew

./gradlew assembleRelease \
  --no-daemon \
  --parallel \
  --build-cache \
  -Dorg.gradle.jvmargs="-Xmx3g -XX:+UseParallelGC" \
  2>&1 | grep -E "^(BUILD|FAILURE|ERROR|:app|Deprecated)" || true

APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
[[ -f "$APK_PATH" ]] || error "APK not found at $APK_PATH"

UNSIGNED_OUT="$BUILD_DIR/ankr-interact-v${VERSION}-unsigned.apk"
cp "$APK_PATH" "$UNSIGNED_OUT"
success "Unsigned APK: $UNSIGNED_OUT ($(du -sh "$UNSIGNED_OUT" | cut -f1))"

# ─── Sign APK ─────────────────────────────────────────────────────────────────
FINAL_OUT="$BUILD_DIR/ankr-interact-v${VERSION}.apk"

if [[ "$SIGN" == "true" ]]; then
  info "Signing APK..."

  # Auto-detect keystore location
  if [[ -z "$KEYSTORE_PATH" ]]; then
    if [[ -f "$MOBILE_DIR/keystore.jks" ]]; then
      KEYSTORE_PATH="$MOBILE_DIR/keystore.jks"
    elif [[ -f "$HOME/.ankr/ankr-interact.keystore" ]]; then
      KEYSTORE_PATH="$HOME/.ankr/ankr-interact.keystore"
    else
      error "No keystore found. Provide --keystore <path> or place keystore.jks in mobile/"
    fi
  fi

  # Prompt for passwords if not provided
  if [[ -z "$KEYSTORE_PASS" ]]; then
    read -s -p "Keystore password: " KEYSTORE_PASS; echo
  fi
  if [[ -z "$KEY_PASS" ]]; then
    KEY_PASS="$KEYSTORE_PASS"
  fi

  # Detect build-tools version
  BUILD_TOOLS_VERSION=$(ls "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools/" 2>/dev/null | sort -V | tail -1)
  ZIPALIGN="${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools/${BUILD_TOOLS_VERSION}/zipalign"
  APKSIGNER="${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools/${BUILD_TOOLS_VERSION}/apksigner"

  if [[ -f "$APKSIGNER" ]]; then
    "$APKSIGNER" sign \
      --ks "$KEYSTORE_PATH" \
      --ks-pass "pass:$KEYSTORE_PASS" \
      --ks-key-alias "$KEY_ALIAS" \
      --key-pass "pass:$KEY_PASS" \
      --out "$FINAL_OUT" \
      "$UNSIGNED_OUT"
  else
    # Fallback to jarsigner
    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
      -keystore "$KEYSTORE_PATH" \
      -storepass "$KEYSTORE_PASS" \
      -keypass "$KEY_PASS" \
      -signedjar "$FINAL_OUT" \
      "$UNSIGNED_OUT" \
      "$KEY_ALIAS"
  fi

  # zipalign (optimize APK)
  if [[ -f "$ZIPALIGN" ]]; then
    ALIGNED="$BUILD_DIR/ankr-interact-v${VERSION}-aligned.apk"
    "$ZIPALIGN" -v 4 "$FINAL_OUT" "$ALIGNED"
    mv "$ALIGNED" "$FINAL_OUT"
  fi

  success "Signed APK: $FINAL_OUT ($(du -sh "$FINAL_OUT" | cut -f1))"
else
  FINAL_OUT="$UNSIGNED_OUT"
  warn "APK is unsigned. To install on a device, you may need to sign it first."
  warn "Re-run with --sign to sign with your keystore."
fi

# ─── Verify APK ───────────────────────────────────────────────────────────────
info "APK info:"
if command -v aapt2 >/dev/null 2>&1; then
  aapt2 dump badging "$FINAL_OUT" 2>/dev/null | grep -E "^(package|application-label|sdkVersion)" || true
fi

# ─── Generate keystore (if none exists) ───────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
success "Build complete!"
echo ""
echo "Output: $FINAL_OUT"
echo ""
echo "Install on device:"
echo "  adb install -r $FINAL_OUT"
echo ""
echo "Or sideload via Android:"
echo "  1. Transfer APK to device"
echo "  2. Settings > Security > Install unknown apps"
echo "  3. Tap the APK"
echo ""

if [[ "$SIGN" == "false" ]]; then
  echo "To generate a keystore for signing:"
  echo "  keytool -genkeypair -v \\"
  echo "    -keystore $MOBILE_DIR/keystore.jks \\"
  echo "    -alias ankr-interact \\"
  echo "    -keyalg RSA -keysize 2048 -validity 10000"
  echo "  ./scripts/build-apk-local.sh --sign"
fi
