from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import ProgressRequest
from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict, now_iso

router = APIRouter()


@router.get("/{skill_id}/modules")
def list_modules(skill_id: str) -> list[dict[str, Any]]:
    query = collection("learning_modules").where("skill_id", "==", skill_id).order_by("order_index")
    return [doc_to_dict(snapshot) for snapshot in query.stream() if doc_to_dict(snapshot)]


@router.get("/progress/{user_id}")
def learning_progress(user_id: str, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> list[dict[str, Any]]:
    if user_id != firebase_user["uid"]:
        raise HTTPException(status_code=403, detail="You can only view your own progress.")
    query = collection("learning_progress").where("user_id", "==", user_id)
    return [doc_to_dict(snapshot) for snapshot in query.stream() if doc_to_dict(snapshot)]


@router.post("/progress")
def save_learning_progress(payload: ProgressRequest, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    if payload.user_id != firebase_user["uid"]:
        raise HTTPException(status_code=403, detail="You can only update your own progress.")
    doc_id = f"{firebase_user['uid']}_{payload.skill_id}_{payload.module_id}"
    data = payload.model_dump()
    data["updated_at"] = now_iso()
    collection("learning_progress").document(doc_id).set(data, merge=True)
    return doc_to_dict(collection("learning_progress").document(doc_id).get())
