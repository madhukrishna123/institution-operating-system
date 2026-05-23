"use client";

import { FolderKanban, Pin, Users } from "lucide-react";
import { SocialWorkspace } from "./types";

export function WorkspaceHub({
  workspaces,
  activeWorkspace,
  onSelect
}: {
  workspaces: SocialWorkspace[];
  activeWorkspace: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-3">
      {workspaces.map((workspace) => {
        const active = activeWorkspace === workspace.id;
        return (
          <button
            className={`rounded-3xl border p-4 text-left backdrop-blur-xl transition hover:-translate-y-1 ${
              active
                ? "border-cyan-300/40 bg-cyan-300/12 shadow-2xl shadow-cyan-950/20"
                : "border-white/10 bg-white/[0.055] hover:border-white/20 hover:bg-white/[0.075]"
            }`}
            key={workspace.id}
            onClick={() => onSelect(workspace.id)}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
                <FolderKanban size={18} />
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">
                {workspace.agent}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white">{workspace.name}</h3>
            <p className="mt-1 text-sm text-cyan-100">{workspace.status}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-1">
                <Users size={14} />
                {workspace.members}
              </span>
              <span>{workspace.threads} threads</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {workspace.pinned.map((item) => (
                <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-xs text-slate-300" key={item}>
                  <Pin size={11} />
                  {item}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </section>
  );
}
