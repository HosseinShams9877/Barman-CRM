/**
 * ReceivablesView — گزارش مطالبات (PHASE_06 §۶/§۱۲).
 *
 * تجمیع بر اساس حساب: چک‌های دریافتی وصول‌نشده + نسیه باقی‌مانده
 * سفارش‌های قطعی‌شده (منبع قوانین: fin-core.js:59-70).
 *
 * مبالغ فقط برای نقش‌های دارای `money.view` نمایش داده می‌شوند — نسخه
 * noMoney فیلد `amount` را در ردیف‌ها ندارد و کل گروه هم حذف می‌شود
 * (R-32 — فیلتر سمت سرور).
 *
 * حالت‌های Loading/Error/Empty اجباری (CD-09).
 */
"use client";

import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { formatJalaliFa, parseJalali } from "@core/calendar";
import { useReceivablesQuery } from "../hooks/useFinanceReports";
import type {
  ReceivableGroup,
  ReceivableGroupNoMoney,
  ReceivableRow,
  ReceivableRowNoMoney,
} from "../types/finance.types";

export type ReceivablesViewProps = {
  /** باز کردن دیالوگ ثبت تراکنش (دریافت متفرقه) — اختیاری. */
  onNewIncome?: () => void;
};

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی. */
function isoToFa(iso: string | null): string {
  if (!iso) return "—";
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

export function ReceivablesView({ onNewIncome }: ReceivablesViewProps) {
  const me = useMeQuery();
  const canSeeMoney = new Set(me.data?.permissions ?? []).has("money.view");
  const canCreate = new Set(me.data?.permissions ?? []).has("finance.edit");

  const query = useReceivablesQuery();

  if (query.isLoading) {
    return <LoadingState label="در حال بارگذاری مطالبات…" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="بارگذاری ناموفق"
        message={query.error?.message ?? "خطا در دریافت مطالبات."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const data = query.data;
  const groups = data?.groups ?? [];
  const total = "total" in (data ?? {}) ? (data as { total: number }).total : null;

  if (groups.length === 0) {
    return (
      <EmptyState
        title="مطالباتی وجود ندارد"
        description="چک دریافتی باز یا نسیه سفارشی برای نمایش نیست."
        action={
          canCreate && onNewIncome ? (
            <Button onClick={onNewIncome}>ثبت دریافت متفرقه</Button>
          ) : undefined
        }
      />
    );
  }

  type Row = ReceivableRow | ReceivableRowNoMoney;

  return (
    <div className="stack gap-4">
      {canSeeMoney && total !== null ? (
        <Card title="جمع کل مطالبات">
          <p className="stack gap-1" dir="ltr">
            <span className="text-muted">جمع کل:</span>
            <span dir="ltr">{formatMoney(total)} ریال</span>
          </p>
        </Card>
      ) : null}

      {groups.map((group: ReceivableGroup | ReceivableGroupNoMoney) => {
        const g = group as ReceivableGroup;
        return (
          <Card
            key={g.accountId}
            title={g.accountName}
            actions={
              canSeeMoney && "total" in g ? (
                <span className="text-muted" dir="ltr">
                  {formatMoney(g.total)} ریال
                </span>
              ) : undefined
            }
          >
            <DataTable
              caption={`مطالبات ${g.accountName}`}
              rowKey={(row: Row) =>
                row.chequeId ?? `${(row as ReceivableRow).orderId ?? ""}-${(row as ReceivableRow).kind}-${(row as ReceivableRow).due ?? ""}`
              }
              rows={g.rows}
              columns={[
                {
                  key: "kind",
                  header: "نوع",
                  render: (row: Row) => (
                    <span className="tag-chip" data-tone={(row as ReceivableRow).kind === "cheque" ? "info" : "warning"}>
                      {(row as ReceivableRow).kind === "cheque" ? "چک دریافتی" : "نسیه"}
                    </span>
                  ),
                },
                {
                  key: "orderId",
                  header: "سفارش",
                  render: (row: Row) => {
                    const orderId = (row as ReceivableRow).orderId;
                    return orderId ? <span dir="ltr">{toFaDigits(orderId)}</span> : <span className="text-muted">—</span>;
                  },
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
                  key: "due",
                  header: "سررسید",
                  render: (row: Row) => (
                    <span dir="ltr">{isoToFa((row as ReceivableRow).due)}</span>
                  ),
                },
              ]}
            />
          </Card>
        );
      })}
    </div>
  );
}
