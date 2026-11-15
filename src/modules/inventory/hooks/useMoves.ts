/**
 * hookهای کوئری انبار — حرکت‌ها و موجودی (CD-09 / CLAUDE.md §۶).
 *
 * fetch مستقیم در useEffect ممنوع است — همه چیز از طریق این hookها و
 * `apiFetch` انجام می‌شود. polling پیش‌فرض ممنوع (Q-15).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type {
  MoveListParams,
  MoveListResult,
  StockRow,
  StockRowNoMoney,
  StockAlert,
} from "../types/move.types";

/** پارامترهای لیست حرکت‌ها به‌شکل URL search params. */
function toSearchParams(params: MoveListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  sp.set("q", params.q);
  if (params.wh !== null) sp.set("wh", params.wh);
  if (params.kind !== null) sp.set("kind", params.kind);
  return sp.toString();
}

/** GET /api/moves — لیست حرکت‌ها با فیلتر انبار/نوع و جستجو. */
export function useMovesQuery(params: MoveListParams) {
  return useQuery<MoveListResult, ApiError>({
    queryKey: queryKeys.moves.list({
      wh: params.wh,
      kind: params.kind,
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
    }),
    queryFn: () => apiFetch<MoveListResult>(`/api/moves?${toSearchParams(params)}`),
  });
}

/**
 * GET /api/stock — موجودی تجمعی همه اقلام.
 *
 * سرور فیلتر `wh` ندارد و هر دو انبار را در یک پاسخ برمی‌گرداند؛
 * کلاینت بر اساس `wh` فیلتر می‌کند (CD-09 — کلید query شامل wh است).
 */
export function useStockQuery(wh: "raw" | "depot" | null) {
  return useQuery<StockRow[] | StockRowNoMoney[], ApiError>({
    queryKey: queryKeys.stock.list(wh),
    queryFn: () =>
      apiFetch<{ items: StockRow[] | StockRowNoMoney[] }>("/api/stock").then(
        (r) => r.items,
      ),
    select: (items) =>
      wh === null ? items : items.filter((row) => row.wh === wh),
  });
}

/** GET /api/stock/alerts — مواد زیر آستانه حداقل (app/stock.js:۲۷). */
export function useStockAlertsQuery() {
  return useQuery<{ items: StockAlert[] }, ApiError>({
    queryKey: queryKeys.stock.alerts(),
    queryFn: () => apiFetch<{ items: StockAlert[] }>("/api/stock/alerts"),
  });
}
