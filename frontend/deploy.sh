#!/bin/bash
set -e

# Navigate to frontend directory
cd "$(dirname "$0")"

echo "🚀 Starting frontend deployment to GitHub Pages..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install --silent
fi

# Build Tailwind CSS
echo "🎨 Building CSS..."
npm run build --silent

# Create deployment directory
echo "📦 Preparing deployment files..."
rm -rf dist
mkdir -p dist
cp index.html app.js style.css dist/
[ -d "assets" ] && cp -r assets/ dist/assets/

# Configure git user (needed for CI/CD)
git config --global user.name "GitHub Actions"
git config --global user.email "actions@github.com"

# Deploy to GitHub Pages
echo "🚀 Publishing to GitHub Pages..."
npx gh-pages@latest --dist dist --dotfiles --silent

echo "✅ Successfully deployed! Your app is now live at:"
echo "https://$(git config --get remote.origin.url | sed -E 's/.*github.com[\/:](.*)\/(.*).git/\1.github.io\/\2/')"