/**
 * BuysList — لیست درخواست‌های خرید (PHASE_06 §۶).
 *
 * جستجو، فیلتر وضعیت و تأمین‌کننده، صفحه‌بندی و ثبت خرید جدید. مبالغ فقط
 * برای نقش‌های دارای `money.view` نمایش داده می‌شوند — نسخه noMoney فیلد
 * `calc` ندارد (R-32 — فیلتر سمت سرور، تشخیص در کلاینت).
 *
 * دکمه‌ها بر اساس مجوز کلاینت پنهان می‌شوند، اما سرور منبع حقیقت است
 * (R-02) — هر اقدام بدون مجوز در API رد می‌شود.
 */
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouteDraft } from "@core/utils/useRouteDraft";
import { useUrlHash } from "@core/utils/useUrlHash";
import { PageHeader } from "@components/shared/PageHeader";
import Link from "next/link";
import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { formatJalaliFa, parseJalali } from "@core/calendar";
import { useSummaryQuery } from "@modules/home/hooks/useSummary";
import { BUY_STATUS_LABELS, BUY_STATUSES } from "../constants";
import type { BuyStatus } from "../constants";
import type { BuyListItem, BuyListItemNoMoney } from "../types/buy.types";
import { useBuysQuery } from "../hooks/useBuys";
import { BuyFormDialog } from "./BuyFormDialog";

const PAGE_SIZE = 20;

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

export function BuysList() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canCreate = permissions.has("purchasing.edit");
  const summary = useSummaryQuery(Boolean(me.data));
  const role = me.data?.roles[0];
  const actionStatus = role === "management" || role === "admin" ? "req" : role === "finance" ? "ok" : "fin";
  const canSeeMoney = permissions.has("money.view");

  const search = useSearchParams();
  const hash = useUrlHash();
  const [q, setQ] = useRouteDraft(search.get("q") ?? "");
  const [statusDraft, setStatus] = useRouteDraft(search.get("status") ?? "");
  const status = hash === "#in" ? "fin" : statusDraft;
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useRouteDraft(search.get("new") === "1");

  const query = useBuysQuery({
    q,
    page,
    pageSize: PAGE_SIZE,
    status: status.length > 0 ? (status as BuyStatus) : null,
    supplierId: null,
  });

  const onSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    setPage(1);
    void query.refetch();
  };

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  type Row = BuyListItem | BuyListItemNoMoney;

  const moneyColumns = canSeeMoney
    ? [
        {
          key: "total" as const,
          header: "مبلغ",
          render: (row: Row) =>
            "calc" in row ? <span dir="ltr">{formatMoney(row.calc.total)} ریال</span> : null,
        },
        {
          key: "due" as const,
          header: "مانده بدهی",
          render: (row: Row) =>
            "calc" in row ? <span dir="ltr">{formatMoney(row.calc.due)} ریال</span> : null,
        },
      ]
    : [];

  return (
    <>
      <PageHeader icon="cart" title={hash === "#in" ? "ورود خرید به انبار" : "خرید و تأمین"} description="مواد اولیه کارگاه و محصولات نمایندگی؛ درخواست، تأیید، پرداخت و ورود به انبار.">
        {canCreate ? (
          <Button onClick={() => setDialogOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
            درخواست خرید جدید
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <nav className="fw-q" aria-label="وضعیت خرید">{[[actionStatus,"منتظر اقدام شما"],["ok","منتظر مالی"],["fin","منتظر رسیدن کالا"],["recv","وارد انبار شد"],["","همه"]].map(([key,label],index)=><Link key={index} className="btn btn-ghost" href={key ? `/buys?status=${key}` : "/buys"} aria-current={status === key ? "page" : undefined}>{label}{key === actionStatus && summary.data?.workspace?.buyWaiting ? " " + toFaDigits(summary.data.workspace.buyWaiting) : ""}</Link>)}</nav>
        <form className="toolbar" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="buys-q">
              جستجو
            </label>
            <input
              id="buys-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="شناسه خرید یا نام تأمین‌کننده"
            />
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="buys-status">
              وضعیت
            </label>
            <select
              id="buys-status"
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه وضعیت‌ها</option>
              {BUY_STATUSES.map((k) => (
                <option key={k} value={k}>
                  {BUY_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="ghost" isLoading={query.isFetching}>
            جستجو
          </Button>
        </form>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال بارگذاری خریدها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت خریدها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          title="خریدی وجود ندارد"
          description={q.length > 0 || status.length > 0 ? "نتیجه‌ای برای فیلترهای شما پیدا نشد." : "هنوز درخواست خریدی ثبت نشده است."}
          action={
            canCreate ? <Button onClick={() => setDialogOpen(true)}>ایجاد اولین خرید</Button> : undefined
          }
        />
      ) : (
        <>
          <DataTable
            caption="فهرست خریدها"
            rowKey={(row) => row.id}
            rows={query.data?.items ?? []}
            columns={[
              {key:"id",header:"سند",render:(row:Row)=><Link href={`/buys/${row.id}`} className="link"><b className="ltr">{row.id}</b><small className="ltr">{isoToFa(row.createdAt)}</small></Link>},
              {key:"kind",header:"نوع",render:()=>"مواد اولیه"},
              {key:"supplier",header:"فروشنده",render:(row:Row)=>row.supplierName ?? "—"},
              {key:"items",header:"اقلام",render:(row:Row)=>toFaDigits(row.itemCount)},
              ...moneyColumns,
              {key:"method",header:"روش پرداخت",render:(row:Row)=>row.chequeCount ? "چک" : "—"},
              {key:"status",header:"وضعیت",render:(row:Row)=><span className="tag-chip" data-tone={statusTone(row.status)}>{BUY_STATUS_LABELS[row.status]}</span>},
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
              صفحه {toFaDigits(page)} از {toFaDigits(totalPages)} — {toFaDigits(query.data?.total ?? 0)} خرید
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

      {dialogOpen ? (
        <BuyFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} buy={null} />
      ) : null}
    </>
  );
}

/** تن رنگ برچسب وضعیت (CD-03 — فقط نام توکن، بدون رنگ خام). */
function statusTone(status: BuyStatus): "info" | "success" | "warning" {
  switch (status) {
    case "req":
      return "info";
    case "ok":
      return "info";
    case "fin":
      return "warning";
    case "recv":
      return "success";
  }
}
