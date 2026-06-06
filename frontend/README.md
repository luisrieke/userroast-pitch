# Hamburg Hackathon — Product-Gap Scanner

Point the app at a public GitHub repo. The backend spawns a Modal function that
runs an OpenCode (Claude) agent to analyze the codebase for product gaps and
missing features, reporting progress and findings back in real time.

## Architecture

- **Frontend** (Vite + React + TS): submits a repo URL and polls for progress.
- **Backend** (FastAPI, local): `POST /api/scans` creates a job and spawns the
  Modal function; `GET /api/scans/{job_id}` returns the current state.
- **Modal** (`backend/modal_app.py`): `analyze_repo` clones the repo, runs
  `opencode run` headlessly, and the agent `curl`s findings to an in-container
  callback server that relays them into a shared `modal.Dict` (`codescan-jobs`).
  The backend reads the same Dict — no public URL needed.

## One-time setup

API keys live in the repo-root `.env` (`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`,
`ANTHROPIC_API_KEY`). The backend loads it automatically; the Modal CLI needs
the tokens in its env, so source `.env` before deploying. The Anthropic key is
baked into a Modal Secret from `.env` at deploy time (via `Secret.from_dotenv`),
so no manual secret creation is needed.

Deploy the Modal app so the local backend can spawn it and share the Dict. Run
it through `uv` from the `backend/` dir so the CLI uses the project env (which
has `python-dotenv`, required by `Secret.from_dotenv`):

```bash
cd backend
uv sync
uv run modal deploy modal_app.py
```

## Run

Backend:

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

The backend runs at `http://127.0.0.1:8000`.

Frontend:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

The frontend runs at `http://localhost:5173`.

## Health Check

```bash
curl http://127.0.0.1:8000/health
```

## Usage

1. Open the frontend, paste a public GitHub URL (e.g.
   `https://github.com/owner/repo`), and click **Scan**.
2. Watch the progress timeline and findings populate as the agent works.

> Hackathon posture: endpoints are unauthenticated and OpenCode runs with
> `--dangerously-skip-permissions`. Don't ship this as-is.
