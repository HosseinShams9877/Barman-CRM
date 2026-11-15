/**
 * hook جزئیات حساب — CD-09.
 *
 * جزئیات شامل مخاطبین کامل است (برخلاف آیتم لیست که فقط شمارش می‌دهد).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { AccountDetail } from "../types/account.types";

/** GET /api/customers/[id] — جزئیات حساب با مخاطبین. */
export function useAccountQuery(id: string | null) {
  return useQuery<AccountDetail, ApiError>({
    queryKey: queryKeys.customers.detail(id ?? ""),
    enabled: id !== null,
    queryFn: () => apiFetch<AccountDetail>(`/api/customers/${id}`),
  });
}
