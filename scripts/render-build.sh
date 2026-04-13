#!/bin/bash
set -e

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🎨 Building frontend..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/tg-game run build

echo "⚙️ Building API server..."
pnpm --filter @workspace/api-server run build

echo "🗄️ Syncing database schema..."
pnpm --filter @workspace/db push || echo "⚠️ DB push failed (may already be up to date)"

echo "✅ Build complete!"
