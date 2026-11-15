/**
 * hookهای mutation سرنخ‌ها — CD-09 (TanStack React Query v5).
 *
 * هر mutation بعد از موفقیت کوئری‌های مرتبط را invalidate می‌کند.
 * خطاها به‌صورت `ApiError` به کامپوننت می‌رسند (قرارداد یکپارچه خطا).
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import type { z } from "zod";
import type { LeadDetail, FollowupRow } from "../types/lead.types";
import {
  createFollowupSchema,
  createLeadSchema,
  moveStageSchema,
  updateLeadSchema,
} from "../schemas/lead.schema";
import { importLeadsSchema } from "../schemas/import.schema";
import type { ImportResult } from "../schemas/import.schema";
import { invalidateLeads } from "../queries/invalidations";

type CreateInput = z.infer<typeof createLeadSchema>;
type UpdateInput = z.infer<typeof updateLeadSchema>;
type MoveInput = z.infer<typeof moveStageSchema>;
type FollowupInput = z.infer<typeof createFollowupSchema>;
type ImportInput = z.infer<typeof importLeadsSchema>;

/** POST /api/leads — ایجاد سرنخ جدید. */
export function useCreateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation<LeadDetail, ApiError, CreateInput>({
    mutationFn: (input) => apiFetch<LeadDetail>("/api/leads", { method: "POST", json: input }),
    onSuccess: (lead) => invalidateLeads(queryClient, lead.id),
  });
}

/** PATCH /api/leads/[id] — ویرایش فیلدهای سرنخ. */
export function useUpdateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation<LeadDetail, ApiError, { id: string; data: UpdateInput }>({
    mutationFn: ({ id, data }) => apiFetch<LeadDetail>(`/api/leads/${id}`, { method: "PATCH", json: data }),
    onSuccess: (lead) => invalidateLeads(queryClient, lead.id),
  });
}

/** PATCH /api/leads/[id] — جابه‌جایی مرحله (شامل ورود به lost و بازگرداندن). */
export function useMoveLeadStageMutation() {
  const queryClient = useQueryClient();
  return useMutation<LeadDetail, ApiError, { id: string; data: MoveInput }>({
    mutationFn: ({ id, data }) => apiFetch<LeadDetail>(`/api/leads/${id}`, { method: "PATCH", json: data }),
    onSuccess: (lead) => invalidateLeads(queryClient, lead.id),
  });
}

/** POST /api/leads/[id]/followups — ثبت پیگیری («چی شد؟»). */
export function useAddFollowupMutation() {
  const queryClient = useQueryClient();
  return useMutation<FollowupRow, ApiError, { id: string; data: FollowupInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<FollowupRow>(`/api/leads/${id}/followups`, { method: "POST", json: data }),
    onSuccess: (_row, { id }) => invalidateLeads(queryClient, id),
  });
}

/** POST /api/leads/import — ورود گروهی CSV با گزارش ردیف‌به‌ردیف. */
export function useImportLeadsMutation() {
  const queryClient = useQueryClient();
  return useMutation<ImportResult, ApiError, ImportInput>({
    mutationFn: (input) => apiFetch<ImportResult>("/api/leads/import", { method: "POST", json: input }),
    onSuccess: () => invalidateLeads(queryClient),
  });
}
