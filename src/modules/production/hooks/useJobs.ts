/**
 * hookهای کوئری کارهای تولید — CD-09 / CLAUDE.md §۶.
 *
 * fetch مستقیم در useEffect ممنوع است — همه چیز از طریق این hookها و
 * `apiFetch` انجام می‌شود. polling پیش‌فرض ممنوع (Q-15).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { JobDetail, JobListParams, JobListResult } from "../types/job.types";

/** پارامترهای لیست کارها به‌شکل URL search params. */
function toSearchParams(params: JobListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  sp.set("q", params.q);
  if (params.status !== null) sp.set("status", params.status);
  return sp.toString();
}

/** GET /api/jobs — لیست کارهای تولید با فیلتر وضعیت و جستجو. */
export function useJobsQuery(params: JobListParams) {
  return useQuery<JobListResult, ApiError>({
    queryKey: queryKeys.jobs.list({
      status: params.status,
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
    }),
    queryFn: () => apiFetch<JobListResult>(`/api/jobs?${toSearchParams(params)}`),
  });
}

/** GET /api/jobs/[id] — جزئیات کار با پیش‌نمایش BOM ذخیره‌شده. */
export function useJobDetailQuery(id: string | null) {
  return useQuery<JobDetail, ApiError>({
    queryKey: queryKeys.jobs.detail(id ?? ""),
    enabled: id !== null,
    queryFn: () => apiFetch<JobDetail>(`/api/jobs/${id}`),
  });
}
