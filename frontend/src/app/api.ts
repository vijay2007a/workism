import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db, firebaseConfigured, firebaseConfigurationMessage } from "./firebase";

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

export type DashboardStats = {
  skillsInProgress: number;
  completedLessons: number;
  projectsSubmitted: number;
  evaluationsCompleted: number;
  averageScore: number;
  certificatesEarned: number;
};

export type LearningProgressRecord = {
  id?: string;
  user_id: string;
  skill_id: string;
  module_id: string;
  completed: boolean;
  updated_at?: string;
};

export type RepositoryMetadata = {
  owner: string;
  repo: string;
  full_name?: string;
  default_branch?: string;
  selected_branch: string;
  latest_commit?: string;
  html_url?: string;
  private?: boolean;
  languages?: Record<string, number>;
};

export type SubmissionResult = {
  submission: { id: string; evaluation_id?: string };
  evaluation: WorkismEvaluation;
};

type ApiOptions = RequestInit & { body?: BodyInit | Record<string, unknown> };

export function isApiConfigured() {
  return Boolean(API_BASE_URL);
}

export function apiConfigurationMessage() {
  return "Backend API URL is not configured. Set VITE_API_URL in Vercel to enable AI tutor, GitHub repository validation, project submission, evaluation, and certificates.";
}

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(apiConfigurationMessage());
  }
  if (!firebaseConfigured || !auth) {
    throw new Error(firebaseConfigurationMessage());
  }
  const headers = new Headers(options.headers);
  const firebaseToken = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
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
  throw new Error("Demo authentication has been removed. Sign in with Firebase Authentication.");
}

export function logoutDemoUser() {
  localStorage.removeItem("workism_user");
  localStorage.removeItem("workism_last_submission");
  localStorage.removeItem("workism_last_evaluation");
  localStorage.removeItem("workism_last_certificate");
}

export async function syncFirebaseUser(user: WorkismUser, idToken: string): Promise<WorkismUser> {
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
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

export async function getUserProfile(uid: string): Promise<WorkismUser | null> {
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const profile = await getDoc(doc(db, "users", uid));
  if (!profile.exists()) return null;
  return { id: uid, ...profile.data() } as WorkismUser;
}

export async function saveUserProfile(user: WorkismUser): Promise<WorkismUser> {
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const profileRef = doc(db, "users", user.id);
  const profile = {
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    age: user.age,
    mobileNumber: user.mobileNumber,
    gender: user.gender,
    ...(user.github ? { github: user.github } : {}),
    updatedAt: serverTimestamp(),
  };
  const existing = await getDoc(profileRef);
  await setDoc(profileRef, { ...profile, ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
  const saved = { ...user, ...profile };
  localStorage.setItem("workism_user", JSON.stringify(saved));
  return saved;
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

export async function connectGithubAccount() {
  return api<{ auth_url: string; state: string }>("/github/connect", { method: "POST" });
}

export async function listGithubRepositories() {
  return api<Array<{ full_name: string; html_url: string; private?: boolean; default_branch?: string }>>("/github/repositories");
}

export async function validateGithubRepository(repositoryUrl: string, branch?: string) {
  return api<RepositoryMetadata>("/github/repository-url", {
    method: "POST",
    body: { repository_url: repositoryUrl, branch: branch || undefined },
  });
}

export async function listRepositoryBranches(repositoryUrl: string) {
  return api<Array<{ name: string; commit?: { sha?: string } }>>("/github/repository-branches", {
    method: "POST",
    body: { repository_url: repositoryUrl },
  });
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

export async function evaluateSubmission(submissionId: string) {
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

export async function getLearningProgress(userId: string) {
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const result = await getDocs(query(collection(db, "learning_progress"), where("user_id", "==", userId)));
  return result.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })) as LearningProgressRecord[];
}

export async function saveLearningProgress(record: LearningProgressRecord) {
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const docId = `${record.user_id}_${record.skill_id}_${record.module_id}`;
  const payload = {
    ...record,
    updated_at: new Date().toISOString(),
    ...(record.completed ? { completed_at: new Date().toISOString() } : {}),
  };
  await setDoc(doc(db, "learning_progress", docId), payload, { merge: true });
  return { id: docId, ...payload };
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const [progress, submissions, evaluations, certificates] = await Promise.all([
    getDocs(query(collection(db, "learning_progress"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "submissions"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "evaluations"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "certificates"), where("user_id", "==", userId))),
  ]);
  const completedLessons = progress.docs.filter(item => Boolean(item.data().completed)).length;
  const skillsInProgress = new Set(progress.docs.map(item => String(item.data().skill_id || ""))).size;
  const scores = evaluations.docs
    .map(item => Number(item.data().total_score ?? item.data().final_score ?? 0))
    .filter(score => Number.isFinite(score) && score > 0);
  return {
    skillsInProgress,
    completedLessons,
    projectsSubmitted: submissions.size,
    evaluationsCompleted: evaluations.size,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    certificatesEarned: certificates.size,
  };
}

export async function askAiTutor(message: string, context: string) {
  return api<{ answer: string }>("/learning/ai-tutor", {
    method: "POST",
    body: { message, context },
  });
}
