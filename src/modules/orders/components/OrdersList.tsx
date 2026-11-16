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
import { useSearchParams } from "next/navigation";
import { useRouteDraft } from "@core/utils/useRouteDraft";
import { PageHeader } from "@components/shared/PageHeader";
import Link from "next/link";
import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney } from "@core/formatting";
import { formatJalaliFa, parseJalali, instantToJalaliIso } from "@core/calendar";
import { toFaDigits } from "@core/formatting";
import { ORDER_STAGES, ORDER_STATUS_LABELS } from "../constants";
import { ORDER_BUCKETS } from "../constants/buckets";
import { useSummaryQuery } from "@modules/home/hooks/useSummary";
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
  const summary = useSummaryQuery(Boolean(me.data));
  const workspace = summary.data?.workspace;
  const ownTasks = workspace?.queues.filter((q) => !q.task.info).flatMap((q) => q.items) ?? [];

  const search = useSearchParams();
  const [q, setQ] = useRouteDraft(search.get("q") ?? "");
  const [stage, setStage] = useRouteDraft(search.get("stage") ?? "");
  const [status, setStatus] = useRouteDraft(search.get("status") ?? "open");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useRouteDraft(search.get("new") === "1");

  const query = useOrdersQuery({
    q,
    page,
    pageSize: PAGE_SIZE,
    stage: stage.length > 0 ? Number(stage) : null,
    status: status.length > 0 ? (status as OrderListItem["status"]) : null,
    ownerId: null,
    overdue: search.get("overdue") === "1",
    incomplete: search.get("incomplete") === "1",
    bucket: search.get("bucket") as import("../constants/buckets").OrderBucket | undefined || undefined,
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
          header: "مبلغ",
          render: (row: Row) =>
            "calc" in row ? <span dir="ltr">{formatMoney(row.calc.total)} ریال</span> : null,
        },
      ]
    : [];

  return (
    <>
      <PageHeader icon="layers" title={me.data?.roles[0] === "sales" ? "سفارش‌های من" : "مسیر سفارش‌ها"} description="همه سفارش‌ها؛ هر کدام کجاست و دست کیست.">
        {canCreate ? (
          <Button onClick={() => setDialogOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
            پیش‌فاکتور جدید
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <nav className="fw-q" aria-label="صف سفارش‌ها">
          <Link className="btn btn-ghost" aria-current={search.get("bucket") === "mine" ? "page" : undefined} href="/orders?bucket=mine">کارهای من <b>{toFaDigits(new Set(ownTasks.map((o) => o.id)).size)}</b></Link>
          <Link className="btn btn-ghost" aria-current={!search.has("bucket") && !search.has("overdue") && status === "open" ? "page" : undefined} href="/orders">همه سفارش‌های باز <b>{toFaDigits(workspace?.orders.length ?? 0)}</b></Link>
          <Link className="btn btn-ghost" aria-current={search.get("overdue") === "1" ? "page" : undefined} href="/orders?overdue=1">دیرتر از مهلت <b>{toFaDigits(workspace?.orders.filter((o) => o.due < (workspace?.now ?? 0)).length ?? 0)}</b></Link>
        </nav>
        <nav className="fw-pipe" aria-label="مرحله‌های سفارش">
          {ORDER_BUCKETS.map((b) => <Link key={b.key} style={{ "--phase-color": b.color } as React.CSSProperties} aria-current={search.get("bucket") === b.key ? "page" : undefined} href={`/orders?bucket=${b.key}`}><b>{toFaDigits(workspace?.orders.filter((o) => (b.stages as readonly number[]).includes(o.stage)).length ?? 0)}</b><span>{b.label}</span></Link>)}
          <Link className="fw-arch" href={status === "done" ? "/orders?status=cancelled" : "/orders?status=done"}>{status === "done" ? "لغو‌شده‌ها" : status === "cancelled" ? "تحویل‌شده‌ها" : "بایگانی"}</Link>
        </nav>
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
              {key: "id", header: "پرونده", render: (row: Row) => <Link href={`/orders/${row.id}`} className="link"><b className="ltr">{row.id}</b><small className="ltr">{toFaDigits(isoToFa(instantToJalaliIso(row.createdAt)) ?? "")}</small></Link>},
              {key: "account", header: "مشتری", render: (row: Row) => <><b>{row.accountName || "— بدون مشتری —"}</b><small>{me.data?.roles[0] === "sales" ? toFaDigits(row.itemCount) + " قلم" : row.ownerName}</small></>},
              ...moneyColumns,
              ...(!canSeeMoney ? [{key: "items", header: "اقلام", render: (row: Row) => toFaDigits(row.itemCount) + " قلم"}] : []),
              {key: "status", header: "وضعیت", render: (row: Row) => <><span className="stage-chip" data-stage-group={stageGroupOf(row.stageKey)}>{row.status === "open" ? stageLabel(row.stage) : ORDER_STATUS_LABELS[row.status]}</span><small>مرحله {toFaDigits(row.stage)} از {toFaDigits(11)}</small><span className="mf-tr" aria-label="پیشرفت سفارش">{ORDER_BUCKETS.map((b) => <i key={b.key} data-active={row.stage >= b.stages[0]} style={{"--phase-color":b.color} as React.CSSProperties} />)}</span></>},
              {key: "dueDate", header: "مهلت", render: (row: Row) => <span className="ltr">{row.status === "open" ? isoToFa(row.dueDate) ?? "—" : "—"}</span>},
              {key: "actions", header: "", render: (row: Row) => <Link className="btn btn-sm" href={`/orders/${row.id}`}>{workspace?.queues.find((q) => !q.task.info && q.items.some((o) => o.id === row.id))?.task.name ?? "دیدن"}</Link>},
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
        <OrderFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} order={null} leadId={search.get("lead")} accountId={search.get("account")} />
      ) : null}
    </>
  );
}

/** گروه مرحله برای توکن رنگ stage-chip. */
function stageGroupOf(key: OrderListItem["stageKey"]): StageGroup {
  return ORDER_STAGES.find((o) => o.key === key)?.group ?? "sales";
}
