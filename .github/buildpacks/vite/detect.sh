#!/bin/bash
# Vite Buildpack Detector
# Returns 0 (success) if this is a Vite app

APP_DIR="$1"

if [ ! -f "$APP_DIR/package.json" ]; then
  exit 1
fi

# Check if package.json contains vite
if grep -q '"vite"' "$APP_DIR/package.json" 2>/dev/null; then
  echo "✓ Detected Vite app"
  exit 0
fi

exit 1
