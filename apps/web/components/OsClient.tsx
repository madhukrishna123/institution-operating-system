"use client";

import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Sparkles,
  Users
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AdminConfigBuilder } from "./AdminConfigBuilder";
import { ConfigurableForm } from "./ConfigurableForm";
import { ConfigurableListView } from "./ConfigurableListView";
import { ApiSession, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

type Workspace = {
  user: { name: string; email: string; role: string };
  institution: { name: string; locale: string };
  navigation: { label: string; href: string; module_key: string; icon: string; accent: string }[];
  agent_summary?: { pending: number; mode: string };
};

type FieldConfig = {
  key: string;
  label: string;
  type: string;
  visible: boolean;
  required: boolean;
  options?: { label: string; value: string }[];
};

type ModulePayload = {
  module: { key: string; label: string; description: string; accent: string };
  fields: FieldConfig[];
  create_fields: FieldConfig[];
  records: Record<string, string | number | boolean | null>[];
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type AgentWork = {
  id: number;
  agent: string;
  title: string;
  recommendation: string;
  draft_output: string;
  confidence: string;
  status: string;
  audit_trail: string;
};

const workingModules = new Set(["students", "attendance", "fees", "configuration"]);

const icons = {
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users
};

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultValues(moduleKey: string): Record<string, string> {
  if (moduleKey === "students") {
    return { status: "active" };
  }
  return {};
}

export function OsClient({
  initialModule = "workspace"
}: {
  initialModule?: string;
}) {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedModule, setSelectedModule] = useState(initialModule);
  const [modulePayload, setModulePayload] = useState<ModulePayload | null>(null);
  const [agentWork, setAgentWork] = useState<AgentWork[]>([]);
  const [editingRecord, setEditingRecord] = useState<Record<string, string | number | boolean | null> | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = session?.token ?? "";
  const canConfigure = session?.role === "admin" || session?.role === "super_admin";

  const navigation = useMemo(
    () => (workspace?.navigation ?? []).filter((item) => workingModules.has(item.module_key)),
    [workspace]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("ai_os_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem("ai_os_session");
      }
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    loadWorkspace();
    loadAgentWork();
  }, [session]);

  useEffect(() => {
    setEditingRecord(null);
    setMessage("");
    if (!token || selectedModule === "workspace" || selectedModule === "configuration") {
      setModulePayload(null);
      return;
    }
    refreshModule();
  }, [selectedModule, token]);

  async function loadWorkspace() {
    if (!session) {
      return;
    }
    try {
      const nextWorkspace = await apiGet<Workspace>("/api/me/workspace", session.token);
      setWorkspace(nextWorkspace);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load workspace");
      window.localStorage.removeItem("ai_os_session");
      setSession(null);
      setWorkspace(null);
    }
  }

  async function refreshModule() {
    if (!token || selectedModule === "workspace" || selectedModule === "configuration") {
      return;
    }
    try {
      const refreshed = await apiGet<ModulePayload>(`/api/modules/${selectedModule}/records`, token);
      setModulePayload(refreshed);
      setError("");
    } catch (nextError) {
      setModulePayload(null);
      setError(nextError instanceof Error ? nextError.message : "Could not load module");
    }
  }

  async function loadAgentWork() {
    if (!session?.token) {
      return;
    }
    try {
      const items = await apiGet<AgentWork[]>("/api/agent-work", session.token);
      setAgentWork(items);
    } catch {
      setAgentWork([]);
    }
  }

  async function login(email: string, password = "password") {
    try {
      setIsLoggingIn(true);
      const nextSession = await apiPost<ApiSession>("/api/auth/login", {
        email,
        password
      });
      window.localStorage.setItem("ai_os_session", JSON.stringify(nextSession));
      setSession(nextSession);
      setSelectedModule(initialModule === "workspace" ? "workspace" : initialModule);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function submitEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login(loginEmail.trim(), loginPassword);
  }

  function logout() {
    window.localStorage.removeItem("ai_os_session");
    setSession(null);
    setWorkspace(null);
    setModulePayload(null);
    setSelectedModule("workspace");
  }

  async function createRecord(payload: Record<string, string>) {
    await apiPost(`/api/modules/${selectedModule}/records`, payload, token);
    await refreshModule();
    await loadAgentWork();
    setMessage(`${modulePayload?.module.label ?? "Record"} created.`);
  }

  async function updateRecord(payload: Record<string, string>) {
    if (!editingRecord?.id) {
      return;
    }
    await apiPatch(`/api/modules/${selectedModule}/records/${editingRecord.id}`, payload, token);
    setEditingRecord(null);
    await refreshModule();
    await loadAgentWork();
    setMessage(`${modulePayload?.module.label ?? "Record"} updated.`);
  }

  async function deleteRecord(record: Record<string, string | number | boolean | null>) {
    if (!record.id) {
      return;
    }
    const name = String(
      record.full_name ??
      record.admission_number ??
      record.student_name ??
      record.fee_name ??
      "this record"
    );
    if (!window.confirm(`Delete ${name}?`)) {
      return;
    }
    await apiDelete(`/api/modules/${selectedModule}/records/${record.id}`, token);
    if (editingRecord?.id === record.id) {
      setEditingRecord(null);
    }
    await refreshModule();
    await loadAgentWork();
    setMessage(`${modulePayload?.module.label ?? "Record"} deleted.`);
  }

  function editValues(): Record<string, string> {
    if (!editingRecord) {
      return defaultValues(selectedModule);
    }
    return Object.fromEntries(
      Object.entries(editingRecord)
        .filter(([key]) => key !== "id")
        .map(([key, value]) => [key, String(value ?? "")])
    );
  }

  function emptyRecordsMessage() {
    if (selectedModule === "attendance" && ["parent", "student"].includes(session?.role ?? "")) {
      return "No attendance has been recorded for the linked student yet. Once a teacher marks attendance, it will appear here.";
    }
    if (selectedModule === "fees" && ["parent", "student"].includes(session?.role ?? "")) {
      return "No fee records are available for the linked student yet.";
    }
    if (!modulePayload?.can_create) {
      return "No records are available for your account yet.";
    }
    return "No records yet. Create the first one when you are ready.";
  }

  if (!session || !workspace) {
    return (
      <main className="min-h-screen overflow-hidden text-[#1f2933]">
        <section className="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1fr_410px]">
            <div className="relative">
              <div className="mb-5 inline-flex rounded-full border border-[#dfc7a8] bg-white/60 px-3 py-1 text-sm font-semibold text-[#865d23] shadow-sm backdrop-blur">
                Institution OS
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Run your institution with calm, clarity, and care.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                A warm operating layer for admissions, attendance, fees, and daily follow-ups. Built to feel simple for teams, parents, and students.
              </p>
              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {["Students", "Attendance", "Fees"].map((item) => (
                  <div className="rounded-2xl border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur" key={item}>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a36b22]">Ready</p>
                    <p className="mt-2 font-semibold text-slate-900">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-white/75 bg-white/70 p-6 shadow-[0_24px_80px_rgba(72,52,28,0.14)] backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#9a6a28]">Welcome back</p>
                  <h2 className="text-2xl font-semibold">Sign in</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173b45] text-sm font-bold text-white">
                  OS
                </div>
              </div>
              {error ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <form className="mt-4 space-y-3" onSubmit={submitEmailLogin}>
                <label className="block text-sm font-medium text-slate-700">
                  Username
                  <input
                    className="mt-1 w-full rounded-2xl border border-[#e6d6bf] bg-white/80 px-3 py-2.5 text-slate-950 outline-none transition focus:border-[#173b45] focus:ring-4 focus:ring-[#d6ece8]"
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                  <input
                    className="mt-1 w-full rounded-2xl border border-[#e6d6bf] bg-white/80 px-3 py-2.5 text-slate-950 outline-none transition focus:border-[#173b45] focus:ring-4 focus:ring-[#d6ece8]"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button
                  className="flex w-full items-center justify-center rounded-2xl bg-[#173b45] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2c34] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#172127]">
      <div className="grid min-h-screen lg:grid-cols-[292px_1fr]">
        <aside className="border-r border-white/10 bg-[#102f37] p-4 text-white shadow-[18px_0_70px_rgba(16,47,55,0.20)]">
          <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5c36f] font-bold text-[#102f37]">
                OS
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f5c36f]">Institution OS</p>
                <p className="mt-1 truncate text-lg font-semibold leading-6">{workspace.institution.name}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b252b] px-3 py-2 text-xs leading-5 text-white/70">
              Clean operations for students, attendance, fees, and configuration.
            </div>
          </div>
          <nav className="space-y-1">
            <button
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                selectedModule === "workspace"
                  ? "bg-[#fff8ed] text-[#102f37] shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => setSelectedModule("workspace")}
            >
              <LayoutDashboard size={17} />
              Dashboard
            </button>
            {navigation.map((item) => {
              const Icon = icons[item.icon as keyof typeof icons] ?? LayoutDashboard;
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    selectedModule === item.module_key
                      ? "bg-[#fff8ed] text-[#102f37] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  key={item.module_key}
                  onClick={() => setSelectedModule(item.module_key)}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.07] p-4 text-sm text-white/75">
            <div className="mb-3 flex items-center gap-2 text-[#f5c36f]">
              <Sparkles size={16} />
              <span className="font-semibold">Next step</span>
            </div>
            Build people, role assignments, and cleaner parent-teacher linking from this foundation.
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/70 bg-[#f9f4ec]/80 px-5 py-4 backdrop-blur-xl md:px-7">
            <div>
              <p className="text-sm font-semibold text-[#9a6a28]">{roleLabel(session.role)}</p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {selectedModule === "workspace"
                  ? "Dashboard"
                  : selectedModule === "configuration"
                    ? "Configuration"
                  : modulePayload?.module.label ?? "Module"}
              </h1>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
              <div className="hidden min-w-[260px] items-center gap-2 rounded-2xl border border-white bg-white/70 px-3 py-2 text-sm text-slate-500 shadow-sm md:flex">
                <Search size={16} />
                <span>Search students, fees, attendance...</span>
              </div>
              <button className="rounded-2xl border border-white bg-white/70 p-2.5 text-slate-600 shadow-sm transition hover:bg-white">
                <Bell size={17} />
              </button>
              <div className="rounded-2xl border border-white bg-white/70 px-3 py-2 text-sm text-slate-600 shadow-sm">
                {session.user.name}
              </div>
              <button
                className="flex items-center gap-2 rounded-2xl bg-[#102f37] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b252b]"
                onClick={logout}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </header>

          <div className="p-4 md:p-7">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            {selectedModule === "workspace" ? (
              <section className="space-y-5">
                <div className="overflow-hidden rounded-[32px] border border-white/20 bg-[#102f37] text-white shadow-[0_28px_90px_rgba(16,47,55,0.22)]">
                  <div className="grid gap-6 p-6 md:grid-cols-[1fr_280px] md:p-8">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.20em] text-[#f5c36f]">Today workspace</p>
                      <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                        A calm command center for the day.
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">
                        Start from the working modules. Records, approvals, and configuration stay simple, while the architecture is ready for richer roles.
                      </p>
                    </div>
                    <div className="rounded-[26px] border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">System health</p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/[0.08] p-3">
                          <p className="text-2xl font-semibold">{navigation.length}</p>
                          <p className="text-xs text-white/60">Modules</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.08] p-3">
                          <p className="text-2xl font-semibold">{agentWork.filter((item) => item.status === "admin_review").length}</p>
                          <p className="text-xs text-white/60">Pending</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {navigation.map((item) => {
                    const Icon = icons[item.icon as keyof typeof icons] ?? LayoutDashboard;
                    return (
                      <button
                        className="group rounded-[28px] border border-white/80 bg-white/75 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-[#f5c36f] hover:bg-white hover:shadow-xl"
                        key={item.module_key}
                        onClick={() => setSelectedModule(item.module_key)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#102f37] text-[#f5c36f] transition group-hover:scale-105">
                            <Icon size={21} />
                          </div>
                          <span className="rounded-full border border-[#eadcc9] bg-[#fff8ed] px-3 py-1 text-xs font-semibold text-[#805719]">
                            Open
                          </span>
                        </div>
                        <h2 className="mt-4 text-lg font-semibold">{item.label}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Open {item.label.toLowerCase()} records and daily actions.
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9a6a28]">Approvals</p>
                    <p className="mt-3 text-3xl font-semibold">
                      {agentWork.filter((item) => item.status === "admin_review").length}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Items needing review. Details stay inside the workflow module, not on the landing dashboard.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9a6a28]">Workspace</p>
                    <p className="mt-3 text-3xl font-semibold">{roleLabel(session.role)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Navigation is filtered for the current role.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9a6a28]">Setup</p>
                    <p className="mt-3 text-3xl font-semibold">{navigation.length}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Active working modules are ready from the left navigation.
                    </p>
                  </div>
                </div>
              </section>
            ) : selectedModule === "configuration" && canConfigure ? (
              <AdminConfigBuilder token={token} onSaved={loadWorkspace} />
            ) : modulePayload ? (
              <section className="space-y-4">
                <div className="rounded-[24px] border border-white/75 bg-white/65 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm leading-6 text-slate-600">{modulePayload.module.description}</p>
                </div>
                {(modulePayload.can_create || editingRecord) && modulePayload.create_fields.length > 0 ? (
                  <div className="rounded-[24px] border border-white/75 bg-white/65 p-5 shadow-sm backdrop-blur">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">
                        {editingRecord ? `Edit ${modulePayload.module.label}` : `Create ${modulePayload.module.label}`}
                      </h2>
                      {editingRecord ? (
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          onClick={() => setEditingRecord(null)}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                    <ConfigurableForm
                      fields={modulePayload.create_fields}
                      initialValues={editValues()}
                      onSubmit={editingRecord ? updateRecord : createRecord}
                      submitLabel={editingRecord ? "Save changes" : "Create"}
                    />
                  </div>
                ) : null}
                <ConfigurableListView
                  fields={modulePayload.fields}
                  records={modulePayload.records}
                  canEdit={modulePayload.can_edit}
                  canDelete={modulePayload.can_delete}
                  emptyMessage={emptyRecordsMessage()}
                  onEdit={(record) => setEditingRecord(record)}
                  onDelete={deleteRecord}
                />
              </section>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-8 text-slate-500 shadow-sm">
                Loading module...
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
