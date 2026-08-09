from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from ai.ollama_client import AIProviderUnavailable, ai_provider
from models.schemas import AIAnalysis, ObjectiveChecks, StructuredEvaluation
from services.github_service import parse_github_url, repository_context, repository_metadata, repository_tree

PASS_SCORE = 70


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


def build_structured_evaluation(submission: dict[str, Any]) -> StructuredEvaluation:
    objective = objective_analysis(submission)
    ai = ai_analysis(submission, objective)
    final_score = objective.score
    return StructuredEvaluation(
        submission_id=submission["id"],
        objective=objective,
        ai=ai,
        final_score=final_score,
        passed=final_score >= PASS_SCORE,
        metadata={"scoring": "final_score is derived only from objective checks"},
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
    return submission


def ensure_passed(evaluation: dict[str, Any]) -> None:
    if not evaluation.get("passed"):
        raise HTTPException(status_code=400, detail=f"Certificate requires a score of at least {PASS_SCORE}")
