/**
 * hookهای mutation کارهای تولید — CD-09 (TanStack React Query v5).
 *
 * هر mutation بعد از موفقیت کارها و موجودی انبار را invalidate می‌کند
 * (شروع و دریافت کار حرکت می‌سازند — CD-08). خطاها به‌صورت `ApiError`
 * به کامپوننت می‌رسند.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import type { JobDetail } from "../types/job.types";
import type {
  CreateJobInput,
  QcInput,
  ReceiveInput,
  UpdateJobInput,
} from "../types/job.types";
import { invalidateProduction } from "../queries/invalidations";

/** POST /api/jobs — ایجاد کار تولید جدید با پیش‌نمایش BOM. */
export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobDetail, ApiError, CreateJobInput>({
    mutationFn: (input) => apiFetch<JobDetail>("/api/jobs", { method: "POST", json: input }),
    onSuccess: (job) => invalidateProduction(queryClient, job.id),
  });
}

/** PATCH /api/jobs/[id] — گذار وضعیت run → qc (data-jmade در Demo). */
export function useUpdateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobDetail, ApiError, { id: string; data: UpdateJobInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<JobDetail>(`/api/jobs/${id}`, { method: "PATCH", json: data }),
    onSuccess: (job) => invalidateProduction(queryClient, job.id),
  });
}

/** POST /api/jobs/[id]/start — plan → run با کسر مواد (use moves). */
export function useStartJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobDetail, ApiError, string>({
    mutationFn: (id) => apiFetch<JobDetail>(`/api/jobs/${id}/start`, { method: "POST" }),
    onSuccess: (job) => invalidateProduction(queryClient, job.id),
  });
}

/** POST /api/jobs/[id]/qc — qc → sent با ثبت سالم/ضایعات. */
export function useQcJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobDetail, ApiError, { id: string; data: QcInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<JobDetail>(`/api/jobs/${id}/qc`, { method: "POST", json: data }),
    onSuccess: (job) => invalidateProduction(queryClient, job.id),
  });
}

/** POST /api/jobs/[id]/receive — sent → done + حرکت job در دپو. */
export function useReceiveJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobDetail & { warning: string | null }, ApiError, { id: string; data?: ReceiveInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<JobDetail & { warning: string | null }>(`/api/jobs/${id}/receive`, {
        method: "POST",
        json: data ?? {},
      }),
    onSuccess: (job) => invalidateProduction(queryClient, job.id),
  });
}
