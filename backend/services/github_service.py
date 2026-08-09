from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from fastapi import HTTPException

from services.config import settings


def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if parsed.netloc.lower() != "github.com" or len(parts) < 2:
        raise HTTPException(status_code=400, detail="Use a GitHub URL like https://github.com/owner/repo")
    return parts[0], parts[1].removesuffix(".git")


def github_request(path_or_url: str, token: str | None = None) -> Any:
    url = path_or_url if path_or_url.startswith("https://") else f"https://api.github.com{path_or_url}"
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "workism-api"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8") or "GitHub request failed"
        raise HTTPException(status_code=error.code, detail=detail) from error
    except urllib.error.URLError as error:
        raise HTTPException(status_code=502, detail=f"Could not reach GitHub: {error.reason}") from error


def oauth_url(state: str) -> str:
    if not settings.github_client_id or not settings.github_redirect_uri:
        raise HTTPException(status_code=501, detail="GitHub OAuth is not configured")
    query = urllib.parse.urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "repo read:user",
            "state": state,
        }
    )
    return f"https://github.com/login/oauth/authorize?{query}"


def repository_metadata(owner: str, repo: str, branch: str | None = None, token: str | None = None) -> dict[str, Any]:
    repo_data = github_request(f"/repos/{owner}/{repo}", token)
    selected_branch = branch or repo_data.get("default_branch") or "main"
    branch_data = github_request(f"/repos/{owner}/{repo}/branches/{selected_branch}", token)
    languages = github_request(f"/repos/{owner}/{repo}/languages", token)
    return {
        "owner": owner,
        "repo": repo,
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "default_branch": repo_data.get("default_branch"),
        "selected_branch": selected_branch,
        "latest_commit": (branch_data.get("commit") or {}).get("sha"),
        "html_url": repo_data.get("html_url"),
        "private": repo_data.get("private", False),
        "languages": languages,
        "stars": repo_data.get("stargazers_count", 0),
        "forks": repo_data.get("forks_count", 0),
    }


def repository_tree(owner: str, repo: str, branch: str, token: str | None = None) -> list[dict[str, Any]]:
    data = github_request(f"/repos/{owner}/{repo}/git/trees/{branch}?recursive=1", token)
    if data.get("truncated"):
        raise HTTPException(status_code=413, detail="Repository is too large to evaluate automatically.")
    return data.get("tree", [])


def repository_file(owner: str, repo: str, path: str, branch: str, token: str | None = None) -> str:
    data = github_request(f"/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}?ref={branch}", token)
    download_url = data.get("download_url")
    if not download_url:
        raise HTTPException(status_code=404, detail="Repository file not found")
    request = urllib.request.Request(download_url, headers={"User-Agent": "workism-api"})
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def github_user(token: str) -> dict[str, Any]:
    data = github_request("/user", token)
    return {
        "login": data.get("login"),
        "avatar_url": data.get("avatar_url"),
        "html_url": data.get("html_url"),
        "name": data.get("name"),
    }


def repository_context(owner: str, repo: str, branch: str, files: list[dict[str, Any]], token: str | None = None) -> str:
    source_extensions = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".cpp", ".c", ".cs", ".go", ".rs", ".md"}
    preferred_names = {"readme.md", "package.json", "requirements.txt", "pyproject.toml", "vite.config.ts"}
    snippets: list[str] = []
    total_chars = 0
    for item in files:
        path = item.get("path", "")
        lowered = path.lower()
        if item.get("type") != "blob":
            continue
        if item.get("size", 0) > 120_000:
            continue
        suffix = "." + lowered.rsplit(".", 1)[-1] if "." in lowered else ""
        if lowered not in preferred_names and suffix not in source_extensions:
            continue
        try:
            content = repository_file(owner, repo, path, branch, token)
        except Exception:
            continue
        excerpt = content[:5000]
        snippets.append(f"\n--- {path} ---\n{excerpt}")
        total_chars += len(excerpt)
        if total_chars >= 24_000:
            break
    if not snippets:
        raise HTTPException(status_code=400, detail="No readable source files were found in this repository.")
    return "\n".join(snippets)
