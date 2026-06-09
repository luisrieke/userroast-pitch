#!/usr/bin/env bash
#
# Deploy the latest version of userroast on the VM.
# Pulls the newest code, rebuilds the frontend, restarts the backend service,
# and redeploys the Modal app. Run on the server as root (or with sudo).
#
#   sudo /opt/userroast/deploy/deploy.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/userroast}"

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

cd "$APP_DIR"

log "Pulling latest code"
git pull

log "Building frontend"
cd "$APP_DIR/frontend"
pnpm install
npm run build   # outputs frontend/dist

# Deploy the Modal app that actually runs the repo analyzer. Without this step
# changes to backend/modal_app.py never reach production — the backend keeps
# spawning the previously-deployed version of the function. Set DEPLOY_MODAL=0
# to skip (e.g. on a host without Modal credentials).
if [ "${DEPLOY_MODAL:-1}" = "1" ]; then
  log "Deploying Modal app"
  cd "$APP_DIR/backend"
  set -a && . "$APP_DIR/.env" && set +a
  uv run modal deploy modal_app.py
  cd "$APP_DIR"
else
  log "Skipping Modal deploy (DEPLOY_MODAL=0)"
fi

log "Restarting backend service"
systemctl restart userroast-backend
systemctl status userroast-backend --no-pager

log "Reloading Caddy"
systemctl reload caddy

log "Smoke test"
curl -fsS https://userroast.com/health && echo

log "Deploy complete"
