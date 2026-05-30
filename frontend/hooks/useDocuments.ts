/**
 * useDocuments — React Query hooks for document CRUD and status polling.
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { documentsApi, type Document, type DocumentListParams } from "@/lib/api";

export const documentKeys = {
  all: ["documents"] as const,
  list: (params?: DocumentListParams) => [...documentKeys.all, "list", params] as const,
  detail: (id: string) => [...documentKeys.all, "detail", id] as const,
};

export function useDocuments(params?: DocumentListParams) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () => documentsApi.list(params),
    staleTime: 30_000,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      formData,
      onProgress,
    }: {
      formData: FormData;
      onProgress?: (pct: number) => void;
    }) => documentsApi.upload(formData, onProgress),
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
    }) => documentsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: documentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

/** Poll document status until terminal state. */
export function useDocumentStatus(id: string, enabled = true) {
  return useQuery({
    queryKey: [...documentKeys.detail(id), "status"],
    queryFn: () => documentsApi.get(id),
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || ["ready", "failed", "archived"].includes(status)) return false;
      return 2000; // poll every 2 seconds while processing
    },
  });
}
