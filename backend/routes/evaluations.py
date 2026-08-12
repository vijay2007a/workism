from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import EvaluationRequest
from services.evaluation_service import build_structured_evaluation
from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict, get_doc, now_iso

router = APIRouter()


@router.post("")
def create_evaluation(payload: EvaluationRequest, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    submission = get_doc("submissions", payload.submission_id)
    if submission.get("user_id") != firebase_user["uid"]:
        raise HTTPException(status_code=403, detail="You can only evaluate your own submissions.")
    evaluation = build_structured_evaluation(submission).model_dump()
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
    evaluation["originality"] = evaluation.get("metadata", {}).get("originality") or submission.get("originality")
    evaluation["created_at"] = now_iso()
    evaluation["user_id"] = firebase_user["uid"]
    doc = collection("evaluations").document()
    doc.set(evaluation)
    collection("submissions").document(payload.submission_id).set({"status": "evaluated"}, merge=True)
    return doc_to_dict(doc.get())


@router.get("/{evaluation_id}")
def get_evaluation(evaluation_id: str, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    evaluation = get_doc("evaluations", evaluation_id)
    if evaluation.get("user_id") != firebase_user["uid"]:
        raise HTTPException(status_code=403, detail="You can only view your own evaluations.")
    return evaluation


@router.get("/submission/{submission_id}")
def get_submission_evaluations(submission_id: str) -> list[dict[str, Any]]:
    query = collection("evaluations").where("submission_id", "==", submission_id)
    return [doc_to_dict(snapshot) for snapshot in query.stream() if doc_to_dict(snapshot)]
