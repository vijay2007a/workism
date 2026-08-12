from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from models.schemas import CertificateRequest
from services.certificate_service import certificate_html, make_certificate_id
from services.catalog_service import ensure_default_catalog
from services.evaluation_service import ensure_passed
from services.firebase_auth import verify_firebase_token
from services.firestore import collection, doc_to_dict, get_doc, now_iso
from models.schemas import CertificateEligibilityResponse

router = APIRouter()

MIN_CERTIFICATE_SCORE = 50


def _latest_score(evaluations: list[dict[str, Any]]) -> int:
    if not evaluations:
        return 0
    latest = sorted(evaluations, key=lambda item: str(item.get("created_at") or ""))[-1]
    return int(latest.get("total_score") or latest.get("final_score") or 0)


def _latest_submission(submissions: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not submissions:
        return None
    return sorted(submissions, key=lambda item: str(item.get("created_at") or ""))[-1]


def _latest_evaluation(evaluations: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not evaluations:
        return None
    return sorted(evaluations, key=lambda item: str(item.get("created_at") or ""))[-1]


def _profile_complete(user: dict[str, Any] | None) -> bool:
    if not user:
        return False
    return bool(
        str(user.get("name") or "").strip()
        and str(user.get("email") or "").strip()
        and isinstance(user.get("age"), int)
        and str(user.get("mobileNumber") or "").strip()
        and str(user.get("gender") or "").strip()
        and str(user.get("institution") or "").strip()
    )


def _certificate_eligibility(uid: str) -> CertificateEligibilityResponse:
    ensure_default_catalog()
    modules = [doc_to_dict(snapshot) for snapshot in collection("learning_modules").where("skill_id", "==", "python").stream() if doc_to_dict(snapshot)]
    progress = [doc_to_dict(snapshot) for snapshot in collection("learning_progress").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    submissions = [doc_to_dict(snapshot) for snapshot in collection("submissions").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    evaluations = [doc_to_dict(snapshot) for snapshot in collection("evaluations").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    attempts = [doc_to_dict(snapshot) for snapshot in collection("coding_attempts").where("user_id", "==", uid).stream() if doc_to_dict(snapshot)]
    user = get_doc("users", uid)

    progress_by_module = {str(item.get("module_id")): item for item in progress}
    required_module_ids = [str(module.get("id")) for module in modules]
    modules_completed = bool(required_module_ids) and all(bool(progress_by_module.get(module_id, {}).get("completed")) for module_id in required_module_ids)
    coding_completed = bool(attempts) and all(
        bool(progress_by_module.get(str(module_id), {}).get("coding_completed"))
        for module_id in required_module_ids
        if progress_by_module.get(str(module_id)) is not None
    )
    latest_submission = _latest_submission(submissions)
    latest_evaluation = _latest_evaluation(evaluations)
    project_submitted = latest_submission is not None
    evaluation_completed = latest_evaluation is not None
    score = _latest_score(evaluations)
    originality = ((latest_evaluation or {}).get("originality") or (latest_evaluation or {}).get("metadata", {}).get("originality") or (latest_submission or {}).get("originality") or {})
    originality_signal = int(originality.get("signal") or 0)
    originality_threshold = int(originality.get("threshold") or 65)
    originality_passed = bool(originality.get("passed", originality_signal <= originality_threshold))
    profile_completed = _profile_complete(user)

    missing_requirements: list[str] = []
    if not profile_completed:
        missing_requirements.append("Complete your profile")
    if not modules_completed:
        missing_requirements.append("Complete the required learning modules")
    if not coding_completed:
        missing_requirements.append("Complete the required coding workouts")
    if not project_submitted:
        missing_requirements.append("Submit a project")
    if not evaluation_completed:
        missing_requirements.append("Complete project evaluation")
    if score < MIN_CERTIFICATE_SCORE:
        missing_requirements.append(f"Minimum score of {MIN_CERTIFICATE_SCORE}/100 required")
    if not originality_passed:
        missing_requirements.append("Originality review required")

    return CertificateEligibilityResponse(
        eligible=not missing_requirements,
        modules_completed=modules_completed,
        coding_completed=coding_completed,
        project_submitted=project_submitted,
        evaluation_completed=evaluation_completed,
        profile_completed=profile_completed,
        originality_passed=originality_passed,
        originality_signal=originality_signal,
        originality_threshold=originality_threshold,
        score=score,
        minimum_score=MIN_CERTIFICATE_SCORE,
        missing_requirements=missing_requirements,
    )


@router.post("")
def create_certificate(payload: CertificateRequest, firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    uid = firebase_user["uid"]
    if payload.user_id != uid:
        raise HTTPException(status_code=403, detail="You can only create your own certificate.")
    eligibility = _certificate_eligibility(uid)
    if not eligibility.eligible:
        raise HTTPException(status_code=400, detail={"message": "Certificate eligibility requirements are not satisfied.", "missing_requirements": eligibility.missing_requirements, "eligibility": eligibility.model_dump()})
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


@router.get("/eligibility")
def certificate_eligibility(firebase_user: dict[str, Any] = Depends(verify_firebase_token)) -> CertificateEligibilityResponse:
    return _certificate_eligibility(str(firebase_user["uid"]))
