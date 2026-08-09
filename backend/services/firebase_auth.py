from typing import Any

from fastapi import Header, HTTPException
from firebase_admin import auth as firebase_auth

from services.firestore import initialize_firebase_app


def verify_firebase_token(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in again to continue.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        initialize_firebase_app()
        decoded = firebase_auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase session.") from exc
    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Firebase session is missing a user id.")
    return decoded


def github_token_header(x_github_token: str | None = Header(default=None)) -> str:
    if not x_github_token:
        raise HTTPException(status_code=401, detail="Connect GitHub before submitting a repository.")
    return x_github_token.strip()
