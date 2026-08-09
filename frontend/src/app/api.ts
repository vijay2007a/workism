import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE_URL = (configuredApiUrl || "").replace(/\/$/, "");
const GITHUB_TOKEN_KEY = "workism_github_token";

export type WorkismUser = {
  id: string;
  name: string;
  email: string;
  age?: number;
  mobileNumber?: string;
  gender?: Gender;
  github?: GithubProfile;
};

export type Gender = "Male" | "Female" | "Non-binary" | "Prefer not to say";

export type GithubProfile = {
  providerId: "github.com";
  githubUserId?: string;
  username?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
};

export type WorkismEvaluation = {
  id: string;
  submission_id: string;
  total_score: number;
  passed: boolean;
  breakdown: Record<string, boolean | number | string[]>;
  feedback: string;
  strengths: string[];
  improvements: string[];
  created_at: string;
};

export type WorkismCertificate = {
  id: string;
  certificate_id: string;
  user_id: string;
  evaluation_id: string;
  issued_at: string;
  html: string;
};

export type GithubConnection = {
  login: string;
  avatar_url: string;
  html_url: string;
  name?: string;
};

export type SubmissionResult = {
  submission: { id: string };
  evaluation: WorkismEvaluation;
};

type ApiOptions = RequestInit & { body?: BodyInit | Record<string, unknown> };

export function isApiConfigured() {
  return Boolean(API_BASE_URL);
}

export function apiConfigurationMessage() {
  return "Backend API URL is not configured. Set VITE_API_URL in Vercel.";
}

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(apiConfigurationMessage());
  }
  const headers = new Headers(options.headers);
  const firebaseToken = await auth.currentUser?.getIdToken();
  if (firebaseToken) headers.set("Authorization", `Bearer ${firebaseToken}`);
  const githubToken = localStorage.getItem(GITHUB_TOKEN_KEY);
  if (githubToken) headers.set("X-GitHub-Token", githubToken);
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

export async function syncFirebaseUser(user: WorkismUser, idToken: string): Promise<WorkismUser> {
  if (!API_BASE_URL) {
    const profileRef = doc(db, "users", user.id);
    const existing = await getDoc(profileRef);
    const profile = {
      name: user.name,
      email: user.email.toLowerCase(),
      ...(user.age ? { age: user.age } : {}),
      ...(user.mobileNumber ? { mobileNumber: user.mobileNumber } : {}),
      ...(user.gender ? { gender: user.gender } : {}),
      ...(user.github ? { github: user.github } : {}),
      updatedAt: serverTimestamp(),
      ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
    };
    await setDoc(profileRef, profile, { merge: true });
    const synced = { ...user, ...(existing.exists() ? existing.data() : profile), id: user.id } as WorkismUser;
    localStorage.setItem("workism_user", JSON.stringify(synced));
    return synced;
  }
  const synced = await api<WorkismUser>("/auth/firebase-sync", {
    method: "POST",
    body: { ...user, id_token: idToken },
  });
  localStorage.setItem("workism_user", JSON.stringify(synced));
  return synced;
}

export function saveGithubToken(token: string) {
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
}

export function clearGithubToken() {
  localStorage.removeItem(GITHUB_TOKEN_KEY);
  localStorage.removeItem("workism_github_profile");
}

export function getStoredGithubProfile(): GithubConnection | null {
  const saved = localStorage.getItem("workism_github_profile");
  return saved ? JSON.parse(saved) as GithubConnection : null;
}

export async function getGithubProfile() {
  const profile = await api<GithubConnection>("/github/me");
  localStorage.setItem("workism_github_profile", JSON.stringify(profile));
  return profile;
}

export async function submitPythonProject(repositoryUrl: string, branch: string) {
  return api<SubmissionResult>("/submissions", {
    method: "POST",
    body: {
      skill_id: "python",
      assessment_id: "python-task-api",
      repository_url: repositoryUrl,
      branch,
    },
  });
}

export async function evaluateSubmission(submissionId: number) {
  return api<WorkismEvaluation>("/evaluations", {
    method: "POST",
    body: { submission_id: submissionId },
  });
}

export async function generateCertificate(userId: string, evaluationId: string) {
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
