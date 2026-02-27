#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ANKR Interact — Generate Mobile App Assets
#
# Creates PNG icons and splash screens from SVG sources.
# Requires: Inkscape OR ImageMagick (inkscape preferred for quality)
#
# Usage:
#   ./scripts/generate-assets.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$(dirname "$SCRIPT_DIR")/mobile/assets"

mkdir -p "$ASSETS_DIR"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }

# ─── Write SVG sources ────────────────────────────────────────────────────────
info "Writing SVG sources..."

# App icon — 1024x1024 (dark blue background + open book + sparkle)
cat > "$ASSETS_DIR/icon.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="100%" style="stop-color:#1a0a2e"/>
    </linearGradient>
    <linearGradient id="bookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="20" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>

  <!-- Glow circle -->
  <circle cx="512" cy="512" r="320" fill="#6366f1" opacity="0.08"/>

  <!-- Open book left page -->
  <path d="M200 300 L200 724 Q200 740 216 740 L510 740 L510 300 Q440 280 340 290 Q260 298 200 300 Z"
        fill="url(#bookGrad)" opacity="0.9"/>
  <!-- Book spine shadow -->
  <rect x="505" y="300" width="14" height="440" fill="#4338ca" rx="2"/>
  <!-- Open book right page -->
  <path d="M824 300 L824 724 Q824 740 808 740 L514 740 L514 300 Q584 280 684 290 Q764 298 824 300 Z"
        fill="url(#bookGrad)" opacity="0.75"/>

  <!-- Left page lines -->
  <rect x="240" y="380" width="220" height="12" rx="6" fill="white" opacity="0.4"/>
  <rect x="240" y="420" width="200" height="10" rx="5" fill="white" opacity="0.3"/>
  <rect x="240" y="456" width="210" height="10" rx="5" fill="white" opacity="0.3"/>
  <rect x="240" y="492" width="180" height="10" rx="5" fill="white" opacity="0.3"/>
  <rect x="240" y="528" width="195" height="10" rx="5" fill="white" opacity="0.3"/>
  <rect x="240" y="564" width="170" height="10" rx="5" fill="white" opacity="0.3"/>

  <!-- Right page lines -->
  <rect x="560" y="380" width="220" height="12" rx="6" fill="white" opacity="0.3"/>
  <rect x="560" y="420" width="200" height="10" rx="5" fill="white" opacity="0.2"/>
  <rect x="560" y="456" width="215" height="10" rx="5" fill="white" opacity="0.2"/>
  <rect x="560" y="492" width="185" height="10" rx="5" fill="white" opacity="0.2"/>
  <rect x="560" y="528" width="200" height="10" rx="5" fill="white" opacity="0.2"/>

  <!-- AI sparkle (top right of book) -->
  <g filter="url(#glow)" transform="translate(690, 240)">
    <polygon points="0,-50 12,-12 50,0 12,12 0,50 -12,12 -50,0 -12,-12" fill="#f59e0b"/>
    <polygon points="0,-25 6,-6 25,0 6,6 0,25 -6,6 -25,0 -6,-6" fill="white" opacity="0.8"/>
  </g>

  <!-- Small sparkles -->
  <polygon points="300,200 305,212 318,212 308,220 312,232 300,224 288,232 292,220 282,212 295,212"
           fill="#a78bfa" opacity="0.7"/>
  <polygon points="750,700 753,708 762,708 755,713 757,722 750,717 743,722 745,713 738,708 747,708"
           fill="#60a5fa" opacity="0.7"/>
</svg>
SVGEOF

# Adaptive icon foreground (512x512, transparent background)
cat > "$ASSETS_DIR/adaptive-icon.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- Open book left page -->
  <path d="M80 130 L80 382 Q80 396 94 396 L254 396 L254 130 Q208 116 160 122 Q112 128 80 130 Z"
        fill="url(#bookGrad)"/>
  <rect x="251" y="130" width="10" height="266" fill="#4338ca" rx="2"/>
  <!-- Open book right page -->
  <path d="M432 130 L432 382 Q432 396 418 396 L258 396 L258 130 Q304 116 352 122 Q400 128 432 130 Z"
        fill="url(#bookGrad)" opacity="0.8"/>
  <!-- Sparkle -->
  <polygon points="356,80 362,100 382,100 366,112 372,132 356,120 340,132 346,112 330,100 350,100"
           fill="#f59e0b"/>
</svg>
SVGEOF

# Splash screen — 1284x2778 (iPhone 14 Pro Max size, works for all)
cat > "$ASSETS_DIR/splash.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1284 2778" width="1284" height="2778">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="50%" style="stop-color:#0f0720"/>
      <stop offset="100%" style="stop-color:#0a0a1a"/>
    </linearGradient>
    <linearGradient id="bookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.15"/>
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:0"/>
    </radialGradient>
  </defs>

  <rect width="1284" height="2778" fill="url(#bg)"/>
  <!-- Glow -->
  <ellipse cx="642" cy="1389" rx="600" ry="600" fill="url(#glow)"/>

  <!-- Book icon (centered) -->
  <g transform="translate(642,1250)">
    <!-- Left page -->
    <path d="M-260,-200 L-260,200 Q-260,215 -246,215 L-10,215 L-10,-200 Q-60,-215 -140,-210 Q-210,-205 -260,-200 Z"
          fill="url(#bookGrad)"/>
    <!-- Spine -->
    <rect x="-14" y="-200" width="28" height="415" fill="#4338ca" rx="3"/>
    <!-- Right page -->
    <path d="M260,-200 L260,200 Q260,215 246,215 L10,215 L10,-200 Q60,-215 140,-210 Q210,-205 260,-200 Z"
          fill="url(#bookGrad)" opacity="0.8"/>
    <!-- Lines left -->
    <rect x="-230" y="-120" width="170" height="10" rx="5" fill="white" opacity="0.4"/>
    <rect x="-230" y="-90" width="150" height="8" rx="4" fill="white" opacity="0.3"/>
    <rect x="-230" y="-62" width="160" height="8" rx="4" fill="white" opacity="0.3"/>
    <rect x="-230" y="-34" width="140" height="8" rx="4" fill="white" opacity="0.3"/>
    <!-- Sparkle -->
    <g transform="translate(200,-160)">
      <polygon points="0,-35 8,-8 35,0 8,8 0,35 -8,8 -35,0 -8,-8" fill="#f59e0b"/>
    </g>
  </g>

  <!-- App name -->
  <text x="642" y="1560" text-anchor="middle"
        font-family="-apple-system, system-ui, sans-serif" font-size="72" font-weight="700"
        fill="white" opacity="0.95">ANKR Interact</text>
  <text x="642" y="1630" text-anchor="middle"
        font-family="-apple-system, system-ui, sans-serif" font-size="36"
        fill="#6366f1" opacity="0.8">Learn anything. Own your knowledge.</text>
</svg>
SVGEOF

# Notification icon (96x96, white on transparent)
cat > "$ASSETS_DIR/notification-icon.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <path d="M16 20 L16 76 Q16 82 22 82 L46 82 L46 20 Q38 17 28 18 Q20 20 16 20 Z" fill="white"/>
  <rect x="44" y="20" width="8" height="62" fill="white" opacity="0.7"/>
  <path d="M80 20 L80 76 Q80 82 74 82 L50 82 L50 20 Q58 17 68 18 Q76 20 80 20 Z" fill="white" opacity="0.8"/>
</svg>
SVGEOF

# Favicon (64x64)
cat > "$ASSETS_DIR/favicon.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="#0a0a1a"/>
  <path d="M8 12 L8 52 Q8 56 12 56 L30 56 L30 12 Q26 10 18 11 Q11 12 8 12 Z" fill="#6366f1"/>
  <rect x="29" y="12" width="6" height="44" fill="#4338ca"/>
  <path d="M56 12 L56 52 Q56 56 52 56 L34 56 L34 12 Q38 10 46 11 Q53 12 56 12 Z" fill="#8b5cf6"/>
</svg>
SVGEOF

ok "SVG sources written to $ASSETS_DIR"

# ─── Convert SVGs to PNGs ─────────────────────────────────────────────────────
convert_svg() {
  local src="$1" dst="$2" size="$3"
  if command -v inkscape >/dev/null 2>&1; then
    inkscape --export-png="$dst" --export-width="$size" --export-height="$size" "$src" 2>/dev/null
  elif command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w "$size" -h "$size" -o "$dst" "$src"
  elif command -v convert >/dev/null 2>&1; then
    convert -background none -resize "${size}x${size}" "$src" "$dst" 2>/dev/null
  else
    return 1
  fi
}

# Splash needs different handling (non-square)
convert_splash() {
  local src="$1" dst="$2"
  if command -v inkscape >/dev/null 2>&1; then
    inkscape --export-png="$dst" --export-width="1284" --export-height="2778" "$src" 2>/dev/null
  elif command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 1284 -h 2778 -o "$dst" "$src"
  elif command -v convert >/dev/null 2>&1; then
    convert -background "#0a0a1a" -resize "1284x2778" "$src" "$dst" 2>/dev/null
  else
    return 1
  fi
}

HAS_CONVERTER=false
command -v inkscape >/dev/null 2>&1 && HAS_CONVERTER=true
command -v rsvg-convert >/dev/null 2>&1 && HAS_CONVERTER=true
command -v convert >/dev/null 2>&1 && HAS_CONVERTER=true

if [[ "$HAS_CONVERTER" == "true" ]]; then
  info "Converting SVGs to PNGs..."

  convert_svg "$ASSETS_DIR/icon.svg" "$ASSETS_DIR/icon.png" 1024 && ok "icon.png (1024x1024)"
  convert_svg "$ASSETS_DIR/adaptive-icon.svg" "$ASSETS_DIR/adaptive-icon.png" 512 && ok "adaptive-icon.png (512x512)"
  convert_splash "$ASSETS_DIR/splash.svg" "$ASSETS_DIR/splash.png" && ok "splash.png (1284x2778)"
  convert_svg "$ASSETS_DIR/notification-icon.svg" "$ASSETS_DIR/notification-icon.png" 96 && ok "notification-icon.png (96x96)"
  convert_svg "$ASSETS_DIR/favicon.svg" "$ASSETS_DIR/favicon.png" 64 && ok "favicon.png (64x64)"

  echo ""
  ok "All assets generated!"
else
  echo ""
  echo -e "${YELLOW}[WARN]${NC} No SVG converter found. Install one:"
  echo "  Ubuntu/Debian:  sudo apt-get install inkscape"
  echo "  macOS (brew):   brew install inkscape"
  echo "  Alternative:    sudo apt-get install librsvg2-bin"
  echo ""
  echo "SVG sources are ready in $ASSETS_DIR"
  echo "Convert manually or install a converter and re-run this script."
fi
