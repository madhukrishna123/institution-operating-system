"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { apiPost } from "@/lib/api";

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

type AgentWorkQueueProps = {
  items: AgentWork[];
  token: string;
  canApprove: boolean;
  onChange: () => void;
};

export function AgentWorkQueue({
  items,
  token,
  canApprove,
  onChange
}: AgentWorkQueueProps) {
  async function approve(id: number) {
    await apiPost(`/api/agent-work/${id}/approve`, {}, token);
    onChange();
  }

  async function reject(id: number) {
    await apiPost(`/api/agent-work/${id}/reject`, { reason: "Reviewed in workspace" }, token);
    onChange();
  }

  return (
    <aside className="h-full rounded-[24px] border border-white/75 bg-white/65 p-4 shadow-sm backdrop-blur">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6a28]">Approval queue</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Recommendations</h2>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#eadcc9] bg-white/55 p-4 text-sm text-slate-500">
            No pending agent work for this role.
          </div>
        ) : (
          items.map((item) => (
            <article className="rounded-2xl border border-[#eadcc9] bg-white/60 p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#9a6a28]">{item.agent}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h3>
                </div>
                <span className="rounded-full bg-[#f7dfb8] px-2 py-1 text-[11px] font-semibold text-[#70470f]">
                  {item.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.recommendation}</p>
              {item.draft_output ? (
                <p className="mt-3 rounded-2xl border border-[#cfe6e1] bg-[#edf7f4] p-3 text-xs leading-5 text-[#173b45]">
                  {item.draft_output}
                </p>
              ) : null}
              <p className="mt-3 text-[11px] text-slate-400">{item.audit_trail}</p>
              {canApprove && item.status === "admin_review" ? (
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex items-center gap-1 rounded-full bg-[#173b45] px-3 py-2 text-xs font-semibold text-white"
                    onClick={() => approve(item.id)}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                  <button
                    className="flex items-center gap-1 rounded-full border border-[#e6d6bf] bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700"
                    onClick={() => reject(item.id)}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
