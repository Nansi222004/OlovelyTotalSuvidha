#!/bin/bash
# Olovely Total Suvidha Deployment Script

PROJECT_DIR="/root/olovelytotal"

# Ensure we are in the project root directory
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR" || exit 1
else
    cd "$(dirname "$0")" || exit 1
fi

echo "=========================================="
echo "  1. Pulling latest code from GitHub...   "
echo "=========================================="
git checkout -- deploy.sh 2>/dev/null || true
git reset --hard
git clean -fd
git pull origin main

echo "=========================================="
echo "  2. Updating Environment Configuration... "
echo "=========================================="
# Copy from .env.example if backend/.env is missing
if [ ! -f "$PROJECT_DIR/backend/.env" ] && [ -f "$PROJECT_DIR/backend/.env.example" ]; then
    cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
    echo "Created backend/.env from .env.example"
fi

# Remove duplicate MONGO_URI line from backend/.env if present
if [ -f "$PROJECT_DIR/backend/.env" ]; then
    sed -i '/^MONGO_URI=/d' "$PROJECT_DIR/backend/.env"
    echo "Cleaned up MONGO_URI in backend/.env"
fi

echo "=========================================="
echo "  3. Installing & Building Backend...     "
echo "=========================================="
cd "$PROJECT_DIR/backend" || exit 1
npm install
npm run build

echo "=========================================="
echo "  4. Installing & Building Frontend...    "
echo "=========================================="
cd "$PROJECT_DIR/frontend" || exit 1
npm install
npm run build

echo "=========================================="
echo "  5. Restarting PM2 Application Services. "
echo "=========================================="
pm2 restart all || pm2 reload all

echo "=========================================="
echo "  Deployment Completed Successfully! 🟢   "
echo "=========================================="
