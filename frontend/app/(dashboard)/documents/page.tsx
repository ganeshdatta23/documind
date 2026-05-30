"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, Search, Filter,
  MoreVertical, Trash2, ExternalLink,
  CheckCircle2, AlertCircle, Loader2, Clock,
} from "lucide-react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/useDocuments";
import { formatBytes, formatRelativeTime, DOC_STATUS_CONFIG, type DocStatus, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ─── Upload Zone ──────────────────────────────────────────────────────────

function UploadZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/html": [".html"],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200",
        isDragActive
          ? "border-sky-400 bg-sky-400/5 scale-[1.01]"
          : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
      )}
    >
      <input {...getInputProps()} />
      <div className={cn(
        "w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors",
        isDragActive ? "bg-sky-400/20" : "bg-slate-800"
      )}>
        <Upload className={cn("w-6 h-6", isDragActive ? "text-sky-400" : "text-slate-500")} />
      </div>
      <p className="text-sm font-medium text-slate-300 mb-1">
        {isDragActive ? "Drop to upload" : "Drag & drop files here"}
      </p>
      <p className="text-xs text-slate-500">PDF, DOCX, TXT, HTML · Max 100MB</p>
      <Button variant="secondary" size="sm" className="mt-4">
        Browse files
      </Button>
    </div>
  );
}

// ─── Upload Progress Item ──────────────────────────────────────────────────

interface UploadState {
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

function UploadItem({ item }: { item: UploadState }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
      <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{item.file.name}</p>
        {item.status === "uploading" && (
          <div className="mt-1.5 h-1 rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === "error" && (
          <p className="text-[10px] text-red-400 mt-1">{item.error}</p>
        )}
      </div>
      {item.status === "uploading" && (
        <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />
      )}
      {item.status === "done" && (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      )}
      {item.status === "error" && (
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      )}
    </div>
  );
}

// ─── Document Row ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status as DocStatus] ?? DOC_STATUS_CONFIG.pending;
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", cfg.bg, cfg.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", docx: "📝", txt: "📃", html: "🌐",
};

// ─── Documents Page ────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useDocuments({
    page,
    page_size: 20,
    status: statusFilter,
  });

  const { mutateAsync: uploadDoc } = useUploadDocument();
  const { mutate: deleteDoc } = useDeleteDocument();

  const handleFiles = useCallback(
    async (files: File[]) => {
      const newUploads: UploadState[] = files.map((f) => ({
        file: f, progress: 0, status: "uploading",
      }));
      setUploads((prev) => [...newUploads, ...prev]);

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name.replace(/\.[^/.]+$/, ""));

        try {
          await uploadDoc({
            formData: fd,
            onProgress: (pct) => {
              setUploads((prev) =>
                prev.map((u, idx) => (idx === i ? { ...u, progress: pct } : u))
              );
            },
          });
          setUploads((prev) =>
            prev.map((u, idx) => (idx === i ? { ...u, status: "done", progress: 100 } : u))
          );
          setTimeout(() => {
            setUploads((prev) => prev.filter((_, idx) => idx !== i));
          }, 3000);
        } catch (err: any) {
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i
                ? { ...u, status: "error", error: err.response?.data?.error?.message ?? "Upload failed" }
                : u
            )
          );
        }
      }
    },
    [uploadDoc]
  );

  const filtered = data?.items.filter((d) =>
    search
      ? d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.file_name.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.total ?? 0} documents in your workspace
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upload */}
        <div className="space-y-3">
          <UploadZone onFiles={handleFiles} />
          {uploads.map((u, i) => (
            <UploadItem key={`${u.file.name}-${i}`} item={u} />
          ))}
        </div>

        {/* Document list */}
        <div className="xl:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="search"
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all"
              />
            </div>
            <select
              value={statusFilter ?? ""}
              onChange={(e) => setStatusFilter(e.target.value || undefined)}
              className="px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              <option value="">All status</option>
              <option value="ready">Ready</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Table */}
          <div className="glass rounded-2xl border border-slate-800 overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-slate-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded bg-slate-800 animate-pulse w-2/3" />
                      <div className="h-2 rounded bg-slate-800 animate-pulse w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No documents found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filtered?.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-800/40 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg flex-shrink-0">
                      {FILE_ICONS[doc.file_type] ?? "📎"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(doc.file_size_bytes)} ·{" "}
                        {doc.page_count ? `${doc.page_count} pages · ` : ""}
                        {formatRelativeTime(doc.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                    <button
                      aria-label="Delete document"
                      onClick={() => deleteDoc(doc.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                  Prev
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= data.total}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
