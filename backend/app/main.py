import re
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load repo-root .env (MODAL_TOKEN_ID/SECRET, ANTHROPIC_API_KEY) before importing
# modal so the client authenticates with the tokens from .env.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

import modal  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

APP_NAME = "codescan"
DICT_NAME = "codescan-jobs"

app = FastAPI(title="Hamburg Hackathon API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://(www\.)?userroast\.com|http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared store between this backend and the deployed Modal function.
jobs = modal.Dict.from_name(DICT_NAME, create_if_missing=True)


_NANOID_ALPHABET = string.ascii_lowercase + string.digits

# Mirror of the fixed scoring categories in modal_app.py so the initial job
# state has the right shape before the Modal function takes over.
_CATEGORIES = [
    ("feature", "Feature completeness"),
    ("ux", "UX"),
    ("integration", "Integrations"),
    ("reliability", "Reliability"),
    ("security", "Security"),
]

# Audit scope ladder (key -> display label), lenient -> strict. Mirror of the
# SCOPES in modal_app.py so grading expectations match the selected stage.
_SCOPES = {
    "hackathon": "Hackathon project",
    "mvp": "MVP / prototype",
    "beta": "Beta",
    "production": "Production",
}
_DEFAULT_SCOPE = "hackathon"


def _normalize_scope(scope: str | None) -> str:
    return scope if scope in _SCOPES else _DEFAULT_SCOPE


def _slugify_repo(repo_url: str) -> str:
    s = re.sub(r"^https?://", "", repo_url.strip())
    s = re.sub(r"^github\.com/", "", s)
    s = re.sub(r"\.git$", "", s)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "repo"


def _nanoid(n: int = 6) -> str:
    return "".join(secrets.choice(_NANOID_ALPHABET) for _ in range(n))


class ScanRequest(BaseModel):
    repo_url: str
    scope: str = _DEFAULT_SCOPE


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "FastAPI backend is running"}


@app.post("/api/scans")
def create_scan(req: ScanRequest) -> dict[str, str]:
    repo_url = req.repo_url.strip()
    if not repo_url:
        raise HTTPException(status_code=400, detail="repo_url is required")

    scope = _normalize_scope(req.scope)
    job_id = f"{_slugify_repo(repo_url)}-{_nanoid()}"
    now = datetime.now(timezone.utc).isoformat()
    jobs[job_id] = {
        "job_id": job_id,
        "repo_url": repo_url,
        "scope": scope,
        "status": "queued",
        "stages": [],
        "findings": [],
        "scores": {
            "overall": None,
            "categories": [
                {"key": key, "label": label, "score": None, "roast": None}
                for key, label in _CATEGORIES
            ],
        },
        "summary": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }

    analyze_repo = modal.Function.from_name(APP_NAME, "analyze_repo")
    analyze_repo.spawn(job_id, repo_url, scope)

    return {"job_id": job_id}


@app.get("/api/scans")
def list_scans() -> list[dict]:
    items: list[dict] = []
    for _, v in jobs.items():
        try:
            items.append(
                {
                    "job_id": v.get("job_id"),
                    "repo_url": v.get("repo_url"),
                    "status": v.get("status"),
                    "overall": (v.get("scores") or {}).get("overall"),
                    "summary": v.get("summary"),
                    "created_at": v.get("created_at"),
                    "updated_at": v.get("updated_at"),
                }
            )
        except (AttributeError, TypeError):
            continue
    items.sort(key=lambda s: (s["overall"] is None, -(s["overall"] or 0)))
    return items


@app.get("/api/scans/{job_id}")
def get_scan(job_id: str) -> dict:
    try:
        return jobs[job_id]
    except KeyError:
        raise HTTPException(status_code=404, detail="job not found")
