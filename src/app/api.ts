const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export type WorkismUser = {
  id: number;
  name: string;
  email: string;
};

export type WorkismEvaluation = {
  id: number;
  submission_id: number;
  total_score: number;
  passed: number;
  breakdown: string;
  feedback: string;
  strengths: string;
  improvements: string;
  created_at: string;
};

export type WorkismCertificate = {
  id: number;
  certificate_id: string;
  user_id: number;
  evaluation_id: number;
  issued_at: string;
  html: string;
};

type ApiOptions = RequestInit & { body?: BodyInit | Record<string, unknown> };

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body });
  if (!response.ok) {
    let detail = `Request failed with ${response.status}`;
    try {
      const error = await response.json();
      detail = error.detail || detail;
    } catch {
      detail = await response.text();
    }
    throw new Error(detail);
  }
  return response.json();
}

export async function ensureDemoUser(): Promise<WorkismUser> {
  const saved = localStorage.getItem("workism_user");
  if (saved) return JSON.parse(saved) as WorkismUser;

  const email = `demo+${Date.now()}@workism.local`;
  const user = await api<WorkismUser>("/auth/register", {
    method: "POST",
    body: { name: "Vijay A", email, password: "workism-demo" },
  });
  localStorage.setItem("workism_user", JSON.stringify(user));
  return user;
}

export function logoutDemoUser() {
  localStorage.removeItem("workism_user");
  localStorage.removeItem("workism_last_submission");
  localStorage.removeItem("workism_last_evaluation");
  localStorage.removeItem("workism_last_certificate");
}

export async function submitPythonProject(userId: number, repositoryUrl: string, branch: string) {
  const developmentSample = [
    "from fastapi import FastAPI, HTTPException",
    "app = FastAPI()",
    "tasks = []",
    "@app.get('/tasks')",
    "def list_tasks(): return tasks",
    "# tests readme validation docs security edge cases project structure",
  ].join("\n").repeat(30);

  return api<{ id: number }>("/submissions", {
    method: "POST",
    body: {
      user_id: userId,
      skill_id: 1,
      module_id: 10,
      github_url: repositoryUrl || undefined,
      code: repositoryUrl ? undefined : developmentSample,
      notes: `Branch: ${branch}. Python Task Management REST API assessment submission.`,
    },
  });
}

export async function evaluateSubmission(submissionId: number) {
  return api<WorkismEvaluation>("/evaluations", {
    method: "POST",
    body: { submission_id: submissionId },
  });
}

export async function generateCertificate(userId: number, evaluationId: number) {
  return api<WorkismCertificate>("/certificates", {
    method: "POST",
    body: { user_id: userId, evaluation_id: evaluationId },
  });
}

export async function verifyCertificate(certificateId: string) {
  return api<{ valid: boolean; certificate: WorkismCertificate }>(`/certificates/${certificateId}/verify`);
}

export function certificateDownloadUrl(certificateId: string) {
  return `${API_BASE_URL}/certificates/${certificateId}/download`;
}
