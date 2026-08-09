from typing import Any

from fastapi import APIRouter

from models.schemas import AssessmentRequest
from services.catalog_service import ensure_default_catalog
from services.firestore import collection, doc_to_dict, get_doc, now_iso

router = APIRouter()


@router.get("")
def list_assessments() -> list[dict[str, Any]]:
    ensure_default_catalog()
    return [doc_to_dict(snapshot) for snapshot in collection("assessments").stream() if doc_to_dict(snapshot)]


@router.post("")
def create_assessment(payload: AssessmentRequest) -> dict[str, Any]:
    doc = collection("assessments").document()
    data = payload.model_dump()
    data["created_at"] = now_iso()
    doc.set(data)
    return doc_to_dict(doc.get())


@router.get("/{assessment_id}")
def get_assessment(assessment_id: str) -> dict[str, Any]:
    ensure_default_catalog()
    return get_doc("assessments", assessment_id)
