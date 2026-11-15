/**
 * سرویس گزارش جریان نقدی — bucketing ماهانه بر اساس JDN
 * (PHASE_06 §۵ — «گزارش جریان نقدی ماهانه با bucketing تاریخ بر اساس
 * JDN (رفع R-11 — به‌جای slice(0,7) رشته‌ای)»).
 *
 * منابع رویدادهای پولی (همه با ارجاع به Demo fin-core.js:46-57 —
 * CLAUDE.md §۱۳، هیچ منبعی اختراع نمی‌شود):
 *  ۱. پرداخت‌های سفارش باطل‌نشده → dir +1، kind «واریز مشتری»
 *     (fin-core.js:50 — receipts kind "cash").
 *  ۲. چک‌های دریافتی وصول‌شده (status "clear") → dir +1، kind
 *     «وصول چک مشتری»، تاریخ = سررسید (fin-core.js:51:
 *     `r.chq.clearAt || r.chq.due` — فاز ۴ فیلد clearAt ندارد،
 *     پس due به‌کار می‌رود — تفسیر ثبت‌شده در DECISION_LOG).
 *  ۳. چک‌های صادره خرید پاس‌شده (status "paid") → dir −1، kind
 *     «چک صادره خرید»، تاریخ = سررسید (fin-core.js:55).
 *  ۴. تراکنش‌های دفتر هزینه/درآمد متفرقه (txns) — dir و kind از رکورد
 *     (fin-core.js:56).
 *
 * ماه شمسی از تاریخ خالص با موتور JDF محاسبه می‌شود (parseJalali) و
 * مرتب‌سازی ردیف‌ها با JDN انجام می‌شود (jalaliToJdn) — نه با برش
 * رشته‌ای (R-11).
 *
 * نکته: Demo روی `extraPays` (fin-core.js:53) هم جریان ورودی ثبت
 * می‌کند؛ فاز ۴ این ساختار را مدل‌سازی نکرده است (دریافت‌های سفارش =
 * OrderPayment نقدی/کارتی + OrderCheque) — تفسیر ثبت‌شده در
 * DECISION_LOG.
 *
 * noMoney (R-32): تمام فیلدهای پولی در پاسخ حذف می‌شوند.
 */
import { prisma } from "@core/database/client";
import { jalaliToJdn, parseJalali } from "@core/calendar";
import { toDisplayKind, type TxnDirection } from "../constants";
import type {
  CashflowMonth,
  CashflowMonthNoMoney,
  CashflowResult,
  CashflowResultNoMoney,
  CashflowRow,
  CashflowRowNoMoney,
} from "../types/finance.types";

/** تبدیل تاریخ خالص `YYYY/MM/DD` به کلید ماه `YYYY/MM` — بدون برش رشته‌ای. */
function monthOf(iso: string): string | null {
  const d = parseJalali(iso);
  if (!d) return null;
  const jm = String(d.jm).padStart(2, "0");
  return `${d.jy}/${jm}`;
}

/**
 * GET /api/finance/cashflow — جریان نقدی تجمیع‌شده بر اساس ماه شمسی.
 *
 * ماه‌ها صعودی و ردیف‌های هر ماه بر اساس JDN صعودی مرتب می‌شوند.
 * `month` اختیاری است (قالب `YYYY/MM`)؛ در صورت ارائه فقط همان ماه
 * برمی‌گردد.
 */
export async function getCashflow(
  hideMoney: boolean,
  month?: string | null,
): Promise<CashflowResult | CashflowResultNoMoney> {
  const [orders, buys, txns] = await Promise.all([
    prisma.order.findMany({
      include: {
        account: { select: { name: true } },
        payments: true,
        cheques: true,
      },
      orderBy: [{ id: "asc" }],
    }),
    prisma.buy.findMany({
      include: {
        supplier: { select: { name: true } },
        cheques: true,
      },
      orderBy: [{ id: "asc" }],
    }),
    prisma.txn.findMany({ orderBy: [{ at: "desc" }, { createdAt: "desc" }] }),
  ]);

  const events: { at: string; label: string; direction: TxnDirection; amount: number }[] = [];

  for (const order of orders) {
    for (const p of order.payments) {
      if (p.void) continue;
      events.push({ at: p.date, label: "واریز مشتری", direction: "income", amount: p.amount });
    }
    for (const c of order.cheques) {
      if (c.status !== "clear") continue;
      events.push({ at: c.due, label: "وصول چک مشتری", direction: "income", amount: c.amount });
    }
  }

  for (const buy of buys) {
    for (const chq of buy.cheques) {
      if (chq.status !== "paid") continue;
      events.push({
        at: chq.due,
        label: "چک صادره خرید",
        direction: "expense",
        amount: chq.amount,
      });
    }
  }

  for (const t of txns) {
    events.push({
      at: t.at,
      label: toDisplayKind(t.kind),
      direction: t.direction as TxnDirection,
      amount: t.amount,
    });
  }

  // Bucketing ماهانه + مرتب‌سازی JDN (R-11)
  const rows: CashflowRow[] = [];
  for (const e of events) {
    const m = monthOf(e.at);
    if (m === null) continue;
    rows.push({ month: m, label: e.label, direction: e.direction, amount: e.amount, at: e.at });
  }

  const filtered = month ? rows.filter((r) => r.month === month) : rows;
  filtered.sort((a, b) => jalaliToJdnOf(a.at) - jalaliToJdnOf(b.at));

  const byMonth = new Map<string, CashflowMonth>();
  for (const row of filtered) {
    let m = byMonth.get(row.month);
    if (!m) {
      m = { month: row.month, income: 0, expense: 0, net: 0 };
      byMonth.set(row.month, m);
    }
    if (row.direction === "income") m.income += row.amount;
    else m.expense += row.amount;
    m.net = m.income - m.expense;
  }

  const months = [...byMonth.values()].sort((a, b) =>
    jalaliToJdnOf(a.month + "/01") - jalaliToJdnOf(b.month + "/01"),
  );
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);

  if (hideMoney) return stripCashflow(months, filtered);
  return {
    months,
    rows: filtered,
    totalIncome,
    totalExpense,
    totalNet: totalIncome - totalExpense,
  };
}

/** JDN تاریخ خالص — برای مرتب‌سازی واقعی (نه مقایسه رشته‌ای). */
function jalaliToJdnOf(iso: string): number {
  const d = parseJalali(iso);
  return d ? jalaliToJdn(d.jy, d.jm, d.jd) : Number.MAX_SAFE_INTEGER;
}

/** حذف فیلدهای پولی برای نقش‌های noMoney (R-32) — تخریب واقعی. */
function stripCashflow(
  months: CashflowMonth[],
  rows: CashflowRow[],
): CashflowResultNoMoney {
  return {
    months: months.map((m) => ({ month: m.month })),
    rows: rows.map(stripRow),
  };
}

function stripRow(row: CashflowRow): CashflowRowNoMoney {
  const { amount, ...rest } = row;
  void amount;
  return rest;
}
