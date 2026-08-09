from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from models.schemas import CertificateRequest
from services.certificate_service import certificate_html, make_certificate_id
from services.catalog_service import ensure_default_catalog
from services.evaluation_service import ensure_passed
from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict, get_doc, now_iso

router = APIRouter()


@router.post("")
def create_certificate(payload: CertificateRequest, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    uid = firebase_user["uid"]
    if payload.user_id != uid:
        raise HTTPException(status_code=403, detail="You can only create your own certificate.")
    user = get_doc("users", uid)
    evaluation = get_doc("evaluations", payload.evaluation_id)
    if evaluation.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="You can only certify your own evaluation.")
    ensure_passed(evaluation)
    ensure_default_catalog()
    existing = list(collection("certificates").where("evaluation_id", "==", payload.evaluation_id).limit(1).stream())
    if existing:
        return doc_to_dict(existing[0])
    submission = get_doc("submissions", evaluation["submission_id"])
    skill = get_doc("skills", submission["skill_id"])
    issued_at = now_iso()
    certificate_id = make_certificate_id(uid, payload.evaluation_id)
    data = {
        "certificate_id": certificate_id,
        "user_id": uid,
        "learner": user["name"],
        "skill_id": skill["id"],
        "skill": skill["name"],
        "score": evaluation["final_score"],
        "total_score": evaluation["final_score"],
        "evaluation_id": payload.evaluation_id,
        "issued_at": issued_at,
        "verification_status": "valid",
        "html": certificate_html(certificate_id, user["name"], skill["name"], evaluation["final_score"], issued_at),
    }
    doc = collection("certificates").document()
    doc.set(data)
    return doc_to_dict(doc.get())


@router.get("/{certificate_id}")
def get_certificate(certificate_id: str) -> dict[str, Any]:
    matches = list(collection("certificates").where("certificate_id", "==", certificate_id).limit(1).stream())
    if not matches:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return doc_to_dict(matches[0])


@router.get("/{certificate_id}/verify")
@router.get("/verify/{certificate_id}")
def verify_certificate(certificate_id: str) -> dict[str, Any]:
    certificate = get_certificate(certificate_id)
    return {"valid": certificate.get("verification_status") == "valid", "certificate": certificate}


@router.get("/{certificate_id}/download", response_class=HTMLResponse)
def download_certificate(certificate_id: str) -> HTMLResponse:
    certificate = get_certificate(certificate_id)
    return HTMLResponse(certificate["html"])
