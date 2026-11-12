#!/bin/bash

# ============================================================
# Olovely Total Suvidha - Production Deployment
# ============================================================

set -Eeuo pipefail

# Wrapped in { ... } so bash parses the WHOLE script before executing it: `git reset`
# below rewrites this file, and a changed deploy.sh must not take effect mid-run.
{

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
# 3. Fetch, SECURITY-CHECK, then deploy latest code
# ------------------------------------------------------------
#
# The GitHub repo was repeatedly force-pushed with forged commits carrying a
# Node.js trojan (Aug–Nov 2026). Every new commit is inspected IN GIT (nothing is
# checked out, installed or built) before the working tree is updated.
#
# Overrides (use only after you have checked the commit yourself):
#   EXPECTED_COMMIT=<sha>        deploy only if origin/main is exactly this commit
#   ALLOW_FOREIGN_TZ=1           accept commits not committed in IST (+0530)
#   ALLOW_DEPLOY_SCRIPT_CHANGE=1 accept a new version of deploy.sh

security_guard() {
    local REF="$1"
    local problems=0
    local TAB
    TAB="$(printf '\t')"

    flag() {
        error "SECURITY: $1"
        problems=$((problems + 1))
    }

    log "Security check of $(git rev-parse --short "$REF")..."
    git log -1 --format='   commit    %H%n   author    %an  %ad%n   committer %cn  %cd%n   message   %s' --date=iso "$REF"

    # 0. Exact commit pin
    if [ -n "${EXPECTED_COMMIT:-}" ]; then
        case "$(git rev-parse "$REF")" in
            "$EXPECTED_COMMIT"*) ;;
            *) flag "origin/main is not EXPECTED_COMMIT=$EXPECTED_COMMIT" ;;
        esac
    fi

    # 1. Forged-commit fingerprint: every forged commit was committed outside IST
    if [ "${ALLOW_FOREIGN_TZ:-0}" != "1" ]; then
        local foreign
        foreign="$(git log --format='%h %cd %cn | %s' --date=format:'%Y-%m-%d %H:%M %z' "HEAD..$REF" | grep -v ' +0530 ' || true)"
        local tip_tz
        tip_tz="$(git log -1 --format='%cd' --date=format:'%z' "$REF")"
        if [ -n "$foreign" ] || [ "$tip_tz" != "+0530" ]; then
            flag "commit(s) not committed in IST (+0530) — this is how the forged commits looked:"
            echo "${foreign:-   tip commit timezone $tip_tz}" | sed 's/^/     /'
        fi
    fi

    # 2. npm scripts must not run an extra file before the real command
    local pj
    for pj in backend/package.json frontend/package.json; do
        if git show "$REF:$pj" 2>/dev/null \
            | grep -E '"(build|start|dev|preview|prebuild|prestart|predev|postinstall|preinstall|install|prepare)"[[:space:]]*:' \
            | grep -qE 'node[[:space:]]+[^ "]+\.?(js|cjs|mjs)?[[:space:]]*&&|node[[:space:]]+(init|api)'; then
            flag "$pj runs a file with node before build/start/dev"
            git show "$REF:$pj" | grep -nE 'node[[:space:]]+[^ "]+[[:space:]]*&&' | sed 's/^/     /'
        fi
    done

    # 3. Known trojan files / loader leftovers
    local bad
    bad="$(git ls-tree -r --name-only "$REF" | grep -E '^(backend|frontend)/(init|api\.js)$|(^|/)config\.bat$|\.bat$' || true)"
    [ -n "$bad" ] && flag "suspicious files present: $(echo "$bad" | tr '\n' ' ')"
    if git grep -q -I "createRequire" "$REF" -- 'frontend/postcss.config.*' 'frontend/tailwind.config.*' 'frontend/vite.config.*' 2>/dev/null; then
        flag "createRequire found in a frontend build config (malware loader pattern)"
    fi

    # 4a. Malware signatures anywhere in JS/TS
    local sig
    sig="$(git grep -n -I -F \
        -e 'spawnNodeScript' \
        -e 'x-payload-b64' \
        -e '.split("").reverse().join("")' \
        -e "global['\\u0072']" \
        -e '/0x/cls' \
        -e 'INDEXER_URL' \
        "$REF" -- '*.js' '*.cjs' '*.mjs' '*.ts' '*.tsx' 2>/dev/null | cut -c1-160 || true)"
    [ -n "$sig" ] && { flag "malware signature found:"; echo "$sig" | head -10 | sed 's/^/     /'; }

    # 4b. Code hidden after long runs of spaces/tabs (how every payload was hidden)
    local ws
    ws="$(git grep -l -I -E "[ ${TAB}]{100,}[^ ${TAB}]" "$REF" -- '*.js' '*.cjs' '*.mjs' '*.ts' '*.tsx' 2>/dev/null || true)"
    [ -n "$ws" ] && flag "code hidden after long whitespace in: $(echo "$ws" | tr '\n' ' ')"

    # 4c. Abnormally long lines in JS/TS (payloads were 7,000–35,000 chars on one line)
    local f long=""
    while IFS= read -r f; do
        if git show "$REF:$f" 2>/dev/null | awk 'length > 1500 { found = 1; exit } END { exit !found }'; then
            long="$long $f"
        fi
    done < <(git ls-tree -r --name-only "$REF" | grep -E '\.(js|cjs|mjs|ts)$' | grep -vE '(^|/)(node_modules|dist|build)/|\.min\.js$')
    [ -n "$long" ] && flag "lines longer than 1500 characters in:$long"

    # 5. .env must stay out of git
    if ! git show "$REF:.gitignore" 2>/dev/null | grep -qE '^\.env$'; then
        flag ".gitignore no longer ignores .env (secrets would be committed)"
    fi

    # 6. A new deploy.sh could disable these checks
    if [ "${ALLOW_DEPLOY_SCRIPT_CHANGE:-0}" != "1" ] && ! git diff --quiet HEAD "$REF" -- deploy.sh; then
        flag "deploy.sh itself changed in the new commit — review: git diff HEAD $REF -- deploy.sh"
    fi

    if [ "$problems" -gt 0 ]; then
        echo ""
        fail "Deployment BLOCKED: $problems security problem(s). Nothing was checked out, installed or built."
    fi
    success "Security check passed."
}

log "Fetching latest code from main..."

git fetch origin main

security_guard "origin/main"

git reset --hard origin/main

chmod +x "$PROJECT_DIR/deploy.sh"

success "Latest code deployed from origin/main ($(git rev-parse --short HEAD))."

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

exit 0
}
