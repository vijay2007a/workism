import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

from services.config import settings


class AIProviderUnavailable(RuntimeError):
    pass


class OllamaProvider:
    def _debug_enabled(self) -> bool:
        return os.getenv("OLLAMA_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}

    def _debug(self, message: str) -> None:
        if self._debug_enabled():
            print(f"[ollama-client] {message}", file=sys.stdout, flush=True)

    def _target(self) -> str:
        return f"{settings.ollama_base_url} (model: {settings.ollama_model})"

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        api_key = settings.ollama_api_key
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def generate(self, prompt: str, *, format_json: bool = False, timeout: int = 90) -> str:
        payload: dict[str, Any] = {"model": settings.ollama_model, "prompt": prompt, "stream": False}
        if format_json:
            payload["format"] = "json"
        api_key = settings.ollama_api_key
        headers = self._headers()
        self._debug(
            "request "
            f"url={settings.ollama_base_url}/api/generate "
            f"model={settings.ollama_model} "
            f"auth_present={'yes' if 'Authorization' in headers else 'no'} "
            f"api_key_present={'yes' if api_key else 'no'} "
            f"api_key_len={len(api_key) if api_key else 0}"
        )
        request = urllib.request.Request(
            f"{settings.ollama_base_url}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
                self._debug(f"response status=200 target={self._target()}")
                return data.get("response", "").strip()
        except urllib.error.HTTPError as error:
            self._debug(f"response status={error.code} target={self._target()}")
            if error.code in {401, 403}:
                raise AIProviderUnavailable(
                    f"Ollama authentication failed at {self._target()}. "
                    "Check OLLAMA_API_KEY and your local authenticated proxy or tunnel."
                ) from error
            raise AIProviderUnavailable(
                f"Ollama at {self._target()} returned HTTP {error.code}. "
                "Confirm the model name is available on the Ollama server and that the server is healthy."
            ) from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise AIProviderUnavailable(
                f"Could not reach Ollama at {self._target()}. "
                "Set OLLAMA_BASE_URL in your Render environment variables to a URL Render can reach, "
                "or use a public tunnel/host for your local PC."
            ) from error


print("[OLLAMA-DIAGNOSTIC] loaded ollama_client.py", flush=True)


ai_provider = OllamaProvider()
