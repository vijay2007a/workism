from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict

router = APIRouter()


def _latest(items: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not items:
        return None
    return sorted(items, key=lambda item: str(item.get("created_at") or item.get("updated_at") or ""))[-1]


@router.get("/stats")
def dashboard_stats(firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    uid = str(firebase_user["uid"])
    progress = [doc_to_dict(snapshot) for snapshot in collection("learning_progress").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    submissions = [doc_to_dict(snapshot) for snapshot in collection("submissions").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    evaluations = [doc_to_dict(snapshot) for snapshot in collection("evaluations").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    certificates = [doc_to_dict(snapshot) for snapshot in collection("certificates").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    completed_lessons = sum(1 for item in progress if item.get("lesson_completed"))
    skills_in_progress = len({str(item.get("skill_id") or "") for item in progress if item.get("skill_id")})
    scores = [int(item.get("total_score") or item.get("final_score") or 0) for item in evaluations if int(item.get("total_score") or item.get("final_score") or 0) > 0]
    activity = []
    latest_submission = _latest(submissions)
    latest_evaluation = _latest(evaluations)
    latest_progress = _latest(progress)
    if latest_evaluation:
        activity.append({"type": "evaluation", "text": f'Project "{latest_evaluation.get("submission_id")}" evaluated', "meta": f"Score: {latest_evaluation.get('total_score') or latest_evaluation.get('final_score')}/100", "created_at": latest_evaluation.get("created_at")})
    if latest_progress:
        activity.append({"type": "lesson", "text": f'Completed lesson module {latest_progress.get("module_id")}', "meta": "", "created_at": latest_progress.get("updated_at") or latest_progress.get("created_at")})
    if latest_submission:
        activity.append({"type": "submission", "text": f'Submitted project for {latest_submission.get("skill_id")}', "meta": "", "created_at": latest_submission.get("created_at")})
    return {
        "skillsInProgress": skills_in_progress,
        "completedLessons": completed_lessons,
        "projectsSubmitted": len(submissions),
        "evaluationsCompleted": len(evaluations),
        "averageScore": round(sum(scores) / len(scores)) if scores else 0,
        "certificatesEarned": len(certificates),
        "recentActivity": sorted(activity, key=lambda item: str(item.get("created_at") or ""), reverse=True),
    }
