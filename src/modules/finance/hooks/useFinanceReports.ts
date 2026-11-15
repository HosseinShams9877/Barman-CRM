/**
 * hookهای کوئری گزارش‌های مالی — CD-09 (TanStack React Query v5).
 *
 * fetch مستقیم در useEffect ممنوع است (CLAUDE.md §۶). polling ممنوع (Q-15).
 *
 * پاسخ API بسته به نقش کاربر نسخه کامل یا نسخه noMoney (R-32) است؛
 * نوع بازگشتی اتحاد هر دو است.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type {
  CashflowResult,
  CashflowResultNoMoney,
  PayablesResult,
  PayablesResultNoMoney,
  ReceivablesResult,
  ReceivablesResultNoMoney,
} from "../types/finance.types";

/** GET /api/finance/receivables — مطالبات تجمیع‌شده بر اساس حساب. */
export function useReceivablesQuery() {
  return useQuery<ReceivablesResult | ReceivablesResultNoMoney, ApiError>({
    queryKey: queryKeys.finance.receivables(),
    queryFn: () =>
      apiFetch<ReceivablesResult | ReceivablesResultNoMoney>("/api/finance/receivables"),
  });
}

/** GET /api/finance/payables — پرداختنی‌ها تجمیع‌شده بر اساس تأمین‌کننده. */
export function usePayablesQuery() {
  return useQuery<PayablesResult | PayablesResultNoMoney, ApiError>({
    queryKey: queryKeys.finance.payables(),
    queryFn: () => apiFetch<PayablesResult | PayablesResultNoMoney>("/api/finance/payables"),
  });
}

/** GET /api/finance/cashflow — جریان نقدی ماهانه (bucketing JDN). */
export function useCashflowQuery(month: string | null) {
  return useQuery<CashflowResult | CashflowResultNoMoney, ApiError>({
    queryKey: queryKeys.finance.cashflow(month),
    queryFn: () =>
      apiFetch<CashflowResult | CashflowResultNoMoney>(
        month ? `/api/finance/cashflow?month=${encodeURIComponent(month)}` : "/api/finance/cashflow",
      ),
  });
}
