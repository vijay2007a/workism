
  # Premium AI Learning Platform

  This is a code bundle for Premium AI Learning Platform. The original project is available at https://www.figma.com/design/j0bD1MHMytbMpBNeDyXb8m/Premium-AI-Learning-Platform.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend

  A FastAPI backend has been added in `backend/`.

  ```powershell
  cd backend
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
  ```

  API docs are available at `http://127.0.0.1:8000/docs`.
  
