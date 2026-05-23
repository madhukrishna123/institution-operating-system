"use client";

import { Hash, MessageSquareText } from "lucide-react";
import { MessagePreview } from "./types";

export function MessagingDock({ messages }: { messages: MessagePreview[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Messaging Agent</p>
          <h2 className="text-xl font-semibold text-white">Live channels</h2>
        </div>
        <MessageSquareText className="text-cyan-200" size={20} />
      </div>
      {messages.map((message) => (
        <button
          className="flex w-full items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.075]"
          key={message.channel}
        >
          <span className="mt-1 flex size-9 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
            <Hash size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold text-white">{message.channel}</span>
              <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-xs font-bold text-slate-950">
                {message.unread}
              </span>
            </span>
            <span className="mt-1 block text-sm text-slate-400">
              {message.sender}: {message.preview}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
