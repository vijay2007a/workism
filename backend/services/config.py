import json
import os
from functools import cached_property


class Settings:
    @property
    def cors_origins(self) -> list[str]:
        raw = os.getenv(
            "CORS_ORIGINS",
            "https://workism-ai.vercel.app,http://localhost:5173,http://127.0.0.1:5173",
        )
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        raw = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")
        return raw.strip() or None

    @property
    def firebase_project_id(self) -> str | None:
        return os.getenv("FIREBASE_PROJECT_ID")

    @property
    def firebase_credentials_path(self) -> str | None:
        return os.getenv("FIREBASE_CREDENTIALS_PATH")

    @cached_property
    def firebase_credentials_json(self) -> dict | None:
        raw = os.getenv("FIREBASE_CREDENTIALS_JSON")
        return json.loads(raw) if raw else None

    @property
    def github_client_id(self) -> str | None:
        return os.getenv("GITHUB_CLIENT_ID")

    @property
    def github_client_secret(self) -> str | None:
        return os.getenv("GITHUB_CLIENT_SECRET")

    @property
    def github_redirect_uri(self) -> str | None:
        return os.getenv("GITHUB_REDIRECT_URI")

    @property
    def ollama_base_url(self) -> str:
        return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    @property
    def ollama_api_key(self) -> str | None:
        raw = os.getenv("OLLAMA_API_KEY")
        if not raw:
            return None
        value = raw.strip()
        return value or None

    @property
    def ollama_model(self) -> str:
        return os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")

    @property
    def originality_max_ai_signal(self) -> int:
        raw = os.getenv("WORKISM_ORIGINALITY_MAX_AI_SIGNAL", "65")
        try:
            value = int(raw)
        except ValueError:
            value = 65
        return max(0, min(100, value))


settings = Settings()
