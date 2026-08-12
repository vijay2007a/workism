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
    institution: str | None = Field(default=None, min_length=2, max_length=120)
    github: dict[str, Any] | None = None


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    age: int | None = Field(default=None, ge=13, le=100)
    mobileNumber: str | None = Field(default=None, min_length=7, max_length=20)
    gender: Literal["Male", "Female", "Non-binary", "Prefer not to say"] | None = None
    institution: str = Field(min_length=2, max_length=120)
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
    lesson_completed: bool | None = None
    practice_completed: bool | None = None
    coding_completed: bool | None = None
    completed: bool | None = None
    attempts: int | None = Field(default=None, ge=0)
    best_score: int | None = Field(default=None, ge=0, le=100)


class AssessmentRequest(BaseModel):
    skill_id: str
    title: str
    requirements: list[str] = []
    max_score: int = 100


class RepositoryMetadataRequest(BaseModel):
    owner: str
    repo: str
    branch: str | None = None


class RepositoryUrlRequest(BaseModel):
    repository_url: HttpUrl
    branch: str | None = None


class AiTutorRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    context: str = Field(default="", max_length=2000)


class SubmissionRequest(BaseModel):
    skill_id: str
    assessment_id: str | None = None
    repository_url: HttpUrl
    branch: str = "main"
    main_file: str | None = Field(default=None, max_length=200)


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


class CodingRunRequest(BaseModel):
    problem_id: str = Field(min_length=1)
    language: Literal["python"] = "python"
    code: str = Field(min_length=1, max_length=20_000)
    ai_help_used: bool = False


class CodingSubmitRequest(CodingRunRequest):
    pass


class CodingAttemptRecord(BaseModel):
    id: str
    user_id: str
    problem_id: str
    module_id: str
    language: str
    code: str
    output: str | None = None
    error: str | None = None
    passed: bool
    attempt_number: int
    total_tests: int
    passed_tests: int
    score: int = Field(ge=0, le=100)
    ai_help_used: bool = False
    created_at: str


class CommunityPostRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=3, max_length=5000)
    category: Literal["Discussion", "Question", "Project", "Announcement"] = "Discussion"
    tags: list[str] = Field(default_factory=list)


class CommunityCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class UnderstandingAnswerRequest(BaseModel):
    answers: list[str] = Field(default_factory=list)


class CertificateEligibilityResponse(BaseModel):
    eligible: bool
    modules_completed: bool
    coding_completed: bool
    project_submitted: bool
    evaluation_completed: bool
    profile_completed: bool
    originality_passed: bool
    originality_signal: int
    originality_threshold: int
    score: int
    minimum_score: int
    missing_requirements: list[str] = Field(default_factory=list)


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    student: str
    institution: str | None = None
    score: int
    completed_modules: int
    certificates: int


class CommunityPost(BaseModel):
    id: str
    user_id: str
    user_name: str
    institution: str | None = None
    title: str
    body: str
    category: str
    tags: list[str] = Field(default_factory=list)
    created_at: str
    reply_count: int = 0
