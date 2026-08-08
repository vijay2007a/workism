import json
import os
import urllib.error
import urllib.request
from typing import Any


class OllamaUnavailable(RuntimeError):
    pass


def ollama_config() -> tuple[str, str]:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:14b")
    return base_url, model


def generate(prompt: str, *, format_json: bool = False, timeout: int = 90) -> str:
    base_url, model = ollama_config()
    payload: dict[str, Any] = {"model": model, "prompt": prompt, "stream": False}
    if format_json:
        payload["format"] = "json"
    request = urllib.request.Request(
        f"{base_url}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("response", "").strip()
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise OllamaUnavailable(str(error)) from error
