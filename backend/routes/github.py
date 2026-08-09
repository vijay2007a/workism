import secrets
from typing import Any

from fastapi import APIRouter, Depends, Header

from models.schemas import RepositoryMetadataRequest, RepositoryUrlRequest
from services.firebase_auth import github_token_header, verify_firebase_token
from services.github_service import github_user, oauth_url, parse_github_url, repository_file, repository_metadata, repository_tree

router = APIRouter()


@router.post("/connect")
def connect_github() -> dict[str, str]:
    state = secrets.token_urlsafe(24)
    return {"auth_url": oauth_url(state), "state": state}


@router.get("/me")
def me(_: dict[str, Any] = Depends(verify_firebase_token), token: str = Depends(github_token_header)) -> dict[str, Any]:
    return github_user(token)


@router.get("/repositories")
def list_repositories(_: dict[str, Any] = Depends(verify_firebase_token), token: str = Depends(github_token_header)) -> list[dict[str, Any]]:
    from services.github_service import github_request

    return github_request("/user/repos?sort=updated&per_page=100", token)


@router.post("/repository")
def get_repository(payload: RepositoryMetadataRequest, _: dict[str, Any] = Depends(verify_firebase_token), token: str = Depends(github_token_header)) -> dict[str, Any]:
    return repository_metadata(payload.owner, payload.repo, payload.branch, token)


@router.post("/repository-url")
def get_repository_by_url(payload: RepositoryUrlRequest, _: dict[str, Any] = Depends(verify_firebase_token)) -> dict[str, Any]:
    owner, repo = parse_github_url(str(payload.repository_url))
    return repository_metadata(owner, repo, payload.branch)


@router.post("/repository-branches")
def get_repository_branches(payload: RepositoryUrlRequest, _: dict[str, Any] = Depends(verify_firebase_token)) -> list[dict[str, Any]]:
    from services.github_service import github_request

    owner, repo = parse_github_url(str(payload.repository_url))
    return github_request(f"/repos/{owner}/{repo}/branches?per_page=100")


@router.post("/repository/tree")
def get_repository_tree(payload: RepositoryMetadataRequest, _: dict[str, Any] = Depends(verify_firebase_token), token: str = Depends(github_token_header)) -> list[dict[str, Any]]:
    metadata = repository_metadata(payload.owner, payload.repo, payload.branch, token)
    return repository_tree(payload.owner, payload.repo, metadata["selected_branch"], token)


@router.get("/repository/file")
def get_repository_file(
    owner: str,
    repo: str,
    path: str,
    branch: str = "main",
    _: dict[str, Any] = Depends(verify_firebase_token),
    token: str = Depends(github_token_header),
) -> dict[str, str]:
    return {"path": path, "content": repository_file(owner, repo, path, branch, token)}
