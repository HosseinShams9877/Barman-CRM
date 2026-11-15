/**
 * TxnsView — لیست تراکنش‌های مالی (PHASE_06 §۶).
 *
 * فیلتر نوع (۸ گزینه ثابت app/fin.js:145) و جهت، صفحه‌بندی و دکمه ثبت
 * تراکنش جدید. مبالغ فقط برای نقش‌های دارای `money.view` نمایش داده
 * می‌شوند — نسخه noMoney فیلد `amount` ندارد (R-32 — فیلتر سمت سرور،
 * تشخیص در کلاینت با `"amount" in row`).
 *
 * حالت‌های Loading/Error/Empty اجباری (CD-09).
 */
"use client";

import { useState } from "react";
import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { formatJalaliFa, parseJalali } from "@core/calendar";
import { EXPENSE_KIND_LABELS, toDisplayKind } from "../constants";
import type { TxnDirection } from "../constants";
import type { TxnRow, TxnRowNoMoney } from "../types/txn.types";
import { useTxnsQuery } from "../hooks/useTxns";
import { TxnDialog } from "./TxnDialog";

const PAGE_SIZE = 20;

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string): string {
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

export function TxnsView() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canCreate = permissions.has("finance.edit");
  const canSeeMoney = permissions.has("money.view");

  const [kind, setKind] = useState<string>("");
  const [direction, setDirection] = useState<string>("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useTxnsQuery({
    kind: kind.length > 0 ? kind : null,
    direction: direction.length > 0 ? (direction as TxnDirection) : null,
    q: "",
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  type Row = TxnRow | TxnRowNoMoney;

  return (
    <>
      <Card>
        <form
          className="toolbar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="txns-kind">
              نوع
            </label>
            <select
              id="txns-kind"
              className="select"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه نوع‌ها</option>
              {EXPENSE_KIND_LABELS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="txns-direction">
              جهت
            </label>
            <select
              id="txns-direction"
              className="select"
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه جهت‌ها</option>
              <option value="income">دریافت</option>
              <option value="expense">پرداخت</option>
            </select>
          </div>
        </form>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال بارگذاری تراکنش‌ها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت تراکنش‌ها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          title="تراکنشی وجود ندارد"
          description={
            kind.length > 0 || direction.length > 0
              ? "نتیجه‌ای برای فیلترهای شما پیدا نشد."
              : "هنوز هزینه یا دریافت متفرقه‌ای ثبت نشده است."
          }
          action={
            canCreate ? <Button onClick={() => setDialogOpen(true)}>ثبت اولین تراکنش</Button> : undefined
          }
        />
      ) : (
        <>
          <DataTable
            caption="فهرست تراکنش‌های مالی"
            rowKey={(row) => row.id}
            rows={query.data?.items ?? []}
            columns={[
              {
                key: "kind",
                header: "نوع",
                render: (row: Row) => <span>{toDisplayKind(row.kind)}</span>,
              },
              {
                key: "direction",
                header: "جهت",
                render: (row: Row) => (
                  <span
                    className="tag-chip"
                    data-tone={row.direction === "income" ? "success" : "warning"}
                  >
                    {row.direction === "income" ? "دریافت" : "پرداخت"}
                  </span>
                ),
              },
              ...(canSeeMoney
                ? [
                    {
                      key: "amount" as const,
                      header: "مبلغ",
                      render: (row: Row) =>
                        "amount" in row ? (
                          <span dir="ltr">{formatMoney(row.amount)} ریال</span>
                        ) : (
                          <span className="text-muted">—</span>
                        ),
                    },
                  ]
                : []),
              {
                key: "who",
                header: "طرف مقابل",
                render: (row: Row) =>
                  row.who ? <span>{row.who}</span> : <span className="text-muted">—</span>,
              },
              {
                key: "note",
                header: "یادداشت",
                render: (row: Row) =>
                  row.note ? <span>{row.note}</span> : <span className="text-muted">—</span>,
              },
              {
                key: "byName",
                header: "ثبت‌کننده",
                render: (row: Row) =>
                  row.byName ? <span>{row.byName}</span> : <span className="text-muted">—</span>,
              },
              {
                key: "at",
                header: "تاریخ",
                render: (row: Row) => <span dir="ltr">{isoToFa(row.at)}</span>,
              },
            ]}
          />

          <div className="toolbar" aria-label="صفحه‌بندی">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              صفحه قبل
            </Button>
            <span className="text-muted">
              صفحه {toFaDigits(page)} از {toFaDigits(totalPages)} — {toFaDigits(query.data?.total ?? 0)} تراکنش
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || query.isFetching}
            >
              صفحه بعد
            </Button>
          </div>
        </>
      )}

      {canCreate && dialogOpen ? (
        <TxnDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      ) : null}
    </>
  );
}
