"use client";

import { FormEvent, useState } from "react";
import { Heart, MessageCircle, Radio, Send, Zap } from "lucide-react";
import { SocialFeedItem } from "./types";

export function SocialActivityFeed({
  items,
  onPost
}: {
  items: SocialFeedItem[];
  onPost: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    setIsPosting(true);
    try {
      await onPost(content.trim());
      setContent("");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <section className="space-y-4">
      <form
        className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl"
        onSubmit={submit}
      >
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200">
          <Radio size={14} />
          Feed Agent
        </div>
        <textarea
          className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
          placeholder="Share a launch note, ask the network, or drop a decision signal..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {["launch", "decision", "question"].map((chip) => (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1" key={chip}>
                {chip}
              </span>
            ))}
          </div>
          <button
            className="flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
            disabled={isPosting}
          >
            <Send size={15} />
            {isPosting ? "Posting" : "Post Signal"}
          </button>
        </div>
      </form>

      {items.map((item) => (
        <article
          className="group rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/15 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-white/[0.075]"
          key={item.id}
        >
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-300 text-sm font-bold text-slate-950">
              {item.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-white">{item.author}</h3>
                <span className="text-sm text-slate-400">{item.role}</span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-xs text-cyan-100">
                  {item.signal}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {item.workspace} · {item.time}
              </p>
              <p className="mt-4 text-base leading-7 text-slate-100">{item.content}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 transition hover:border-rose-300/30 hover:text-rose-100">
                  <Heart size={15} />
                  {item.reactions}
                </button>
                <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 transition hover:border-cyan-300/30 hover:text-cyan-100">
                  <MessageCircle size={15} />
                  {item.replies}
                </button>
                <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 transition hover:border-violet-300/30 hover:text-violet-100">
                  <Zap size={15} />
                  Ask AI
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
