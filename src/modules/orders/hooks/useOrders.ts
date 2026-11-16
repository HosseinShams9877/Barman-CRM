/**
 * hookهای کوئری سفارش‌ها — CD-09 (TanStack React Query v5).
 *
 * fetch مستقیم در useEffect ممنوع است (CLAUDE.md §۶) — همه چیز از طریق
 * این hookها و `apiFetch` انجام می‌شود. polling پیش‌فرض ممنوع (Q-15).
 *
 * پاسخ API بسته به نقش کاربر نسخه کامل یا نسخه noMoney (R-32) است؛
 * بنابراین نوع بازگشتی اتحاد هر دو است و کامپوننت با `"calc" in row`
 * حالت را تشخیص می‌دهد.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type {
  OrderDetail,
  OrderDetailNoMoney,
  OrderListItem,
  OrderListItemNoMoney,
  OrderListParams,
  OrderListResult,
} from "../types/order.types";

/** پارامترهای لیست به‌شکل URL search params. */
function toSearchParams(params: OrderListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  sp.set("q", params.q);
  if (params.stage !== null) sp.set("stage", String(params.stage));
  if (params.status !== null) sp.set("status", params.status);
  if (params.ownerId) sp.set("ownerId", params.ownerId);
  if (params.overdue) sp.set("overdue", "1");
  if (params.incomplete) sp.set("incomplete", "1");
  if (params.bucket) sp.set("bucket", params.bucket);
  return sp.toString();
}

/** GET /api/orders — لیست سفارش‌ها با فیلتر مرحله/وضعیت/مالک و جستجو. */
export function useOrdersQuery(params: OrderListParams) {
  return useQuery<OrderListResult<OrderListItem | OrderListItemNoMoney>, ApiError>({
    queryKey: queryKeys.orders.list(params),
    queryFn: () =>
      apiFetch<OrderListResult<OrderListItem | OrderListItemNoMoney>>(
        `/api/orders?${toSearchParams(params)}`,
      ),
  });
}

/** GET /api/orders/[id] — جزئیات سفارش با اقلام، پرداخت‌ها و تاریخچه مرحله. */
export function useOrderDetailQuery(id: string | null) {
  return useQuery<OrderDetail | OrderDetailNoMoney, ApiError>({
    queryKey: queryKeys.orders.detail(id ?? ""),
    enabled: id !== null,
    queryFn: () => apiFetch<OrderDetail | OrderDetailNoMoney>(`/api/orders/${id}`),
  });
}
