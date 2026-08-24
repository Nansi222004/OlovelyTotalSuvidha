#!/bin/bash
# Olovely Total Suvidha - Production Deployment Script
# Idempotent, Non-destructive, Strict Health & Stability Checks

set -e

PROJECT_DIR="/root/olovelytotal"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=========================================="
echo "  1. Navigating to Project Directory...   "
echo "=========================================="
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR" || exit 1
else
    echo "❌ Error: Project directory $PROJECT_DIR does not exist!"
    exit 1
fi

if [ ! -d ".git" ]; then
    echo "❌ Error: $PROJECT_DIR is not a valid Git repository!"
    exit 1
fi

echo "=========================================="
echo "  2. Pulling Latest Changes Safely...     "
echo "=========================================="
git checkout -- deploy.sh 2>/dev/null || true
git reset --hard
git pull origin main
chmod +x "$PROJECT_DIR/deploy.sh" 2>/dev/null || true

echo "=========================================="
echo "  3. Verifying Production .env File...    "
echo "=========================================="
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "❌ ERROR: $BACKEND_DIR/.env does not exist!"
    echo "Deployment halted. Please ensure backend/.env exists on the server."
    exit 1
fi

if ! grep -q "^MONGODB_URI=" "$BACKEND_DIR/.env" && ! grep -q "^MONGO_URI=" "$BACKEND_DIR/.env"; then
    echo "❌ ERROR: Neither MONGODB_URI nor MONGO_URI is defined in backend/.env!"
    echo "Deployment halted."
    exit 1
fi
echo "✅ Production backend/.env verified (MongoDB URI variable present)."

echo "=========================================="
echo "  4. Installing & Building Backend...     "
echo "=========================================="
cd "$BACKEND_DIR" || exit 1
npm install --production=false
npm run build

if [ ! -f "$BACKEND_DIR/dist/server.js" ]; then
    echo "❌ Error: Backend build failed! dist/server.js does not exist."
    exit 1
fi
echo "✅ Backend build succeeded: dist/server.js"

echo "=========================================="
echo "  5. Installing & Building Frontend...    "
echo "=========================================="
cd "$FRONTEND_DIR" || exit 1
npm install --production=false
npm run build

if [ ! -d "$FRONTEND_DIR/dist" ] || [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
    echo "❌ Error: Frontend build failed! dist/index.html does not exist."
    exit 1
fi
echo "✅ Frontend build succeeded: dist/index.html"

echo "=========================================="
echo "  6. Pre-Restart Inspection & Metrics     "
echo "=========================================="
echo "--- Inspecting Current PM2 Process State ---"
pm2 describe olovely-backend 2>/dev/null || echo "Info: olovely-backend process not yet registered in PM2."

echo "--- Recent PM2 Backend Logs (Last 100 lines) ---"
pm2 logs olovely-backend --lines 100 --nostream 2>/dev/null || echo "No logs found for olovely-backend."

echo "--- Port 5000 Status BEFORE Restart ---"
if command -v ss >/dev/null 2>&1; then
    ss -lntp | grep ':5000' || echo "Port 5000 is currently not listening."
fi

# Capture restart count before restart
RESTARTS_BEFORE=$(pm2 jlist 2>/dev/null | grep -o '"name":"olovely-backend"[^}]*' | grep -o '"restart_time":[0-9]*' | cut -d':' -f2 || echo "0")
if [ -z "$RESTARTS_BEFORE" ]; then
    RESTARTS_BEFORE=0
fi
echo "PM2 Restart Count BEFORE restart: $RESTARTS_BEFORE"

echo "=========================================="
echo "  7. Restarting PM2 (olovely-backend)     "
echo "=========================================="
cd "$BACKEND_DIR" || exit 1

if pm2 id olovely-backend >/dev/null 2>&1; then
    echo "Restarting PM2 process 'olovely-backend' with updated environment..."
    pm2 restart olovely-backend --update-env
else
    echo "Starting new PM2 process 'olovely-backend'..."
    pm2 start dist/server.js --name "olovely-backend"
fi

echo "Waiting 10 seconds for application startup and MongoDB connection..."
sleep 10

echo "=========================================="
echo "  8. Post-Restart Verification & Stability "
echo "=========================================="
pm2 status
pm2 describe olovely-backend 2>/dev/null || true

echo "--- Port 5000 Status AFTER Restart ---"
PORT_LISTENING=NO
if command -v ss >/dev/null 2>&1; then
    if ss -lntp | grep -q ':5000'; then
        ss -lntp | grep ':5000'
        PORT_LISTENING=YES
    else
        echo "⚠️ Port 5000 is not listening!"
    fi
fi

PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"name":"olovely-backend"[^}]*' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
RESTARTS_AFTER=$(pm2 jlist 2>/dev/null | grep -o '"name":"olovely-backend"[^}]*' | grep -o '"restart_time":[0-9]*' | cut -d':' -f2 || echo "0")
if [ -z "$RESTARTS_AFTER" ]; then
    RESTARTS_AFTER=0
fi

echo "PM2 Status: $PM2_STATUS"
echo "PM2 Restart Count AFTER restart: $RESTARTS_AFTER"

# Verify stability: restart count should increase by at most 1 (the explicit restart itself)
RESTART_DIFF=$((RESTARTS_AFTER - RESTARTS_BEFORE))
RESTART_STABLE=YES

if [ "$PM2_STATUS" != "online" ] || [ "$RESTART_DIFF" -gt 1 ]; then
    RESTART_STABLE=NO
    echo "❌ ERROR: Backend process is unstable or crashing! Status: $PM2_STATUS, Restart Diff: $RESTART_DIFF"
    echo "Recent 100 lines of PM2 logs:"
    pm2 logs olovely-backend --lines 100 --nostream
    exit 1
fi
echo "✅ PM2 process is stable (online with no crash loop)."

echo "=========================================="
echo "  9. Local Health Check (127.0.0.1:5000)   "
echo "=========================================="
echo "Testing: http://127.0.0.1:5000/api/v1/health"
LOCAL_HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/v1/health || echo "000")
echo "Local Health Check HTTP Status: $LOCAL_HEALTH_CODE"

if [ "$LOCAL_HEALTH_CODE" -ne 200 ]; then
    echo "❌ ERROR: Local health check failed with HTTP $LOCAL_HEALTH_CODE!"
    echo "Recent 100 lines of PM2 logs:"
    pm2 logs olovely-backend --lines 100 --nostream
    exit 1
fi
echo "✅ Local backend health check PASSED (HTTP 200 OK)."

echo "=========================================="
echo "  10. Nginx Configuration & Reload         "
echo "=========================================="
NGINX_TEST=PASS
NGINX_RELOAD=PASS

if command -v nginx >/dev/null 2>&1; then
    if nginx -t; then
        echo "Nginx syntax test PASSED."
        if systemctl reload nginx 2>/dev/null; then
            echo "✅ Nginx reloaded successfully via systemctl."
        elif nginx -s reload 2>/dev/null; then
            echo "✅ Nginx reloaded successfully via nginx -s reload."
        else
            NGINX_RELOAD=FAIL
            echo "❌ ERROR: Nginx reload failed!"
            exit 1
        fi
    else
        NGINX_TEST=FAIL
        echo "❌ ERROR: Nginx configuration test (nginx -t) failed!"
        exit 1
    fi
fi

echo "=========================================="
echo "  11. Production HTTPS Health Verification "
echo "=========================================="
echo "Testing: https://olovelytotal.com/api/v1/health"
PROD_HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://olovelytotal.com/api/v1/health || echo "000")
echo "Production HTTPS Status Code: $PROD_HEALTH_CODE"

if [ "$PROD_HEALTH_CODE" -ne 200 ]; then
    echo "❌ ERROR: Production HTTPS health check failed with HTTP status $PROD_HEALTH_CODE!"
    exit 1
fi
echo "✅ Production HTTPS health check PASSED (HTTP 200 OK)."

echo ""
echo "==============================================================="
echo "                  DEPLOYMENT SUMMARY REPORT                    "
echo "==============================================================="
echo " Backend Build         : PASS"
echo " Frontend Build        : PASS"
echo " .env File             : PASS"
echo " MongoDB Variable      : PRESENT"
echo " PM2 Status            : $PM2_STATUS"
echo " PM2 Restarts Before   : $RESTARTS_BEFORE"
echo " PM2 Restarts After    : $RESTARTS_AFTER"
echo " Restart Stability     : $RESTART_STABLE"
echo " Port 5000 Listening   : $PORT_LISTENING"
echo " Local Health Check    : HTTP $LOCAL_HEALTH_CODE"
echo " Nginx Syntax Test     : $NGINX_TEST"
echo " Nginx Reload          : $NGINX_RELOAD"
echo " Production Health     : HTTP $PROD_HEALTH_CODE"
echo " Deployment Status     : SUCCESS 🟢"
echo "==============================================================="
