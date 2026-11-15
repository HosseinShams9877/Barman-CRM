/**
 * hookهای کوئری خرید — CD-09 (TanStack React Query v5).
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
  BuyDetail,
  BuyDetailNoMoney,
  BuyListParams,
  BuyListResult,
  BuyListResultNoMoney,
} from "../types/buy.types";

/** پارامترهای لیست به‌شکل URL search params. */
function toSearchParams(params: BuyListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  sp.set("q", params.q);
  if (params.status !== null) sp.set("status", params.status);
  if (params.supplierId !== null) sp.set("supplierId", params.supplierId);
  return sp.toString();
}

type BuyListMixed = BuyListResult | BuyListResultNoMoney;

/** GET /api/buys — لیست خریدها با فیلتر وضعیت/تأمین‌کننده و جستجو. */
export function useBuysQuery(params: BuyListParams) {
  return useQuery<BuyListMixed, ApiError>({
    queryKey: queryKeys.buys.list(params),
    queryFn: () => apiFetch<BuyListMixed>(`/api/buys?${toSearchParams(params)}`),
  });
}

/** GET /api/buys/[id] — جزئیات خرید با اقلام، چک‌ها و تاریخچه وضعیت. */
export function useBuyDetailQuery(id: string | null) {
  return useQuery<BuyDetail | BuyDetailNoMoney, ApiError>({
    queryKey: queryKeys.buys.detail(id ?? ""),
    enabled: id !== null,
    queryFn: () => apiFetch<BuyDetail | BuyDetailNoMoney>(`/api/buys/${id}`),
  });
}
