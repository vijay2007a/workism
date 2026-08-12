import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db, firebaseConfigured, firebaseConfigurationMessage } from "./firebase";

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE_URL = (configuredApiUrl || "").replace(/\/$/, "");
const GITHUB_TOKEN_KEY = "workism_github_token";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export type WorkismUser = {
  id: string;
  name: string;
  email: string;
  age?: number;
  mobileNumber?: string;
  gender?: Gender;
  institution?: string;
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
  lesson_completed?: boolean;
  practice_completed?: boolean;
  coding_completed?: boolean;
  completed?: boolean;
  attempts?: number;
  best_score?: number;
  updated_at?: string;
};

export type LearningModule = {
  id: string;
  skill_id: string;
  title: string;
  order_index: number;
  overview?: string;
  lesson?: string;
  examples?: string[];
  practice?: string[];
  coding_problem_ids?: string[];
};

export type CodingProblem = {
  id: string;
  skill_id: string;
  module_id: string;
  title: string;
  difficulty: string;
  description: string;
  instructions: string;
  entrypoint: string;
  language: "python";
  starter_code: string;
  example_input?: string;
  expected_output?: string;
  tests: Array<{ args?: unknown[]; kwargs?: Record<string, unknown>; expected: unknown }>;
  hints: string[];
};

export type CodingAttempt = {
  id: string;
  user_id: string;
  problem_id: string;
  module_id: string;
  language: string;
  code: string;
  output?: string;
  error?: string;
  passed: boolean;
  attempt_number: number;
  total_tests: number;
  passed_tests: number;
  score: number;
  ai_help_used: boolean;
  kind?: string;
  created_at: string;
};

export type CodingSummary = {
  attempts: number;
  passed: number;
  best_score: number;
  latest: CodingAttempt | null;
  problem_id?: string | null;
};

export type CodingRunResult = {
  problem: CodingProblem;
  attempt: CodingAttempt;
  tests: Array<{ args?: unknown[]; kwargs?: Record<string, unknown>; expected: unknown; actual: unknown; passed: boolean }>;
  stdout: string;
  error?: string | null;
  passed: boolean;
  passed_tests: number;
  total_tests: number;
  score: number;
  summary: CodingSummary;
};

export type DashboardActivity = {
  type: string;
  text: string;
  meta?: string;
  created_at?: string;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  student: string;
  institution?: string;
  score: number;
  completed_modules: number;
  certificates: number;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  user_name: string;
  institution?: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  created_at: string;
  reply_count: number;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  body: string;
  created_at: string;
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
  if (API_BASE_URL) {
    const synced = await api<WorkismUser>("/auth/firebase-sync", {
      method: "POST",
      body: { ...user, id_token: idToken },
    });
    localStorage.setItem("workism_user", JSON.stringify(synced));
    return synced;
  }
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const profileRef = doc(db, "users", user.id);
  const existing = await getDoc(profileRef);
  const profile = {
    name: user.name,
    email: user.email.toLowerCase(),
    ...(user.age ? { age: user.age } : {}),
    ...(user.mobileNumber ? { mobileNumber: user.mobileNumber } : {}),
    ...(user.gender ? { gender: user.gender } : {}),
    ...(user.institution ? { institution: user.institution } : {}),
    ...(user.github ? { github: user.github } : {}),
    updatedAt: serverTimestamp(),
    ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
  };
  await setDoc(profileRef, profile, { merge: true });
  const synced = { ...user, ...(existing.exists() ? existing.data() : profile), id: user.id } as WorkismUser;
  localStorage.setItem("workism_user", JSON.stringify(synced));
  return synced;
}

export async function getUserProfile(uid: string): Promise<WorkismUser | null> {
  if (API_BASE_URL) {
    try {
      return await api<WorkismUser>("/profile");
    } catch (error) {
      if (error instanceof Error && /Profile not found|Request failed with 404/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  }
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const profile = await getDoc(doc(db, "users", uid));
  if (!profile.exists()) return null;
  return { id: uid, ...profile.data() } as WorkismUser;
}

export async function saveUserProfile(user: WorkismUser): Promise<WorkismUser> {
  if (API_BASE_URL) {
    const saved = await api<WorkismUser>("/profile", {
      method: "PUT",
      body: {
        name: user.name.trim(),
        age: user.age,
        mobileNumber: user.mobileNumber,
        gender: user.gender,
        institution: user.institution?.trim() || "",
        github: user.github,
      },
    });
    localStorage.setItem("workism_user", JSON.stringify(saved));
    return saved;
  }
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
    institution: user.institution?.trim(),
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
  return safeJsonParse<GithubConnection>(localStorage.getItem("workism_github_profile"));
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
  if (API_BASE_URL) {
    return api<LearningProgressRecord[]>(`/learning/progress/${userId}`);
  }
  if (!firebaseConfigured || !db) {
    throw new Error(firebaseConfigurationMessage());
  }
  const result = await getDocs(query(collection(db, "learning_progress"), where("user_id", "==", userId)));
  return result.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })) as LearningProgressRecord[];
}

export async function saveLearningProgress(record: LearningProgressRecord) {
  if (API_BASE_URL) {
    return api<LearningProgressRecord>("/learning/progress", {
      method: "POST",
      body: record,
    });
  }
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
  if (API_BASE_URL) {
    const data = await api<DashboardStats & { recentActivity?: DashboardActivity[] }>("/dashboard/stats");
    return data;
  }
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

export async function getLearningModules(skillId: string) {
  if (API_BASE_URL) {
    return api<LearningModule[]>(`/learning/${skillId}/modules`);
  }
  return [];
}

export async function getCodingProblems(skillId = "python", moduleId?: string) {
  const suffix = moduleId ? `?skill_id=${encodeURIComponent(skillId)}&module_id=${encodeURIComponent(moduleId)}` : `?skill_id=${encodeURIComponent(skillId)}`;
  return api<CodingProblem[]>(`/coding/problems${suffix}`);
}

export async function getCodingProblem(problemId: string) {
  return api<CodingProblem>(`/coding/problems/${problemId}`);
}

export async function getCodingAttempts(problemId?: string) {
  const suffix = problemId ? `?problem_id=${encodeURIComponent(problemId)}` : "";
  return api<{ user_id: string; attempts: CodingAttempt[]; summary: CodingSummary }>(`/coding/attempts${suffix}`);
}

export async function runCodingWorkout(problemId: string, code: string, aiHelpUsed = false) {
  return api<CodingRunResult>("/coding/run", {
    method: "POST",
    body: { problem_id: problemId, language: "python", code, ai_help_used: aiHelpUsed },
  });
}

export async function submitCodingWorkout(problemId: string, code: string, aiHelpUsed = false) {
  return api<CodingRunResult>("/coding/submit", {
    method: "POST",
    body: { problem_id: problemId, language: "python", code, ai_help_used: aiHelpUsed },
  });
}

export async function getLeaderboard() {
  return api<{ entries: LeaderboardEntry[] }>("/leaderboard");
}

export async function getCommunityPosts() {
  return api<CommunityPost[]>("/community/posts");
}

export async function createCommunityPost(payload: { title: string; body: string; category?: "Discussion" | "Question" | "Project" | "Announcement"; tags?: string[] }) {
  return api<CommunityPost>("/community/posts", {
    method: "POST",
    body: { category: payload.category || "Discussion", title: payload.title, body: payload.body, tags: payload.tags || [] },
  });
}

export async function getCommunityComments(postId: string) {
  return api<CommunityComment[]>(`/community/posts/${postId}/comments`);
}

export async function createCommunityComment(postId: string, body: string) {
  return api<CommunityComment>(`/community/posts/${postId}/comments`, {
    method: "POST",
    body: { body },
  });
}

export async function getCertificateEligibility() {
  return api<{
    eligible: boolean;
    modules_completed: boolean;
    coding_completed: boolean;
    project_submitted: boolean;
    evaluation_completed: boolean;
    profile_completed: boolean;
    originality_passed: boolean;
    originality_signal: number;
    originality_threshold: number;
    score: number;
    minimum_score: number;
    missing_requirements: string[];
  }>("/certificates/eligibility");
}
