from __future__ import annotations

import hmac
import http.client
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

OLLAMA_API_KEY = (os.getenv("OLLAMA_API_KEY") or "").strip()
OLLAMA_TARGET_URL = os.getenv("OLLAMA_TARGET_URL", "http://127.0.0.1:11434").strip()
OLLAMA_PROXY_HOST = os.getenv("OLLAMA_PROXY_HOST", "127.0.0.1").strip() or "127.0.0.1"
OLLAMA_PROXY_PORT = int(os.getenv("OLLAMA_PROXY_PORT", "8080"))
OLLAMA_DEBUG = os.getenv("OLLAMA_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


def _parse_target_url(target_url: str) -> tuple[str, int, str, bool]:
    parsed = urlparse(target_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("OLLAMA_TARGET_URL must use http:// or https://")
    if not parsed.hostname:
        raise ValueError("OLLAMA_TARGET_URL must include a hostname")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    base_path = parsed.path.rstrip("/")
    return parsed.hostname, port, base_path, parsed.scheme == "https"


TARGET_HOST, TARGET_PORT, TARGET_BASE_PATH, TARGET_IS_TLS = _parse_target_url(OLLAMA_TARGET_URL)


def _require_api_key() -> None:
    if not OLLAMA_API_KEY:
        raise SystemExit(
            "OLLAMA_API_KEY is required. Set it before starting the proxy so requests can be authenticated."
        )


def _request_path(path: str) -> str:
    if TARGET_BASE_PATH:
        if path == "/":
            return TARGET_BASE_PATH or "/"
        return f"{TARGET_BASE_PATH}{path}"
    return path


def _forward_headers(incoming: Iterable[tuple[str, str]]) -> dict[str, str]:
    headers: dict[str, str] = {}
    for name, value in incoming:
        lower = name.lower()
        if lower in HOP_BY_HOP_HEADERS or lower == "host":
            continue
        headers[name] = value
    return headers


def _debug(message: str) -> None:
    if OLLAMA_DEBUG:
        print(f"[ollama-proxy] {message}", file=sys.stdout, flush=True)


class OllamaProxyHandler(BaseHTTPRequestHandler):
    server_version = "WorkismOllamaProxy/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        message = format % args
        sys.stdout.write(f"{self.address_string()} - {message}\n")
        sys.stdout.flush()

    def _unauthorized(self) -> None:
        self.close_connection = True
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.send_header("WWW-Authenticate", 'Bearer realm="ollama-proxy"')
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(b'{"error":"Unauthorized"}')
        self.wfile.flush()

    def _authorized(self) -> bool:
        incoming = self.headers.get("Authorization", "")
        expected = f"Bearer {OLLAMA_API_KEY}"
        _debug(
            "incoming "
            f"method={self.command} "
            f"path={self.path} "
            f"auth_present={'yes' if incoming else 'no'} "
            f"auth_len={len(incoming)} "
            f"expected_len={len(expected)}"
        )
        return hmac.compare_digest(incoming.strip(), expected)

    def _read_body(self) -> bytes | None:
        content_length = self.headers.get("Content-Length")
        if content_length is None:
            return None
        try:
            length = int(content_length)
        except ValueError as error:
            raise ValueError("Invalid Content-Length header") from error
        if length < 0:
            raise ValueError("Invalid Content-Length header")
        return self.rfile.read(length) if length else b""

    def _proxy(self) -> None:
        if not self._authorized():
            self._unauthorized()
            return

        try:
            body = self._read_body()
        except ValueError as error:
            self.send_error(400, explain=str(error))
            return

        conn_cls = http.client.HTTPSConnection if TARGET_IS_TLS else http.client.HTTPConnection
        connection = conn_cls(TARGET_HOST, TARGET_PORT, timeout=120)
        try:
            connection.request(
                self.command,
                _request_path(self.path),
                body=body,
                headers=_forward_headers(self.headers.items()),
            )
            upstream = connection.getresponse()
            _debug(f"upstream status={upstream.status} reason={upstream.reason} path={self.path}")
            self.send_response(upstream.status, upstream.reason)

            content_length = upstream.getheader("Content-Length")
            content_type = upstream.getheader("Content-Type")
            for name, value in upstream.getheaders():
                lower = name.lower()
                if lower in HOP_BY_HOP_HEADERS:
                    continue
                if lower in {"content-length", "content-type"}:
                    continue
                self.send_header(name, value)

            if content_type:
                self.send_header("Content-Type", content_type)
            if content_length is not None:
                self.send_header("Content-Length", content_length)
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True

            while True:
                chunk = upstream.read(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            connection.close()

    def do_GET(self) -> None:  # noqa: N802
        self._proxy()

    def do_POST(self) -> None:  # noqa: N802
        self._proxy()

    def do_PUT(self) -> None:  # noqa: N802
        self._proxy()

    def do_PATCH(self) -> None:  # noqa: N802
        self._proxy()

    def do_DELETE(self) -> None:  # noqa: N802
        self._proxy()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._proxy()


def main() -> None:
    _require_api_key()
    server = ThreadingHTTPServer((OLLAMA_PROXY_HOST, OLLAMA_PROXY_PORT), OllamaProxyHandler)
    print(
        f"OLLAMA proxy listening on http://{OLLAMA_PROXY_HOST}:{OLLAMA_PROXY_PORT} "
        f"-> {OLLAMA_TARGET_URL}",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Ollama proxy...", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
