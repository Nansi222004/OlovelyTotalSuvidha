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
git pull origin main

echo "=========================================="
echo "  2. Installing & Building Backend...     "
echo "=========================================="
cd "$PROJECT_DIR/backend" || exit 1
npm install
npm run build

echo "=========================================="
echo "  3. Installing & Building Frontend...    "
echo "=========================================="
cd "$PROJECT_DIR/frontend" || exit 1
npm install
npm run build

echo "=========================================="
echo "  4. Restarting PM2 Application Services. "
echo "=========================================="
pm2 restart all || pm2 reload all

echo "=========================================="
echo "  Deployment Completed Successfully! 🟢   "
echo "=========================================="
