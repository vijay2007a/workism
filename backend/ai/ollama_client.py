import json
import urllib.error
import urllib.request
from typing import Any

from services.config import settings


class AIProviderUnavailable(RuntimeError):
    pass


class OllamaProvider:
    def _target(self) -> str:
        return f"{settings.ollama_base_url} (model: {settings.ollama_model})"

    def generate(self, prompt: str, *, format_json: bool = False, timeout: int = 90) -> str:
        payload: dict[str, Any] = {"model": settings.ollama_model, "prompt": prompt, "stream": False}
        if format_json:
            payload["format"] = "json"
        request = urllib.request.Request(
            f"{settings.ollama_base_url}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("response", "").strip()
        except urllib.error.HTTPError as error:
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


ai_provider = OllamaProvider()
