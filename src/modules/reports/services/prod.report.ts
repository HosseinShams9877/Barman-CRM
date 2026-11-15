/**
 * سرویس گزارش تولید و مواد — PHASE_07 §۹ (بازسازی reports.js:39-47).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - تولید سالم و ضایعات از QC کارها (jobs.good/waste — reports.js:41).
 *  - ارزش مواد اولیه = موجودی raw × قیمت خرید (reports.js:42).
 *  - ارزش دپو = موجودی depot × قیمت فروش (reports.js:42).
 *  - سفارش‌های عقب از زمان‌بندی تولید: prod.end گذشته ولی stage <= ۸
 *    و بسته‌نشده (reports.js:43).
 *  - موجودی همیشه تجمع لحظه‌ای از حرکت‌هاست (CD-08).
 */
import { prisma } from "@core/database/client";
import { computeOnHand } from "@modules/inventory/services/stock.service";

export type ProdReport = {
  tiles: {
    /** تولید سالم (مترمربع). */
    good: number;
    /** نرخ ضایعات (درصد). */
    wastePct: number;
    /** ارزش مواد اولیه — فقط برای نقش‌های دارای money.view. */
    rawValue?: number;
    /** ارزش موجودی دپو — فقط برای نقش‌های دارای money.view. */
    depotValue?: number;
  };
  /** سفارش‌های عقب از زمان‌بندی تولید. */
  late: { id: string; end: number }[];
};

type JsonProd = { end?: number; qc?: { good?: Record<string, number>; waste?: Record<string, number> } };

/**
 * گزارش تولید — تجمیع QC کارها و ارزش انبارها (reports.js:39-47).
 */
export async function prodReport(hideMoney: boolean): Promise<ProdReport> {
  const jobs = await prisma.job.findMany({ where: { good: { not: null } } });

  let good = 0;
  let waste = 0;
  for (const job of jobs) {
    good += job.good ?? 0;
    waste += job.waste ?? 0;
  }

  // سفارش‌های تولیدی عقب از برنامه (reports.js:43).
  const now = Date.now();
  const lateOrders = await prisma.order.findMany({
    where: {
      status: "open",
      stage: { lte: 8 },
    },
    select: { id: true, prod: true },
  });
  const late = lateOrders
    .map((o) => ({ id: o.id, prod: o.prod as JsonProd | null }))
    .filter((o) => typeof o.prod?.end === "number" && (o.prod?.end ?? 0) < now)
    .map((o) => ({ id: o.id, end: o.prod!.end! }));

  if (hideMoney) {
    return {
      tiles: { good, wastePct: wasteRate(good, waste) },
      late,
    };
  }

  // ارزش انبارها — موجودی از حرکت‌ها (CD-08)، قیمت از کاتالوگ.
  const onHand = await computeOnHand();
  const [materials, products] = await Promise.all([
    prisma.material.findMany({ select: { id: true, price: true } }),
    prisma.product.findMany({ select: { id: true, price: true } }),
  ]);

  const rawValue = materials.reduce(
    (sum, m) => sum + (onHand[`raw|${m.id}`] ?? 0) * m.price,
    0,
  );
  const depotValue = products.reduce(
    (sum, p) => sum + (onHand[`depot|${p.id}`] ?? 0) * p.price,
    0,
  );

  return {
    tiles: { good, wastePct: wasteRate(good, waste), rawValue, depotValue },
    late,
  };
}

function wasteRate(good: number, waste: number): number {
  return good + waste > 0 ? Math.round((waste / (good + waste)) * 100) : 0;
}
