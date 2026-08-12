from __future__ import annotations

import json
import math
import re
from typing import Any

from fastapi import HTTPException

from ai.ollama_client import AIProviderUnavailable, ai_provider
from models.schemas import AIAnalysis, ObjectiveChecks, StructuredEvaluation
from services.config import settings
from services.github_service import parse_github_url, repository_context, repository_metadata, repository_tree

PASS_SCORE = 70


def _clamp(value: int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, value))


def objective_analysis(submission: dict[str, Any]) -> ObjectiveChecks:
    findings: list[str] = []
    code = submission.get("code") or ""
    repo_info = submission.get("repository") or {}
    files = submission.get("repository_files") or []
    paths = {item.get("path", "").lower() for item in files}

    has_tests = any("test" in path or "spec" in path for path in paths) or "test" in code.lower()
    has_readme = any(path.endswith("readme.md") or path == "readme" for path in paths) or "readme" in code.lower()
    has_required_files = bool(paths and ({"package.json", "requirements.txt", "pyproject.toml", "vite.config.ts", "vite.config.mjs"} & paths))
    has_syntax_signal = bool(code.strip() or repo_info.get("languages"))
    has_security = not any(secret in code.lower() for secret in ["api_key=", "password=", "secret=", "private_key"])
    has_requirements = bool(submission.get("notes") or repo_info.get("latest_commit"))

    checks = {
        "tests": has_tests,
        "syntax": has_syntax_signal,
        "required_files": has_required_files,
        "readme": has_readme,
        "security": has_security,
        "project_requirements": has_requirements,
    }
    for name, passed in checks.items():
        if not passed:
            findings.append(f"Objective check failed: {name.replace('_', ' ')}")
    score = round(sum(1 for passed in checks.values() if passed) / len(checks) * 100)
    return ObjectiveChecks(**checks, score=score, findings=findings)


def ai_analysis(submission: dict[str, Any], objective: ObjectiveChecks) -> AIAnalysis:
    prompt = f"""
You are reviewing a coding assessment for WORKISM.
Return JSON only with keys: code_quality, maintainability, architecture, documentation, improvement_suggestions.
Do not provide a final score.

Objective checks:
{objective.model_dump_json(indent=2)}

Repository:
{json.dumps(submission.get("repository") or {}, indent=2)}

Notes:
{submission.get("notes") or ""}

Code excerpt:
{(submission.get("code") or "")[:6000]}
"""
    fallback = AIAnalysis(
        code_quality="AI analysis unavailable. Objective checks were completed by the backend.",
        maintainability="Pending review from the configured AI provider.",
        architecture="Pending review from the configured AI provider.",
        documentation="Pending review from the configured AI provider.",
        improvement_suggestions=["Configure Ollama on the backend AI server for qualitative feedback."],
    )
    try:
        raw = ai_provider.generate(prompt, format_json=True)
        parsed = json.loads(raw)
        return AIAnalysis(**parsed)
    except (AIProviderUnavailable, json.JSONDecodeError, ValueError):
        return fallback


def originality_analysis(submission: dict[str, Any]) -> dict[str, Any]:
    code = str(submission.get("code") or "")
    files = submission.get("repository_files") or []
    repository = submission.get("repository") or {}
    lowered = code.lower()
    lines = [line.strip() for line in code.splitlines() if line.strip()]
    total_lines = len(lines)
    non_comment_lines = [line for line in lines if not line.lstrip().startswith("#")]
    comment_lines = total_lines - len(non_comment_lines)

    suspicious_hits = 0
    reasons: list[str] = []

    if total_lines and total_lines < 12:
        suspicious_hits += 10
        reasons.append("Very small codebase for the claimed project scope")
    if lowered.count("todo") or lowered.count("fixme"):
        suspicious_hits += 15
        reasons.append("Contains TODO/FIXME placeholders")
    if "pass" in lowered:
        suspicious_hits += 10
        reasons.append("Contains placeholder pass statements")
    if any(phrase in lowered for phrase in ["as an ai", "i cannot", "here is a", "feel free to ask"]):
        suspicious_hits += 25
        reasons.append("Contains AI-like explanatory phrases inside code")
    if len(code) > 0 and comment_lines > total_lines * 0.45:
        suspicious_hits += 10
        reasons.append("Comment density is unusually high")

    source_files = [str(item.get("path") or "") for item in files if str(item.get("path") or "").lower().endswith((".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".cpp", ".c", ".cs", ".go", ".rs"))]
    readmes = [path for path in source_files if path.lower().endswith("readme.md")]
    tests = [path for path in source_files if "test" in path.lower() or "spec" in path.lower()]

    if len(source_files) <= 1:
        suspicious_hits += 12
        reasons.append("Repository has very few source files")
    if not tests:
        suspicious_hits += 8
        reasons.append("No test files found")
    if not readmes:
        suspicious_hits += 8
        reasons.append("No README file found")
    if not repository.get("latest_commit"):
        suspicious_hits += 5
        reasons.append("Missing commit metadata")

    if len(set(line for line in non_comment_lines if len(line) > 2)) < max(3, math.ceil(total_lines * 0.35)):
        suspicious_hits += 10
        reasons.append("Code shows limited variety across implementation lines")

    signal = _clamp(suspicious_hits)
    threshold = settings.originality_max_ai_signal
    return {
        "signal": signal,
        "threshold": threshold,
        "passed": signal <= threshold,
        "needs_review": signal > threshold,
        "reasons": reasons,
    }


def build_structured_evaluation(submission: dict[str, Any]) -> StructuredEvaluation:
    objective = objective_analysis(submission)
    ai = ai_analysis(submission, objective)
    final_score = objective.score
    originality = originality_analysis(submission)
    return StructuredEvaluation(
        submission_id=submission["id"],
        objective=objective,
        ai=ai,
        final_score=final_score,
        passed=final_score >= PASS_SCORE,
        metadata={
            "scoring": "final_score is derived only from objective checks",
            "originality": originality,
        },
    )


def enrich_submission_repository(submission: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    url = submission.get("repository_url")
    owner, repo = parse_github_url(url)
    branch = submission.get("branch") or "main"
    metadata = repository_metadata(owner, repo, branch, token)
    files = repository_tree(owner, repo, metadata["selected_branch"], token)
    submission["repository"] = metadata
    submission["repository_files"] = files
    submission["code"] = repository_context(owner, repo, metadata["selected_branch"], files, token)
    submission["originality"] = originality_analysis(submission)
    return submission


def ensure_passed(evaluation: dict[str, Any]) -> None:
    if not evaluation.get("passed"):
        raise HTTPException(status_code=400, detail=f"Certificate requires a score of at least {PASS_SCORE}")
