/**
 * useDocuments — React Query hooks for document CRUD and status polling.
 * Source: lib/api-client.ts → documentsClient
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  documentsClient,
  type Document,
  type DocumentListParams,
} from "@/lib/api-client";
import { uploadDocument } from "@/lib/api";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ["documents"] as const,
  list: (params?: DocumentListParams) =>
    [...documentKeys.all, "list", params] as const,
  detail: (id: string) => [...documentKeys.all, "detail", id] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useDocuments(params?: DocumentListParams) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () => documentsClient.list(params),
    staleTime: 30_000,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsClient.get(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Poll document until it reaches a terminal status. */
export function useDocumentStatus(id: string) {
  return useQuery({
    queryKey: [...documentKeys.detail(id), "poll"],
    queryFn: () => documentsClient.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (!s || ["ready", "failed", "archived"].includes(s)) return false;
      return 2_000;
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      formData,
      onProgress,
    }: {
      formData: FormData;
      onProgress?: (pct: number) => void;
    }) => uploadDocument(formData, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<Document, "title" | "description" | "tags">>;
    }) => documentsClient.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: documentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsClient.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}
