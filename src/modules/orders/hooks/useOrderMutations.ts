/**
 * hookهای mutation سفارش‌ها — CD-09 (TanStack React Query v5).
 *
 * هر mutation بعد از موفقیت کوئری‌های مرتبط را invalidate می‌کند.
 * خطاها به‌صورت `ApiError` به کامپوننت می‌رسند (قرارداد یکپارچه خطا).
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import type {
  OrderDetail,
  OrderDetailNoMoney,
  PlanResult,
} from "../types/order.types";
import type {
  CancelOrderInput,
  CreateChequeInput,
  CreateOrderInput,
  CreatePaymentInput,
  GeneratePlanInput,
  StageAction,
  UpdateChequeInput,
  UpdateOrderInput,
  UpdatePaymentInput,
} from "../schemas/order.schema";
import { invalidateOrders } from "../queries/invalidations";

/** نوع پاسخ مشترک سرویس‌هایی که سفارش کامل را برمی‌گردانند. */
type OrderResponse = OrderDetail | OrderDetailNoMoney;

/** POST /api/orders — ایجاد پیش‌فاکتور جدید. */
export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation<OrderResponse, ApiError, CreateOrderInput>({
    mutationFn: (input) => apiFetch<OrderResponse>("/api/orders", { method: "POST", json: input }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** PATCH /api/orders/[id] — ویرایش پیش‌فاکتور (فقط در مراحل قابل ویرایش). */
export function useUpdateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation<OrderResponse, ApiError, { id: string; data: UpdateOrderInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}`, { method: "PATCH", json: data }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** POST /api/orders/[id]/stage — اقدام مرحله (۱۳ اقدام خط لوله). */
export function useStageActionMutation() {
  const queryClient = useQueryClient();
  return useMutation<OrderResponse, ApiError, { id: string; data: StageAction }>({
    mutationFn: ({ id, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}/stage`, { method: "POST", json: data }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** POST /api/orders/[id]/cancel — لغو سفارش با دلیل. */
export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation<OrderResponse, ApiError, { id: string; data: CancelOrderInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}/cancel`, { method: "POST", json: data }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** POST /api/orders/[id]/plan — تولید برنامه پرداخت با preset یا پارامتر دلخواه. */
export function useGeneratePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation<PlanResult, ApiError, { id: string; data: GeneratePlanInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<PlanResult>(`/api/orders/${id}/plan`, { method: "POST", json: data }),
    onSuccess: (_plan, { id }) => invalidateOrders(queryClient, id),
  });
}

/** POST /api/orders/[id]/payments — ثبت پرداخت دریافتی (نقدی/کارتی). */
export function useCreatePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<OrderResponse, ApiError, { id: string; data: CreatePaymentInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}/payments`, { method: "POST", json: data }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** PATCH /api/orders/[id]/payments/[pid] — باطل‌سازی یا یادداشت پرداخت. */
export function useUpdatePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    OrderResponse,
    ApiError,
    { id: string; pid: string; data: UpdatePaymentInput }
  >({
    mutationFn: ({ id, pid, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}/payments/${pid}`, {
        method: "PATCH",
        json: data,
      }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** POST /api/orders/[id]/cheques — ثبت چک دریافتی. */
export function useCreateChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation<OrderResponse, ApiError, { id: string; data: CreateChequeInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}/cheques`, { method: "POST", json: data }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** PATCH /api/orders/[id]/cheques/[cid] — وضعیت بانکی و اطلاعات چک. */
export function useUpdateChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    OrderResponse,
    ApiError,
    { id: string; cid: string; data: UpdateChequeInput }
  >({
    mutationFn: ({ id, cid, data }) =>
      apiFetch<OrderResponse>(`/api/orders/${id}/cheques/${cid}`, {
        method: "PATCH",
        json: data,
      }),
    onSuccess: (order) => invalidateOrders(queryClient, order.id),
  });
}

/** POST /api/orders/[id]/print-token — صدور توکن چاپ کوتاه‌مدت (R-01). */
export function usePrintTokenMutation() {
  return useMutation<{ token: string }, ApiError, { id: string }>({
    mutationFn: ({ id }) =>
      apiFetch<{ token: string }>(`/api/orders/${id}/print-token`, { method: "POST" }),
  });
}
