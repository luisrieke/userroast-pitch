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

log "Deploying Modal app"
cd "$APP_DIR/backend"
set -a && . "$APP_DIR/.env" && set +a
uv run modal deploy modal_app.py

log "Restarting backend service"
systemctl restart userroast-backend
systemctl status userroast-backend --no-pager

log "Reloading Caddy"
systemctl reload caddy

log "Smoke test"
curl -fsS https://userroast.com/health && echo

log "Deploy complete"
