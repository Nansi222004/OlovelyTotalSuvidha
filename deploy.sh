#!/bin/bash

# ============================================================
# Olovely Total Suvidha - Production Deployment
# ============================================================

set -Eeuo pipefail

PROJECT_DIR="/root/olovelytotal"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
APP_NAME="olovely-backend"
PORT="5000"
DOMAIN="olovelytotal.com"

# ------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------

log() {
    echo "▶ $1"
}

success() {
    echo "✅ $1"
}

error() {
    echo "❌ $1"
}

fail() {
    error "$1"
    exit 1
}

# ------------------------------------------------------------
# 1. Check required commands
# ------------------------------------------------------------

log "Checking required commands..."

for cmd in git npm node pm2 curl; do
    command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is not installed."
done

success "Required commands available."

# ------------------------------------------------------------
# 2. Project directory
# ------------------------------------------------------------

log "Checking project directory..."

[ -d "$PROJECT_DIR" ] || fail "Project directory does not exist: $PROJECT_DIR"
[ -d "$PROJECT_DIR/.git" ] || fail "Not a Git repository: $PROJECT_DIR"

cd "$PROJECT_DIR"

success "Project directory verified."

# ------------------------------------------------------------
# 3. Pull latest code
# ------------------------------------------------------------

log "Pulling latest code from main..."

git fetch origin main
git reset --hard origin/main

chmod +x "$PROJECT_DIR/deploy.sh"

success "Latest code deployed from origin/main."

# ------------------------------------------------------------
# 4. Verify backend .env
# ------------------------------------------------------------

log "Checking production environment..."

[ -f "$BACKEND_DIR/.env" ] || fail "backend/.env does not exist."

grep -qE '^MONGODB_URI=|^MONGO_URI=' "$BACKEND_DIR/.env" \
    || fail "MongoDB URI is missing from backend/.env."

grep -q '^NODE_ENV=production' "$BACKEND_DIR/.env" \
    || fail "NODE_ENV=production is missing from backend/.env."

grep -q '^PORT=5000' "$BACKEND_DIR/.env" \
    || fail "PORT=5000 is missing from backend/.env."

success "Production environment verified."

# ------------------------------------------------------------
# 5. Build backend
# ------------------------------------------------------------

log "Installing backend dependencies..."

cd "$BACKEND_DIR"

npm install --production=false >/tmp/olovely-backend-install.log 2>&1 \
    || {
        cat /tmp/olovely-backend-install.log
        fail "Backend npm install failed."
    }

success "Backend dependencies installed."

log "Building backend..."

npm run build >/tmp/olovely-backend-build.log 2>&1 \
    || {
        cat /tmp/olovely-backend-build.log
        fail "Backend build failed."
    }

[ -f "$BACKEND_DIR/dist/server.js" ] \
    || fail "Backend build completed but dist/server.js was not found."

success "Backend build successful."

# ------------------------------------------------------------
# 6. Build frontend
# ------------------------------------------------------------

log "Installing frontend dependencies..."

cd "$FRONTEND_DIR"

npm install --production=false >/tmp/olovely-frontend-install.log 2>&1 \
    || {
        cat /tmp/olovely-frontend-install.log
        fail "Frontend npm install failed."
    }

success "Frontend dependencies installed."

log "Building frontend..."

npm run build >/tmp/olovely-frontend-build.log 2>&1 \
    || {
        cat /tmp/olovely-frontend-build.log
        fail "Frontend build failed."
    }

[ -f "$FRONTEND_DIR/dist/index.html" ] \
    || fail "Frontend build completed but dist/index.html was not found."

success "Frontend build successful."

# ------------------------------------------------------------
# 7. PM2 restart
# ------------------------------------------------------------

cd "$BACKEND_DIR"

log "Restarting backend..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env >/dev/null
else
    pm2 start dist/server.js \
        --name "$APP_NAME" \
        --time >/dev/null
fi

sleep 8

# ------------------------------------------------------------
# 8. Verify PM2 status
# ------------------------------------------------------------

PM2_STATUS=$(pm2 jlist | node -e '
let data = "";
process.stdin.on("data", chunk => data += chunk);
process.stdin.on("end", () => {
    try {
        const apps = JSON.parse(data);
        const app = apps.find(x => x.name === "olovely-backend");
        console.log(app?.pm2_env?.status || "unknown");
    } catch {
        console.log("unknown");
    }
});
')

if [ "$PM2_STATUS" != "online" ]; then
    error "Backend is not online."

    echo ""
    echo "Recent backend errors:"
    pm2 logs "$APP_NAME" --err --lines 30 --nostream || true

    exit 1
fi

success "PM2 backend is online."

# ------------------------------------------------------------
# 9. Verify port
# ------------------------------------------------------------

log "Checking port $PORT..."

if command -v ss >/dev/null 2>&1; then
    if ! ss -lnt | grep -q ":$PORT "; then
        fail "Port $PORT is not listening."
    fi
fi

success "Port $PORT is listening."

# ------------------------------------------------------------
# 10. Local health check
# ------------------------------------------------------------

log "Checking local backend health..."

LOCAL_HEALTH=$(curl -sS \
    --max-time 10 \
    -o /dev/null \
    -w "%{http_code}" \
    "http://127.0.0.1:$PORT/api/v1/health" || echo "000")

if [ "$LOCAL_HEALTH" != "200" ]; then
    error "Local health check failed: HTTP $LOCAL_HEALTH"

    echo ""
    echo "Recent backend errors:"
    pm2 logs "$APP_NAME" --err --lines 30 --nostream || true

    exit 1
fi

success "Local health check passed: HTTP 200."

# ------------------------------------------------------------
# 11. Nginx verification
# ------------------------------------------------------------

if command -v nginx >/dev/null 2>&1; then

    log "Checking Nginx configuration..."

    if ! nginx -t >/tmp/olovely-nginx-test.log 2>&1; then
        cat /tmp/olovely-nginx-test.log
        fail "Nginx configuration test failed."
    fi

    systemctl reload nginx >/dev/null 2>&1 \
        || fail "Nginx reload failed."

    success "Nginx configuration valid and reloaded."

fi

# ------------------------------------------------------------
# 12. HTTPS health check
# ------------------------------------------------------------

log "Checking production HTTPS..."

PROD_HEALTH=$(curl -sS \
    --max-time 15 \
    -o /dev/null \
    -w "%{http_code}" \
    "https://$DOMAIN/api/v1/health" || echo "000")

if [ "$PROD_HEALTH" != "200" ]; then
    error "Production HTTPS health check failed: HTTP $PROD_HEALTH"

    echo ""
    echo "Check Nginx and backend logs:"
    pm2 logs "$APP_NAME" --err --lines 30 --nostream || true

    exit 1
fi

success "Production HTTPS health check passed: HTTP 200."

# ------------------------------------------------------------
# 13. Save PM2 process list
# ------------------------------------------------------------

pm2 save >/dev/null

# ------------------------------------------------------------
# 14. Final status
# ------------------------------------------------------------

echo ""
echo "============================================================"
echo "              DEPLOYMENT SUCCESSFUL 🟢"
echo "============================================================"
echo " Project       : Olovely Total Suvidha"
echo " Backend       : Built"
echo " Frontend      : Built"
echo " Environment   : Production"
echo " PM2           : Online"
echo " Port          : $PORT"
echo " Local Health  : HTTP $LOCAL_HEALTH"
echo " HTTPS Health  : HTTP $PROD_HEALTH"
echo " Nginx         : OK"
echo "============================================================"
echo ""

# Only show the concise PM2 status.
pm2 status