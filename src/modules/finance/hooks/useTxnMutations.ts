/**
 * hookهای mutation تراکنش‌های مالی — CD-09 (TanStack React Query v5).
 *
 * ثبت تراکنش هر دو خانواده txns و گزارش جریان نقدی (finance) را تغییر
 * می‌دهد، پس هر دو invalidate می‌شوند. خطاها به‌صورت `ApiError` به
 * کامپوننت می‌رسند.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import type { CreateTxnInput } from "../schemas/txn.schema";
import type { TxnRow, TxnRowNoMoney } from "../types/txn.types";
import { invalidateFinance } from "../queries/invalidations";

type TxnResponse = TxnRow | TxnRowNoMoney;

/** POST /api/txns — ثبت هزینه/دریافت متفرقه. */
export function useCreateTxnMutation() {
  const queryClient = useQueryClient();
  return useMutation<TxnResponse, ApiError, CreateTxnInput>({
    mutationFn: (input) => apiFetch<TxnResponse>("/api/txns", { method: "POST", json: input }),
    onSuccess: () => invalidateFinance(queryClient),
  });
}
