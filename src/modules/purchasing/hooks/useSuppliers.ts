/**
 * hookهای کوئری تأمین‌کنندگان — فقط‌خواندن (PHASE_06 §۵).
 *
 * داده‌ها برای فرم خرید لازم‌اند (انتخاب تأمین‌کننده)؛ هیچ mutationی در
 * این فاز وجود ندارد (مدیریت تأمین‌کننده فاز ۷ است).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { SupplierRow } from "../types/supplier.types";

/** کلید اختصاصی برای فهرست تأمین‌کنندگان (زیر کلید خرید — CD-09). */
const suppliersKey = [...queryKeys.buys.all, "suppliers"] as const;

/** GET /api/suppliers — فهرست تأمین‌کنندگان مواد خام. */
export function useSuppliersQuery() {
  return useQuery<SupplierRow[], ApiError>({
    queryKey: suppliersKey,
    queryFn: () => apiFetch<SupplierRow[]>("/api/suppliers"),
  });
}
