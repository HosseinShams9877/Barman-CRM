/**
 * PayablesView — گزارش پرداختنی‌ها (PHASE_06 §۶/§۱۲).
 *
 * تجمیع بر اساس تأمین‌کننده: چک‌های صادره خرید (issued) + نسیه باقی‌مانده
 * خریدهای تأییدشده و پرداخت‌نشده (منبع قوانین: fin-core.js:72-74).
 *
 * مبالغ فقط برای نقش‌های دارای `money.view` نمایش داده می‌شوند — نسخه
 * noMoney فیلد `amount` در ردیف‌ها ندارد و جمع گروه حذف می‌شود
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
import { usePayablesQuery } from "../hooks/useFinanceReports";
import type {
  PayableGroup,
  PayableGroupNoMoney,
  PayableRow,
  PayableRowNoMoney,
} from "../types/finance.types";

export type PayablesViewProps = {
  /** باز کردن دیالوگ ثبت هزینه — اختیاری. */
  onNewExpense?: () => void;
};

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی. */
function isoToFa(iso: string | null): string {
  if (!iso) return "—";
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

export function PayablesView({ onNewExpense }: PayablesViewProps) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canSeeMoney = permissions.has("money.view");
  const canCreate = permissions.has("finance.edit");

  const query = usePayablesQuery();

  if (query.isLoading) {
    return <LoadingState label="در حال بارگذاری پرداختنی‌ها…" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="بارگذاری ناموفق"
        message={query.error?.message ?? "خطا در دریافت پرداختنی‌ها."}
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
        title="پرداختنی‌ای وجود ندارد"
        description="چک صادره بازی یا نسیه خریدی برای نمایش نیست."
        action={
          canCreate && onNewExpense ? (
            <Button onClick={onNewExpense}>ثبت هزینه</Button>
          ) : undefined
        }
      />
    );
  }

  type Row = PayableRow | PayableRowNoMoney;

  return (
    <div className="stack gap-4">
      {canSeeMoney && total !== null ? (
        <Card title="جمع کل پرداختنی‌ها">
          <p className="stack gap-1" dir="ltr">
            <span className="text-muted">جمع کل:</span>
            <span dir="ltr">{formatMoney(total)} ریال</span>
          </p>
        </Card>
      ) : null}

      {groups.map((group: PayableGroup | PayableGroupNoMoney) => {
        const g = group as PayableGroup;
        return (
          <Card
            key={g.supplierId}
            title={g.supplierName}
            actions={
              canSeeMoney && "total" in g ? (
                <span className="text-muted" dir="ltr">
                  {formatMoney(g.total)} ریال
                </span>
              ) : undefined
            }
          >
            <DataTable
              caption={`پرداختنی‌های ${g.supplierName}`}
              rowKey={(row: Row) =>
                `${(row as PayableRow).buyId ?? ""}-${(row as PayableRow).kind}-${(row as PayableRow).due ?? ""}`
              }
              rows={g.rows}
              columns={[
                {
                  key: "kind",
                  header: "نوع",
                  render: (row: Row) => (
                    <span
                      className="tag-chip"
                      data-tone={(row as PayableRow).kind === "cheque" ? "info" : "warning"}
                    >
                      {(row as PayableRow).kind === "cheque" ? "چک صادره" : "نسیه"}
                    </span>
                  ),
                },
                {
                  key: "buyId",
                  header: "خرید",
                  render: (row: Row) => {
                    const buyId = (row as PayableRow).buyId;
                    return buyId ? (
                      <span dir="ltr">{toFaDigits(buyId)}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    );
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
                    <span dir="ltr">{isoToFa((row as PayableRow).due)}</span>
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
