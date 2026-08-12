from typing import Any

from fastapi import APIRouter, Depends, Header

from models.schemas import SubmissionRequest
from services.evaluation_service import build_structured_evaluation, enrich_submission_repository
from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict, get_doc, now_iso

router = APIRouter()


@router.post("")
def create_submission(
    payload: SubmissionRequest,
    firebase_user: dict[str, Any] = Depends(verify_firebase_token),
    x_github_token: str | None = Header(default=None),
) -> dict[str, Any]:
    data = payload.model_dump()
    data["repository_url"] = str(data["repository_url"])
    data["user_id"] = firebase_user["uid"]
    data["user_email"] = firebase_user.get("email")
    data["status"] = "preparing_repository"
    data["created_at"] = now_iso()
    doc = collection("submissions").document()
    data["id"] = doc.id
    doc.set(data)

    enriched = enrich_submission_repository(data, x_github_token)
    enriched["status"] = "running_objective_checks"
    doc.set(enriched)

    evaluation = build_structured_evaluation(enriched).model_dump()
    evaluation["total_score"] = evaluation["final_score"]
    evaluation["breakdown"] = evaluation["objective"].copy()
    evaluation["feedback"] = " ".join(
        [
            evaluation["ai"]["code_quality"],
            evaluation["ai"]["maintainability"],
            evaluation["ai"]["architecture"],
            evaluation["ai"]["documentation"],
        ]
    )
    evaluation["strengths"] = [name for name, passed in evaluation["objective"].items() if isinstance(passed, bool) and passed]
    evaluation["improvements"] = evaluation["ai"]["improvement_suggestions"]
    evaluation["originality"] = enriched.get("originality") or evaluation.get("metadata", {}).get("originality")
    evaluation["created_at"] = now_iso()
    evaluation["user_id"] = firebase_user["uid"]
    evaluation_doc = collection("evaluations").document()
    evaluation_doc.set(evaluation)
    enriched["status"] = "evaluated"
    enriched["evaluation_id"] = evaluation_doc.id
    doc.set(enriched)
    return {"submission": doc_to_dict(doc.get()), "evaluation": doc_to_dict(evaluation_doc.get())}


@router.get("/{submission_id}")
def get_submission(submission_id: str, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    submission = get_doc("submissions", submission_id)
    if submission.get("user_id") != firebase_user["uid"]:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="You can only view your own submissions.")
    return submission
