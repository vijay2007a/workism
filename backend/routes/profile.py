from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import ProfileUpdateRequest
from services.auth_service import get_user_profile, save_user_profile
from services.firebase_auth import verify_firebase_token

router = APIRouter()


@router.get("")
def read_profile(decoded: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    uid = str(decoded["uid"])
    return get_user_profile(uid)


@router.put("")
def update_profile(
    payload: ProfileUpdateRequest,
    decoded: dict[str, Any] = Depends(verify_firebase_token),
) -> dict[str, Any]:
    uid = str(decoded["uid"])
    email = str(decoded.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=401, detail="Firebase session is missing an email address.")
    return save_user_profile(
        uid,
        payload.name,
        email,
        age=payload.age,
        mobile_number=payload.mobileNumber,
        gender=payload.gender,
        institution=payload.institution,
        github=payload.github,
    )
