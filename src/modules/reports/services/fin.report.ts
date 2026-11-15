/**
 * سرویس گزارش مالی — PHASE_07 §۹ (بازسازی reports.js:48-55).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - دریافتنی باز = جمع مطالبات (reports.js:53 — B.receivables).
 *  - پرداختنی باز = جمع پرداختنی‌ها (reports.js:53 — B.payables).
 *  - ورودی/خروجی پول در بازه از تراکنش‌های دفتر (reports.js:51-52).
 *  - خروجی پول به تفکیک نوع با برچسب نمایشی (reports.js:53 — exp[x.kind]).
 *
 * نکته: Demo روی ردیف‌های cashflow فیلتر `t >= from` می‌زد؛ در اینجا
 * منبع تراکنش‌ها جدول `txns` است (CD-36) با تاریخ شمسی `YYYY/MM/DD`
 * که مقایسه رشته‌ای آن معتبر است (CD-06).
 */
import { prisma } from "@core/database/client";
import { instantToJalaliIso } from "@core/calendar";
import { listPayables } from "@modules/finance/services/payable.service";
import { listReceivables } from "@modules/finance/services/receivable.service";
import { toDisplayKind } from "@modules/finance/constants";
import { rangeFrom } from "./bucketing";

export type FinReport = {
  tiles: {
    /** دریافتنی باز — فقط برای نقش‌های دارای money.view. */
    receivable?: number;
    /** پرداختنی باز — فقط برای نقش‌های دارای money.view. */
    payable?: number;
    /** ورودی پول در بازه — فقط برای نقش‌های دارای money.view. */
    income?: number;
    /** خروجی پول در بازه — فقط برای نقش‌های دارای money.view. */
    expense?: number;
  };
  /** خروجی پول به تفکیک نوع (reports.js:53). */
  expensesByKind: { kind: string; amount: number }[];
};

/**
 * گزارش مالی — جمع دریافتنی/پرداختنی و جریان پول در بازه (reports.js:48-55).
 */
export async function finReport(input: { days: number; hideMoney: boolean }): Promise<FinReport> {
  if (input.hideMoney) {
    // گزارش مالی برای نقش‌های فاقد money.view — بدون مبالغ (R-32).
    return { tiles: {}, expensesByKind: [] };
  }

  // دریافتنی/پرداختنی باز — جمع از سرویس‌های فاز ۶ (CD-37/CD-38).
  const [receivables, payables] = await Promise.all([
    listReceivables(false),
    listPayables(false),
  ]);
  const recTotal = resultTotal(receivables);
  const payTotal = resultTotal(payables);

  // تراکنش‌های دفتر در بازه — تاریخ شمسی قیاس‌پذیر (CD-06).
  const fromIso = instantToJalaliIso(rangeFrom(input.days));
  const txns = await prisma.txn.findMany({ where: { at: { gte: fromIso } } });

  let income = 0;
  let expense = 0;
  const byKind = new Map<string, number>();
  for (const t of txns) {
    if (t.direction === "income") income += t.amount;
    else {
      expense += t.amount;
      const label = toDisplayKind(t.kind);
      byKind.set(label, (byKind.get(label) ?? 0) + t.amount);
    }
  }

  return {
    tiles: { receivable: recTotal, payable: payTotal, income, expense },
    expensesByKind: [...byKind.entries()]
      .map(([kind, amount]) => ({ kind, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** جمع نتیجه دریافتنی/پرداختنی — نوع NoMoney کلید `total` ندارد. */
function resultTotal(result: { total?: number } | object): number {
  return (result as { total?: number }).total ?? 0;
}
