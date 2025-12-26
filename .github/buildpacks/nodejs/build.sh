#!/bin/bash
# Node.js Buildpack Builder
# Simple npm install - no build step needed

set -e

APP_DIR="$1"

echo "📦 Preparing Node.js app..."
cd "$APP_DIR"

if [ -f "package.json" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "✓ Node.js app ready!"
