/**
 * hookهای لیست حساب‌ها — CD-09 (TanStack React Query v5).
 *
 * fetch مستقیم در useEffect ممنوع است (CLAUDE.md §۶) — همه چیز از طریق
 * این hookها و `apiFetch` انجام می‌شود.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { AccountDetail, AccountListResult } from "../types/account.types";
import { invalidateAccounts } from "../queries/invalidations";
import type { z } from "zod";
import {
  createAccountSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from "../schemas/account.schema";

type CreateInput = z.infer<typeof createAccountSchema>;
type UpdateInput = z.infer<typeof updateAccountSchema>;

/** پارامترهای لیست — در کلید query می‌نشیند (cache به ازای فیلترها). */
export type AccountListParams = z.infer<typeof listAccountsQuerySchema>;

/** GET /api/customers — لیست حساب‌ها با جستجو و صفحه‌بندی. */
export function useAccountsQuery(params: AccountListParams) {
  const { page, pageSize, q, includeInactive } = params;
  return useQuery<AccountListResult, ApiError>({
    queryKey: queryKeys.customers.list({ q, page, pageSize, includeInactive }),
    queryFn: () =>
      apiFetch<AccountListResult>(
        `/api/customers?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&includeInactive=${includeInactive ? 1 : 0}`,
      ),
  });
}

/** POST /api/customers — ایجاد حساب (phones/contacts اختیاری). */
export function useCreateAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation<AccountDetail, ApiError, CreateInput>({
    mutationFn: (input) =>
      apiFetch<AccountDetail>("/api/customers", { method: "POST", json: input }),
    onSuccess: (account) => invalidateAccounts(queryClient, account.id),
  });
}

/**
 * PATCH /api/customers/[id] — ویرایش حساب.
 *
 * `phones`/`contacts` ارسالی جایگزین کامل می‌شوند؛ کلاینت باید ویرایش
 * را با دانستن این موضوع انجام دهد (سرویس مستند است).
 */
export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation<AccountDetail, ApiError, { id: string; data: UpdateInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<AccountDetail>(`/api/customers/${id}`, { method: "PATCH", json: data }),
    onSuccess: (account) => invalidateAccounts(queryClient, account.id),
  });
}

/** POST /api/customers/[id]/deactivate — غیرفعال‌سازی حساب. */
export function useDeactivateAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/customers/${id}/deactivate`, { method: "POST" }),
    onSuccess: (_void, id) => invalidateAccounts(queryClient, id),
  });
}
