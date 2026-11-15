/**
 * hookهای گزارش‌ها — CD-09 (TanStack React Query v5).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { LeadsReport } from "../services/leads.report";
import type { SalesReport } from "../services/sales.report";
import type { ProdReport } from "../services/prod.report";
import type { FinReport } from "../services/fin.report";
import type { ReportKind } from "../schemas/report-query.schema";

/** پارامترهای گزارش — در کلید query می‌نشیند (cache به ازای فیلترها). */
export type ReportParams = {
  kind: ReportKind;
  days: number;
  line: "prod" | "agency" | null;
};

/** GET /api/reports/[kind] — گزارش تجمیعی با bucketing ماهانه (رفع R-11). */
export function useReportQuery(params: ReportParams) {
  const qs = new URLSearchParams({ days: String(params.days) });
  if (params.line) qs.set("line", params.line);
  return useQuery<LeadsReport | SalesReport | ProdReport | FinReport, ApiError>({
    queryKey: queryKeys.reports.byKind(params.kind, params.days, params.line),
    queryFn: () =>
      apiFetch<LeadsReport | SalesReport | ProdReport | FinReport>(
        `/api/reports/${params.kind}?${qs.toString()}`,
      ),
  });
}
