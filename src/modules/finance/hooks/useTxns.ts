/**
 * hookهای کوئری تراکنش‌های مالی — CD-09 (TanStack React Query v5).
 *
 * fetch مستقیم در useEffect ممنوع است (CLAUDE.md §۶). polling ممنوع (Q-15).
 *
 * پاسخ API بسته به نقش کاربر نسخه کامل یا نسخه noMoney (R-32) است؛
 * نوع بازگشتی اتحاد هر دو است و کامپوننت با `"amount" in row` حالت را
 * تشخیص می‌دهد.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { TxnListParams } from "../types/txn.types";
import type { TxnRow, TxnRowNoMoney } from "../types/txn.types";

/** پارامترهای لیست به‌شکل URL search params. */
function toSearchParams(params: TxnListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.kind !== null) sp.set("kind", params.kind);
  if (params.direction !== null) sp.set("direction", params.direction);
  if (params.q.length > 0) sp.set("q", params.q);
  return sp.toString();
}

type TxnListMixed = {
  items: (TxnRow | TxnRowNoMoney)[];
  total: number;
  page: number;
  pageSize: number;
};

/** GET /api/txns — لیست تراکنش‌ها با فیلتر نوع/جهت. */
export function useTxnsQuery(params: TxnListParams) {
  return useQuery<TxnListMixed, ApiError>({
    queryKey: queryKeys.txns.list(params),
    queryFn: () => apiFetch<TxnListMixed>(`/api/txns?${toSearchParams(params)}`),
  });
}
