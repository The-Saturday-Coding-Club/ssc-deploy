#!/bin/bash
# Vite Buildpack Builder
# Builds a Vite application

set -e

APP_DIR="$1"

echo "📦 Building Vite app..."
cd "$APP_DIR"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the app
echo "Building production bundle..."
npm run build

echo "✓ Vite build complete! Output in dist/"
