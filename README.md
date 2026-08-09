# WORKISM

WORKISM is a React/Vite frontend with a separate FastAPI backend for learning, submissions, GitHub integration, AI-assisted evaluation, and verified certificates.

Users learn technical skills through structured AI-guided lessons, complete real-world projects, submit their work through GitHub, and receive an evidence-based evaluation combining automated analysis with AI-powered review.

## Features

- AI-powered learning and tutoring
- Real-world skill-based projects
- GitHub repository integration
- Automated testing and project analysis
- Security and code-quality checks
- Local LLM-powered code evaluation
- Transparent skill scoring
- AI-powered improvement recommendations
- Learning progress tracking
- Verifiable digital certificates
- Certificate verification

## Local Setup

Requirements:

- Node.js 20+
- Python 3.11+
- Firebase project with Firestore enabled
- Ollama installed on the machine that runs AI inference

```powershell
git clone https://github.com/vijay2007a/workism.git
cd workism
```

## Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

`frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

The browser must only call the FastAPI backend. Do not put Firebase service account keys, GitHub secrets, or Ollama URLs in frontend environment variables.

## Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

API docs are available at `http://127.0.0.1:8000/docs`.

## Firebase Configuration

Use Firestore for:

- `users`
- `learning_progress`
- `assessments`
- `submissions`
- `evaluations`
- `certificates`

Create a Firebase service account JSON file and keep it outside Git. For local development, save it as `backend/service-account.json`.

Backend `.env`:

```env
FIREBASE_PROJECT_ID=workism-6021d
FIREBASE_CREDENTIALS_PATH=./service-account.json
```

For hosted backends, prefer `FIREBASE_CREDENTIALS_JSON` with the full service account JSON stored as a secret environment variable.

The Firebase web config is not used for privileged backend access. Keep privileged Firebase credentials only in the backend environment.

## Ollama Installation

Install Ollama from `https://ollama.com/download`, then start it:

```powershell
ollama serve
```

## Qwen Model Setup

```powershell
ollama pull qwen2.5-coder:14b
```

Backend `.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:14b
```

The frontend never calls Ollama directly. Local flow is:

```text
Frontend -> FastAPI -> Ollama
```

Production flow is:

```text
Vercel Frontend -> Cloud FastAPI Backend -> AI server/Ollama
```

## GitHub Configuration

The backend contains a GitHub integration service for OAuth, repository metadata, branch metadata, file trees, and secure file retrieval.

Backend `.env`:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://127.0.0.1:8000/api/github/callback
```

Do not expose GitHub client secrets in the frontend. User access tokens should be sent only to the backend over HTTPS.

## Vercel Deployment

This repo includes `vercel.json` for root deployments and `frontend/vercel.json` for frontend-root deployments. Both configure SPA rewrites to `index.html`.

In Vercel, set:

```env
VITE_API_URL=https://your-fastapi-backend.example.com/api
```

Build settings if deploying from repo root:

```text
Install Command: cd frontend && npm install
Build Command: cd frontend && npm run build
Output Directory: frontend/dist
```

The production build must not use localhost API URLs.

## Backend Deployment

Deploy `backend/` separately to a Python-capable host such as Cloud Run, Render, Railway, Fly.io, or a VM.

Run command:

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

Set `CORS_ORIGINS` to your Vercel domain:

```env
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

If Ollama runs on another server, set `OLLAMA_BASE_URL` to the private or protected backend-accessible URL. Never expose Ollama directly to the browser.

## Required Environment Variables

Frontend:

```env
VITE_API_URL=
```

Backend:

```env
CORS_ORIGINS=
FIREBASE_PROJECT_ID=
FIREBASE_CREDENTIALS_PATH=
FIREBASE_CREDENTIALS_JSON=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:14b
```

## Architecture Notes

- `frontend/` contains the React/Vite/TypeScript UI.
- `backend/routes/` contains REST route modules.
- `backend/services/` contains Firestore, GitHub, catalog, certificate, and evaluation logic.
- `backend/ai/` isolates the Ollama provider so another LLM provider can replace it later.
- Evaluation separates objective checks from AI analysis. The final score is derived only from objective checks, and the AI cannot independently decide the final score.
- Certificates are generated only after a passing evaluation and are stored with certificate ID, learner, skill, score, date, and verification status in Firestore.
