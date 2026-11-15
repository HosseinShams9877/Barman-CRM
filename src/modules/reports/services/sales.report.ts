/**
 * سرویس گزارش فروش — PHASE_07 §۹ (بازسازی reports.js:28-38).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - سفارش‌های قطعی (stage >= 6 یا done) و لغو‌نشده در بازه (reports.js:30).
 *  - مهر زمانی دسته‌بندی: times[6] (قطعی) → times[9] (تحویل) → created
 *    (reports.js:32).
 *  - bucketing ماهانه با JDN به‌جای برش رشتهای `slice(0,7)` — رفع R-11.
 *  - فروش به تفکیک محصول با فیلتر خط محصول (reports.js:32-33).
 *  - نرخ تبدیل = سفارشهای قطعی / پیشفاکتورهای بازه (reports.js:34).
 *  - فیلتر نقش در سرور: sales فقط سفارش‌های خودش (PHASE_07 §۸).
 */
import { prisma } from "@core/database/client";
import { type Prisma } from "@prisma/client";
import { getSettings } from "@modules/settings/services/settings.service";
import { calcOrder } from "@modules/orders/services/order.service";
import { rangeFrom, monthKeyOf } from "./bucketing";
import type { ReportScope } from "./leads.report";

/** مرحله ۶ = قطعی شدن مشتری (orderStage.ts فاز ۴). */
const CONFIRMED_STAGE = 6;
/** مرحله ۹ = تحویل به مشتری. */
const DELIVERED_STAGE = 9;

export type SalesByProduct = {
  productId: string;
  name: string;
  code: string;
  unit: string;
  qty: number;
  /** مبلغ فروش — فقط برای نقش‌های دارای money.view. */
  amount?: number;
};

export type SalesReport = {
  tiles: {
    orders: number;
    /** جمع فروش — فقط برای نقش‌های دارای money.view. */
    total?: number;
    /** نرخ تبدیل پیش‌فاکتور به خرید (درصد). */
    conversion: number;
  };
  byProduct: SalesByProduct[];
  /** فروش ماهانه — کلید `YYYY/MM` مرتب صعودی (رفع R-11). */
  byMonth: { month: string; total: number }[];
};

type OrderRow = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { select: { name: true; code: true; unit: true; line: true } } } };
    payments: true;
    cheques: true;
  };
}>;

/**
 * گزارش فروش — تجمیع بر اساس محصول و ماه (reports.js:28-38).
 *
 * `hideMoney` (R-32): مبالغ برای نقش‌های فاقد money.view حذف می‌شوند.
 */
export async function salesReport(input: {
  days: number;
  line: "prod" | "agency" | null;
  scope: ReportScope;
  hideMoney: boolean;
}): Promise<SalesReport> {
  const from = rangeFrom(input.days);
  const where: Prisma.OrderWhereInput = {
    status: { not: "cancelled" },
    OR: [{ stage: { gte: CONFIRMED_STAGE } }, { status: "done" }],
  };
  if (input.scope.restrictToOwner) where.ownerId = input.scope.userId;

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: { select: { name: true, code: true, unit: true, line: true } } } },
      payments: true,
      cheques: true,
    },
    orderBy: [{ id: "asc" }],
  });

  const settings = await getSettings();

  // فیلتر بازه بر اساس مهر زمانی قطعی/تحویل/ایجاد (reports.js:32).
  const inRange = orders.filter((o) => bucketTime(o) >= from);

  const byProduct = new Map<string, SalesByProduct>();
  const byMonth = new Map<string, number>();
  let total = 0;

  for (const order of inRange) {
    const calc = calcOrder(order.items, {
      discPct: order.discPct,
      discAmt: order.discAmt,
      ship: order.ship,
      install: order.install,
      noVat: order.noVat,
      vat: settings.vat,
    });
    total += calc.total;

    for (const item of order.items) {
      // فیلتر خط محصول روی اقلام (reports.js:32 — F.line روی l.p.line).
      if (input.line && item.product.line !== input.line) continue;
      const cell = byProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        code: item.product.code,
        unit: item.product.unit,
        qty: 0,
        amount: 0,
      };
      cell.qty += item.qty;
      cell.amount = (cell.amount ?? 0) + Math.round(item.qty * item.price * (1 - item.discount / 100));
      byProduct.set(item.productId, cell);
    }

    // bucketing ماهانه با JDN — رفع R-11 (به جای slice(0,7)).
    const key = monthKeyOf(bucketTime(order));
    byMonth.set(key, (byMonth.get(key) ?? 0) + calc.total);
  }

  // تعداد کل پیش‌فاکتورهای بازه (برای نرخ تبدیل — reports.js:34).
  // نکته: Demo با تقدم عملگرها (a && b || c) همه لغوشده‌ها را شمارش می‌کرد
  // (ریسک ثبت‌شده)؛ اینجا تفسیر دفاعی: پیش‌فاکتور‌های ایجادشده در بازه.
  const pfAll = await prisma.order.count({
    where: {
      createdAt: { gte: from },
      stage: { gte: CONFIRMED_STAGE },
      ...(input.scope.restrictToOwner ? { ownerId: input.scope.userId } : {}),
    },
  });

  const products = [...byProduct.values()].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  return {
    tiles: {
      orders: inRange.length,
      total: input.hideMoney ? undefined : total,
      conversion: pfAll > 0 ? Math.round((inRange.length / pfAll) * 100) : 0,
    },
    byProduct: input.hideMoney ? products.map(({ amount: _a, ...rest }) => rest) : products,
    byMonth: input.hideMoney
      ? []
      : [...byMonth.entries()]
          .map(([month, t]) => ({ month, total: t }))
          .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/**
 * مهر زمانی دسته‌بندی سفارش — times[6] (قطعی) → times[9] (تحویل) → created
 * (reports.js:32). `times` در طرح داده Json است.
 */
function bucketTime(order: { times: Prisma.JsonValue; createdAt: BigInt }): number {
  const times = order.times as Record<string, number> | null;
  const confirmed = times?.["6"];
  if (typeof confirmed === "number") return confirmed;
  const delivered = times?.["9"];
  if (typeof delivered === "number") return delivered;
  return Number(order.createdAt);
}
