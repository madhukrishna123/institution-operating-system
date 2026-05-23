"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CircleUserRound,
  Compass,
  GraduationCap,
  Home,
  Loader2,
  MessageCircle,
  Network,
  Orbit,
  Sparkles,
  Users
} from "lucide-react";
import { ApiSession, apiGet, apiPost } from "@/lib/api";
import { CommandBar } from "./CommandBar";
import { CopilotPanel } from "./CopilotPanel";
import { InteractiveProfile } from "./InteractiveProfile";
import { MessagingDock } from "./MessagingDock";
import { SocialActivityFeed } from "./SocialActivityFeed";
import { WorkspaceHub } from "./WorkspaceHub";
import { SeedUser, SocialHome } from "./types";

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function EnterpriseSocialShell({
  initialSeedUsers = []
}: {
  initialSeedUsers?: SeedUser[];
}) {
  const [seedUsers, setSeedUsers] = useState<SeedUser[]>(initialSeedUsers);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [home, setHome] = useState<SocialHome | null>(null);
  const [error, setError] = useState("");
  const [activeWorkspace, setActiveWorkspace] = useState("product-studio");
  const [pulse, setPulse] = useState("Social OS online");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (initialSeedUsers.length === 0) {
      apiGet<SeedUser[]>("/api/auth/seed-users")
        .then(setSeedUsers)
        .catch((nextError) => setError(`Cannot load roles: ${nextError.message}`));
    }
    const saved = window.localStorage.getItem("ai_os_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem("ai_os_session");
      }
    }
  }, [initialSeedUsers.length]);

  useEffect(() => {
    if (!session) {
      return;
    }
    loadHome(session.token);
  }, [session]);

  async function loadHome(token = session?.token ?? "") {
    if (!token) {
      return;
    }
    try {
      const data = await apiGet<SocialHome>("/api/social/home", token);
      setHome(data);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load Social OS");
    }
  }

  async function login(email: string) {
    try {
      const nextSession = await apiPost<ApiSession>("/api/auth/login", {
        email,
        password: "password"
      });
      window.localStorage.setItem("ai_os_session", JSON.stringify(nextSession));
      setSession(nextSession);
      setPulse("Identity synced");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    }
  }

  function logout() {
    window.localStorage.removeItem("ai_os_session");
    setSession(null);
    setHome(null);
    setPulse("Social OS online");
  }

  async function createPost(content: string) {
    if (!session) {
      return;
    }
    const workspace =
      home?.workspaces.find((item) => item.id === activeWorkspace)?.name ?? "Company";
    await apiPost("/api/social/feed", { content, workspace }, session.token);
    await loadHome(session.token);
    setPulse("Feed signal published");
  }

  if (!session || !home) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.28),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.22),transparent_30%),linear-gradient(135deg,#020617_0%,#111827_52%,#020617_100%)]" />
        <section className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 backdrop-blur">
              <Sparkles size={16} />
              Future-ready enterprise collaboration
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-white md:text-7xl">
              Social work, AI agents, and teams in one living OS.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A dark-mode command center where feeds, workspaces, copilots, messaging, and creator-style profiles move together.
            </p>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {["Social feed", "AI copilots", "Student records"].map((item) => (
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-200 backdrop-blur" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Choose identity</p>
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {seedUsers.length === 0 ? (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                  <Loader2 className="animate-spin" size={16} />
                  Loading identities
                </div>
              ) : null}
              {seedUsers.map((user) => (
                <button
                  className="group flex w-full items-center justify-between rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/10"
                  key={user.email}
                  onClick={() => login(user.email)}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-cyan-300 text-sm font-bold text-slate-950">
                      {user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </span>
                    <span>
                      <span className="block font-semibold text-white">{user.name}</span>
                      <span className="text-sm text-slate-400">{roleLabel(user.role)}</span>
                    </span>
                  </span>
                  <Orbit className="text-slate-500 group-hover:text-cyan-200" size={18} />
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.2),transparent_25%),radial-gradient(circle_at_92%_12%,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_60%_90%,rgba(244,114,182,0.12),transparent_24%)]" />
      <div className="relative grid min-h-screen lg:grid-cols-[96px_1fr_360px]">
        <aside className="hidden border-r border-white/10 bg-slate-950/70 p-4 backdrop-blur-2xl lg:block">
          <div className="mb-8 flex size-14 items-center justify-center rounded-3xl bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-500/20">
            <Network size={26} />
          </div>
          <nav className="space-y-3">
            {[
              [Home, "Home"],
              [Compass, "Explore"],
              [Users, "Teams"],
              [GraduationCap, "Students"],
              [Bot, "Agents"],
              [MessageCircle, "Messages"],
              [CircleUserRound, "Profile"]
            ].map(([Icon, label]) => (
              <button
                className="flex size-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                key={String(label)}
                title={String(label)}
                onClick={() => {
                  if (label === "Profile") {
                    setProfileOpen(true);
                    return;
                  }
                  if (label === "Students") {
                    window.location.href = "/modules/students";
                    return;
                  }
                  setPulse(`${label} layer focused`);
                }}
              >
                <Icon size={21} />
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <CommandBar
            profile={home.profile}
            pulse={pulse}
            onLogout={logout}
            onProfile={() => setProfileOpen(true)}
          />
          <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Shell Agent</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-semibold text-white md:text-5xl">
                    Good momentum, {home.profile.name.split(" ")[0]}.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                    Your enterprise social OS is blending team signals, agent recommendations, and live collaboration into one workspace.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
                      href="/modules/students"
                    >
                      <GraduationCap size={16} />
                      Create Student
                    </a>
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                      onClick={() => setPulse("Student records are available from Create Student")}
                    >
                      Institution Apps
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {home.profile.stats.map((stat) => (
                    <div className="min-w-20 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-center" key={stat.label}>
                      <p className="text-lg font-semibold text-white">{stat.value}</p>
                      <p className="text-xs text-slate-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <WorkspaceHub
              activeWorkspace={activeWorkspace}
              workspaces={home.workspaces}
              onSelect={(id) => {
                setActiveWorkspace(id);
                setPulse("Workspace context shifted");
              }}
            />
            <SocialActivityFeed items={home.feed} onPost={createPost} />
          </div>
        </section>

        <aside className="hidden space-y-6 overflow-y-auto border-l border-white/10 bg-slate-950/70 p-5 backdrop-blur-2xl xl:block">
          <CopilotPanel items={home.copilots} />
          <MessagingDock messages={home.messages} />
        </aside>
      </div>
      <InteractiveProfile
        profile={home.profile}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </main>
  );
}
