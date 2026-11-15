/**
 * CashflowReport — گزارش جریان نقدی ماهانه (PHASE_06 §۵/§۶/§۱۲).
 *
 * bucketing ماهانه بر اساس JDN در سرویس انجام می‌شود (R-11). این
 * کامپوننت ماه را با قالب `YYYY/MM` ASCII فیلتر می‌کند و خروجی را
 * نمایش می‌دهد. منابع رویدادهای پولی: fin-core.js:46-57.
 *
 * مبالغ فقط برای نقش‌های دارای `money.view` (R-32).
 * حالت‌های Loading/Error/Empty اجباری (CD-09).
 */
"use client";

import { useState } from "react";
import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { formatJalaliFa, formatJalaliIso, parseJalali } from "@core/calendar";
import { useCashflowQuery } from "../hooks/useFinanceReports";
import type {
  CashflowResult,
  CashflowResultNoMoney,
  CashflowRow,
  CashflowRowNoMoney,
} from "../types/finance.types";

/** قالب نمایش ماه `YYYY/MM` ASCII → فارسی. */
function monthToFa(month: string): string {
  const parsed = parseJalali(`${month}/01`);
  if (!parsed) return toFaDigits(month);
  // روز از قالب ISO (ارقام ASCII) حذف می‌شود — قبل از تبدیل به ارقام فارسی
  return toFaDigits(formatJalaliIso(parsed).replace(/\/\d+$/, ""));
}

/** تبدیل ورودی کاربر به کلید ماه ASCII — `YYYY/MM` یا تهی. */
function normalizeMonth(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const parsed = parseJalali(`${trimmed}/01`);
  if (!parsed) return null;
  return `${parsed.jy}/${String(parsed.jm).padStart(2, "0")}`;
}

export function CashflowReport() {
  const me = useMeQuery();
  const canSeeMoney = new Set(me.data?.permissions ?? []).has("money.view");

  const [monthInput, setMonthInput] = useState<string>("");
  const [month, setMonth] = useState<string | null>(null);

  const query = useCashflowQuery(month);

  const onFilter = (e: React.FormEvent): void => {
    e.preventDefault();
    setMonth(normalizeMonth(monthInput));
  };

  if (query.isLoading) {
    return <LoadingState label="در حال بارگذاری جریان نقدی…" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="بارگذاری ناموفق"
        message={query.error?.message ?? "خطا در دریافت جریان نقدی."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const data = query.data as
    | (CashflowResult | CashflowResultNoMoney)
    | undefined;
  const months = data?.months ?? [];
  const rows = data?.rows ?? [];
  /** ردیف‌ها با کلید یکتا (ماه + تاریخ + شرح + شماره ترتیب). */
  const keyedRows = rows.map((row, i) => ({ ...row, key: `${row.month}-${row.at}-${i}` }));
  const totals =
    data && "totalIncome" in data
      ? { income: data.totalIncome, expense: data.totalExpense, net: data.totalNet }
      : null;

  type Row = CashflowRow | CashflowRowNoMoney;

  return (
    <div className="stack gap-4">
      <Card>
        <form className="toolbar" onSubmit={onFilter} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="cashflow-month">
              ماه
            </label>
            <input
              id="cashflow-month"
              className="input"
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              placeholder="YYYY/MM — خالی = همه ماه‌ها"
            />
          </div>
          <Button type="submit" variant="ghost" isLoading={query.isFetching}>
            اعمال فیلتر
          </Button>
          {month ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMonthInput("");
                setMonth(null);
              }}
            >
              همه ماه‌ها
            </Button>
          ) : null}
        </form>
      </Card>

      {months.length === 0 && rows.length === 0 ? (
        <EmptyState
          title="رویداد پولی ثبت نشده است"
          description={
            month
              ? `برای ${toFaDigits(month)} رویداد پولی وجود ندارد.`
              : "هنوز تراکنش، چک پاس‌شده یا دریافت سفارشی ثبت نشده است."
          }
        />
      ) : (
        <>
          {canSeeMoney && totals ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card title="دریافت‌ها">
                <p dir="ltr">{formatMoney(totals.income)} ریال</p>
              </Card>
              <Card title="پرداخت‌ها">
                <p dir="ltr">{formatMoney(totals.expense)} ریال</p>
              </Card>
              <Card title="خالص جریان نقدی">
                <p dir="ltr">{formatMoney(totals.net)} ریال</p>
              </Card>
            </div>
          ) : null}

          {canSeeMoney ? (
            <Card title="خلاصه ماهانه">
              <DataTable
                caption="خلاصه ماهانه جریان نقدی"
                rowKey={(m) => m.month}
                rows={months as CashflowResult["months"]}
                columns={[
                  { key: "month", header: "ماه", render: (m) => <span dir="ltr">{monthToFa(m.month)}</span> },
                  {
                    key: "income",
                    header: "دریافت",
                    render: (m) => <span dir="ltr">{formatMoney(m.income)} ریال</span>,
                  },
                  {
                    key: "expense",
                    header: "پرداخت",
                    render: (m) => <span dir="ltr">{formatMoney(m.expense)} ریال</span>,
                  },
                  {
                    key: "net",
                    header: "خالص",
                    render: (m) => <span dir="ltr">{formatMoney(m.net)} ریال</span>,
                  },
                ]}
              />
            </Card>
          ) : null}

          <Card title="رویدادهای جریان نقدی">
            <DataTable
              caption="رویدادهای جریان نقدی"
              rowKey={(row) => row.key}
              rows={keyedRows}
              empty="رویدادی در این ماه وجود ندارد."
              columns={[
                {
                  key: "month",
                  header: "ماه",
                  render: (row: Row) => (
                    <span className="text-muted" dir="ltr">
                      {monthToFa((row as CashflowRow).month)}
                    </span>
                  ),
                },
                {
                  key: "direction",
                  header: "جهت",
                  render: (row: Row) => (
                    <span
                      className="tag-chip"
                      data-tone={(row as CashflowRow).direction === "income" ? "success" : "warning"}
                    >
                      {(row as CashflowRow).direction === "income" ? "دریافت" : "پرداخت"}
                    </span>
                  ),
                },
                { key: "label", header: "شرح", render: (row: Row) => <span>{(row as CashflowRow).label}</span> },
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
                  key: "at",
                  header: "تاریخ",
                  render: (row: Row) => {
                    const parsed = parseJalali((row as CashflowRow).at);
                    return (
                      <span dir="ltr">
                        {parsed ? formatJalaliFa(parsed) : toFaDigits((row as CashflowRow).at)}
                      </span>
                    );
                  },
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
