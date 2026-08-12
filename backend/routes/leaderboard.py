from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict

router = APIRouter()


def _aggregate_scores() -> list[dict[str, Any]]:
    users = [doc_to_dict(snapshot) for snapshot in collection("users").stream() if doc_to_dict(snapshot)]
    progress_docs = [doc_to_dict(snapshot) for snapshot in collection("learning_progress").stream() if doc_to_dict(snapshot)]
    evaluations = [doc_to_dict(snapshot) for snapshot in collection("evaluations").stream() if doc_to_dict(snapshot)]
    certificates = [doc_to_dict(snapshot) for snapshot in collection("certificates").stream() if doc_to_dict(snapshot)]
    coding_attempts = [doc_to_dict(snapshot) for snapshot in collection("coding_attempts").stream() if doc_to_dict(snapshot)]

    progress_by_user: dict[str, list[dict[str, Any]]] = {}
    for item in progress_docs:
        progress_by_user.setdefault(str(item.get("user_id")), []).append(item)

    evaluations_by_user: dict[str, list[dict[str, Any]]] = {}
    for item in evaluations:
        evaluations_by_user.setdefault(str(item.get("user_id")), []).append(item)

    certificates_by_user: dict[str, list[dict[str, Any]]] = {}
    for item in certificates:
        certificates_by_user.setdefault(str(item.get("user_id")), []).append(item)

    attempts_by_user: dict[str, list[dict[str, Any]]] = {}
    for item in coding_attempts:
        attempts_by_user.setdefault(str(item.get("user_id")), []).append(item)

    entries: list[dict[str, Any]] = []
    for user in users:
        uid = str(user.get("id"))
        completed_modules = sum(1 for item in progress_by_user.get(uid, []) if item.get("completed"))
        avg_score = 0
        if evaluations_by_user.get(uid):
            scores = [int(item.get("total_score") or item.get("final_score") or 0) for item in evaluations_by_user[uid]]
            avg_score = round(sum(scores) / len(scores)) if scores else 0
        coding_passed = sum(1 for item in attempts_by_user.get(uid, []) if item.get("passed"))
        cert_count = len(certificates_by_user.get(uid, []))
        score = avg_score + (completed_modules * 10) + (coding_passed * 3) + (cert_count * 25)
        entries.append(
            {
                "user_id": uid,
                "student": user.get("name") or "Learner",
                "institution": user.get("institution") or "",
                "score": score,
                "completed_modules": completed_modules,
                "certificates": cert_count,
            }
        )

    entries.sort(key=lambda item: (-int(item["score"]), str(item["student"]).lower()))
    return [
        {**entry, "rank": index + 1}
        for index, entry in enumerate(entries[:50])
    ]


@router.get("")
def get_leaderboard(_: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    return {"entries": _aggregate_scores()}
