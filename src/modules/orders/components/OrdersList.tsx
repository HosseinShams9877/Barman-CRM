/**
 * OrdersList — لیست پیش‌فاکتورها/سفارش‌ها (PHASE_04 §۱۰).
 *
 * جستجو، فیلتر مرحله (۱۱ مرحله) و وضعیت، صفحه‌بندی، و ایجاد.
 * مبالغ فقط برای نقش‌های دارای money.view نمایش داده می‌شوند —
 * نسخه‌ی noMoney فیلد `calc` ندارد (R-32 — فیلتر سمت سرور، تشخیص کلاینت).
 *
 * دکمه‌ها بر اساس مجوز کلاینت پنهان می‌شوند، اما سرور منبع حقیقت
 * است (R-02) — هر اقدام بدون مجوز در API رد می‌شود.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney } from "@core/formatting";
import { formatJalaliFa, parseJalali } from "@core/calendar";
import { toFaDigits } from "@core/formatting";
import { ORDER_STAGES, ORDER_STATUS_LABELS } from "../constants";
import type { StageGroup } from "../constants";
import type { OrderListItem, OrderListItemNoMoney } from "../types/order.types";
import { useOrdersQuery } from "../hooks/useOrders";
import { OrderFormDialog } from "./OrderFormDialog";

const PAGE_SIZE = 20;

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

/**
 * لیست سفارش‌ها — فیلترها در کلید query می‌نشینند (CD-09) و سرور دامنه
 * دید را اعمال می‌کند (کارشناس فروش فقط سفارش‌های خودش — R-02).
 */
export function OrdersList() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canCreate = permissions.has("orders.create");
  const canSeeMoney = permissions.has("money.view");

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useOrdersQuery({
    q,
    page,
    pageSize: PAGE_SIZE,
    stage: stage.length > 0 ? Number(stage) : null,
    status: status.length > 0 ? (status as OrderListItem["status"]) : null,
    ownerId: null,
  });

  const onSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    setPage(1);
    void query.refetch();
  };

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  /** برچسب مرحله از روی شماره — خط لوله ۱..۱۱. */
  const stageLabel = (step: number): string =>
    ORDER_STAGES.find((s) => s.step === step)?.label ?? `مرحله ${step}`;

  type Row = OrderListItem | OrderListItemNoMoney;

  /** ستون‌های پولی فقط برای نقش‌های دارای money.view ساخته می‌شوند. */
  const moneyColumns = canSeeMoney
    ? [
        {
          key: "total" as const,
          header: "مبلغ نهایی",
          render: (row: Row) =>
            "calc" in row ? <span dir="ltr">{formatMoney(row.calc.total)} ریال</span> : null,
        },
        {
          key: "balance" as const,
          header: "مانده",
          render: (row: Row) =>
            "calc" in row ? <span dir="ltr">{formatMoney(row.balance)} ریال</span> : null,
        },
      ]
    : [];

  return (
    <>
      <div className="page-head">
        <h1 className="h1">سفارش‌ها</h1>
        {canCreate ? (
          <Button onClick={() => setDialogOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
            پیش‌فاکتور جدید
          </Button>
        ) : null}
      </div>

      <Card>
        <form className="toolbar" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="orders-q">
              جستجو
            </label>
            <input
              id="orders-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="شناسه سفارش یا نام مشتری"
            />
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="orders-stage">
              مرحله
            </label>
            <select
              id="orders-stage"
              className="select"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه مراحل</option>
              {ORDER_STAGES.map((s) => (
                <option key={s.key} value={String(s.step)}>
                  {toFaDigits(s.step)} — {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="orders-status">
              وضعیت
            </label>
            <select
              id="orders-status"
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه وضعیت‌ها</option>
              {(Object.keys(ORDER_STATUS_LABELS) as OrderListItem["status"][]).map((k) => (
                <option key={k} value={k}>
                  {ORDER_STATUS_LABELS[k]}
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
        <LoadingState label="در حال بارگذاری سفارش‌ها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت سفارش‌ها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          title="سفارشی وجود ندارد"
          description={
            q.length > 0 || stage.length > 0 || status.length > 0
              ? "نتیجه‌ای برای فیلترهای شما پیدا نشد."
              : "هنوز پیش‌فاکتوری ثبت نشده است."
          }
          action={
            canCreate ? (
              <Button onClick={() => setDialogOpen(true)}>ایجاد اولین پیش‌فاکتور</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            caption="فهرست سفارش‌ها"
            rowKey={(row) => row.id}
            rows={query.data?.items ?? []}
            columns={[
              {
                key: "id",
                header: "شناسه",
                render: (row: Row) => (
                  <Link href={`/orders/${row.id}`} className="link">
                    <span dir="ltr">{row.id}</span>
                  </Link>
                ),
              },
              {
                key: "stage",
                header: "مرحله",
                render: (row: Row) => (
                  <span className="stage-chip" data-stage-group={stageGroupOf(row.stageKey)}>
                    {toFaDigits(row.stage)} — {stageLabel(row.stage)}
                  </span>
                ),
              },
              {
                key: "status",
                header: "وضعیت",
                render: (row: Row) => (
                  <span
                    className="tag-chip"
                    data-tone={
                      row.status === "done"
                        ? "success"
                        : row.status === "cancelled"
                          ? "danger"
                          : "info"
                    }
                  >
                    {ORDER_STATUS_LABELS[row.status]}
                  </span>
                ),
              },
              {
                key: "account",
                header: "مشتری",
                render: (row: Row) =>
                  row.accountName ? (
                    <span>{row.accountName}</span>
                  ) : (
                    <span className="text-muted">— بدون مشتری —</span>
                  ),
              },
              {
                key: "owner",
                header: "کارشناس",
                render: (row: Row) => (row.ownerName ? <span>{row.ownerName}</span> : null),
              },
              {
                key: "itemCount",
                header: "اقلام",
                render: (row: Row) => toFaDigits(row.itemCount),
              },
              ...moneyColumns,
              {
                key: "dueDate",
                header: "سررسید",
                render: (row: Row) => {
                  const fa = isoToFa(row.dueDate);
                  return fa ? <span dir="ltr">{fa}</span> : <span className="text-muted">—</span>;
                },
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
              صفحه {toFaDigits(page)} از {toFaDigits(totalPages)} —{" "}
              {toFaDigits(query.data?.total ?? 0)} سفارش
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
        <OrderFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} order={null} />
      ) : null}
    </>
  );
}

/** گروه مرحله برای توکن رنگ stage-chip. */
function stageGroupOf(key: OrderListItem["stageKey"]): StageGroup {
  return ORDER_STAGES.find((o) => o.key === key)?.group ?? "sales";
}
