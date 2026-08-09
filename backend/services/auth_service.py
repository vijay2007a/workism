import re
from typing import Any

from firebase_admin import auth as firebase_auth
from fastapi import HTTPException

from services.firestore import collection, initialize_firebase_app, now_iso

NAME_PATTERN = re.compile(r"[A-Za-z][A-Za-z .'-]{1,78}")
MOBILE_PATTERN = re.compile(r"^\+?[1-9]\d{6,14}$|^[6-9]\d{9}$")
INSTITUTION_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9 .,&'()/-]{1,118}")


def register_user(name: str, email: str, password: str) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="Use Firebase Authentication for registration.")


def login_user(email: str, password: str) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="Use Firebase Authentication for login.")


def _normalize_mobile(mobile_number: str) -> str:
    return mobile_number.replace(" ", "").replace("-", "")


def _validate_profile_fields(name: str, mobile_number: str | None, institution: str | None) -> tuple[str, str | None, str | None]:
    clean_name = name.strip()
    if not NAME_PATTERN.fullmatch(clean_name):
        raise HTTPException(status_code=422, detail="Enter a valid full name.")
    if mobile_number:
        clean_mobile = _normalize_mobile(mobile_number)
        if not MOBILE_PATTERN.fullmatch(clean_mobile):
            raise HTTPException(status_code=422, detail="Enter a valid mobile number.")
    else:
        clean_mobile = None
    if institution is not None:
        clean_institution = institution.strip()
        if not INSTITUTION_PATTERN.fullmatch(clean_institution):
            raise HTTPException(status_code=422, detail="Enter a valid institution name.")
    else:
        clean_institution = None
    return clean_name, clean_mobile if mobile_number else None, clean_institution


def _build_profile_document(
    *,
    name: str,
    email: str,
    age: int | None = None,
    mobile_number: str | None = None,
    gender: str | None = None,
    institution: str | None = None,
    github: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clean_name, clean_mobile, clean_institution = _validate_profile_fields(name, mobile_number, institution)
    normalized_email = email.strip().lower()
    user = {
        "name": clean_name or normalized_email.split("@", 1)[0],
        "email": normalized_email,
        **({"age": age} if age is not None else {}),
        **({"mobileNumber": clean_mobile} if clean_mobile else {}),
        **({"gender": gender} if gender else {}),
        **({"institution": clean_institution} if clean_institution else {}),
        **({"github": github} if github else {}),
        "auth_provider": "firebase",
        "updatedAt": now_iso(),
    }
    return user


def _persist_user_profile(uid: str, profile: dict[str, Any]) -> dict[str, Any]:
    doc = collection("users").document(uid)
    existing = doc.get()
    if existing.exists:
        doc.update(profile)
        existing_data = existing.to_dict() or {}
    else:
        doc.set({**profile, "createdAt": now_iso()})
        existing_data = {}
    return {"id": uid, **existing_data, **profile}


def get_user_profile(uid: str) -> dict[str, Any]:
    initialize_firebase_app()
    snapshot = collection("users").document(uid).get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = snapshot.to_dict() or {}
    return {"id": uid, **data}


def save_user_profile(
    uid: str,
    name: str,
    email: str,
    *,
    age: int | None = None,
    mobile_number: str | None = None,
    gender: str | None = None,
    institution: str,
    github: dict[str, Any] | None = None,
) -> dict[str, Any]:
    initialize_firebase_app()
    profile = _build_profile_document(
        name=name,
        email=email,
        age=age,
        mobile_number=mobile_number,
        gender=gender,
        institution=institution,
        github=github,
    )
    return _persist_user_profile(uid, profile)


def sync_firebase_user(
    uid: str,
    name: str,
    email: str,
    id_token: str,
    *,
    age: int | None = None,
    mobile_number: str | None = None,
    gender: str | None = None,
    institution: str | None = None,
    github: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        initialize_firebase_app()
        verified = firebase_auth.verify_id_token(id_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Firebase token") from exc
    token_uid = verified.get("uid")
    token_email = (verified.get("email") or email).lower()
    if token_uid != uid:
        raise HTTPException(status_code=401, detail="Firebase token does not match user")
    user = _build_profile_document(
        name=name,
        email=token_email,
        age=age,
        mobile_number=mobile_number,
        gender=gender,
        institution=institution,
        github=github,
    )
    persisted = _persist_user_profile(uid, user)
    return persisted
