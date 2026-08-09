from typing import Any

from fastapi import APIRouter, HTTPException

from models.schemas import SkillRequest
from services.catalog_service import ensure_default_catalog
from services.firestore import collection, doc_to_dict, get_doc, list_docs, now_iso

router = APIRouter()


@router.get("")
def list_skills() -> list[dict[str, Any]]:
    ensure_default_catalog()
    return list_docs("skills", order_by="name")


@router.post("")
def create_skill(payload: SkillRequest) -> dict[str, Any]:
    existing = list(collection("skills").where("name", "==", payload.name).limit(1).stream())
    if existing:
        raise HTTPException(status_code=409, detail="Skill already exists")
    doc = collection("skills").document()
    data = payload.model_dump()
    data["created_at"] = now_iso()
    doc.set(data)
    return doc_to_dict(doc.get())


@router.get("/{skill_id}")
def get_skill(skill_id: str) -> dict[str, Any]:
    return get_doc("skills", skill_id)
