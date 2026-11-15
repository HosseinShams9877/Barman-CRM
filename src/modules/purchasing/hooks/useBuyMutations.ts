/**
 * hookهای mutation خرید — CD-09 (TanStack React Query v5).
 *
 * هر mutation بعد از موفقیت کوئری‌های مرتبط را invalidate می‌کند:
 *  - create/update/approve/finance: فقط خانواده buys.
 *  - receive: buys + stock (ورود مواد به انبار).
 *  - payCheque: buys + finance (تغییر پرداختنی‌ها و جریان نقد).
 * خطاها به‌صورت `ApiError` به کامپوننت می‌رسند.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import type { BuyDetail, BuyDetailNoMoney } from "../types/buy.types";
import type {
  ApproveBuyInput,
  CreateBuyInput,
  FinanceBuyInput,
  ReceiveBuyInput,
  UpdateBuyInput,
} from "../schemas/buy.schema";
import { invalidateBuys } from "../queries/invalidations";

/** نوع پاسخ مشترک سرویس‌هایی که خرید کامل را برمی‌گردانند. */
type BuyResponse = BuyDetail | BuyDetailNoMoney;

/** POST /api/buys — ثبت درخواست خرید. */
export function useCreateBuyMutation() {
  const queryClient = useQueryClient();
  return useMutation<BuyResponse, ApiError, CreateBuyInput>({
    mutationFn: (input) => apiFetch<BuyResponse>("/api/buys", { method: "POST", json: input }),
    onSuccess: (buy) => invalidateBuys(queryClient, buy.id),
  });
}

/** PATCH /api/buys/[id] — ویرایش فقط در وضعیت `req`. */
export function useUpdateBuyMutation() {
  const queryClient = useQueryClient();
  return useMutation<BuyResponse, ApiError, { id: string; data: UpdateBuyInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<BuyResponse>(`/api/buys/${id}`, { method: "PATCH", json: data }),
    onSuccess: (buy) => invalidateBuys(queryClient, buy.id),
  });
}

/** POST /api/buys/[id]/approve — تأیید مدیر خرید `req → ok`. */
export function useApproveBuyMutation() {
  const queryClient = useQueryClient();
  return useMutation<BuyResponse, ApiError, { id: string; data: ApproveBuyInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<BuyResponse>(`/api/buys/${id}/approve`, { method: "POST", json: data }),
    onSuccess: (buy) => invalidateBuys(queryClient, buy.id),
  });
}

/** POST /api/buys/[id]/finance — تأیید مالی `ok → fin` + ثبت چک‌های صادره. */
export function useFinanceBuyMutation() {
  const queryClient = useQueryClient();
  return useMutation<BuyResponse, ApiError, { id: string; data: FinanceBuyInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<BuyResponse>(`/api/buys/${id}/finance`, { method: "POST", json: data }),
    onSuccess: (buy) => invalidateBuys(queryClient, buy.id, { finance: true }),
  });
}

/** POST /api/buys/[id]/receive — رسید انبار `fin → recv` + حرکت‌های `buy`. */
export function useReceiveBuyMutation() {
  const queryClient = useQueryClient();
  return useMutation<BuyResponse, ApiError, { id: string; data: ReceiveBuyInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<BuyResponse>(`/api/buys/${id}/receive`, { method: "POST", json: data }),
    onSuccess: (buy) => invalidateBuys(queryClient, buy.id, { stock: true, finance: true }),
  });
}

/** PATCH /api/buys/[id]/cheques/[cid] — چک صادره `issued → paid`. */
export function usePayBuyChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation<BuyResponse, ApiError, { id: string; cid: string }>({
    mutationFn: ({ id, cid }) =>
      apiFetch<BuyResponse>(`/api/buys/${id}/cheques/${cid}`, { method: "PATCH", json: { status: "paid" } }),
    onSuccess: (buy) => invalidateBuys(queryClient, buy.id, { finance: true }),
  });
}
