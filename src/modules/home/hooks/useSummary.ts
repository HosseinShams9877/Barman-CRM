/**
 * hook خلاصه داشبورد خانه — CD-09 (TanStack React Query v5).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { DashboardSummary } from "../services/summary.service";

/** GET /api/home/summary — خلاصه عملکرد داشبورد (PHASE_07 §۱۰). */
export function useSummaryQuery() {
  return useQuery<DashboardSummary, ApiError>({
    queryKey: queryKeys.home.summary(),
    queryFn: () => apiFetch<DashboardSummary>("/api/home/summary"),
  });
}
