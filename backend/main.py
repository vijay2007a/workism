from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes import assessments, auth, certificates, evaluations, github, learning, skills, submissions
from services.config import settings

load_dotenv()

app = FastAPI(title="Workism API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(learning.router, prefix="/api/learning", tags=["learning"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(github.router, prefix="/api/github", tags=["github"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["evaluations"])
app.include_router(certificates.router, prefix="/api/certificates", tags=["certificates"])


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "workism-api"}
