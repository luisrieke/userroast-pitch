"""Modal app that runs OpenCode (Claude) to analyze a GitHub repo for product gaps.

Deploy with:  modal deploy backend/modal_app.py

The local FastAPI backend spawns `analyze_repo` and reads job state from the
shared `codescan-jobs` modal.Dict.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import modal

APP_NAME = "codescan"
DICT_NAME = "codescan-jobs"
MODEL = "anthropic/claude-sonnet-4-5"
CALLBACK_PORT = 9999

# Fixed scoring categories (key -> display label). Findings reuse these keys.
CATEGORIES = [
    ("feature", "Feature completeness"),
    ("ux", "UX"),
    ("integration", "Integrations"),
    ("reliability", "Reliability"),
    ("security", "Security"),
]
CATEGORY_KEYS = {key for key, _ in CATEGORIES}

# Audit scope ladder (key -> (label, grading guidance)), lenient -> strict.
# The selected scope calibrates how harshly the agent scores each category.
SCOPES = {
    "hackathon": (
        "Hackathon project",
        "This was thrown together in a weekend to prove an idea. Judge the core "
        "concept and whether the main feature works at all. Do NOT penalize "
        "missing tests, observability, hardening, polish, or production ops - "
        "score those categories generously and focus roasts on the core idea.",
    ),
    "mvp": (
        "MVP / prototype",
        "This is an early MVP. The core flow should work end to end with light "
        "tolerance for rough edges. Expect basic error handling but go easy on "
        "advanced reliability, integrations, and security hardening.",
    ),
    "beta": (
        "Beta",
        "This is a beta product with real users. Most features should be done; "
        "UX, reliability, and integrations now matter. Hold a moderate bar and "
        "expect reasonable error handling and security basics.",
    ),
    "production": (
        "Production",
        "This is a production product. Hold it to a high, best-in-class bar "
        "across every category - feature depth, polished UX, solid integrations, "
        "reliability/observability, and real security. Be strict and unforgiving.",
    ),
}
DEFAULT_SCOPE = "hackathon"


def _normalize_scope(scope: str | None) -> str:
    return scope if scope in SCOPES else DEFAULT_SCOPE

app = modal.App(APP_NAME)

# Shared store between the local backend and this Modal function.
jobs = modal.Dict.from_name(DICT_NAME, create_if_missing=True)

# API keys are sourced from the repo-root .env at deploy time (ANTHROPIC_API_KEY
# etc. are baked into a Modal Secret). No manual `modal secret create` needed.
ENV_DIR = Path(__file__).resolve().parents[1]
anthropic_secret = modal.Secret.from_dotenv(ENV_DIR)

image = (
    modal.Image.debian_slim()
    .apt_install("curl", "git")
    .run_commands("curl -fsSL https://opencode.ai/install | bash")
    .env({"PATH": "/root/.opencode/bin:${PATH}"})
    .uv_pip_install("modal")
)


def build_analysis_prompt(scope: str) -> str:
    scope = _normalize_scope(scope)
    scope_label, scope_guidance = SCOPES[scope]
    scope_section = (
        f"AUDIT SCOPE: the author says this product is at the "
        f"\"{scope_label}\" stage. Calibrate every score to expectations for "
        f"that stage - {scope_guidance}\n\n"
    )
    return scope_section + _ANALYSIS_PROMPT_BODY


_ANALYSIS_PROMPT_BODY = f"""\
You are a senior product strategist and staff engineer running a Lighthouse-style \
audit of the codebase in the current directory. You grade the product on 5 fixed \
categories (0-100 each), roast each one, and list the concrete gaps with fixes.

The 5 fixed categories (use these exact keys):
- feature      → Feature completeness
- ux           → UX
- integration  → Integrations
- reliability  → Reliability
- security     → Security

Steps:
1. Read the README, docs, package manifests, and skim the source to infer the \
product's purpose and its target customers.
2. For each category, judge how complete/strong it is and assign a score from 0 \
(broken/absent) to 100 (best-in-class). Be honest and a little harsh.
3. Identify concrete gaps within each category: missing features, weak UX, missing \
integrations, reliability/observability gaps, security gaps. Each gap needs an \
actionable fix.

IMPORTANT - report as you go by calling the local reporting endpoint with the \
`bash` tool. The endpoint base URL is in the CALLBACK_URL environment variable.

- When you start a meaningful step, post progress:
  curl -s -X POST "$CALLBACK_URL/progress" -H 'Content-Type: application/json' \
-d '{{"message": "<short status>"}}'

- For EACH of the 5 categories, post exactly one score (one curl per category) as \
soon as you've judged it:
  curl -s -X POST "$CALLBACK_URL/score" -H 'Content-Type: application/json' \
-d '{{"category": "<feature|ux|integration|reliability|security>", "score": <0-100 integer>, "roast": "<one punchy handwritten-voice sentence>"}}'

- For EACH gap you find, immediately post a finding (one curl per finding). The \
`category` MUST be one of the 5 keys, `fix` MUST be a concrete, actionable fix \
(what file/area to change and how), and `points` MUST be your estimate of how many \
points the product's OVERALL score (0-100) would gain if this single gap were fixed \
(an integer, typically 1-15, larger for more impactful gaps):
  curl -s -X POST "$CALLBACK_URL/finding" -H 'Content-Type: application/json' \
-d '{{"title": "<short title>", "category": "<feature|ux|integration|reliability|security>", "severity": "<low|medium|high>", "description": "<1-3 sentences, what is wrong>", "fix": "<1-3 sentences, concrete actionable fix>", "points": <integer points gained by fixing>}}'

- When completely done, post a summary:
  curl -s -X POST "$CALLBACK_URL/summary" -H 'Content-Type: application/json' \
-d '{{"summary": "<2-4 sentence overall assessment>"}}'

Post all 5 category scores. Find between 4 and 10 high-quality gaps across the \
categories. Always send valid JSON. Do not skip the curl calls - they are how your \
work is reported back to the user.
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobState:
    """Thread-safe in-memory job state mirrored into the shared modal.Dict."""

    def __init__(self, job_id: str, repo_url: str, scope: str = DEFAULT_SCOPE):
        self._lock = threading.Lock()
        self._finding_seq: dict[str, int] = {}
        self.data = {
            "job_id": job_id,
            "repo_url": repo_url,
            "scope": _normalize_scope(scope),
            "status": "queued",
            "stages": [],
            "findings": [],
            "scores": {
                "overall": None,
                "categories": [
                    {"key": key, "label": label, "score": None, "roast": None}
                    for key, label in CATEGORIES
                ],
            },
            "summary": None,
            "error": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._flush()

    def _flush(self) -> None:
        self.data["updated_at"] = _now()
        jobs[self.data["job_id"]] = dict(self.data)

    def set_status(self, status: str) -> None:
        with self._lock:
            self.data["status"] = status
            self._flush()

    def add_stage(self, stage: str, message: str) -> None:
        with self._lock:
            self.data["stages"].append(
                {"ts": _now(), "stage": stage, "message": message}
            )
            self._flush()

    def add_finding(self, finding: dict) -> None:
        with self._lock:
            category = finding.get("category", "other")
            if category not in CATEGORY_KEYS:
                category = "other"
            seq = self._finding_seq.get(category, 0) + 1
            self._finding_seq[category] = seq
            try:
                points = max(0, min(100, int(round(float(finding.get("points"))))))
            except (TypeError, ValueError):
                points = None
            self.data["findings"].append(
                {
                    "id": f"{category}-{seq}",
                    "title": finding.get("title", "Untitled gap"),
                    "category": category,
                    "severity": finding.get("severity", "medium"),
                    "description": finding.get("description", ""),
                    "fix": finding.get("fix", ""),
                    "points": points,
                }
            )
            self._flush()

    def set_score(self, key: str, score, roast: str) -> None:
        if key not in CATEGORY_KEYS:
            return
        with self._lock:
            try:
                score_val = max(0, min(100, int(round(float(score)))))
            except (TypeError, ValueError):
                return
            for cat in self.data["scores"]["categories"]:
                if cat["key"] == key:
                    cat["score"] = score_val
                    cat["roast"] = roast
                    break
            graded = [
                c["score"]
                for c in self.data["scores"]["categories"]
                if c["score"] is not None
            ]
            self.data["scores"]["overall"] = (
                round(sum(graded) / len(graded)) if graded else None
            )
            self._flush()

    def set_summary(self, summary: str) -> None:
        with self._lock:
            self.data["summary"] = summary
            self._flush()

    def set_error(self, error: str) -> None:
        with self._lock:
            self.data["status"] = "error"
            self.data["error"] = error
            self._flush()


def _start_callback_server(state: JobState) -> ThreadingHTTPServer:
    """Tiny HTTP server the OpenCode agent curls to report progress/findings."""

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # silence noisy logging
            pass

        def _read_json(self) -> dict:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                return json.loads(raw.decode("utf-8") or "{}")
            except (json.JSONDecodeError, UnicodeDecodeError):
                return {}

        def do_POST(self):
            payload = self._read_json()
            route = self.path.rstrip("/")
            if route.endswith("/progress"):
                state.add_stage("agent", str(payload.get("message", "")))
            elif route.endswith("/score"):
                state.set_score(
                    str(payload.get("category", "")),
                    payload.get("score"),
                    str(payload.get("roast", "")),
                )
            elif route.endswith("/finding"):
                state.add_finding(payload)
            elif route.endswith("/summary"):
                state.set_summary(str(payload.get("summary", "")))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok": true}')

    server = ThreadingHTTPServer(("127.0.0.1", CALLBACK_PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def _stream_opencode(state: JobState, repo_dir: str, prompt: str) -> int:
    """Run opencode headless and stream JSON events into the job stages."""
    env = dict(os.environ)
    env["CALLBACK_URL"] = f"http://127.0.0.1:{CALLBACK_PORT}"

    proc = subprocess.Popen(
        [
            "opencode",
            "run",
            "--model",
            MODEL,
            "--format",
            "json",
            "--dangerously-skip-permissions",
            prompt,
        ],
        cwd=repo_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        _ingest_event(state, event)

    return proc.wait()


def _ingest_event(state: JobState, event: dict) -> None:
    """Best-effort extraction of human-readable progress from JSON events."""
    etype = event.get("type") or event.get("event") or ""
    if "tool" in str(etype).lower():
        name = (
            event.get("tool")
            or event.get("name")
            or (event.get("data") or {}).get("tool")
        )
        if name:
            state.add_stage("tool", f"Using tool: {name}")
    elif "text" in str(etype).lower() or "message" in str(etype).lower():
        text = (
            event.get("text")
            or event.get("content")
            or (event.get("data") or {}).get("text")
        )
        if isinstance(text, str) and text.strip():
            snippet = text.strip()
            state.add_stage("thinking", snippet[:280])


@app.function(image=image, timeout=20 * 60, secrets=[anthropic_secret])
def analyze_repo(job_id: str, repo_url: str, scope: str = DEFAULT_SCOPE) -> None:
    scope = _normalize_scope(scope)
    state = JobState(job_id, repo_url, scope)
    repo_dir = "/workspace/repo"
    server = None
    try:
        state.set_status("cloning")
        state.add_stage("clone", f"Cloning {repo_url}")
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, repo_dir],
            check=True,
            capture_output=True,
            text=True,
        )

        server = _start_callback_server(state)
        state.set_status("analyzing")
        state.add_stage("analyze", "Running OpenCode product-gap analysis")

        code = _stream_opencode(state, repo_dir, build_analysis_prompt(scope))
        if code != 0:
            state.add_stage("analyze", f"OpenCode exited with code {code}")

        state.set_status("done")
        state.add_stage("done", "Analysis complete")
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        state.set_error(f"Command failed: {detail[:500]}")
    except Exception as exc:  # noqa: BLE001 - hackathon: surface any error
        state.set_error(str(exc)[:500])
    finally:
        if server is not None:
            # give any in-flight callbacks a moment to land
            time.sleep(1)
            server.shutdown()
