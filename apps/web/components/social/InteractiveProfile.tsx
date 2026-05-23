"use client";

import { X } from "lucide-react";
import { SocialProfile } from "./types";

export function InteractiveProfile({
  profile,
  open,
  onClose
}: {
  profile: SocialProfile;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/70 p-4 backdrop-blur-xl">
      <aside className="ml-auto flex h-full max-w-md flex-col rounded-[2rem] border border-white/10 bg-slate-950/90 p-5 shadow-2xl shadow-black/40">
        <div className="flex justify-end">
          <button className="rounded-2xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/20 via-white/[0.06] to-violet-300/20 p-5">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-cyan-300 text-2xl font-bold text-slate-950">
            {profile.avatar}
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-white">{profile.name}</h2>
          <p className="mt-1 text-cyan-100">{profile.role}</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">{profile.headline}</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {profile.stats.map((stat) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-center" key={stat.label}>
              <p className="text-lg font-semibold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Skills graph</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm text-slate-200" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.22em] text-violet-200">Badges</p>
          <div className="mt-3 space-y-2">
            {profile.badges.map((badge) => (
              <div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-sm text-violet-100" key={badge}>
                {badge}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
