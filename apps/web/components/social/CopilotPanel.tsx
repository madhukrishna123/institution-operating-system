"use client";

import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import { CopilotSuggestion } from "./types";

export function CopilotPanel({ items }: { items: CopilotSuggestion[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-violet-200">Copilot Agent</p>
          <h2 className="text-xl font-semibold text-white">AI work queue</h2>
        </div>
        <div className="rounded-2xl bg-violet-300/15 p-3 text-violet-100">
          <Bot size={20} />
        </div>
      </div>
      {items.map((item) => (
        <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl transition hover:border-violet-300/30" key={item.title}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-xs text-violet-100">
              {item.agent}
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-200">
              <CheckCircle2 size={13} />
              {item.confidence}
            </span>
          </div>
          <h3 className="font-semibold text-white">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.summary}</p>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-300/20">
            <Sparkles size={15} />
            {item.action}
          </button>
        </article>
      ))}
    </section>
  );
}
