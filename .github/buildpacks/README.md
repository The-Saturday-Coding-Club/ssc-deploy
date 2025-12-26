# Buildpacks

This directory contains buildpacks for different frameworks.

## Structure

Each buildpack has 3 files:
- `detect.sh` - Detects if this buildpack applies (exit 0 = match)
- `build.sh` - Builds the application
- `runtime.js` - (Optional) Lambda wrapper for the app

## Available Buildpacks

### vite/
Supports Vite-based apps (React, Vue, etc.)
- Runs `npm run build`
- Serves from `dist/` folder
- Includes SPA routing

### nodejs/
Fallback for plain Node.js Lambda functions
- Runs `npm install`
- No wrapper needed (uses existing index.js)

## Adding a New Buildpack

1. Create folder: `.github/buildpacks/my-framework/`
2. Add `detect.sh` (must exit 0 if framework detected)
3. Add `build.sh` (build steps)
4. Add `runtime.js` (if runtime wrapper needed)

Example:
```bash
mkdir -p .github/buildpacks/nextjs
# ... create files ...
```
