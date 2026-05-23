"use client";

import { Bell, Command, LogOut, Search, Sparkles } from "lucide-react";
import { SocialProfile } from "./types";

export function CommandBar({
  profile,
  pulse,
  onLogout,
  onProfile
}: {
  profile: SocialProfile;
  pulse: string;
  onLogout: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-cyan-950/20">
          <Search className="shrink-0 text-cyan-200" size={18} />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="Search people, channels, decisions, agents..."
          />
          <div className="hidden items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100 md:flex">
            <Command size={13} />
            Ctrl K
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm text-violet-100">
          <Sparkles size={16} />
          {pulse}
        </div>
        <button className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-slate-200 transition hover:bg-white/10">
          <Bell size={18} />
        </button>
        <button
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-left transition hover:bg-white/10"
          onClick={onProfile}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-300 text-sm font-bold text-slate-950">
            {profile.avatar}
          </span>
          <span className="hidden lg:block">
            <span className="block text-sm font-semibold text-white">{profile.name}</span>
            <span className="text-xs text-slate-400">{profile.role}</span>
          </span>
        </button>
        <button
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-slate-300 transition hover:bg-rose-400/10 hover:text-rose-100"
          onClick={onLogout}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
