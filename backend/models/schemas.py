from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str


class FirebaseUserRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    id_token: str = Field(min_length=1)
    age: int | None = Field(default=None, ge=13, le=100)
    mobileNumber: str | None = Field(default=None, min_length=7, max_length=20)
    gender: Literal["Male", "Female", "Non-binary", "Prefer not to say"] | None = None
    github: dict[str, Any] | None = None


class SkillRequest(BaseModel):
    name: str
    category: str
    level: str = "Beginner to Advanced"
    description: str = ""


class ProgressRequest(BaseModel):
    user_id: str
    skill_id: str
    module_id: str
    completed: bool = True


class AssessmentRequest(BaseModel):
    skill_id: str
    title: str
    requirements: list[str] = []
    max_score: int = 100


class RepositoryMetadataRequest(BaseModel):
    owner: str
    repo: str
    branch: str | None = None


class SubmissionRequest(BaseModel):
    skill_id: str
    assessment_id: str | None = None
    repository_url: HttpUrl
    branch: str = "main"


class EvaluationRequest(BaseModel):
    submission_id: str
    rubric: str | None = None


class ObjectiveChecks(BaseModel):
    tests: bool
    syntax: bool
    required_files: bool
    readme: bool
    security: bool
    project_requirements: bool
    score: int = Field(ge=0, le=100)
    findings: list[str]


class AIAnalysis(BaseModel):
    code_quality: str
    maintainability: str
    architecture: str
    documentation: str
    improvement_suggestions: list[str]


class StructuredEvaluation(BaseModel):
    submission_id: str
    objective: ObjectiveChecks
    ai: AIAnalysis
    final_score: int = Field(ge=0, le=100)
    passed: bool
    metadata: dict[str, Any] = {}


class CertificateRequest(BaseModel):
    user_id: str
    evaluation_id: str
