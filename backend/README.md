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

See the root README for full deployment instructions.
