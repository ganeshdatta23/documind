"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { Send, StopCircle, Plus, BookOpen } from "lucide-react";
import { useRAGChat } from "@/hooks/useRAGChat";
import { useConversations, useCreateConversation } from "@/hooks/useConversations";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Citation } from "@/lib/api-client";

// ─── Citation Chip ─────────────────────────────────────────────────────────

function CitationChip({ citation, onClick }: { citation: Citation; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
        bg-indigo-500/10 border border-indigo-500/20 text-indigo-400
        hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-colors"
    >
      [{citation.index}]
    </button>
  );
}

// ─── Citation Panel ────────────────────────────────────────────────────────

function CitationPanel({
  citations,
  open,
  onClose,
}: {
  citations: Citation[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open || citations.length === 0) return null;
  return (
    <div className="absolute right-0 top-0 w-80 glass rounded-2xl border border-slate-700 shadow-2xl shadow-black/40 p-4 z-20 fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Sources</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
      </div>
      <div className="space-y-3">
        {citations.map((c) => (
          <div key={c.chunk_id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                [{c.index}]
              </span>
              <span className="text-xs text-slate-300 font-medium truncate">{c.document_title}</span>
            </div>
            {c.page_number && (
              <p className="text-[10px] text-slate-500 mb-1.5">Page {c.page_number}</p>
            )}
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{c.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  citations,
  isStreaming,
}: {
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  isStreaming: boolean;
}) {
  const [showCitations, setShowCitations] = useState(false);

  if (role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm bg-sky-500/10 border border-sky-500/20">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        {/* Brain icon */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">AI</span>
          </div>
          <span className="text-xs text-slate-500">DocuMind</span>
        </div>

        <div className="relative px-4 py-3 rounded-2xl rounded-tl-sm glass border border-slate-700">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-sky-400 animate-pulse ml-0.5 align-middle" />
            )}
          </p>

          {/* Citations row */}
          {citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-700/60">
              <span className="text-[10px] text-slate-500 self-center">Sources:</span>
              {citations.map((c) => (
                <CitationChip
                  key={c.chunk_id}
                  citation={c}
                  onClick={() => setShowCitations((s) => !s)}
                />
              ))}
            </div>
          )}

          {/* Citation panel */}
          <CitationPanel
            citations={citations}
            open={showCitations}
            onClose={() => setShowCitations(false)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat Page ────────────────────────────────────────────────────────

export default function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();
  const conversationId = params.conversationId;

  const { messages, isSending, sendMessage, cancelStream } =
    useRAGChat(conversationId);
  const { data: convsData } = useConversations({ page_size: 30 });
  const { mutate: createConv } = useCreateConversation();

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex h-[calc(100vh-56px)] -m-6">
      {/* ── Conversation List Sidebar ───────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-800/60 bg-slate-950">
        <div className="p-4 border-b border-slate-800/60">
          <button
            onClick={() =>
              createConv({}, {
                onSuccess: (conv) => router.push(`/chat/${conv.id}`),
              })
            }
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium
              hover:from-sky-400 hover:to-indigo-400 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {convsData?.items.map((conv) => (
            <button
              key={conv.id}
              onClick={() => router.push(`/chat/${conv.id}`)}
              className={cn(
                "w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors",
                conv.id === conversationId && "bg-sky-500/5 border-r-2 border-sky-400"
              )}
            >
              <p className={cn(
                "text-sm truncate font-medium",
                conv.id === conversationId ? "text-sky-300" : "text-slate-300"
              )}>
                {conv.title ?? "Untitled"}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {conv.message_count} msgs ·{" "}
                {conv.last_message_at
                  ? formatRelativeTime(conv.last_message_at)
                  : "New"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!conversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧠</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Ask your documents</h2>
              <p className="text-slate-500 text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-slate-500 text-sm">
                    Ask anything about your documents…
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  citations={msg.citations}
                  isStreaming={msg.isStreaming}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-6 pb-6 pt-3 border-t border-slate-800/40">
              <div className="flex items-end gap-3 glass rounded-2xl border border-slate-700 px-4 py-3">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleAutoResize}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your documents… (Enter to send)"
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 resize-none outline-none text-sm leading-relaxed"
                  style={{ maxHeight: "160px" }}
                />
                {isSending ? (
                  <button
                    onClick={cancelStream}
                    aria-label="Stop generating"
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    aria-label="Send message"
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white hover:from-sky-400 hover:to-indigo-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-600 text-center mt-2">
                Shift+Enter for new line · Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
