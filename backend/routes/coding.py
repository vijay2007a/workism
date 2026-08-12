from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from models.schemas import CodingRunRequest, CodingSubmitRequest
from services.coding_service import (
    coding_summary,
    evaluate_code,
    get_problem,
    list_attempts,
    list_problems,
    persist_attempt,
)
from services.firebase_auth import verify_firebase_token

router = APIRouter()


@router.get("/problems")
def problems(
    skill_id: str | None = Query(default="python"),
    module_id: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    return list_problems(skill_id=skill_id, module_id=module_id)


@router.get("/problems/{problem_id}")
def problem(problem_id: str) -> dict[str, Any]:
    return get_problem(problem_id)


@router.get("/attempts")
def attempts(
    firebase_user: dict[str, Any] = Depends(verify_firebase_token),
    problem_id: str | None = Query(default=None),
) -> dict[str, Any]:
    user_id = str(firebase_user["uid"])
    records = list_attempts(user_id, problem_id)
    return {
        "user_id": user_id,
        "attempts": records,
        "summary": coding_summary(user_id, problem_id),
    }


def _run_payload(payload: CodingRunRequest, *, persist: bool, firebase_user: dict[str, Any]) -> dict[str, Any]:
    user_id = str(firebase_user["uid"])
    if payload.language != "python":
      raise HTTPException(status_code=400, detail="Python is the only supported language for coding workouts right now.")
    evaluation = evaluate_code(payload.problem_id, payload.code)
    attempt = persist_attempt(
        user_id,
        payload.problem_id,
        payload.code,
        payload.language,
        evaluation,
        ai_help_used=payload.ai_help_used,
        kind="submit" if persist else "run",
        update_progress=persist,
    )
    summary = coding_summary(user_id, payload.problem_id)
    return {
        "problem": evaluation["problem"],
        "attempt": attempt,
        "tests": evaluation["tests"],
        "stdout": evaluation["stdout"],
        "error": evaluation["error"],
        "passed": evaluation["passed"],
        "passed_tests": evaluation["passed_tests"],
        "total_tests": evaluation["total_tests"],
        "score": evaluation["score"],
        "summary": summary,
    }


@router.post("/run")
def run_code(
    payload: CodingRunRequest,
    firebase_user: dict[str, Any] = Depends(verify_firebase_token),
) -> dict[str, Any]:
    return _run_payload(payload, persist=False, firebase_user=firebase_user)


@router.post("/submit")
def submit_code(
    payload: CodingSubmitRequest,
    firebase_user: dict[str, Any] = Depends(verify_firebase_token),
) -> dict[str, Any]:
    return _run_payload(payload, persist=True, firebase_user=firebase_user)
