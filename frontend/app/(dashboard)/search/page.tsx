"use client";

import { useState } from "react";
import { Search as SearchIcon, FileText, Sparkles, Layers, Zap } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { StaggerList, StaggerItem } from "@/components/motion/Stagger";
import type { ChunkResult } from "@/lib/api-client";

type Mode = "hybrid" | "vector" | "bm25";

const SEGMENTS = [
  { id: "hybrid", label: "Hybrid", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "vector", label: "Semantic", icon: <Layers className="h-3.5 w-3.5" /> },
  { id: "bm25", label: "Keyword", icon: <Zap className="h-3.5 w-3.5" /> },
];

function ScoreBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[10px] uppercase tracking-wide text-subtle">{label}</span>
      <div className="h-1 flex-1 rounded-full bg-sunken">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-[10px] tabular-nums text-muted">{value.toFixed(3)}</span>
    </div>
  );
}

function ResultCard({ r }: { r: ChunkResult }) {
  return (
    <Card padded={false} className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-subtle">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-h4 text-fg">{r.document_title}</p>
            {r.page_number != null && <Badge tone="neutral">p.{r.page_number}</Badge>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{r.excerpt || r.content.slice(0, 280)}</p>
          <div className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <ScoreBar label="rrf" value={r.rrf_score} color="var(--accent)" />
            <ScoreBar label="rerank" value={r.rerank_score} color="var(--info)" />
            <ScoreBar label="vector" value={r.vector_score} color="var(--success)" />
            <ScoreBar label="bm25" value={r.bm25_score} color="var(--warn)" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("hybrid");
  const { mutate, data, isPending, error } = useSearch();

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    mutate({ query: query.trim(), search_mode: mode, top_k: 10 });
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Retrieval" title="Search" subtitle="Hybrid semantic + keyword search across your knowledge base." />

      <form onSubmit={runSearch} className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question or search for keywords…"
            className="field py-4 pl-12 pr-28 text-base"
          />
          <button type="submit" disabled={!query.trim() || isPending} className="btn btn-primary absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 text-sm">
            {isPending ? <Spinner className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
            Search
          </button>
        </div>
        <Segmented<Mode> segments={SEGMENTS} value={mode} onChange={setMode} />
      </form>

      {error && (
        <Card className="border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-subtle">
          <p className="text-sm text-danger">Search failed. Please try again.</p>
        </Card>
      )}

      {isPending && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-xl shimmer" />)}</div>}

      {!isPending && data && (
        <>
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>{data.total_results} results · {data.search_mode} mode</span>
            <span>{data.retrieval_latency_ms}ms</span>
          </div>
          {data.results.length === 0 ? (
            <EmptyState icon={SearchIcon} title="No matches found" description="Try rephrasing your query or switching search modes." />
          ) : (
            <StaggerList className="space-y-3">
              {data.results.map((r) => <StaggerItem key={r.chunk_id}><ResultCard r={r} /></StaggerItem>)}
            </StaggerList>
          )}
        </>
      )}

      {!isPending && !data && !error && (
        <EmptyState icon={SearchIcon} title="Search your documents" description="Enter a question or keywords above. Hybrid mode blends semantic meaning with exact keyword relevance." />
      )}
    </div>
  );
}
