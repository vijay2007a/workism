from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import CommunityCommentRequest, CommunityPostRequest
from services.auth_service import get_user_profile
from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict, now_iso

router = APIRouter()


@router.get("/posts")
def list_posts(_: dict[str, Any] = Depends(verify_firebase_token)) -> list[dict[str, Any]]:
    query = collection("community_posts").order_by("created_at", direction="DESCENDING")
    return [doc_to_dict(snapshot) for snapshot in query.stream() if doc_to_dict(snapshot)]


@router.post("/posts")
def create_post(payload: CommunityPostRequest, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    profile = get_user_profile(str(firebase_user["uid"]))
    doc = collection("community_posts").document()
    data = {
        "id": doc.id,
        "user_id": firebase_user["uid"],
        "user_name": profile.get("name") or firebase_user.get("name") or "Learner",
        "institution": profile.get("institution"),
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "category": payload.category,
        "tags": [tag.strip() for tag in payload.tags if tag.strip()],
        "reply_count": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    doc.set(data)
    return doc_to_dict(doc.get())


@router.get("/posts/{post_id}")
def get_post(post_id: str, _: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    post = doc_to_dict(collection("community_posts").document(post_id).get())
    if not post:
        raise HTTPException(status_code=404, detail="Community post not found")
    return post


@router.post("/posts/{post_id}/comments")
def comment_on_post(
    post_id: str,
    payload: CommunityCommentRequest,
    firebase_user: dict[str, Any] = Depends(verify_firebase_token),
) -> dict[str, Any]:
    post_ref = collection("community_posts").document(post_id)
    if not post_ref.get().exists:
        raise HTTPException(status_code=404, detail="Community post not found")
    profile = get_user_profile(str(firebase_user["uid"]))
    comment_ref = post_ref.collection("comments").document()
    data = {
        "id": comment_ref.id,
        "post_id": post_id,
        "user_id": firebase_user["uid"],
        "user_name": profile.get("name") or firebase_user.get("name") or "Learner",
        "body": payload.body.strip(),
        "created_at": now_iso(),
    }
    comment_ref.set(data)
    post_ref.set({"reply_count": int((post_ref.get().to_dict() or {}).get("reply_count", 0)) + 1, "updated_at": now_iso()}, merge=True)
    return doc_to_dict(comment_ref.get())


@router.get("/posts/{post_id}/comments")
def list_comments(post_id: str, _: dict[str, Any] = Depends(verify_firebase_token)) -> list[dict[str, Any]]:
    post_ref = collection("community_posts").document(post_id)
    if not post_ref.get().exists:
        raise HTTPException(status_code=404, detail="Community post not found")
    query = post_ref.collection("comments").order_by("created_at")
    return [doc_to_dict(snapshot) for snapshot in query.stream() if doc_to_dict(snapshot)]
