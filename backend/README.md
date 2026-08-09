# WORKISM Backend

FastAPI service for WORKISM. It stores application data in Firebase/Firestore, integrates with GitHub, and calls Ollama for qualitative AI analysis.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

Required production services:

- Firestore service account credentials
- GitHub OAuth app credentials for repository connection
- Ollama reachable from the backend, not from the browser

For Render deployments, set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` as backend environment variables.
Do not send Ollama secrets or credentials to the frontend.
If Ollama stays on your personal PC, Render still needs a URL it can reach, such as a tunnel or exposed host.
If Ollama stays on your personal PC, Render cannot call `http://localhost:11434` directly.
You will need a public tunnel or a host that Render can reach later.

See the root README for full deployment instructions.
