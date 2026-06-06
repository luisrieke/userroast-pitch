# Deploying userroast on a Hetzner VM

Single-origin setup: Caddy terminates TLS for `userroast.com`, serves the built
React SPA, and reverse-proxies `/api/*` + `/health` to the FastAPI backend on
`127.0.0.1:8000`. The backend spawns and reads the already-deployed Modal
`codescan` app. Because everything is one origin, there are no CORS concerns.

Run these steps on a fresh Ubuntu VM (as `root`, or prefix with `sudo`).

## 1. DNS (Cloudflare)

- Add an `A` record: `userroast.com` -> your VM's public IP.
- Add an `A` record: `www.userroast.com` -> your VM's public IP.
- Set both to **DNS only** (grey cloud) so Caddy can complete the Let's Encrypt
  HTTP challenge. You can switch the proxy on later (use SSL mode **Full**).

## 2. Base packages

```bash
apt update && apt install -y git curl caddy nodejs npm
curl -LsSf https://astral.sh/uv/install.sh | sh
```

`uv` installs to `/root/.local/bin/uv` (matches the systemd unit). Confirm with
`which uv` and adjust `ExecStart` in the unit file if your path differs.

## 3. Clone the repo + copy secrets

```bash
git clone <your-repo-url> /opt/userroast
```

The repo-root `.env` is **gitignored** and holds live secrets
(`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `ANTHROPIC_API_KEY`). Copy it from your
machine (never commit it):

```bash
scp .env root@<VM_IP>:/opt/userroast/.env
```

## 4. Deploy the Modal app from the VM

```bash
cd /opt/userroast/backend
uv sync
set -a && . ../.env && set +a
uv run modal deploy modal_app.py
```

## 5. Build the frontend

```bash
cd /opt/userroast/frontend
npm install
npm run build   # outputs frontend/dist
```

## 6. Backend service (systemd)

```bash
cp /opt/userroast/deploy/userroast-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now userroast-backend
systemctl status userroast-backend --no-pager
```

## 7. Caddy (TLS + static + proxy)

```bash
cp /opt/userroast/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

## 8. Smoke test

```bash
curl https://userroast.com/health   # -> {"status":"ok"}
```

Then open https://userroast.com, paste a public GitHub repo, and roast it.
Deep links like `https://userroast.com/roast/<job_id>` work because Caddy falls
back to `index.html` for non-API routes.

## Updating after a code change

```bash
cd /opt/userroast && git pull
cd frontend && npm install && npm run build           # frontend changes
systemctl restart userroast-backend                   # backend changes
cd ../backend && set -a && . ../.env && set +a && uv run modal deploy modal_app.py  # Modal changes
```
