#!/bin/bash
# Node.js Buildpack Detector (Fallback)
# Always matches - this is the default buildpack

APP_DIR="$1"

if [ ! -f "$APP_DIR/package.json" ]; then
  # No package.json - maybe a plain JS file
  if [ -f "$APP_DIR/index.js" ]; then
    echo "✓ Detected plain Node.js app"
    exit 0
  fi
  exit 1
fi

echo "✓ Detected Node.js app (fallback)"
exit 0
