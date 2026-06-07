"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, Search, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/useDocuments";
import { formatBytes, formatRelativeTime, cn, getApiErrorMessage } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/motion/Stagger";

const STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" | "info" | "neutral" }> = {
  pending: { label: "Pending", tone: "warn" },
  parsing: { label: "Parsing", tone: "info" },
  chunking: { label: "Chunking", tone: "info" },
  embedding: { label: "Embedding", tone: "info" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  archived: { label: "Archived", tone: "neutral" },
};

const TYPE_LABEL: Record<string, string> = { pdf: "PDF", docx: "DOCX", txt: "TXT", md: "MD", html: "HTML" };

function UploadZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/html": [".html"],
      "text/markdown": [".md"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer rounded-xl border border-dashed p-8 text-center transition-all duration-200",
        isDragActive ? "border-accent bg-accent-subtle" : "border-line-strong bg-surface hover:border-subtle hover:bg-sunken"
      )}
    >
      <input {...getInputProps()} />
      <div className={cn(
        "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
        isDragActive ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent" : "bg-sunken text-subtle"
      )}>
        <UploadCloud className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-fg">{isDragActive ? "Drop to upload" : "Drag & drop files"}</p>
      <p className="mt-1 text-xs text-subtle">PDF, DOCX, TXT, HTML, MD · up to 50MB</p>
      <Button variant="secondary" size="sm" className="mt-4">Browse files</Button>
    </div>
  );
}

interface UploadState { file: File; progress: number; status: "uploading" | "done" | "error"; error?: string; }

function UploadItem({ item }: { item: UploadState }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
      <FileText className="h-5 w-5 shrink-0 text-subtle" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-fg">{item.file.name}</p>
        {item.status === "uploading" && (
          <div className="mt-1.5 h-1 rounded-full bg-sunken">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${item.progress}%` }} />
          </div>
        )}
        {item.status === "error" && <p className="mt-1 text-[10px] text-danger">{item.error}</p>}
      </div>
      {item.status === "uploading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-subtle" />}
      {item.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
      {item.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-danger" />}
    </div>
  );
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useDocuments({ page, page_size: 20, status: statusFilter });
  const { mutateAsync: uploadDoc } = useUploadDocument();
  const { mutate: deleteDoc } = useDeleteDocument();

  const hasProcessing = data?.items.some((d) => ["pending", "parsing", "chunking", "embedding"].includes(d.status));
  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(() => refetch(), 3000);
    return () => clearInterval(t);
  }, [hasProcessing, refetch]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const newUploads: UploadState[] = files.map((f) => ({ file: f, progress: 0, status: "uploading" }));
      setUploads((prev) => [...newUploads, ...prev]);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name.replace(/\.[^/.]+$/, ""));
        try {
          await uploadDoc({ formData: fd, onProgress: (pct) => setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, progress: pct } : u))) });
          setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: "done", progress: 100 } : u)));
          setTimeout(() => setUploads((prev) => prev.filter((_, idx) => idx !== i)), 3000);
        } catch (err) {
          setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, status: "error", error: getApiErrorMessage(err) ?? "Upload failed" } : u));
        }
      }
    },
    [uploadDoc]
  );

  const filtered = data?.items.filter((d) =>
    search ? d.title.toLowerCase().includes(search.toLowerCase()) || d.file_name.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Library" title="Documents" subtitle={`${data?.total ?? 0} documents in your workspace`} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-3">
          <UploadZone onFiles={handleFiles} />
          {uploads.map((u, i) => <UploadItem key={`${u.file.name}-${i}`} item={u} />)}
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input type="search" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} className="field pl-9" />
            </div>
            <select value={statusFilter ?? ""} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }} className="field w-auto">
              <option value="">All status</option>
              <option value="ready">Ready</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <Card padded={false} className="overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-9 w-9" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-2 w-1/3" /></div>
                  </div>
                ))}
              </div>
            ) : !filtered?.length ? (
              <EmptyState icon={FileText} title="No documents found" description="Upload a file to get started, or adjust your filters." />
            ) : (
              <StaggerList className="divide-y divide-line">
                {filtered.map((doc) => {
                  const s = STATUS[doc.status] ?? STATUS.pending;
                  return (
                    <StaggerItem key={doc.id}>
                      <div className="group flex items-center gap-4 p-4 transition-colors hover:bg-sunken">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{TYPE_LABEL[doc.file_type] ?? doc.file_type.slice(0, 4)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{doc.title}</p>
                          <p className="text-xs text-subtle">
                            {formatBytes(doc.file_size_bytes)}{doc.page_count ? ` · ${doc.page_count} pages` : ""} · {formatRelativeTime(doc.created_at)}
                          </p>
                        </div>
                        <Badge tone={s.tone} dot pulse={["parsing", "chunking", "embedding", "pending"].includes(doc.status)}>{s.label}</Badge>
                        <button
                          aria-label="Delete document"
                          onClick={() => deleteDoc(doc.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle opacity-0 transition-all hover:bg-danger-subtle hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerList>
            )}
          </Card>

          {data && data.total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-subtle">{(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Prev</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= data.total}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
