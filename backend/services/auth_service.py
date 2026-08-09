import re
from typing import Any

from firebase_admin import auth as firebase_auth
from fastapi import HTTPException

from services.firestore import collection, initialize_firebase_app, now_iso


def register_user(name: str, email: str, password: str) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="Use Firebase Authentication for registration.")


def login_user(email: str, password: str) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="Use Firebase Authentication for login.")


def sync_firebase_user(
    uid: str,
    name: str,
    email: str,
    id_token: str,
    *,
    age: int | None = None,
    mobile_number: str | None = None,
    gender: str | None = None,
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
    if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,78}", name.strip()):
        raise HTTPException(status_code=422, detail="Enter a valid full name.")
    if mobile_number and not re.fullmatch(r"^\+?[1-9]\d{6,14}$|^[6-9]\d{9}$", mobile_number.replace(" ", "").replace("-", "")):
        raise HTTPException(status_code=422, detail="Enter a valid mobile number.")
    normalized = token_email
    doc = collection("users").document(uid)
    existing = doc.get()
    user = {
        "name": name.strip() or normalized.split("@", 1)[0],
        "email": normalized,
        **({"age": age} if age is not None else {}),
        **({"mobileNumber": mobile_number} if mobile_number else {}),
        **({"gender": gender} if gender else {}),
        **({"github": github} if github else {}),
        "auth_provider": "firebase",
        "updatedAt": now_iso(),
    }
    if existing.exists:
        doc.update(user)
    else:
        doc.set({**user, "createdAt": now_iso()})
    return {"id": uid, "name": user["name"], "email": normalized, **{k: v for k, v in user.items() if k in {"age", "mobileNumber", "gender", "github"}}}
