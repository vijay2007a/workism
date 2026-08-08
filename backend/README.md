# Workism FastAPI Backend

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API stores data in `backend/data/workism.db`.

## Local LLM

By default evaluation calls Ollama at `http://localhost:11434/api/generate` with model `llama3.1`.

You can override it:

```powershell
$env:LOCAL_LLM_URL="http://localhost:11434/api/generate"
$env:LOCAL_LLM_MODEL="llama3.1"
```

If the local LLM is unavailable, the backend still stores a baseline heuristic score.

## Main Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /skills`
- `POST /skills`
- `GET /skills/{skill_id}/modules`
- `POST /skills/{skill_id}/modules`
- `POST /github/repository`
- `POST /submissions`
- `POST /llm/evaluate`
- `GET /results/{user_id}`
- `POST /certificates`
- `GET /certificates/verify/{certificate_id}`
- `GET /certificates/{certificate_id}/download`

Open `http://127.0.0.1:8000/docs` after starting the server to test everything from Swagger UI.
