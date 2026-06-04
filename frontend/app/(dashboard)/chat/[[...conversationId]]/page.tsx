"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, StopCircle, Plus, BookOpen, Trash2, MessageSquare, X } from "lucide-react";
import { useRAGChat } from "@/hooks/useRAGChat";
import { useConversations, useCreateConversation, useDeleteConversation, useMessages } from "@/hooks/useConversations";
import { formatRelativeTime, cn } from "@/lib/utils";
import { AnswerContent } from "@/components/chat/AnswerContent";
import { EmptyState } from "@/components/ui/EmptyState";
import { panelRight } from "@/components/motion/tokens";
import type { Citation } from "@/lib/api-client";

function CitationPanel({ citations, activeIndex, onClose }: { citations: Citation[]; activeIndex: number | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeIndex === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, onClose]);

  return (
    <AnimatePresence>
      {activeIndex !== null && (
        <motion.div
          variants={panelRight}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-xl)] sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              <span className="text-h4 text-fg">Sources</span>
              <span className="text-xs text-subtle">({citations.length})</span>
            </div>
            <button ref={closeRef} onClick={onClose} aria-label="Close sources" className="text-subtle transition-colors hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {citations.map((c) => (
              <div key={c.chunk_id} className={cn("rounded-xl border p-3.5 transition-colors", c.index === activeIndex ? "border-accent bg-accent-subtle" : "border-line bg-sunken")}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-1.5 py-0.5 text-[11px] font-semibold text-accent">[{c.index}]</span>
                  <span className="truncate text-xs font-medium text-fg">{c.document_title}</span>
                </div>
                {c.page_number != null && <p className="mb-1.5 text-[10px] uppercase tracking-wide text-subtle">Page {c.page_number}</p>}
                <p className="text-xs leading-relaxed text-muted">{c.excerpt}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({
  role, content, citations, isStreaming, latencyMs, onCite,
}: {
  role: "user" | "assistant"; content: string; citations: Citation[]; isStreaming: boolean; latencyMs?: number;
  onCite: (index: number, citations: Citation[]) => void;
}) {
  if (role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm border border-line bg-surface px-4 py-3 shadow-[var(--shadow-xs)]">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{content}</p>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-start">
      <div className="max-w-[85%]">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-fg">
            <span className="text-[10px] font-bold leading-none">D</span>
          </div>
          <span className="text-xs text-subtle">DocuMind</span>
          {latencyMs != null && <span className="text-[10px] text-subtle">· {latencyMs}ms retrieval</span>}
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-5 py-4 shadow-[var(--shadow-xs)]">
          {isStreaming && !content ? (
            <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
            </div>
          ) : (
            <div className="relative">
              <AnswerContent content={content} onCite={(i) => onCite(i, citations)} />
              {isStreaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />}
            </div>
          )}
          {citations.length > 0 && !isStreaming && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
              <span className="text-[10px] text-subtle">Sources:</span>
              {citations.map((c) => (
                <button key={c.chunk_id} onClick={() => onCite(c.index, citations)} title={c.document_title}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] hover:text-accent">
                  [{c.index}] {c.document_title.slice(0, 18)}{c.document_title.length > 18 ? "…" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatPage() {
  const params = useParams<{ conversationId: string[] }>();
  const router = useRouter();
  const conversationId = params.conversationId?.[0] ?? "";

  const { messages, isSending, sendMessage, cancelStream, hydrate } = useRAGChat(conversationId);
  const { data: convsData } = useConversations({ page_size: 30 });
  const { data: history } = useMessages(conversationId);
  const { mutate: createConv, isPending: creating } = useCreateConversation();
  const { mutate: deleteConv } = useDeleteConversation();

  const [input, setInput] = useState("");
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => { hydratedRef.current = null; }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !history) return;
    if (hydratedRef.current === conversationId || isSending) return;
    hydrate(history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      citations: m.citations ?? [],
      isStreaming: false,
      latency_ms: m.latency_ms ?? undefined,
    })));
    hydratedRef.current = conversationId;
  }, [conversationId, history, isSending, hydrate]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };
  const handleAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };
  const openCitations = (index: number, citations: Citation[]) => { setActiveCitations(citations); setActiveIndex(index); };

  return (
    <div className="-mx-8 -my-8 flex h-[calc(100vh-64px)]">
      {/* Conversation list */}
      <div className="flex w-64 shrink-0 flex-col border-r border-line bg-canvas">
        <div className="border-b border-line p-4">
          <button onClick={() => createConv({}, { onSuccess: (conv) => router.push(`/chat/${conv.id}`) })} disabled={creating} className="btn btn-primary w-full py-2.5 text-sm">
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {convsData?.items.length === 0 && <p className="px-4 py-8 text-center text-xs text-subtle">No conversations yet</p>}
          {convsData?.items.map((conv) => (
            <div key={conv.id} className={cn("group mx-2 flex items-center rounded-lg transition-colors", conv.id === conversationId ? "bg-accent-subtle" : "hover:bg-sunken")}>
              <button onClick={() => router.push(`/chat/${conv.id}`)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                <p className={cn("truncate text-sm font-medium", conv.id === conversationId ? "text-accent" : "text-muted")}>{conv.title ?? "Untitled"}</p>
                <p className="mt-0.5 text-[11px] text-subtle">{conv.message_count} msgs · {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : "New"}</p>
              </button>
              <button aria-label="Delete conversation" onClick={() => deleteConv(conv.id, { onSuccess: () => { if (conv.id === conversationId) router.push("/chat"); } })}
                className="px-2 text-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={MessageSquare} title="Ask your documents anything" description="Start a new conversation to chat with your knowledge base. Every answer comes with cited sources." />
          </div>
        ) : (
          <>
            <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface">
                    <MessageSquare className="h-5 w-5 text-accent" />
                  </div>
                  <p className="text-sm text-subtle">Ask anything about your documents…</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} role={msg.role} content={msg.content} citations={msg.citations} isStreaming={msg.isStreaming} latencyMs={msg.latency_ms} onCite={openCitations} />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-line px-6 py-4">
              <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-3 shadow-[var(--shadow-sm)] transition-colors focus-within:border-accent">
                <textarea
                  ref={textareaRef} rows={1} value={input} onChange={handleAutoResize} onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your documents…"
                  className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-fg placeholder-subtle outline-none"
                  style={{ maxHeight: "160px" }}
                />
                {isSending ? (
                  <button onClick={cancelStream} aria-label="Stop generating" className="btn btn-danger h-9 w-9 shrink-0 !px-0"><StopCircle className="h-4 w-4" /></button>
                ) : (
                  <button onClick={handleSend} disabled={!input.trim()} aria-label="Send message" className="btn btn-primary h-9 w-9 shrink-0 !px-0"><Send className="h-4 w-4" /></button>
                )}
              </div>
              <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-subtle">Shift + Enter for a new line · answers are grounded in your documents</p>
            </div>
          </>
        )}
      </div>

      <CitationPanel citations={activeCitations} activeIndex={activeIndex} onClose={() => setActiveIndex(null)} />
    </div>
  );
}
