from __future__ import annotations

import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import firebase_admin
from fastapi import HTTPException
from firebase_admin import credentials, firestore

from services.config import settings


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def initialize_firebase_app() -> None:
    if firebase_admin._apps:
        return
    try:
        if settings.firebase_credentials_json:
            temp = tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", encoding="utf-8")
            temp.write(__import__("json").dumps(settings.firebase_credentials_json))
            temp.close()
            cred = credentials.Certificate(temp.name)
        elif settings.firebase_credentials_path:
            cred = credentials.Certificate(str(Path(settings.firebase_credentials_path)))
        else:
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Firestore is not configured. Set FIREBASE_PROJECT_ID and Firebase service account credentials.",
        ) from error


def db() -> firestore.Client:
    initialize_firebase_app()
    return firestore.client()


def doc_to_dict(snapshot: firestore.DocumentSnapshot) -> dict[str, Any] | None:
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return data


def collection(name: str) -> firestore.CollectionReference:
    return db().collection(name)


def get_doc(name: str, doc_id: str) -> dict[str, Any]:
    data = doc_to_dict(collection(name).document(doc_id).get())
    if not data:
        raise HTTPException(status_code=404, detail=f"{name.rstrip('s').title()} not found")
    return data


def list_docs(name: str, *, order_by: str | None = None) -> list[dict[str, Any]]:
    query: Any = collection(name)
    if order_by:
        query = query.order_by(order_by)
    return [doc_to_dict(snapshot) for snapshot in query.stream() if doc_to_dict(snapshot)]
