import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ai.ollama_client import OllamaUnavailable, generate
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "workism.db"
PASS_SCORE = 70


app = FastAPI(title="Workism Learning Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str


class SkillRequest(BaseModel):
    name: str
    category: str
    level: str = "Beginner to Advanced"
    description: str = ""


class ModuleRequest(BaseModel):
    title: str
    content: str = ""
    order_index: int = 0


class SubmissionRequest(BaseModel):
    user_id: int
    skill_id: int
    module_id: int | None = None
    github_url: str | None = None
    code: str | None = None
    notes: str = ""


class RepositoryRequest(BaseModel):
    url: str
    github_token: str | None = None


class EvaluationRequest(BaseModel):
    submission_id: int
    rubric: str | None = None


class CertificateRequest(BaseModel):
    user_id: int
    evaluation_id: int


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with connect() as db:
        return row_to_dict(db.execute(query, params).fetchone())


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with connect() as db:
        return [dict(row) for row in db.execute(query, params).fetchall()]


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split("$", 1)
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return hmac.compare_digest(candidate, digest)


def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if parsed.netloc.lower() != "github.com" or len(parts) < 2:
        raise HTTPException(status_code=400, detail="Use a GitHub repository URL like https://github.com/owner/repo")
    return parts[0], parts[1].removesuffix(".git")


def request_json(url: str, token: str | None = None, timeout: int = 15) -> dict[str, Any]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "workism-backend"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise HTTPException(status_code=error.code, detail=error.read().decode("utf-8") or "GitHub request failed")
    except urllib.error.URLError as error:
        raise HTTPException(status_code=502, detail=f"Could not reach upstream service: {error.reason}")


def get_repository_info(url: str, github_token: str | None = None) -> dict[str, Any]:
    owner, repo = parse_github_url(url)
    repo_data = request_json(f"https://api.github.com/repos/{owner}/{repo}", github_token)
    languages = request_json(f"https://api.github.com/repos/{owner}/{repo}/languages", github_token)
    return {
        "owner": owner,
        "repo": repo,
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "default_branch": repo_data.get("default_branch"),
        "stars": repo_data.get("stargazers_count", 0),
        "forks": repo_data.get("forks_count", 0),
        "open_issues": repo_data.get("open_issues_count", 0),
        "pushed_at": repo_data.get("pushed_at"),
        "html_url": repo_data.get("html_url"),
        "languages": languages,
    }


def heuristic_scores(submission: dict[str, Any], repo_info: dict[str, Any] | None) -> dict[str, Any]:
    code = submission.get("code") or ""
    notes = submission.get("notes") or ""
    has_repo = bool(submission.get("github_url"))
    base = 52
    base += 12 if has_repo else 0
    base += min(len(code) // 150, 18)
    base += 5 if "test" in code.lower() or "test" in notes.lower() else 0
    base += 5 if "readme" in notes.lower() else 0
    if repo_info and repo_info.get("languages"):
        base += 6
    total = max(0, min(100, base))
    return {
        "total_score": total,
        "passed": total >= PASS_SCORE,
        "breakdown": {
            "functionality": min(30, round(total * 0.30)),
            "code_quality": min(20, round(total * 0.20)),
            "security": min(10, round(total * 0.10)),
            "documentation": min(10, round(total * 0.10)),
            "testing": min(10, round(total * 0.10)),
            "git_practices": min(20, round(total * 0.20)),
        },
        "feedback": "Automatic baseline evaluation completed. Connect Ollama or another local LLM for richer written feedback.",
        "strengths": ["Submission received", "Repository metadata captured" if has_repo else "Code sample captured"],
        "improvements": ["Add tests and README details", "Document setup and edge cases"],
    }


def build_evaluation(submission: dict[str, Any], repo_info: dict[str, Any] | None, rubric: str | None) -> dict[str, Any]:
    rubric_text = rubric or (
        "Score the project from 0-100 across functionality, code quality, security, documentation, testing, and git practices. "
        "Return concise feedback, strengths, and improvements."
    )
    prompt = f"""
You are evaluating a student coding assessment for Workism.
Rubric: {rubric_text}
GitHub repository info: {json.dumps(repo_info or {}, indent=2)}
Submitted notes: {submission.get("notes") or ""}
Submitted code excerpt:
{(submission.get("code") or "")[:6000]}
"""
    try:
        llm_feedback = generate(prompt, format_json=False)
    except OllamaUnavailable:
        llm_feedback = ""
    result = heuristic_scores(submission, repo_info)
    if llm_feedback:
        result["feedback"] = llm_feedback
    return result


def make_certificate_id(user_id: int, evaluation_id: int) -> str:
    token = secrets.token_hex(3).upper()
    date = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"WK-{date}-{user_id:04d}-{evaluation_id:04d}-{token}"


def init_db() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                level TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                skill_id INTEGER NOT NULL,
                module_id INTEGER,
                github_url TEXT,
                code TEXT,
                notes TEXT NOT NULL DEFAULT '',
                github_info TEXT,
                status TEXT NOT NULL DEFAULT 'submitted',
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(skill_id) REFERENCES skills(id),
                FOREIGN KEY(module_id) REFERENCES modules(id)
            );
            CREATE TABLE IF NOT EXISTS evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL UNIQUE,
                total_score INTEGER NOT NULL,
                passed INTEGER NOT NULL,
                breakdown TEXT NOT NULL,
                feedback TEXT NOT NULL,
                strengths TEXT NOT NULL,
                improvements TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(submission_id) REFERENCES submissions(id)
            );
            CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                certificate_id TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                evaluation_id INTEGER NOT NULL UNIQUE,
                issued_at TEXT NOT NULL,
                html TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(evaluation_id) REFERENCES evaluations(id)
            );
            """
        )
        count = db.execute("SELECT COUNT(*) FROM skills").fetchone()[0]
        if count == 0:
            skills = [
                ("Python", "Programming", "Beginner to Advanced", "Core Python, APIs, testing, and deployment."),
                ("JavaScript", "Programming", "Beginner to Advanced", "Modern JavaScript and browser fundamentals."),
                ("React", "Web Development", "Beginner to Advanced", "Component-driven frontend development."),
                ("SQL", "Database", "Beginner to Advanced", "Data modeling, querying, and optimization."),
                ("Cybersecurity", "Security", "Beginner to Advanced", "Secure coding and practical security checks."),
                ("AI / ML", "Data Science", "Beginner to Advanced", "Applied machine learning foundations."),
            ]
            db.executemany(
                "INSERT INTO skills (name, category, level, description, created_at) VALUES (?, ?, ?, ?, ?)",
                [(name, category, level, desc, now_iso()) for name, category, level, desc in skills],
            )
            modules = ["Introduction", "Core Concepts", "Hands-on Practice", "Project Assessment"]
            for skill_id in range(1, len(skills) + 1):
                db.executemany(
                    "INSERT INTO modules (skill_id, title, content, order_index, created_at) VALUES (?, ?, ?, ?, ?)",
                    [(skill_id, title, f"{title} learning content.", index, now_iso()) for index, title in enumerate(modules, 1)],
                )


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": str(DB_PATH)}


@app.post("/api/auth/register")
@app.post("/auth/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    with connect() as db:
        try:
            cursor = db.execute(
                "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (payload.name, payload.email.lower(), hash_password(payload.password), now_iso()),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Email is already registered")
        user_id = cursor.lastrowid
    return {"id": user_id, "name": payload.name, "email": payload.email.lower()}


@app.post("/api/auth/login")
@app.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    user = fetch_one("SELECT * FROM users WHERE email = ?", (payload.email.lower(),))
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = secrets.token_urlsafe(32)
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@app.get("/api/users/{user_id}/profile")
@app.get("/users/{user_id}/profile")
def user_profile(user_id: int) -> dict[str, Any]:
    user = fetch_one("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    results = fetch_all(
        """
        SELECT e.*, s.github_url, sk.name AS skill_name
        FROM evaluations e
        JOIN submissions s ON s.id = e.submission_id
        JOIN skills sk ON sk.id = s.skill_id
        WHERE s.user_id = ?
        ORDER BY e.created_at DESC
        """,
        (user_id,),
    )
    certificates = fetch_all("SELECT certificate_id, issued_at FROM certificates WHERE user_id = ?", (user_id,))
    return {"user": user, "results": results, "certificates": certificates}


@app.get("/api/skills")
@app.get("/skills")
def list_skills() -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM skills ORDER BY name")


@app.post("/api/skills")
@app.post("/skills")
def create_skill(payload: SkillRequest) -> dict[str, Any]:
    with connect() as db:
        try:
            cursor = db.execute(
                "INSERT INTO skills (name, category, level, description, created_at) VALUES (?, ?, ?, ?, ?)",
                (payload.name, payload.category, payload.level, payload.description, now_iso()),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Skill already exists")
    return fetch_one("SELECT * FROM skills WHERE id = ?", (cursor.lastrowid,))


@app.get("/api/skills/{skill_id}/modules")
@app.get("/skills/{skill_id}/modules")
def list_modules(skill_id: int) -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM modules WHERE skill_id = ? ORDER BY order_index, id", (skill_id,))


@app.post("/api/skills/{skill_id}/modules")
@app.post("/skills/{skill_id}/modules")
def create_module(skill_id: int, payload: ModuleRequest) -> dict[str, Any]:
    if not fetch_one("SELECT id FROM skills WHERE id = ?", (skill_id,)):
        raise HTTPException(status_code=404, detail="Skill not found")
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO modules (skill_id, title, content, order_index, created_at) VALUES (?, ?, ?, ?, ?)",
            (skill_id, payload.title, payload.content, payload.order_index, now_iso()),
        )
    return fetch_one("SELECT * FROM modules WHERE id = ?", (cursor.lastrowid,))


@app.post("/api/github/repository")
@app.post("/github/repository")
def github_repository(payload: RepositoryRequest) -> dict[str, Any]:
    return get_repository_info(payload.url, payload.github_token)


@app.post("/api/submissions")
@app.post("/submissions")
def create_submission(payload: SubmissionRequest) -> dict[str, Any]:
    if not fetch_one("SELECT id FROM users WHERE id = ?", (payload.user_id,)):
        raise HTTPException(status_code=404, detail="User not found")
    if not fetch_one("SELECT id FROM skills WHERE id = ?", (payload.skill_id,)):
        raise HTTPException(status_code=404, detail="Skill not found")
    github_info = None
    if payload.github_url:
        github_info = get_repository_info(payload.github_url)
    with connect() as db:
        cursor = db.execute(
            """
            INSERT INTO submissions (user_id, skill_id, module_id, github_url, code, notes, github_info, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.user_id,
                payload.skill_id,
                payload.module_id,
                payload.github_url,
                payload.code,
                payload.notes,
                json.dumps(github_info) if github_info else None,
                "submitted",
                now_iso(),
            ),
        )
    return fetch_one("SELECT * FROM submissions WHERE id = ?", (cursor.lastrowid,))


@app.get("/api/submissions/{submission_id}")
@app.get("/submissions/{submission_id}")
def get_submission(submission_id: int) -> dict[str, Any]:
    submission = fetch_one("SELECT * FROM submissions WHERE id = ?", (submission_id,))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.get("github_info"):
        submission["github_info"] = json.loads(submission["github_info"])
    return submission


@app.post("/api/llm/evaluate")
@app.post("/llm/evaluate")
def evaluate_submission(payload: EvaluationRequest) -> dict[str, Any]:
    submission = get_submission(payload.submission_id)
    repo_info = submission.get("github_info")
    evaluation = build_evaluation(submission, repo_info, payload.rubric)
    with connect() as db:
        db.execute("UPDATE submissions SET status = ? WHERE id = ?", ("evaluated", payload.submission_id))
        db.execute(
            """
            INSERT INTO evaluations (submission_id, total_score, passed, breakdown, feedback, strengths, improvements, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(submission_id) DO UPDATE SET
              total_score = excluded.total_score,
              passed = excluded.passed,
              breakdown = excluded.breakdown,
              feedback = excluded.feedback,
              strengths = excluded.strengths,
              improvements = excluded.improvements,
              created_at = excluded.created_at
            """,
            (
                payload.submission_id,
                evaluation["total_score"],
                int(evaluation["passed"]),
                json.dumps(evaluation["breakdown"]),
                evaluation["feedback"],
                json.dumps(evaluation["strengths"]),
                json.dumps(evaluation["improvements"]),
                now_iso(),
            ),
        )
    return fetch_one("SELECT * FROM evaluations WHERE submission_id = ?", (payload.submission_id,))


@app.get("/api/results/{user_id}")
@app.get("/results/{user_id}")
def list_results(user_id: int) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT e.*, s.github_url, sk.name AS skill_name
        FROM evaluations e
        JOIN submissions s ON s.id = e.submission_id
        JOIN skills sk ON sk.id = s.skill_id
        WHERE s.user_id = ?
        ORDER BY e.created_at DESC
        """,
        (user_id,),
    )


@app.get("/api/results/submission/{submission_id}")
@app.get("/results/submission/{submission_id}")
def result_for_submission(submission_id: int) -> dict[str, Any]:
    evaluation = fetch_one("SELECT * FROM evaluations WHERE submission_id = ?", (submission_id,))
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation


@app.post("/api/certificates")
@app.post("/certificates")
def generate_certificate(payload: CertificateRequest) -> dict[str, Any]:
    user = fetch_one("SELECT id, name, email FROM users WHERE id = ?", (payload.user_id,))
    evaluation = fetch_one("SELECT * FROM evaluations WHERE id = ?", (payload.evaluation_id,))
    if not user or not evaluation:
        raise HTTPException(status_code=404, detail="User or evaluation not found")
    if not evaluation["passed"]:
        raise HTTPException(status_code=400, detail=f"Certificate requires a score of at least {PASS_SCORE}")
    existing = fetch_one("SELECT * FROM certificates WHERE evaluation_id = ?", (payload.evaluation_id,))
    if existing:
        return existing
    submission = fetch_one("SELECT skill_id FROM submissions WHERE id = ?", (evaluation["submission_id"],))
    skill = fetch_one("SELECT name FROM skills WHERE id = ?", (submission["skill_id"],))
    cert_id = make_certificate_id(payload.user_id, payload.evaluation_id)
    issued = now_iso()
    html = certificate_html(cert_id, user["name"], skill["name"], evaluation["total_score"], issued)
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO certificates (certificate_id, user_id, evaluation_id, issued_at, html) VALUES (?, ?, ?, ?, ?)",
            (cert_id, payload.user_id, payload.evaluation_id, issued, html),
        )
    return fetch_one("SELECT * FROM certificates WHERE id = ?", (cursor.lastrowid,))


@app.get("/api/certificates/verify/{certificate_id}")
@app.get("/certificates/verify/{certificate_id}")
def verify_certificate(certificate_id: str) -> dict[str, Any]:
    certificate = fetch_one("SELECT * FROM certificates WHERE certificate_id = ?", (certificate_id,))
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"valid": True, "certificate": certificate}


@app.get("/api/certificates/{certificate_id}/download", response_class=HTMLResponse)
@app.get("/certificates/{certificate_id}/download", response_class=HTMLResponse)
def download_certificate(certificate_id: str) -> HTMLResponse:
    certificate = fetch_one("SELECT html FROM certificates WHERE certificate_id = ?", (certificate_id,))
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return HTMLResponse(certificate["html"])


@app.get("/api/certificates/{certificate_id}")
@app.get("/certificates/{certificate_id}")
def get_certificate(certificate_id: str) -> dict[str, Any]:
    certificate = fetch_one("SELECT * FROM certificates WHERE certificate_id = ?", (certificate_id,))
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return certificate


@app.get("/api/learning/{skill_id}")
@app.get("/learning/{skill_id}")
def learning_modules(skill_id: int) -> list[dict[str, Any]]:
    return list_modules(skill_id)


@app.get("/api/assessments/{assessment_id}")
@app.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: int) -> dict[str, Any]:
    if assessment_id != 1:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {
        "id": 1,
        "skill_id": 1,
        "title": "Build a REST API for a Task Management System",
        "difficulty": "Intermediate",
        "time_limit": "7 days",
        "max_score": 100,
        "requirements": [
            "User registration/authentication",
            "CRUD operations",
            "Data validation",
            "Error handling",
            "Unit tests",
            "README documentation",
            "Proper project structure",
        ],
    }


@app.post("/api/github/connect")
@app.post("/github/connect")
def github_connect() -> dict[str, str]:
    return {"status": "pending_oauth", "message": "GitHub OAuth is not connected yet. Submit a repository URL for now."}


@app.get("/api/github/repositories")
@app.get("/github/repositories")
def github_repositories() -> list[dict[str, str]]:
    return []


@app.post("/api/evaluations")
@app.post("/evaluations")
def create_evaluation(payload: EvaluationRequest) -> dict[str, Any]:
    return evaluate_submission(payload)


@app.get("/api/evaluations/{evaluation_id}")
@app.get("/evaluations/{evaluation_id}")
def get_evaluation(evaluation_id: int) -> dict[str, Any]:
    evaluation = fetch_one("SELECT * FROM evaluations WHERE id = ?", (evaluation_id,))
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation


@app.get("/api/certificates/{certificate_id}/verify")
@app.get("/certificates/{certificate_id}/verify")
def verify_certificate_alias(certificate_id: str) -> dict[str, Any]:
    return verify_certificate(certificate_id)


def certificate_html(certificate_id: str, student: str, skill: str, score: int, issued_at: str) -> str:
    issued_date = datetime.fromisoformat(issued_at).strftime("%d %b %Y")
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{certificate_id}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; background: #0b1020; color: #fff; }}
    .certificate {{ max-width: 900px; margin: 40px auto; padding: 56px; border: 2px solid #d7b56d; border-radius: 18px; text-align: center; background: linear-gradient(135deg,#15123a,#102345); }}
    h1 {{ letter-spacing: 4px; margin: 0 0 28px; }}
    .name {{ font-size: 46px; font-weight: 800; margin: 22px 0; }}
    .skill {{ font-size: 30px; color: #a8c7ff; margin: 12px 0; }}
    .meta {{ display: flex; justify-content: space-between; margin-top: 52px; color: #d7dce8; font-size: 14px; }}
  </style>
</head>
<body>
  <main class="certificate">
    <h1>WORKISM</h1>
    <p>Certificate of Achievement</p>
    <p>Presented to</p>
    <div class="name">{student}</div>
    <p>for successfully demonstrating proficiency in</p>
    <div class="skill">{skill}</div>
    <p>with an assessment score of {score}/100.</p>
    <section class="meta">
      <div>Certificate ID<br><strong>{certificate_id}</strong></div>
      <div>Date Issued<br><strong>{issued_date}</strong></div>
    </section>
  </main>
</body>
</html>"""
