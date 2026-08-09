import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
  type UserCredential,
} from "firebase/auth";
import {
  LayoutDashboard, BookOpen, ClipboardList, FolderGit2, Award,
  Trophy, Users, Settings, ChevronRight, Github, CheckCircle2,
  ArrowRight, Code2, Shield, Brain, Zap, TrendingUp,
  Clock, Calendar, Bell, Search, Star, ChevronLeft,
  Download, Share2, Check, BarChart3,
  Menu, Target, Send, GitBranch,
  GraduationCap, ExternalLink, Sparkles, FileText,
  Cpu, Layers, CheckCheck, Mail, Lock
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";
import {
  certificateDownloadUrl,
  clearGithubToken,
  askAiTutor,
  evaluateSubmission,
  generateCertificate,
  getDashboardStats,
  getStoredGithubProfile,
  getLearningProgress,
  getUserProfile,
  isApiConfigured,
  listGithubRepositories,
  listRepositoryBranches,
  saveGithubToken,
  saveLearningProgress,
  saveUserProfile,
  submitPythonProject,
  syncFirebaseUser,
  validateGithubRepository,
  type DashboardStats,
  type Gender,
  type WorkismCertificate,
  type WorkismEvaluation,
  type GithubProfile,
  type WorkismUser,
} from "./api";
import { auth, firebaseConfigured, firebaseConfigurationMessage, githubProvider, googleProvider } from "./firebase";

type Screen =
  | "landing"
  | "auth"
  | "profile"
  | "dashboard"
  | "skills"
  | "learning"
  | "assessment"
  | "submission"
  | "evaluation"
  | "certificate";

const LANDING_NAV_ITEMS = ["Features", "How It Works", "Skills", "About"];

const SKILLS_DATA = [
  { id: "python", name: "Python", emoji: "🐍", level: "Beginner to Advanced", modules: 12, category: "Programming", color: "#3b82f6", progress: 65 },
  { id: "javascript", name: "JavaScript", emoji: "⚡", level: "Beginner to Advanced", modules: 14, category: "Programming", color: "#f59e0b", progress: 40 },
  { id: "react", name: "React", emoji: "⚛️", level: "Beginner to Advanced", modules: 10, category: "Web Development", color: "#06b6d4", progress: 25 },
  { id: "java", name: "Java", emoji: "☕", level: "Beginner to Advanced", modules: 12, category: "Programming", color: "#f97316", progress: 0 },
  { id: "cpp", name: "C++", emoji: "⚙️", level: "Beginner to Advanced", modules: 10, category: "Programming", color: "#8b5cf6", progress: 0 },
  { id: "sql", name: "SQL", emoji: "🗄️", level: "Beginner to Advanced", modules: 8, category: "Database", color: "#10b981", progress: 20 },
  { id: "cybersecurity", name: "Cybersecurity", emoji: "🔒", level: "Beginner to Advanced", modules: 15, category: "Cybersecurity", color: "#ef4444", progress: 0 },
  { id: "aiml", name: "AI / ML", emoji: "🤖", level: "Beginner to Advanced", modules: 18, category: "Data Science", color: "#7c3aed", progress: 0 },
];

const MODULES_DATA = [
  { id: 1, title: "Introduction", completed: true },
  { id: 2, title: "Variables & Data Types", completed: true },
  { id: 3, title: "Control Flow", completed: true },
  { id: 4, title: "Functions", completed: false, active: true },
  { id: 5, title: "OOP in Python", completed: false },
  { id: 6, title: "Modules & Packages", completed: false },
  { id: 7, title: "File Handling", completed: false },
  { id: 8, title: "Exception Handling", completed: false },
];

const ACTIVITIES = [
  { text: 'Project "Task Manager API" evaluated', meta: "Score: 85/100", time: "2h ago", type: "evaluation" },
  { text: "Completed lesson 'OOP in Python'", meta: "", time: "4h ago", type: "lesson" },
  { text: "Started assessment 'Data Structures'", meta: "", time: "1d ago", type: "assessment" },
];

const SCORE_BREAKDOWN = [
  { name: "Functionality", score: 28, max: 30, color: "#10b981" },
  { name: "Code Quality", score: 18, max: 20, color: "#3b82f6" },
  { name: "Security", score: 8, max: 10, color: "#8b5cf6" },
  { name: "Documentation", score: 7, max: 10, color: "#f59e0b" },
  { name: "Testing", score: 9, max: 10, color: "#06b6d4" },
  { name: "Git Practices", score: 15, max: 20, color: "#f97316" },
];

const FEATURES = [
  { icon: Brain, title: "AI-Powered Learning", desc: "Adaptive curriculum that adjusts to your pace and learning style with personalized recommendations.", color: "#7c3aed" },
  { icon: Code2, title: "Real-World Projects", desc: "Build production-grade projects with modern stacks. No toy examples—actual apps employers want to see.", color: "#3b82f6" },
  { icon: Github, title: "GitHub Integration", desc: "Submit your repositories directly. Our AI evaluates code quality, architecture, tests, and documentation.", color: "#10b981" },
  { icon: BarChart3, title: "AI Evaluation Engine", desc: "Receive granular feedback across 6 dimensions: functionality, quality, security, documentation, testing, and Git practices.", color: "#f59e0b" },
  { icon: Award, title: "Verified Certificates", desc: "Earn cryptographically verified credentials that employers can validate instantly with a certificate ID.", color: "#ef4444" },
  { icon: Trophy, title: "Leaderboard & Community", desc: "Compete with peers, share projects, and get code reviews from a community of serious developers.", color: "#06b6d4" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Learn with AI", desc: "Work through structured modules with an AI tutor available 24/7. Ask questions, get explanations, practice in the built-in code editor." },
  { step: "02", title: "Build Real Projects", desc: "Each skill ends with a real-world project assessment. Build something meaningful and push it to GitHub." },
  { step: "03", title: "Submit & Get Evaluated", desc: "Submit your GitHub repository. Our AI engine analyzes your code across 6 quality dimensions within minutes." },
  { step: "04", title: "Earn Your Certificate", desc: "Score above the threshold to earn a verified WORKISM certificate with a unique ID employers can verify." },
];

const DASHBOARD_SCREENS: Screen[] = ["dashboard", "skills", "learning", "assessment", "submission", "evaluation", "certificate"];

type WorkismRuntime = {
  user: WorkismUser | null;
  evaluation: WorkismEvaluation | null;
  certificate: WorkismCertificate | null;
  refreshUser: () => Promise<void>;
  setUser: (user: WorkismUser | null) => void;
  setEvaluation: (evaluation: WorkismEvaluation | null) => void;
  setCertificate: (certificate: WorkismCertificate | null) => void;
  onNavigate: (screen: Screen) => void;
};

function parseStoredList(value: string[] | string | undefined, fallback: string[]) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseBreakdown(value: Record<string, boolean | number | string[]> | string | undefined) {
  const fallback = {
    functionality: 28,
    code_quality: 18,
    security: 13,
    documentation: 8,
    testing: 12,
    git_practices: 7,
  };
  if (!value) return fallback;
  if (typeof value === "object") {
    const objectiveScore = typeof value.score === "number" ? value.score : 0;
    return {
      functionality: value.project_requirements ? 28 : Math.round(objectiveScore * 0.2),
      code_quality: value.syntax ? 18 : Math.round(objectiveScore * 0.15),
      security: value.security ? 8 : Math.round(objectiveScore * 0.08),
      documentation: value.readme ? 7 : Math.round(objectiveScore * 0.07),
      testing: value.tests ? 9 : Math.round(objectiveScore * 0.09),
      git_practices: value.required_files ? 15 : Math.round(objectiveScore * 0.12),
    };
  }
  try {
    return { ...fallback, ...JSON.parse(value) };
  } catch {
    return fallback;
  }
}

// ─── Utility Components ──────────────────────────────────────────────────────

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ transition: "transform 0.4s ease" });

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({ transform: `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(8px)`, transition: "transform 0.12s ease" });
  };

  const onLeave = () =>
    setStyle({ transform: "perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0)", transition: "transform 0.5s ease" });

  return (
    <div ref={ref} className={className} style={style} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

function MagButton({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: (e.clientX - rect.left - rect.width / 2) * 0.28, y: (e.clientY - rect.top - rect.height / 2) * 0.28 });
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      className={className}
      style={{ transform: `translate(${pos.x}px,${pos.y}px)`, transition: pos.x === 0 && pos.y === 0 ? "transform 0.5s ease" : "transform 0.1s ease" }}
    >
      {children}
    </button>
  );
}

function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const step = target / (1800 / 16);
        let n = 0;
        const t = setInterval(() => { n += step; if (n >= target) { setCount(target); clearInterval(t); } else setCount(Math.floor(n)); }, 16);
      }
    }, { threshold: 0.5 });
    if (nodeRef.current) obs.observe(nodeRef.current);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={nodeRef}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

function ScoreCircle({ score }: { score: number }) {
  const r = 52, circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (score / 100) * circ), 500);
    return () => clearTimeout(t);
  }, [score, circ]);

  return (
    <div className="relative w-44 h-44">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#sg)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1)" }} />
        <defs>
          <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white" style={{ fontFamily: "Outfit" }}>{score}</span>
        <span className="text-xs text-white/40">/100</span>
      </div>
    </div>
  );
}

function Bar({ value, color = "#7c3aed", delay = 0 }: { value: number; color?: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 300 + delay); return () => clearTimeout(t); }, [value, delay]);
  return (
    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

function GlassPanel({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`backdrop-blur-md bg-white/[0.04] border border-white/10 rounded-xl ${glow ? "shadow-[0_0_30px_rgba(124,58,237,0.15)]" : ""} ${className}`}>
      {children}
    </div>
  );
}

function SoftPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] ${className}`}>
      {children}
    </div>
  );
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-100">
            <div className="mb-2 text-lg font-semibold text-white">Workism failed to render</div>
            <div className="mb-4 whitespace-pre-wrap">{this.state.message}</div>
            <div className="text-white/70">
              Refresh after fixing the underlying config or runtime error.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── AI Hero Visual ───────────────────────────────────────────────────────────

function AIHeroVisual() {
  return (
    <div className="relative w-full h-[480px] flex items-center justify-center select-none">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute w-48 h-48 rounded-full bg-blue-500/15 blur-2xl" style={{ animation: "pulse 3s ease-in-out infinite 1s" }} />
      </div>

      {/* Orbit rings */}
      <div className="absolute w-72 h-72 rounded-full border border-violet-500/15 animate-orbit" />
      <div className="absolute w-56 h-56 rounded-full border border-blue-400/10 animate-orbit-reverse" />

      {/* Orbit dots */}
      <div className="absolute w-72 h-72 animate-orbit">
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
      </div>
      <div className="absolute w-56 h-56 animate-orbit-reverse">
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
      </div>

      {/* Central core */}
      <div className="relative z-10 w-28 h-28 flex items-center justify-center animate-pulse-glow">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_60px_rgba(124,58,237,0.7),inset_0_0_30px_rgba(255,255,255,0.1)]">
          <Brain className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Floating panel: Code */}
      <div className="absolute top-10 right-12 animate-float">
        <GlassPanel className="p-3 border-violet-500/20" glow>
          <div className="text-[11px] font-mono leading-relaxed">
            <div className="text-violet-400">def <span className="text-white">evaluate</span><span className="text-white/60">(repo):</span></div>
            <div className="ml-3 text-blue-300">score <span className="text-white/60">= ai</span>.analyze<span className="text-white/60">(</span></div>
            <div className="ml-6 text-emerald-400">code<span className="text-white/60">, </span>tests</div>
            <div className="ml-3 text-white/60">)</div>
            <div className="ml-3 text-orange-300">return <span className="text-white">score</span></div>
          </div>
        </GlassPanel>
      </div>

      {/* Floating panel: GitHub */}
      <div className="absolute left-4 top-1/2 -translate-y-12 animate-float-delayed">
        <GlassPanel className="p-3 border-emerald-500/20 min-w-[148px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <Github className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[11px] text-white font-semibold">task-manager-api</div>
              <div className="text-[10px] text-emerald-400">✓ submitted</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3 h-3 text-white/40" />
            <span className="text-[10px] text-white/40">main • 24 commits</span>
          </div>
        </GlassPanel>
      </div>

      {/* Floating panel: Score */}
      <div className="absolute right-4 top-1/2 translate-y-2 animate-float" style={{ animationDelay: "1s" }}>
        <GlassPanel className="p-3 border-blue-500/20 min-w-[130px]" glow>
          <div className="text-[10px] text-white/40 mb-1">AI Evaluation</div>
          <div className="text-3xl font-bold text-white" style={{ fontFamily: "Outfit" }}>87<span className="text-sm text-white/50">/100</span></div>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />)}
          </div>
          <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Great Work!</div>
        </GlassPanel>
      </div>

      {/* Floating panel: Certificate */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-float-delayed" style={{ animationDelay: "0.8s" }}>
        <GlassPanel className="px-4 py-2.5 border-yellow-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Award className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-[11px] text-white font-semibold">Certificate Earned</div>
              <div className="text-[10px] text-white/40">Python Development • Verified</div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-1" />
          </div>
        </GlassPanel>
      </div>

      {/* Analytics panel */}
      <div className="absolute bottom-14 right-10 animate-float" style={{ animationDelay: "2s" }}>
        <GlassPanel className="p-2.5 border-violet-500/20">
          <div className="text-[10px] text-white/40 mb-1.5">Skill Progress</div>
          {[{ l: "Python", v: 65 }, { l: "React", v: 40 }].map(s => (
            <div key={s.l} className="mb-1">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-white/60">{s.l}</span>
                <span className="text-white/40">{s.v}%</span>
              </div>
              <div className="w-24 h-1 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${s.v}%` }} />
              </div>
            </div>
          ))}
        </GlassPanel>
      </div>

      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <line x1="50%" y1="50%" x2="78%" y2="18%" stroke="rgba(124,58,237,0.25)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="16%" y2="45%" stroke="rgba(59,130,246,0.25)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="84%" y2="54%" stroke="rgba(124,58,237,0.25)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="50%" y2="88%" stroke="rgba(59,130,246,0.25)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="82%" y2="78%" stroke="rgba(124,58,237,0.15)" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
    </div>
  );
}

// ─── Landing Nav ──────────────────────────────────────────────────────────────

function LandingNav({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "backdrop-blur-xl bg-[#060616]/80 border-b border-white/5" : ""}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate("landing")}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.5)]">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white" style={{ fontFamily: "Outfit" }}>WORKISM</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {LANDING_NAV_ITEMS.map(item => (
            <button key={item} className="text-sm text-white/60 hover:text-white transition-colors duration-200">
              {item}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-4 h-4" />
            Sidebar
          </button>
          <button className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2" onClick={() => onNavigate("auth")}>
            Sign In
          </button>
          <MagButton
            onClick={() => onNavigate("auth")}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all duration-200 shadow-[0_0_20px_rgba(124,58,237,0.35)]"
          >
            Get Started
          </MagButton>
        </div>

        <button
          className="md:hidden inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-4 h-4" />
          Menu
        </button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[86vw] max-w-[320px] border-r border-white/10 bg-[#060616] p-0 text-white"
        >
          <SheetHeader className="border-b border-white/5 px-6 py-5 text-left">
            <SheetTitle className="flex items-center gap-2 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 shadow-[0_0_15px_rgba(124,58,237,0.45)]">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span style={{ fontFamily: "Outfit" }}>WORKISM</span>
            </SheetTitle>
            <SheetDescription className="text-white/45">
              Quick navigation for the homepage.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 px-4 py-5">
            {LANDING_NAV_ITEMS.map(item => (
              <button
                key={item}
                className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/75 transition-all hover:border-violet-500/25 hover:bg-violet-500/10 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <span>{item}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            ))}
          </div>

          <div className="mt-auto border-t border-white/5 px-4 py-5">
            <button
              onClick={() => {
                onNavigate("auth");
                setMobileOpen(false);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:from-violet-500 hover:to-blue-500"
            >
              Get Started
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────────

function LandingPage({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      {/* Ambient blobs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-violet-600/8 blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-80 h-80 rounded-full bg-blue-600/8 blur-3xl pointer-events-none" />

      <LandingNav onNavigate={onNavigate} />

      {/* Hero */}
      <section className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-6rem)]">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6">
              <Sparkles className="w-3 h-3" /> AI-Powered Skill Assessment
            </div>
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-6" style={{ fontFamily: "Outfit" }}>
              Learn. Build.<br />
              Prove. <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Get Certified.</span>
            </h1>
            <p className="text-lg text-white/55 leading-relaxed mb-8 max-w-lg">
              Workism teaches you skills with AI, challenges you with real-world projects, evaluates your work and certifies your skills.
            </p>
            <div className="flex flex-wrap gap-4">
              <MagButton onClick={() => onNavigate("skills")}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-[0_0_30px_rgba(124,58,237,0.4)] transition-all duration-200 text-[15px]">
                Explore Skills <ArrowRight className="w-4 h-4" />
              </MagButton>
              <MagButton
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white/80 border border-white/15 hover:bg-white/5 hover:text-white transition-all duration-200 text-[15px]">
                How It Works
              </MagButton>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8 mt-12">
              {[
                { val: 500, suffix: "+", label: "Skills to Learn" },
                { val: 10, suffix: "K+", label: "Projects Evaluated" },
                { val: 25, suffix: "K+", label: "Learners" },
                { val: 95, suffix: "%", label: "Satisfaction Rate" },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white" style={{ fontFamily: "Outfit" }}>
                    <AnimatedCounter target={s.val} suffix={s.suffix} />
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
            <AIHeroVisual />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-4">
            <Zap className="w-3 h-3" /> Platform Features
          </div>
          <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "Outfit" }}>
            Everything you need to <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">prove your skills</span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto">A complete ecosystem from learning to certification, powered by AI every step of the way.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}>
              <TiltCard className="group h-full">
                <GlassPanel className="h-full p-6 hover:border-violet-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.1)]">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${f.color}18` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "Outfit" }}>{f.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
                </GlassPanel>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-4">
            <Target className="w-3 h-3" /> Process
          </div>
          <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "Outfit" }}>How It Works</h2>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div className="hidden lg:block absolute top-12 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          {HOW_IT_WORKS.map((step, i) => (
            <motion.div key={step.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }} className="text-center">
              <div className="relative inline-block mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/25 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent" style={{ fontFamily: "Outfit" }}>{step.step}</span>
                </div>
              </div>
              <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "Outfit" }}>{step.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Skills preview */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="flex items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-4">
              <Layers className="w-3 h-3" /> Skill Tracks
            </div>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "Outfit" }}>
              8 In-Demand <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Skill Tracks</span>
            </h2>
          </div>
          <button onClick={() => onNavigate("skills")} className="hidden md:flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SKILLS_DATA.slice(0, 4).map((skill, i) => (
            <motion.div key={skill.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}>
              <TiltCard>
                <div onClick={() => onNavigate("skills")} className="group cursor-pointer p-5 rounded-xl border bg-card hover:border-violet-500/35 transition-all duration-300 hover:shadow-[0_0_25px_rgba(124,58,237,0.12)]" style={{ borderColor: "rgba(124,58,237,0.18)" }}>
                  <div className="text-2xl mb-3">{skill.emoji}</div>
                  <div className="font-semibold text-white mb-1" style={{ fontFamily: "Outfit" }}>{skill.name}</div>
                  <div className="text-xs text-white/40 mb-3">{skill.level} · {skill.modules} Modules</div>
                  <div className="w-full h-1 rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${skill.progress || 15}%`, backgroundColor: skill.color }} />
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="relative rounded-3xl overflow-hidden p-12 md:p-16 text-center bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-transparent border border-violet-500/20">
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />
            <GraduationCap className="w-12 h-12 text-violet-400 mx-auto mb-6" />
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "Outfit" }}>
              Ready to prove your skills?
            </h2>
            <p className="text-white/55 text-lg mb-8 max-w-md mx-auto">
              Join 25,000+ developers who have earned verified certificates and landed better jobs.
            </p>
            <MagButton onClick={() => onNavigate("auth")}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-[0_0_40px_rgba(124,58,237,0.45)] transition-all duration-200 text-[15px]">
              Start Learning Free <ArrowRight className="w-4 h-4" />
            </MagButton>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white" style={{ fontFamily: "Outfit" }}>WORKISM</span>
          </div>
          <p className="text-xs text-white/30">© 2025 Workism Inc. All rights reserved.</p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Contact"].map(l => (
              <button key={l} className="text-xs text-white/30 hover:text-white/60 transition-colors">{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Dashboard Sidebar ────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "learning", label: "Learn", icon: BookOpen },
  { id: "assessment", label: "Assessments", icon: ClipboardList },
  { id: "submission", label: "Projects", icon: FolderGit2 },
  { id: "certificate", label: "Certificates", icon: Award },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "community", label: "Community", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

function DashboardSidebar({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  return (
    <aside className="w-64 min-h-screen border-r border-slate-200 bg-white flex flex-col flex-shrink-0">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-[0_10px_24px_rgba(124,58,237,0.28)]">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>WORKISM</span>
      </div>

      <nav className="flex-1 py-4 px-3">
        {SIDEBAR_ITEMS.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id}
              onClick={() => DASHBOARD_SCREENS.includes(item.id as Screen) ? onNavigate(item.id as Screen) : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-all duration-200 ${isActive
                ? "bg-violet-50 text-violet-700 border border-violet-200 shadow-[0_10px_24px_rgba(124,58,237,0.08)]"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-200 to-rose-200 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-700">VA</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">Vijay A</div>
            <div className="text-xs text-slate-400 truncate">View Profile</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DashboardMobileSidebar({
  active,
  onNavigate,
  open,
  onOpenChange,
}: {
  active: Screen;
  onNavigate: (s: Screen) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[86vw] max-w-[320px] border-r border-white/10 bg-[#050816] p-0 text-white"
      >
        <SheetHeader className="border-b border-white/5 px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span style={{ fontFamily: "Outfit" }}>WORKISM</span>
          </SheetTitle>
          <SheetDescription className="text-white/45">
            Open any section without crowding the page.
          </SheetDescription>
        </SheetHeader>

        <nav className="flex-1 px-4 py-5">
          {SIDEBAR_ITEMS.map(item => {
            const isActive = active === item.id;
            const isEnabled = DASHBOARD_SCREENS.includes(item.id as Screen);

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isEnabled) return;
                  onNavigate(item.id as Screen);
                  onOpenChange(false);
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-all ${
                  isActive
                    ? "border border-violet-500/25 bg-violet-600/20 text-violet-300 shadow-[0_0_15px_rgba(124,58,237,0.1)]"
                    : isEnabled
                      ? "border border-white/6 bg-white/[0.03] text-white/70 hover:border-violet-500/20 hover:bg-white/[0.06] hover:text-white"
                      : "border border-white/5 bg-white/[0.02] text-white/30"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive ? <div className="w-1.5 h-1.5 rounded-full bg-violet-400" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500">
              <span className="text-xs font-bold text-white">VA</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">Vijay A</div>
              <div className="truncate text-xs text-white/35">Pro Member</div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Dashboard Layout Wrapper ─────────────────────────────────────────────────

function DashboardLayout({ screen, children, onNavigate, user, onLogout }: { screen: Screen; children: React.ReactNode; onNavigate: (s: Screen) => void; user: WorkismUser | null; onLogout: () => void }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden md:flex">
        <DashboardSidebar active={screen} onNavigate={onNavigate} />
      </div>
      <DashboardMobileSidebar
        active={screen}
        onNavigate={onNavigate}
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 flex items-center justify-between gap-3 px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input placeholder="Search anything..." className="bg-white/5 border border-white/8 rounded-lg text-sm text-white/60 placeholder:text-white/30 pl-9 pr-4 py-2 focus:outline-none focus:border-violet-500/40 transition-colors w-40 sm:w-56" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/8 transition-colors">
              <Bell className="w-4 h-4 text-white/50" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-xs text-white/50 transition-all hover:border-red-500/25 hover:text-red-300"
              title="Logout"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{user?.name?.slice(0, 2).toUpperCase() || "VA"}</span>
              </span>
              <span className="hidden sm:inline">{user ? "Logout" : "Demo"}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

// ─── Dashboard Home ────────────────────────────────────────────────────────────

function DashboardHome({
  onNavigate,
  user,
}: {
  onNavigate: (s: Screen) => void;
  user: WorkismUser | null;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      try {
        setError("");
        const nextStats = await getDashboardStats(user.id);
        if (active) setStats(nextStats);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load dashboard stats");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const displayStats = stats || {
    skillsInProgress: 0,
    completedLessons: 0,
    projectsSubmitted: 0,
    evaluationsCompleted: 0,
    averageScore: 0,
    certificatesEarned: 0,
  };

  const statCards = [
    { label: "Skills in Progress", value: displayStats.skillsInProgress, suffix: "", icon: Layers, color: "#7c3aed" },
    { label: "Lessons Completed", value: displayStats.completedLessons, suffix: "", icon: BookOpen, color: "#3b82f6" },
    { label: "Projects Submitted", value: displayStats.projectsSubmitted, suffix: "", icon: FolderGit2, color: "#10b981" },
    { label: "Evaluations", value: displayStats.evaluationsCompleted, suffix: "", icon: BarChart3, color: "#f59e0b" },
    { label: "Certificates Earned", value: displayStats.certificatesEarned, suffix: "", icon: Award, color: "#ef4444" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "Outfit" }}>Welcome back, {user?.name || "learner"}!</h1>
        <p className="text-white/45 text-sm">Continue your learning journey and achieve new milestones.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map(stat => (
          <GlassPanel key={stat.label} className="p-5 hover:border-violet-500/25 transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.08)]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}18` }}>
                <stat.icon className="w-[18px] h-[18px]" style={{ color: stat.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "Outfit" }}>
              {typeof stat.value === "number" ? `${stat.value}${stat.suffix}` : stat.value}
            </div>
            <div className="text-xs text-white/40">{stat.label}</div>
          </GlassPanel>
        ))}
      </div>

      {error && <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Continue Learning */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>Continue Learning</h3>
            <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View All</button>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/8">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0 text-xl">🐍</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-0.5">Python Development</div>
              <div className="text-xs text-white/40 mb-2">Functions and Modules</div>
              <Bar value={65} color="#3b82f6" />
              <div className="text-[10px] text-white/30 mt-1">65% complete</div>
            </div>
            <button onClick={() => onNavigate("learning")}
              className="px-4 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-600/30 transition-colors flex-shrink-0">
              Continue
            </button>
          </div>
        </GlassPanel>

        {/* Upcoming Assessment */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>Upcoming Assessment</h3>
            <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View All</button>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/8">
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white mb-0.5">Python API Development</div>
              <div className="text-xs text-white/40 mb-2">Build a RESTful API with FastAPI</div>
              <div className="flex items-center gap-3 text-[11px] text-white/35">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 25 May, 2025</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 10:00 AM</span>
              </div>
            </div>
            <button onClick={() => onNavigate("assessment")} className="px-4 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:border-violet-500/30 hover:text-violet-300 transition-all flex-shrink-0">
              Details
            </button>
          </div>
        </GlassPanel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>Recent Activity</h3>
            <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View All</button>
          </div>
          <div className="flex flex-col gap-3">
            {ACTIVITIES.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: a.type === "evaluation" ? "rgba(16,185,129,0.12)" : a.type === "lesson" ? "rgba(59,130,246,0.12)" : "rgba(124,58,237,0.12)" }}>
                  {a.type === "evaluation" ? <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                    : a.type === "lesson" ? <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                      : <ClipboardList className="w-3.5 h-3.5 text-violet-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 leading-snug">{a.text}</div>
                  {a.meta && <div className="text-xs text-emerald-400 mt-0.5">{a.meta}</div>}
                </div>
                <div className="text-[11px] text-white/30 flex-shrink-0">{a.time}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Skill Progress */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>Skill Progress</h3>
            <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View All</button>
          </div>
          <div className="flex flex-col gap-4">
            {SKILLS_DATA.filter(s => s.progress > 0).map(skill => (
              <div key={skill.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{skill.emoji}</span>
                    <span className="text-sm text-white/70">{skill.name}</span>
                  </div>
                  <span className="text-xs text-white/35">{skill.progress}%</span>
                </div>
                <Bar value={skill.progress} color={skill.color} />
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </motion.div>
  );
}

// ─── Skills Page ──────────────────────────────────────────────────────────────

function SkillsPage({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const categories = ["All", "Programming", "Web Development", "Data Science", "Database", "Cybersecurity"];

  const filtered = SKILLS_DATA.filter(s =>
    (activeCategory === "All" || s.category === activeCategory) &&
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "Outfit" }}>Explore Skills</h1>
        <p className="text-white/45 text-sm">Choose a skill to start your learning journey.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${activeCategory === cat
                ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                : "bg-white/5 text-white/50 border border-white/10 hover:border-violet-500/30 hover:text-white/80"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search skills..."
            className="bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 placeholder:text-white/30 pl-9 pr-4 py-2 focus:outline-none focus:border-violet-500/40 w-48 transition-colors" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((skill, i) => (
          <motion.div key={skill.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
            <TiltCard>
              <div onClick={() => onNavigate("learning")}
                className="group cursor-pointer p-5 rounded-xl border bg-card hover:border-violet-500/35 transition-all duration-300 hover:shadow-[0_0_25px_rgba(124,58,237,0.12)]"
                style={{ borderColor: "rgba(124,58,237,0.18)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${skill.color}15`, border: `1px solid ${skill.color}25` }}>
                    {skill.emoji}
                  </div>
                  {skill.progress > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      In Progress
                    </span>
                  )}
                </div>
                <div className="font-semibold text-white mb-1 text-[15px]" style={{ fontFamily: "Outfit" }}>{skill.name}</div>
                <div className="text-xs text-white/40 mb-3">{skill.level}</div>
                <div className="flex items-center justify-between text-xs text-white/35 mb-3">
                  <span>{skill.modules} Modules</span>
                  <span>{skill.category}</span>
                </div>
                {skill.progress > 0 ? (
                  <>
                    <Bar value={skill.progress} color={skill.color} />
                    <div className="text-[10px] text-white/30 mt-1.5">{skill.progress}% complete</div>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-violet-400 group-hover:gap-2 transition-all">
                    <span>Start Learning</span><ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Learning Page ────────────────────────────────────────────────────────────

function LearningPage({
  onNavigate,
  user,
}: {
  onNavigate: (s: Screen) => void;
  user: WorkismUser | null;
}) {
  const [modules, setModules] = useState(MODULES_DATA.map(module => ({ ...module })));
  const [activeModuleId, setActiveModuleId] = useState(4);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { role: "ai", text: "Functions let you split a problem into reusable pieces. Ask me anything about the current lesson and I’ll walk you through it step by step." },
  ] as Array<{ role: "ai" | "user"; text: string }>);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    let active = true;
    const loadProgress = async () => {
      if (!user) return;
      try {
        setProgressError("");
        const records = await getLearningProgress(user.id);
        const completedIds = new Set(records.filter(record => record.completed).map(record => Number(record.module_id)));
        setModules(MODULES_DATA.map(module => ({
          ...module,
          completed: completedIds.has(module.id),
          active: module.id === activeModuleId,
        })));
      } catch (err) {
        if (active) setProgressError(err instanceof Error ? err.message : "Could not load learning progress");
      }
    };
    void loadProgress();
    return () => {
      active = false;
    };
  }, [activeModuleId, user]);

  const activeModule = modules.find(module => module.id === activeModuleId) || modules[0];
  const activeIndex = Math.max(0, modules.findIndex(module => module.id === activeModuleId));
  const completedCount = modules.filter(module => module.completed).length;
  const progress = Math.round((completedCount / modules.length) * 100);
  const lessonContent = {
    title: activeModule.title,
    overview:
      activeModule.id === 4
        ? "Functions help you organize logic into reusable blocks. They make code easier to test, read, and extend."
        : "This lesson builds on the same pattern: concept first, example second, then a quick practice step.",
    example:
      activeModule.id === 4
        ? [
            "def greet(name):",
            "    return f'Hello, {name}!'",
            "",
            "print(greet('Vijay'))",
          ]
        : [
            "def add(a, b):",
            "    return a + b",
            "",
            "print(add(3, 5))",
          ],
    points:
      activeModule.id === 1
        ? ["What a function does", "Why reuse matters", "How lessons fit into a module"]
        : activeModule.id === 2
          ? ["Parameters and arguments", "Built-in data types", "Choosing the right type"]
          : activeModule.id === 3
            ? ["if/elif/else", "Boolean logic", "Looping through branches"]
            : activeModule.id === 4
              ? ["Defining functions", "Return values", "Calling reusable code"]
              : activeModule.id === 5
                ? ["Classes and objects", "Constructors", "Encapsulation"]
                : activeModule.id === 6
                  ? ["Importing modules", "Organizing packages", "Standard library usage"]
                  : activeModule.id === 7
                    ? ["Reading and writing files", "Context managers", "Safe file handling"]
                    : ["Catch exceptions", "Handle errors gracefully", "Avoid crashing your program"],
  };

  const markComplete = async () => {
    if (!user) return;
    try {
      setProgressError("");
      await saveLearningProgress({
        user_id: user.id,
        skill_id: "python",
        module_id: String(activeModule.id),
        completed: true,
      });
      setModules(current =>
        current.map(module => (module.id === activeModule.id ? { ...module, completed: true } : module)),
      );
      if (activeModuleId < modules[modules.length - 1].id) {
        setActiveModuleId(activeModuleId + 1);
      }
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : "Could not save lesson progress");
    }
  };

  const sendAiMessage = async () => {
    const message = aiInput.trim();
    if (!message) return;
    if (!isApiConfigured()) {
      setAiError(apiConfigurationMessage());
      return;
    }
    setAiBusy(true);
    setAiError("");
    setAiMessages(current => [...current, { role: "user", text: message }]);
    setAiInput("");
    try {
      const response = await askAiTutor(
        message,
        `${lessonContent.title}: ${lessonContent.overview}\n\nKey points:\n- ${lessonContent.points.join("\n- ")}`,
      );
      setAiMessages(current => [...current, { role: "ai", text: response.answer }]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI tutor request failed");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => onNavigate("skills")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back to Skills
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm text-white/40">
          Progress
          <div className="w-32 h-1.5 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-violet-400 font-medium">{progress}%</span>
        </div>
      </div>

      {progressError && <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{progressError}</div>}

      <div className="grid lg:grid-cols-[220px_1fr_320px] gap-5 min-h-[calc(100vh-12rem)]">
        <GlassPanel className="flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <div className="text-xs font-semibold text-white/50 uppercase tracking-widest">Modules</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {modules.map(module => (
              <button
                key={module.id}
                type="button"
                onClick={() => setActiveModuleId(module.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 cursor-pointer transition-colors ${module.id === activeModuleId
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/25"
                  : module.completed
                    ? "text-white/50 hover:text-white/70 hover:bg-white/4"
                    : "text-white/30 hover:text-white/50 hover:bg-white/4"}`}
              >
                {module.completed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : module.id === activeModuleId
                    ? <div className="w-4 h-4 rounded-full border-2 border-violet-400 flex-shrink-0" />
                    : <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />}
                <span className="truncate">{module.id}. {module.title}</span>
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="text-xs text-white/35 mb-1">Python Development</div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Outfit" }}>{activeModule.id}. {lessonContent.title}</h2>
            <p className="text-sm text-white/45 mt-2">{lessonContent.overview}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5">
              <div className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">Lesson Example</div>
              <div className="rounded-xl overflow-hidden border border-white/10" style={{ backgroundColor: "#0d1117" }}>
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
                  {["#ef4444", "#f59e0b", "#10b981"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />)}
                  <span className="ml-2 text-xs text-white/25 font-mono">lesson-{activeModule.id}.py</span>
                </div>
                <div className="p-4 font-mono text-sm leading-relaxed text-white/85">
                  {lessonContent.example.map((line, index) => (
                    <div key={index} className={line ? "" : "h-4"}>{line || "\u00a0"}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-sm text-white/55 leading-relaxed mb-5">
              In this lesson, you will learn:
            </div>
            <div className="flex flex-col gap-2.5">
              {lessonContent.points.map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white/65">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <button onClick={markComplete} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition-all">
              Mark as Complete
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveModuleId(Math.max(1, activeIndex))}
                disabled={activeIndex <= 0}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                onClick={() => setActiveModuleId(Math.min(modules[modules.length - 1].id, activeModuleId + 1))}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                Next Lesson <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600/25 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="text-sm font-semibold text-white">AI Tutor</div>
            <div className={`ml-auto w-2 h-2 rounded-full ${aiBusy ? "bg-amber-400" : "bg-emerald-400"}`} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {aiMessages.map((msg, i) => (
              <div key={i} className={`${msg.role === "user" ? "ml-4" : "mr-4"}`}>
                <div className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${msg.role === "ai"
                  ? "bg-white/[0.04] border border-white/8 text-white/70"
                  : "bg-violet-600/20 border border-violet-500/25 text-violet-200"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {aiError && <div className="mx-4 mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] text-red-200">{aiError}</div>}

          <div className="p-3 border-t border-white/5">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendAiMessage();
                  }
                }}
                placeholder="Ask the AI tutor..."
                className="flex-1 text-xs text-white/60 placeholder:text-white/25 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void sendAiMessage()}
                disabled={aiBusy}
                className="w-6 h-6 rounded-md bg-violet-600/30 flex items-center justify-center hover:bg-violet-600/50 transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3 text-violet-400" />
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </motion.div>
  );
}

// ─── Assessment Page ──────────────────────────────────────────────────────────

function AssessmentPage({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNavigate("learning")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="max-w-4xl">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Outfit" }}>Assessment Details</h1>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6 mt-6">
          {/* Main */}
          <div className="flex flex-col gap-5">
            <GlassPanel className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Outfit" }}>Python API Development</h2>
                  <p className="text-sm text-white/45">Build a RESTful API for a task management system using FastAPI.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-medium flex-shrink-0 ml-4">Medium</span>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                  <Clock className="w-4 h-4 text-violet-400 mx-auto mb-1.5" />
                  <div className="text-lg font-bold text-white">7</div>
                  <div className="text-[11px] text-white/35">Days Limit</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                  <Target className="w-4 h-4 text-blue-400 mx-auto mb-1.5" />
                  <div className="text-lg font-bold text-white">100</div>
                  <div className="text-[11px] text-white/35">Max Score</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                  <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
                  <div className="text-lg font-bold text-white">70</div>
                  <div className="text-[11px] text-white/35">Pass Score</div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Requirements</h3>
              <div className="flex flex-col gap-2.5">
                {[
                  "User registration and authentication",
                  "CRUD operations for tasks",
                  "Proper error handling",
                  "Write unit tests",
                  "Add README with setup instructions",
                ].map(req => (
                  <div key={req} className="flex items-center gap-2.5">
                    <ChevronRight className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <span className="text-sm text-white/65">{req}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Evaluation Criteria</h3>
              <div className="flex flex-col gap-3">
                {SCORE_BREAKDOWN.map(s => (
                  <div key={s.name} className="flex items-center gap-4">
                    <div className="w-28 text-sm text-white/55 flex-shrink-0">{s.name}</div>
                    <div className="flex-1">
                      <Bar value={(s.score / s.max) * 100} color={s.color} />
                    </div>
                    <div className="text-xs text-white/35 w-12 text-right">{s.max} pts</div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">
            <GlassPanel className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>What you need to submit</h3>
              <div className="flex flex-col gap-3">
                {[
                  { icon: Github, label: "GitHub Repository", desc: "Public repository link", color: "#ffffff" },
                  { icon: FileText, label: "README File", desc: "Project documentation", color: "#3b82f6" },
                  { icon: CheckCheck, label: "Tests", desc: "Unit test cases", color: "#10b981" },
                  { icon: Code2, label: "Source Code", desc: "All source files", color: "#7c3aed" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}18` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <div className="text-sm text-white/80">{item.label}</div>
                      <div className="text-[11px] text-white/35">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3" style={{ fontFamily: "Outfit" }}>Tips for Success</h3>
              <div className="flex flex-col gap-2">
                {["Write clean, well-commented code", "Include comprehensive tests", "Follow REST conventions", "Use proper git commit messages"].map(tip => (
                  <div key={tip} className="flex items-start gap-2">
                    <Star className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-white/45 leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <MagButton onClick={() => onNavigate("submission")}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(124,58,237,0.35)] text-sm">
              Start Assessment
            </MagButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Submission Page ──────────────────────────────────────────────────────────

function SubmissionPage({ runtime }: { runtime: WorkismRuntime }) {
  const { user, setEvaluation, onNavigate } = runtime;
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [repositoryInfo, setRepositoryInfo] = useState<RepositoryMetadata | null>(null);
  const [repositories, setRepositories] = useState<Array<{ full_name: string; html_url: string; private?: boolean; default_branch?: string }>>([]);
  const [branches, setBranches] = useState<Array<{ name: string; commit?: { sha?: string } }>>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [repoBusy, setRepoBusy] = useState(false);
  const [error, setError] = useState("");
  const [repoError, setRepoError] = useState("");
  const githubProfile = getStoredGithubProfile();

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      try {
        if (!isApiConfigured()) return;
        const repos = await listGithubRepositories();
        setRepositories(repos);
      } catch (err) {
        setRepoError(err instanceof Error ? err.message : "Could not load GitHub repositories");
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (repositoryInfo?.default_branch && !branch) {
      setBranch(repositoryInfo.default_branch);
    }
  }, [branch, repositoryInfo]);

  const checklist = [
    { label: repo ? "Repository URL provided" : "Enter a GitHub repository", done: Boolean(repo.trim()) },
    { label: repositoryInfo ? "Repository validated" : "Validate repository access", done: Boolean(repositoryInfo) },
    { label: branches.length > 0 ? "Branch list loaded" : "Select a branch", done: Boolean(branches.length) },
    { label: "Automated + AI evaluation ready", done: Boolean(repositoryInfo) },
  ];

  const handleLoadRepository = async () => {
    const trimmed = repo.trim();
    if (!trimmed) {
      setRepoError("Enter a repository URL first.");
      return;
    }
    if (!isApiConfigured()) {
      setRepoError(apiConfigurationMessage());
      return;
    }
    setRepoBusy(true);
    setRepoError("");
    setStatus("Validating repository...");
    try {
      const metadata = await validateGithubRepository(trimmed, branch || undefined);
      setRepositoryInfo(metadata);
      setBranch(metadata.selected_branch);
      const branchList = await listRepositoryBranches(trimmed);
      setBranches(branchList);
      if (!branchList.some(item => item.name === metadata.selected_branch) && branchList[0]?.name) {
        setBranch(branchList[0].name);
      }
      setStatus(`Repository ${metadata.full_name || metadata.owner + "/" + metadata.repo} is ready.`);
    } catch (err) {
      setRepositoryInfo(null);
      setBranches([]);
      setRepoError(err instanceof Error ? err.message : "Repository validation failed");
    } finally {
      setRepoBusy(false);
      setTimeout(() => setStatus(""), 2500);
    }
  };

  const handleSelectRepository = (htmlUrl: string, defaultBranch?: string) => {
    setRepo(htmlUrl);
    setBranch(defaultBranch || "main");
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError("");
    try {
      if (!user) {
        onNavigate("auth");
        return;
      }
      if (!isApiConfigured()) {
        throw new Error(apiConfigurationMessage());
      }
      const metadata = repositoryInfo || await validateGithubRepository(repo.trim(), branch || undefined);
      setRepositoryInfo(metadata);
      if (!branches.length) {
        const branchList = await listRepositoryBranches(repo.trim());
        setBranches(branchList);
      }
      const selectedBranch = branch || metadata.selected_branch || metadata.default_branch || "main";
      setStatus("Submitting project...");
      const submission = await submitPythonProject(metadata.html_url || repo.trim(), selectedBranch);
      localStorage.setItem("workism_last_submission", JSON.stringify(submission));
      setStatus("Running evaluation...");
      const evaluation = await evaluateSubmission(submission.submission.id);
      localStorage.setItem("workism_last_evaluation", JSON.stringify(evaluation));
      setEvaluation(evaluation);
      onNavigate("evaluation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNavigate("assessment")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: "Outfit" }}>Submit Your Project</h1>

        {githubProfile && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            Connected GitHub account: {githubProfile.login}
          </div>
        )}

        {repoError && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{repoError}</div>}
        {status && <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-200">{status}</div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <GlassPanel className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Connect GitHub</h3>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-emerald-500/20 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Github className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{user?.name || "Signed-in learner"}</div>
                  <div className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Firebase session ready</div>
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setRepoBusy(true);
                      const repos = await listGithubRepositories();
                      setRepositories(repos);
                      setRepoError("");
                    } catch (err) {
                      setRepoError(err instanceof Error ? err.message : "Could not load GitHub repositories");
                    } finally {
                      setRepoBusy(false);
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:border-violet-500/25 hover:text-white disabled:opacity-60"
                  disabled={!isApiConfigured() || repoBusy}
                >
                  {repoBusy ? "Loading repositories..." : "Load my repositories"}
                </button>

                {repositories.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    {repositories.map(repository => (
                      <button
                        key={repository.full_name}
                        type="button"
                        onClick={() => handleSelectRepository(repository.html_url, repository.default_branch)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/[0.04]"
                      >
                        <span className="truncate">{repository.full_name}</span>
                        <span className="text-[10px] text-white/35">{repository.private ? "Private" : "Public"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Repository Details</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">GitHub Repository URL</label>
                  <input value={repo} onChange={e => setRepo(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:border-violet-500/40 placeholder:text-white/25" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Branch</label>
                  <select value={branch} onChange={e => setBranch(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:border-violet-500/40 appearance-none">
                    <option value="" className="bg-[#0d0d28]">Select a branch</option>
                    {branches.map(item => (
                      <option key={item.name} value={item.name} className="bg-[#0d0d28]">{item.name}</option>
                    ))}
                    {!branches.length && <option value="main" className="bg-[#0d0d28]">main</option>}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLoadRepository()}
                  disabled={repoBusy}
                  className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {repoBusy ? "Checking..." : "Validate repository"}
                </button>
              </div>
            </GlassPanel>
          </div>

          <div className="flex flex-col gap-5">
            <GlassPanel className="p-6">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Submission Checklist</h3>
              <div className="flex flex-col gap-3 mb-2">
                {checklist.map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5 border border-white/15"}`}>
                      {item.done && <Check className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <span className={`text-sm ${item.done ? "text-white/70" : "text-white/30"}`}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 text-xs text-white/30">
                {repositoryInfo ? "Repository validated and ready for evaluation." : "Validate the repository before submitting."}
              </div>
            </GlassPanel>

            <GlassPanel className="p-5 bg-violet-600/5 border-violet-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white mb-1">AI Evaluation in ~3 min</div>
                  <div className="text-xs text-white/45 leading-relaxed">
                    Once submitted, our backend checks repository access, branch data, README/code signals, quality checks, and AI feedback.
                  </div>
                </div>
              </div>
            </GlassPanel>

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

            <MagButton onClick={() => void handleSubmit()}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(124,58,237,0.35)] text-sm flex items-center justify-center gap-2">
              <Github className="w-4 h-4" /> {busy ? "Evaluating..." : "Submit Project"}
            </MagButton>

            <p className="text-xs text-white/25 text-center">Make sure your repository contains all required files before submitting.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Evaluation Page ──────────────────────────────────────────────────────────

function EvaluationPage({ runtime }: { runtime: WorkismRuntime }) {
  const { evaluation, user, setCertificate, onNavigate } = runtime;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const score = evaluation?.total_score ?? 85;
  const passed = evaluation ? Boolean(evaluation.passed) : true;
  const stages = [
    { label: "Repository validation", done: Boolean(evaluation) },
    { label: "README/code checks", done: Boolean(evaluation?.objective?.readme || evaluation?.objective?.syntax) },
    { label: "Automated quality checks", done: Boolean(evaluation?.objective) },
    { label: "AI evaluation", done: Boolean(evaluation?.ai) },
    { label: "Final evaluation report", done: Boolean(evaluation) },
  ];
  const breakdown = parseBreakdown(evaluation?.breakdown);
  const strengths = parseStoredList(evaluation?.strengths, ["Clean API architecture", "Comprehensive test coverage", "Good README documentation"]);
  const improvements = parseStoredList(evaluation?.improvements, ["Add input validation", "Improve error messages", "Add more edge case tests"]);
  const dynamicBreakdown = [
    { name: "Functionality", score: breakdown.functionality, max: 30, color: "#10b981" },
    { name: "Code Quality", score: breakdown.code_quality, max: 20, color: "#3b82f6" },
    { name: "Testing", score: breakdown.testing, max: 15, color: "#06b6d4" },
    { name: "Security", score: breakdown.security, max: 15, color: "#8b5cf6" },
    { name: "Documentation", score: breakdown.documentation, max: 10, color: "#f59e0b" },
    { name: "Git Practices", score: breakdown.git_practices, max: 10, color: "#f97316" },
  ];

  const handleDownloadReport = () => {
    const blob = new Blob([JSON.stringify({ score, breakdown: dynamicBreakdown, strengths, improvements, feedback: evaluation?.feedback }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workism-evaluation-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCertificate = async () => {
    if (!user || !evaluation) {
      setError("Submit and evaluate a project first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const certificate = await generateCertificate(user.id, evaluation.id);
      localStorage.setItem("workism_last_certificate", JSON.stringify(certificate));
      setCertificate(certificate);
      onNavigate("certificate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Certificate generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate("submission")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
        <button onClick={handleDownloadReport} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:border-violet-500/30 hover:text-violet-300 transition-all">
          <Download className="w-3.5 h-3.5" /> Download Report
        </button>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: "Outfit" }}>Evaluation Results</h1>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        {/* Score */}
        <div className="flex flex-col gap-5">
          <GlassPanel className="p-6 flex flex-col items-center text-center min-w-[200px]" glow>
            <div className="text-xs text-white/40 mb-3">Your Score</div>
            <ScoreCircle score={score} />
            <div className="mt-4">
              <div className="text-base font-semibold text-white mb-1">Great Work! 🎉</div>
              <div className="text-xs text-white/45 max-w-[160px] leading-relaxed">
                {passed ? "You have successfully completed the assessment." : "Improve the project and submit again to earn the certificate."}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 w-full">
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${passed ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className={`text-xs font-medium ${passed ? "text-emerald-400" : "text-amber-400"}`}>{passed ? "Passed" : "Needs Improvement"}</span>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Evaluation Stages</h3>
            <div className="flex flex-col gap-3">
              {stages.map(stage => (
                <div key={stage.label} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${stage.done ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5 border border-white/15"}`}>
                    {stage.done && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className={`text-sm ${stage.done ? "text-white/75" : "text-white/35"}`}>{stage.label}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-5">
          <GlassPanel className="p-6">
            <h3 className="text-sm font-semibold text-white mb-5" style={{ fontFamily: "Outfit" }}>Score Breakdown</h3>
            <div className="flex flex-col gap-4">
              {dynamicBreakdown.map((s, i) => (
                <div key={s.name} className="grid grid-cols-[120px_1fr_60px] items-center gap-4">
                  <span className="text-sm text-white/60">{s.name}</span>
                  <div className="relative">
                    <Bar value={(s.score / s.max) * 100} color={s.color} delay={i * 150} />
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-white">{s.score}</span>
                    <span className="text-xs text-white/30">/{s.max}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>AI Feedback</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                </div>
                <div className="flex flex-col gap-1.5">
                  {strengths.map(s => (
                    <div key={s} className="text-xs text-white/55 flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" /> {s}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <div className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Areas to Improve
                </div>
                <div className="flex flex-col gap-1.5">
                  {improvements.map(s => (
                    <div key={s} className="text-xs text-white/55 flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" /> {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm text-white/50 leading-relaxed mb-5">
              {evaluation?.feedback || "This page is showing sample evaluation data until you submit a project."}
            </p>

            {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

            <div className="flex gap-3">
              <button onClick={handleCertificate}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-blue-500 transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] flex items-center justify-center gap-2">
                <Award className="w-4 h-4" /> {busy ? "Generating..." : "View Certificate"}
              </button>
              <button className="px-4 py-3 rounded-xl border border-white/10 text-sm text-white/50 hover:border-violet-500/30 hover:text-violet-300 transition-all flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> Detailed Feedback
              </button>
            </div>
          </GlassPanel>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Certificate Page ──────────────────────────────────────────────────────────

function CertificatePage({ runtime }: { runtime: WorkismRuntime }) {
  const { user, evaluation, certificate, onNavigate } = runtime;
  const [copied, setCopied] = useState(false);
  const certificateId = certificate?.certificate_id || "WK-PY-DEMO";
  const issued = certificate?.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : "After evaluation";
  const score = evaluation?.total_score ?? 85;

  const handleCopy = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/verify/${certificateId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (certificate?.certificate_id) {
      window.open(certificateDownloadUrl(certificate.certificate_id), "_blank", "noopener,noreferrer");
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/verify/${certificateId}`;
    if (navigator.share) {
      navigator.share({ title: "WORKISM Certificate", text: `Verify my WORKISM certificate: ${certificateId}`, url });
    } else {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => onNavigate("evaluation")} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/25 text-violet-300 text-sm hover:from-violet-600/30 hover:to-blue-600/30 transition-all">
          <Share2 className="w-3.5 h-3.5" /> Share Certificate
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 max-w-5xl">
        {/* The certificate */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="relative rounded-2xl overflow-hidden" style={{
            background: "linear-gradient(135deg, #0f0b2a 0%, #1a0a4a 35%, #0a1a40 65%, #0d0d26 100%)",
            boxShadow: "0 0 60px rgba(124,58,237,0.25), 0 0 120px rgba(59,130,246,0.1), inset 0 0 80px rgba(124,58,237,0.06)"
          }}>
            {/* Gold border frame */}
            <div className="absolute inset-2 rounded-xl border border-yellow-500/20 pointer-events-none" />
            <div className="absolute inset-3 rounded-xl border border-yellow-500/10 pointer-events-none" />

            {/* Corner ornaments */}
            {[["top-5 left-5", "rotate-0"], ["top-5 right-5", "rotate-90"], ["bottom-5 left-5", "-rotate-90"], ["bottom-5 right-5", "rotate-180"]].map(([pos, rot], i) => (
              <div key={i} className={`absolute ${pos} w-8 h-8 pointer-events-none`}>
                <svg viewBox="0 0 32 32" className={`w-full h-full ${rot} text-yellow-500/30`}>
                  <path d="M0 0 L16 0 L16 4 L4 4 L4 16 L0 16 Z" fill="currentColor" />
                </svg>
              </div>
            ))}

            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, rgba(124,58,237,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(59,130,246,0.06) 0%, transparent 50%)"
            }} />

            <div className="relative px-10 py-10 text-center">
              {/* Header */}
              <div className="flex items-center justify-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
                  <Cpu className="w-[18px] h-[18px] text-white" />
                </div>
                <span className="text-xl font-black tracking-widest text-white" style={{ fontFamily: "Outfit", letterSpacing: "0.2em" }}>WORKISM</span>
              </div>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent mx-auto mb-5" />

              <div className="text-[11px] font-semibold tracking-widest text-yellow-400/80 uppercase mb-2" style={{ letterSpacing: "0.3em" }}>
                Certificate of Achievement
              </div>

              <div className="text-sm text-white/40 mb-6">Presented to</div>

              <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "Outfit", textShadow: "0 0 40px rgba(167,139,250,0.4)" }}>
                {user?.name || "Vijay A"}
              </div>

              <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent mx-auto mb-6" />

              <p className="text-sm text-white/50 mb-2">for successfully demonstrating proficiency in</p>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-transparent mb-2" style={{ fontFamily: "Outfit" }}>
                Python Development
              </div>
              <p className="text-sm text-white/40 mb-8">and scoring {score}/100 in the assessment.</p>

              {/* Seal and details */}
              <div className="flex items-end justify-between mt-6">
                <div className="text-left">
                  <div className="text-[10px] text-white/30 mb-0.5">Certificate ID</div>
                  <div className="text-xs font-mono text-white/60">{certificateId}</div>
                </div>

                {/* Seal */}
                <div className="relative w-20 h-20 mx-auto">
                  <svg viewBox="0 0 80 80" className="w-full h-full">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(234,179,8,0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx="40" cy="40" r="30" fill="rgba(234,179,8,0.06)" stroke="rgba(234,179,8,0.2)" strokeWidth="1" />
                    <text x="40" y="38" textAnchor="middle" fontSize="18" fill="rgba(234,179,8,0.7)">✦</text>
                    <text x="40" y="50" textAnchor="middle" fontSize="6" fill="rgba(234,179,8,0.5)" fontWeight="bold" letterSpacing="1">VERIFIED</text>
                  </svg>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-white/30 mb-0.5">Date Issued</div>
                  <div className="text-xs text-white/60">{issued}</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Actions & Verification */}
        <div className="flex flex-col gap-5">
          <GlassPanel className="p-5" glow>
            <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: "Outfit" }}>Your Certificate</h3>
            <div className="flex flex-col gap-2.5">
              <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]">
                <Download className="w-4 h-4" /> Download HTML
              </button>
              <button onClick={handleShare} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:border-violet-500/30 hover:text-violet-300 transition-all">
                <Share2 className="w-4 h-4" /> Share on LinkedIn
              </button>
            </div>
          </GlassPanel>

          <GlassPanel className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>Verify Certificate</h3>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              {[
                { label: "Certificate ID", value: certificateId },
                { label: "Student", value: user?.name || "Vijay A" },
                { label: "Skill", value: "Python Development" },
                { label: "Score", value: `${score}/100` },
                { label: "Issued", value: issued },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/35">{item.label}</span>
                  <span className="text-xs text-white/70 font-medium text-right">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Verified</div>
                <div className="text-[11px] text-white/40">This certificate is valid and issued by Workism.</div>
              </div>
            </div>

            <button onClick={handleCopy}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 text-sm text-white/50 hover:border-violet-500/30 hover:text-violet-300 transition-all">
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><ExternalLink className="w-3.5 h-3.5" /> Copy Verify URL</>}
            </button>
          </GlassPanel>

          <GlassPanel className="p-5 bg-violet-600/5 border-violet-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <div className="text-sm font-semibold text-white">Level Up!</div>
            </div>
            <p className="text-xs text-white/45 leading-relaxed mb-3">
              You&apos;ve completed Python Development. Ready to tackle your next skill?
            </p>
            <button onClick={() => onNavigate("skills")} className="w-full py-2.5 rounded-lg bg-violet-600/20 border border-violet-500/25 text-violet-300 text-xs font-medium hover:bg-violet-600/30 transition-colors flex items-center justify-center gap-2">
              Explore Next Skill <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </GlassPanel>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cursor Glow ──────────────────────────────────────────────────────────────

function CursorGlow() {
  const [pos, setPos] = useState({ x: -999, y: -999 });
  useEffect(() => {
    const h = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        width: 700,
        height: 700,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.055) 0%, rgba(59,130,246,0.025) 40%, transparent 70%)",
        pointerEvents: "none",
        transition: "left 0.15s ease, top 0.15s ease",
      }} />
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

function AuthPage({
  onNavigate,
  onAuthenticated,
}: {
  onNavigate: (s: Screen) => void;
  onAuthenticated: (user: WorkismUser, needsProfile: boolean) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errors: Record<string, string> = {};
    const cleanName = fullName.trim();
    const cleanAge = Number(age);
    const cleanPhone = mobileNumber.replace(/[\s-]/g, "");
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "signup") {
      if (!/^[A-Za-z][A-Za-z .'-]{1,78}$/.test(cleanName)) errors.fullName = "Use 2-80 letters, spaces, apostrophes, dots, or hyphens.";
      if (!Number.isInteger(cleanAge) || cleanAge < 13 || cleanAge > 100) errors.age = "Age must be a number from 13 to 100.";
      if (!/^(\+?[1-9]\d{6,14}|[6-9]\d{9})$/.test(cleanPhone)) errors.mobileNumber = "Use a valid Indian or international mobile number.";
      if (!gender) errors.gender = "Choose an option.";
      if (password !== confirmPassword) errors.confirmPassword = "Passwords must match.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.email = "Enter a valid email address.";
    if (mode === "signup" && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) errors.password = "Use 8+ characters with uppercase, lowercase, and a number.";
    if (mode === "signin" && !password) errors.password = "Enter your password.";

    setFieldErrors(errors);
    return { valid: Object.keys(errors).length === 0, cleanName, cleanAge, cleanPhone, cleanEmail };
  };

  const clearSecrets = () => {
    setPassword("");
    setConfirmPassword("");
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth) {
      setError(firebaseConfigurationMessage());
      return;
    }
    const validation = validate();
    if (!validation.valid) return;
    setBusy(true);
    setError("");
    try {
      const credential =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, validation.cleanEmail, password)
          : await signInWithEmailAndPassword(auth, validation.cleanEmail, password);
      const firebaseUser = credential.user;
      if (mode === "signup" && validation.cleanName && firebaseUser.displayName !== validation.cleanName) {
        await updateProfile(firebaseUser, { displayName: validation.cleanName });
      }
      const workismUser = {
        id: firebaseUser.uid,
        name: mode === "signup" ? validation.cleanName : firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Workism learner",
        email: firebaseUser.email || validation.cleanEmail,
        ...(mode === "signup" ? {
          age: validation.cleanAge,
          mobileNumber: validation.cleanPhone,
          gender: gender as Gender,
        } : {}),
      } satisfies WorkismUser;
      await syncFirebaseUser(workismUser, await firebaseUser.getIdToken());
      clearSecrets();
      onAuthenticated(workismUser, mode === "signup");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace("Firebase: ", "") : "Authentication failed");
    } finally {
      setBusy(false);
      if (auth.currentUser) clearSecrets();
    }
  };

  const submitGithub = async () => {
    if (!auth || !githubProvider) {
      setError(firebaseConfigurationMessage());
      return;
    }
    setBusy(true);
    setError("");
    try {
      const credential = await signInWithPopup(auth, githubProvider);
      const token = GithubAuthProvider.credentialFromResult(credential)?.accessToken;
      if (token) {
        saveGithubToken(token);
      }
      const workismUser = firebaseUserToWorkismUser(credential.user, credential);
      await syncFirebaseUser(workismUser, await credential.user.getIdToken());
      clearSecrets();
      onAuthenticated(workismUser, false);
    } catch (err) {
      console.error("GitHub authentication failed", {
        code: firebaseErrorCode(err),
        message: err instanceof Error ? err.message : err,
      });
      setError(githubAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    if (!auth || !googleProvider) {
      setError(firebaseConfigurationMessage());
      return;
    }
    setBusy(true);
    setError("");
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const workismUser = firebaseUserToWorkismUser(credential.user, credential);
      await syncFirebaseUser(workismUser, await credential.user.getIdToken());
      clearSecrets();
      onAuthenticated(workismUser, false);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace("Firebase: ", "") : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const formInputClass = "w-full rounded-xl border border-white/10 bg-white/5 py-3 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-500/40";
  const errorText = (key: string) => fieldErrors[key] ? <span className="mt-1 text-[11px] leading-relaxed text-red-300">{fieldErrors[key]}</span> : null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-6 py-10">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      <button onClick={() => onNavigate("landing")} className="relative z-10 mb-10 flex items-center gap-2 text-white/55 hover:text-white transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Workism
      </button>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_520px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
            <Shield className="w-3 h-3" /> Firebase Authentication
          </div>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white lg:text-6xl" style={{ fontFamily: "Outfit" }}>
            Join Workism, then keep building.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-white/50">
            Your dashboard, learning progress, GitHub submissions, evaluations, and certificates stay tied to your secure Firebase account.
          </p>
        </div>

        <GlassPanel className="p-6" glow>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Outfit" }}>
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-white/40">
              {mode === "signin" ? "Use your account to continue." : "Tell us the essentials to set up your learner profile."}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(["signin", "signup"] as const).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${mode === item ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"}`}
              >
                {item === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={submitEmail} className="flex flex-col gap-4">
            {mode === "signup" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs text-white/45 sm:col-span-2">
                  Full Name
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input value={fullName} onChange={event => setFullName(event.target.value)} className={`${formInputClass} pl-10`} placeholder="Vijay A" autoComplete="name" />
                  </div>
                  {errorText("fullName")}
                </label>
                <label className="flex flex-col gap-2 text-xs text-white/45">
                  Age
                  <input inputMode="numeric" value={age} onChange={event => setAge(event.target.value)} className={formInputClass} placeholder="18" autoComplete="off" />
                  {errorText("age")}
                </label>
                <label className="flex flex-col gap-2 text-xs text-white/45">
                  Gender
                  <select value={gender} onChange={event => setGender(event.target.value as Gender)} className={`${formInputClass} appearance-none`}>
                    <option value="" className="bg-[#0d0d28]">Select gender</option>
                    {(["Male", "Female", "Non-binary", "Prefer not to say"] as Gender[]).map(item => (
                      <option key={item} value={item} className="bg-[#0d0d28]">{item}</option>
                    ))}
                  </select>
                  {errorText("gender")}
                </label>
                <label className="flex flex-col gap-2 text-xs text-white/45 sm:col-span-2">
                  Mobile Number
                  <input inputMode="tel" value={mobileNumber} onChange={event => setMobileNumber(event.target.value)} className={formInputClass} placeholder="+91 98765 43210" autoComplete="tel" />
                  {errorText("mobileNumber")}
                </label>
              </div>
            )}
            <label className="flex flex-col gap-2 text-xs text-white/45">
              Email Address
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} className={`${formInputClass} pl-10`} placeholder="you@example.com" autoComplete="email" />
              </div>
              {errorText("email")}
            </label>
            <label className="flex flex-col gap-2 text-xs text-white/45">
              Password
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input type="password" value={password} onChange={event => setPassword(event.target.value)} className={`${formInputClass} pl-10`} placeholder="8+ characters, mixed case, number" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
              </div>
              {errorText("password")}
            </label>
            {mode === "signup" && (
              <label className="flex flex-col gap-2 text-xs text-white/45">
                Confirm Password
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={`${formInputClass} pl-10`} placeholder="Repeat your password" autoComplete="new-password" />
                </div>
                {errorText("confirmPassword")}
              </label>
            )}

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

            <button disabled={busy} className="mt-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/30">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button onClick={submitGithub} disabled={busy} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-violet-500/25 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
            <span className="flex items-center justify-center gap-2"><Github className="h-4 w-4" /> Continue with GitHub</span>
          </button>

          <button onClick={submitGoogle} disabled={busy} className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-violet-500/25 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
            <span className="flex items-center justify-center gap-2">
              <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.656 29.266 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.077 6.053 29.353 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.648-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.077 6.053 29.353 4 24 4c-7.391 0-13.805 4.176-17.694 10.691z" />
                <path fill="#4CAF50" d="M24 44c5.255 0 10.062-2.013 13.686-5.294l-6.31-5.338C29.307 34.073 26.858 35 24 35c-5.245 0-9.619-3.327-11.303-7.938l-6.546 5.054C9.909 39.556 16.386 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.017 2.831-2.979 5.211-5.927 6.368l.005-.003 6.31 5.338C35.258 39.711 40 36 40 24c0-1.341-.138-2.648-.389-3.917z" />
              </svg>
              Continue with Google
            </span>
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}

function ProfilePage({
  user,
  onComplete,
  onCancel,
}: {
  user: WorkismUser;
  onComplete: (user: WorkismUser) => Promise<void>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(user.name || "");
  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [mobileNumber, setMobileNumber] = useState(user.mobileNumber || "");
  const [gender, setGender] = useState<Gender | "">(user.gender || "");
  const [email] = useState(user.email || "");
  const [githubUsername, setGithubUsername] = useState(user.github?.username || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFullName(user.name || "");
    setAge(user.age ? String(user.age) : "");
    setMobileNumber(user.mobileNumber || "");
    setGender(user.gender || "");
    setGithubUsername(user.github?.username || "");
  }, [user]);

  const validate = () => {
    const errors: Record<string, string> = {};
    const cleanName = fullName.trim();
    const cleanAge = Number(age);
    const cleanPhone = mobileNumber.replace(/[\s-]/g, "");
    const cleanGithub = githubUsername.trim();

    if (!/^[A-Za-z][A-Za-z .'-]{1,78}$/.test(cleanName)) errors.fullName = "Enter a valid full name.";
    if (!Number.isInteger(cleanAge) || cleanAge < 13 || cleanAge > 100) errors.age = "Age must be between 13 and 100.";
    if (!/^(\+?[1-9]\d{6,14}|[6-9]\d{9})$/.test(cleanPhone)) errors.mobileNumber = "Enter a valid mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email is invalid.";
    if (!gender) errors.gender = "Choose a gender option.";
    if (cleanGithub && !/^[A-Za-z0-9-]{1,39}$/.test(cleanGithub)) errors.githubUsername = "Use a valid GitHub username or leave it blank.";

    setFieldErrors(errors);
    return {
      valid: Object.keys(errors).length === 0,
      cleanName,
      cleanAge,
      cleanPhone,
      cleanGithub,
    };
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validate();
    if (!validation.valid) return;
    setBusy(true);
    setError("");
    try {
      const profile: WorkismUser = {
        id: user.id,
        name: validation.cleanName,
        email,
        age: validation.cleanAge,
        mobileNumber: validation.cleanPhone,
        gender: gender as Gender,
        ...(validation.cleanGithub
          ? {
              github: {
                providerId: "github.com",
                username: validation.cleanGithub,
                email: user.github?.email || undefined,
                githubUserId: user.github?.githubUserId,
                displayName: user.github?.displayName,
                photoURL: user.github?.photoURL,
              },
            }
          : user.github
            ? { github: user.github }
            : {}),
      };
      if (auth.currentUser && auth.currentUser.displayName !== validation.cleanName) {
        await updateProfile(auth.currentUser, { displayName: validation.cleanName });
      }
      await saveUserProfile(profile);
      onComplete(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace("Firebase: ", "") : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };

  const formInputClass = "w-full rounded-xl border border-white/10 bg-white/5 py-3 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-500/40";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-6 py-10">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      <button onClick={onCancel} className="relative z-10 mb-10 flex items-center gap-2 text-white/55 hover:text-white transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1fr_560px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
            <Users className="w-3 h-3" /> Complete your profile
          </div>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white lg:text-6xl" style={{ fontFamily: "Outfit" }}>
            Finish setup, then you’re in.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-white/50">
            We use this profile for progress tracking, submissions, evaluations, and certificates. Your email stays tied to the authenticated Firebase account.
          </p>
        </div>

        <GlassPanel className="p-6" glow>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs text-white/45 sm:col-span-2">
                Full Name
                <input value={fullName} onChange={event => setFullName(event.target.value)} className={formInputClass} placeholder="Your name" autoComplete="name" />
                {fieldErrors.fullName && <span className="text-[11px] text-red-300">{fieldErrors.fullName}</span>}
              </label>
              <label className="flex flex-col gap-2 text-xs text-white/45">
                Age
                <input inputMode="numeric" value={age} onChange={event => setAge(event.target.value)} className={formInputClass} placeholder="18" />
                {fieldErrors.age && <span className="text-[11px] text-red-300">{fieldErrors.age}</span>}
              </label>
              <label className="flex flex-col gap-2 text-xs text-white/45">
                Gender
                <select value={gender} onChange={event => setGender(event.target.value as Gender)} className={`${formInputClass} appearance-none`}>
                  <option value="" className="bg-[#0d0d28]">Select gender</option>
                  {(["Male", "Female", "Non-binary", "Prefer not to say"] as Gender[]).map(item => (
                    <option key={item} value={item} className="bg-[#0d0d28]">{item}</option>
                  ))}
                </select>
                {fieldErrors.gender && <span className="text-[11px] text-red-300">{fieldErrors.gender}</span>}
              </label>
              <label className="flex flex-col gap-2 text-xs text-white/45 sm:col-span-2">
                Mobile Number
                <input inputMode="tel" value={mobileNumber} onChange={event => setMobileNumber(event.target.value)} className={formInputClass} placeholder="+91 98765 43210" autoComplete="tel" />
                {fieldErrors.mobileNumber && <span className="text-[11px] text-red-300">{fieldErrors.mobileNumber}</span>}
              </label>
              <label className="flex flex-col gap-2 text-xs text-white/45 sm:col-span-2">
                Email Address
                <input value={email} readOnly className={`${formInputClass} opacity-80`} />
                <span className="text-[11px] text-white/30">This comes from your Firebase account and stays locked to your auth identity.</span>
                {fieldErrors.email && <span className="text-[11px] text-red-300">{fieldErrors.email}</span>}
              </label>
              <label className="flex flex-col gap-2 text-xs text-white/45 sm:col-span-2">
                GitHub Username or Account
                <input value={githubUsername} onChange={event => setGithubUsername(event.target.value)} className={formInputClass} placeholder="octocat" autoComplete="off" />
                {fieldErrors.githubUsername && <span className="text-[11px] text-red-300">{fieldErrors.githubUsername}</span>}
              </label>
            </div>

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

            <button disabled={busy} className="mt-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Saving profile..." : "Save Profile"}
            </button>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
}

function githubAuthErrorMessage(error: unknown) {
  const code = firebaseErrorCode(error);
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "GitHub sign-in was cancelled. Try again when you are ready.";
    case "auth/popup-blocked":
      return "Your browser blocked the GitHub popup. Allow popups for WORKISM and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using another sign-in method. Sign in with that method first, then link GitHub.";
    case "auth/operation-not-allowed":
      return "GitHub sign-in is not enabled in Firebase yet. Enable the GitHub provider in Firebase Authentication.";
    case "auth/unauthorized-domain":
      return "This WORKISM domain is not authorized in Firebase Authentication. Add the current domain in Firebase Auth settings.";
    case "auth/invalid-credential":
    case "auth/invalid-oauth-client-id":
    case "auth/invalid-oauth-provider":
      return "GitHub sign-in is not configured correctly. Check the GitHub Client ID and secret in Firebase.";
    case "auth/network-request-failed":
      return "Network connection failed while signing in with GitHub. Check your connection and try again.";
    default:
      return "GitHub sign-in could not be completed. Check the Firebase and GitHub OAuth settings, then try again.";
  }
}

function githubProfileFromCredential(firebaseUser: FirebaseUser, credential?: UserCredential): GithubProfile | undefined {
  const provider = firebaseUser.providerData.find(item => item.providerId === "github.com");
  if (!provider) return undefined;
  const additional = credential ? getAdditionalUserInfo(credential) : null;
  return {
    providerId: "github.com",
    githubUserId: provider.uid,
    username: additional?.username || undefined,
    displayName: provider.displayName || firebaseUser.displayName || undefined,
    email: provider.email || firebaseUser.email || undefined,
    photoURL: provider.photoURL || firebaseUser.photoURL || undefined,
  };
}

function workismProfileName(firebaseUser: FirebaseUser, email: string) {
  const provider = firebaseUser.providerData.find(item => item.providerId === "github.com");
  const candidate = firebaseUser.displayName || provider?.displayName || provider?.email?.split("@")[0] || email.split("@")[0];
  return /^[A-Za-z][A-Za-z .'-]{1,78}$/.test(candidate) ? candidate : "Workism learner";
}

function firebaseUserToWorkismUser(firebaseUser: FirebaseUser, credential?: UserCredential): WorkismUser {
  const provider = firebaseUser.providerData.find(item => item.providerId === "github.com");
  const email = firebaseUser.email || provider?.email || `${firebaseUser.uid}@users.noreply.workism.local`;
  return {
    id: firebaseUser.uid,
    name: workismProfileName(firebaseUser, email),
    email,
    github: githubProfileFromCredential(firebaseUser, credential),
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [authReady, setAuthReady] = useState(firebaseConfigured);
  const [pendingProfile, setPendingProfile] = useState<WorkismUser | null>(null);
  const [user, setUser] = useState<WorkismUser | null>(() => {
    const saved = localStorage.getItem("workism_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [evaluation, setEvaluation] = useState<WorkismEvaluation | null>(() => {
    const saved = localStorage.getItem("workism_last_evaluation");
    return saved ? JSON.parse(saved) : null;
  });
  const [certificate, setCertificate] = useState<WorkismCertificate | null>(() => {
    const saved = localStorage.getItem("workism_last_certificate");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setPendingProfile(null);
          localStorage.removeItem("workism_user");
          if (screen !== "landing" && screen !== "auth") setScreen("auth");
          return;
        }
        const workismUser = firebaseUserToWorkismUser(firebaseUser);
        const syncedUser = await syncFirebaseUser(workismUser, await firebaseUser.getIdToken());
        const profile = await getUserProfile(firebaseUser.uid);
        const mergedUser = profile ? { ...syncedUser, ...profile } : syncedUser;
        if (!active) return;
        setUser(mergedUser);
        if (pendingProfile || !profile) {
          setPendingProfile(mergedUser);
          setScreen("profile");
        } else if (screen === "auth" || screen === "landing") {
          setScreen("dashboard");
        }
      } catch (err) {
        console.error("Failed to sync Firebase user", err);
      } finally {
        if (active) setAuthReady(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pendingProfile, screen]);

  const navigate = (nextScreen: Screen) => {
    if (!user && nextScreen !== "landing" && nextScreen !== "auth") {
      setScreen("auth");
      return;
    }
    setScreen(nextScreen);
  };

  const handleAuthenticated = (nextUser: WorkismUser, needsProfile: boolean) => {
    setUser(nextUser);
    if (needsProfile) {
      setPendingProfile(nextUser);
      setScreen("profile");
    } else {
      setPendingProfile(null);
      setScreen("dashboard");
    }
  };

  const handleProfileComplete = async (savedUser: WorkismUser) => {
    setUser(savedUser);
    setPendingProfile(null);
    setScreen("dashboard");
  };

  const runtime: WorkismRuntime = {
    user,
    evaluation,
    certificate,
    setUser,
    setEvaluation,
    setCertificate,
    onNavigate: navigate,
  };

  const handleLogout = async () => {
    await signOut(auth);
    clearGithubToken();
    localStorage.removeItem("workism_user");
    localStorage.removeItem("workism_last_submission");
    localStorage.removeItem("workism_last_evaluation");
    localStorage.removeItem("workism_last_certificate");
    setUser(null);
    setEvaluation(null);
    setCertificate(null);
    setPendingProfile(null);
    setScreen("auth");
  };

  const renderDashboardContent = () => {
    switch (screen) {
      case "dashboard": return <DashboardHome onNavigate={navigate} user={user} />;
      case "skills": return <SkillsPage onNavigate={navigate} />;
      case "learning": return <LearningPage onNavigate={navigate} user={user} />;
      case "assessment": return <AssessmentPage onNavigate={navigate} />;
      case "submission": return <SubmissionPage runtime={runtime} />;
      case "evaluation": return <EvaluationPage runtime={runtime} />;
      case "certificate": return <CertificatePage runtime={runtime} />;
      default: return <DashboardHome onNavigate={navigate} user={user} />;
    }
  };

  if (!authReady) {
    return (
      <>
        <CursorGlow />
        <div className="min-h-screen bg-background flex items-center justify-center text-sm text-white/50">Loading Workism...</div>
      </>
    );
  }

  if (!firebaseConfigured) {
    return (
      <>
        <CursorGlow />
        <div className="min-h-screen bg-background px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-100">
            <div className="mb-2 text-lg font-semibold text-white">Firebase is not configured</div>
            <div className="mb-4">{firebaseConfigurationMessage()}</div>
            <div className="text-white/70">
              Add the Firebase Vercel environment variables, then redeploy. The app cannot initialize auth or Firestore without them.
            </div>
          </div>
        </div>
      </>
    );
  }

  if (screen === "landing") {
    return (
      <>
        <CursorGlow />
        <LandingPage onNavigate={navigate} />
      </>
    );
  }

  if ((screen === "auth" || !user) && screen !== "profile") {
    return (
      <>
        <CursorGlow />
        <AuthPage onNavigate={navigate} onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  if (screen === "profile" && (pendingProfile || user)) {
    const profileUser = pendingProfile || user;
    if (!profileUser) {
      return null;
    }
    return (
      <>
        <CursorGlow />
        <ProfilePage
          user={profileUser}
          onComplete={handleProfileComplete}
          onCancel={async () => {
            await handleLogout();
          }}
        />
      </>
    );
  }

  return (
    <>
      <CursorGlow />
      <DashboardLayout screen={screen} onNavigate={navigate} user={user} onLogout={handleLogout}>
        {renderDashboardContent()}
      </DashboardLayout>
    </>
  );
}
