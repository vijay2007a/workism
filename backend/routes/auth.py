from typing import Any

from fastapi import APIRouter

from models.schemas import FirebaseUserRequest, LoginRequest, RegisterRequest
from services.auth_service import login_user, register_user, sync_firebase_user

router = APIRouter()


@router.post("/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    return register_user(payload.name, payload.email, payload.password)


@router.post("/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    return login_user(payload.email, payload.password)


@router.post("/firebase-sync")
def firebase_sync(payload: FirebaseUserRequest) -> dict[str, Any]:
    return sync_firebase_user(
        payload.id,
        payload.name,
        payload.email,
        payload.id_token,
        age=payload.age,
        mobile_number=payload.mobileNumber,
        gender=payload.gender,
        github=payload.github,
    )
