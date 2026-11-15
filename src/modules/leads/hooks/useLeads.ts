/**
 * hookهای کوئری سرنخ‌ها — CD-09 (TanStack React Query v5).
 *
 * fetch مستقیم در useEffect ممنوع است (CLAUDE.md §۶) — همه چیز از طریق
 * این hookها و `apiFetch` انجام می‌شود. polling پیش‌فرض ممنوع (Q-15).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { z } from "zod";
import type { FollowupRow, LeadDetail, LeadListResult } from "../types/lead.types";
import { listLeadsQuerySchema } from "../schemas/lead.schema";

type ListQuery = z.infer<typeof listLeadsQuerySchema>;

/** پارامترهای لیست سرنخ‌ها — در کلید query می‌نشیند (cache به ازای فیلتر). */
export type LeadListParams = ListQuery;

/** پارامترهای لیست به‌شکل URL search params. */
function toSearchParams(params: ListQuery): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  sp.set("q", params.q);
  if (params.line) sp.set("line", params.line);
  if (params.stage) sp.set("stage", params.stage);
  if (params.ownerId) sp.set("ownerId", params.ownerId);
  return sp.toString();
}

/** GET /api/leads — لیست سرنخ‌ها با فیلتر خط/مرحله/کارشناس و جستجو. */
export function useLeadsQuery(params: LeadListParams) {
  return useQuery<LeadListResult, ApiError>({
    queryKey: queryKeys.leads.list({
      line: params.line ?? null,
      stage: params.stage ?? null,
      ownerId: params.ownerId ?? null,
      q: params.q,
    }),
    queryFn: () => apiFetch<LeadListResult>(`/api/leads?${toSearchParams(params)}`),
  });
}

/** GET /api/leads/[id] — جزئیات سرنخ با تاریخچه پیگیری. */
export function useLeadDetailQuery(id: string | null) {
  return useQuery<LeadDetail, ApiError>({
    queryKey: queryKeys.leads.detail(id ?? ""),
    enabled: id !== null,
    queryFn: () => apiFetch<LeadDetail>(`/api/leads/${id}`),
  });
}

/** GET /api/leads/[id]/followups — تاریخچه پیگیری سرنخ. */
export function useLeadFollowupsQuery(id: string | null) {
  return useQuery<FollowupRow[], ApiError>({
    queryKey: queryKeys.leads.followups(id ?? ""),
    enabled: id !== null,
    queryFn: () => apiFetch<FollowupRow[]>(`/api/leads/${id}/followups`),
  });
}
