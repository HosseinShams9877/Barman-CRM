/**
 * StockView — موجودی انبارها (PHASE_05 §۱۰).
 *
 * repr: depotView/rawView در Demo (app/stock.js:۱۸-۳۸) — موجودی، رزرو،
 * آزاد و مصرف ۳۰ روز. موجودی **همیشه** از حرکت‌ها محاسبه می‌شود —
 * هیچ فیلد موجودی ذخیره نمی‌شود (CD-08 / app/core.js:۲۰۶).
 *
 * مبالغ فقط برای نقش‌های دارای money.view نمایش داده می‌شوند —
 * نسخه noMoney فیلدهای price/value را ندارد (R-32 — فیلتر سمت سرور).
 *
 * هشدار کسری آستانه min در همین صفحه نشان داده می‌شود
 * (app/stock.js:۲۷: `m.min && h < m.min`).
 */
"use client";

import { useState } from "react";
import { Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney } from "@core/formatting";
import { toFaDigits } from "@core/formatting";
import { useStockQuery, useStockAlertsQuery } from "../hooks/useMoves";
import { WAREHOUSE_LABELS } from "../constants";
import type { Warehouse } from "../constants";
import type { StockRow, StockRowNoMoney } from "../types/move.types";

type Row = StockRow | StockRowNoMoney;

/**
 * صفحه موجودی — انتخاب انبار (هر دو/مواد/دپو) و فیلتر کسری.
 */
export function StockView() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canSeeMoney = permissions.has("money.view");

  const [wh, setWh] = useState<Warehouse>("raw");
  const query = useStockQuery(wh);
  const alerts = useStockAlertsQuery();

  const atWh = wh === "raw" ? WAREHOUSE_LABELS.raw : WAREHOUSE_LABELS.depot;

  const moneyColumns = canSeeMoney
    ? [
        {
          key: "price" as const,
          header: "قیمت واحد",
          render: (row: Row) =>
            "price" in row ? <span dir="ltr">{formatMoney(row.price)} ریال</span> : null,
        },
        {
          key: "value" as const,
          header: "ارزش",
          render: (row: Row) =>
            "value" in row ? <span dir="ltr">{formatMoney(row.value)} ریال</span> : null,
        },
      ]
    : [];

  return (
    <>
      <div className="page-head">
        <h1 className="h1">موجودی انبار</h1>
      </div>

      {alerts.data && alerts.data.items.length > 0 ? (
        <Card>
          <div className="stack gap-2">
            <h2 className="h3">هشدار کسری مواد</h2>
            <ul className="stack gap-1">
              {alerts.data.items.map((a) => (
                <li key={a.itemId} className="text-sm">
                  <strong>{a.name}</strong> — موجودی{" "}
                  <span dir="ltr">{toFaDigits(round3(a.onHand))} {a.unit}</span> کمتر از
                  حداقل <span dir="ltr">{toFaDigits(round3(a.min))}</span> است (کمبود{" "}
                  <span dir="ltr">{toFaDigits(round3(a.shortfall))} {a.unit}</span>).
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="toolbar">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="stock-wh">
              انبار
            </label>
            <select
              id="stock-wh"
              className="select"
              value={wh}
              onChange={(e) => setWh(e.target.value as Warehouse)}
            >
              {(Object.keys(WAREHOUSE_LABELS) as Warehouse[]).map((k) => (
                <option key={k} value={k}>
                  {WAREHOUSE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال محاسبه موجودی…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت موجودی."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.length === 0 ? (
        <EmptyState
          title="موردی در این انبار وجود ندارد"
          description={`هنوز حرکتی برای ${atWh} ثبت نشده است — موجودی از مجموع حرکت‌ها محاسبه می‌شود.`}
        />
      ) : (
        <DataTable
          caption={`موجودی ${atWh}`}
          rowKey={(row: Row) => `${row.wh}|${row.itemId}`}
          rows={query.data ?? []}
          columns={[
            {
              key: "name",
              header: "قلم",
              render: (row: Row) => (
                <span>
                  {row.name} <span className="text-muted" dir="ltr">({row.code})</span>
                </span>
              ),
            },
            {
              key: "onHand",
              header: "موجودی",
              render: (row: Row) => (
                <span dir="ltr">
                  {toFaDigits(round3(row.onHand))} {row.unit}
                </span>
              ),
            },
            {
              key: "reserved",
              header: "رزرو سفارش‌ها",
              render: (row: Row) => (
                <span dir="ltr">{toFaDigits(round3(row.reserved))}</span>
              ),
            },
            {
              key: "free",
              header: "آزاد",
              render: (row: Row) => (
                <span dir="ltr">
                  {toFaDigits(round3(row.free))} {row.unit}
                </span>
              ),
            },
            {
              key: "used30",
              header: "مصرف ۳۰ روز",
              render: (row: Row) =>
                row.wh === "raw" ? (
                  <span dir="ltr">{toFaDigits(round3(row.used30))}</span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: "min",
              header: "حداقل",
              render: (row: Row) =>
                row.min > 0 ? (
                  <span dir="ltr">{toFaDigits(round3(row.min))}</span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            ...moneyColumns,
            {
              key: "status",
              header: "وضعیت",
              render: (row: Row) =>
                row.min > 0 && row.onHand < row.min ? (
                  <span className="tag-chip" data-tone="danger">
                    زیر حداقل
                  </span>
                ) : (
                  <span className="tag-chip" data-tone="success">
                    کافی
                  </span>
                ),
            },
          ]}
        />
      )}
    </>
  );
}

/** گردسازی ۳ رقم برای نمایش (همان round3 در Demo — app/core.js:۱۲). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
