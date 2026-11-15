/**
 * سرویس موجودی — محاسبه لحظه‌ای موجودی از حرکت‌ها (CD-08 / PHASE_05 §۵).
 *
 * منبع حقیقت فقط `moves` است — **هیچ فیلد موجودی ذخیره نمی‌شود**.
 *
 * قوانین (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - onHand(wh, item) — جمع جبری qty حرکت‌ها (app/core.js:۲۰۶).
 *  - reserved(item) — مجموع رزرو سفارش‌های باز (app/core.js:۲۰۷):
 *    در پلتفرم فعلی رزرو پیاده‌سازی نشده (فاز ۴ `resv` ندارد) → صفر.
 *  - freeQty = max(0, onHand − reserved) (app/core.js:۲۰۸).
 *  - used30 — مصرف ۳۰ روز اخیر مواد (rawView — app/stock.js:۲۳).
 *  - آستانه min — `m.min && h < m.min` (app/stock.js:۲۷) + بنر.
 *  - value = onHand × price فقط برای نقش‌های غیر-OPS (app/stock.js:۳۱) —
 *    فیلتر در سرور (R-32 / CD-05).
 */
import { prisma } from "@core/database/client";
import type { StockAlert, StockRow, StockRowNoMoney, ReservationCheckResult } from "../types/move.types";
import type { Warehouse } from "../constants";

/** ۳۰ روز به میلی‌ثانیه — X.DAY × ۳۰ در Demo (app/stock.js:۲۳). */
const MS_30D = 30 * 24 * 60 * 60 * 1000;

type ItemInfo = {
  id: string;
  name: string;
  code: string;
  unit: string;
  price: number;
  min?: number | null;
};

/** نقشه موجودی: کلید `${wh}|${itemId}` → جمع جبری qty. */
type OnHandMap = Record<string, number>;

function key(wh: string, item: string): string {
  return `${wh}|${item}`;
}

/** محاسبه نقشه موجودی از همه حرکت‌ها — تجمیعی در دیتابیس (PHASE_05 §۱۳). */
export async function computeOnHand(): Promise<OnHandMap> {
  const groups = await prisma.move.groupBy({
    by: ["wh", "item"],
    _sum: { qty: true },
  });
  const map: OnHandMap = {};
  for (const g of groups) {
    map[key(g.wh, g.item)] = g._sum.qty ?? 0;
  }
  return map;
}

/**
 * مجموع رزروهای سفارش‌های باز برای یک قلم — reserved در Demo
 * (app/core.js:۲۰۷). پلتفرم فاز ۴ رزرو ذخیره نمی‌کند (Q-04 باز)؛
 * تا اضافه شدن، صفر برمی‌گرداند — انحراف در گزارش فاز ۵.
 */
export function reservedQty(_itemId: string, _exceptOrder?: string): number {
  return 0;
}

/** موجودی آزاد: max(0, onHand − reserved) — freeQty در Demo (core.js:۲۰۸). */
export function freeQtyOf(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

/** مصرف ۳۰ روز اخیر یک ماده در انبار مواد (rawView — app/stock.js:۲۳). */
async function computeUsed30(): Promise<Record<string, number>> {
  const since = Date.now() - MS_30D;
  const groups = await prisma.move.groupBy({
    by: ["item"],
    where: { wh: "raw", qty: { lt: 0 }, at: { gt: since } },
    _sum: { qty: true },
  });
  const map: Record<string, number> = {};
  for (const g of groups) {
    map[g.item] = -(g._sum.qty ?? 0);
  }
  return map;
}

/**
 * GET /api/stock — موجودی محاسبه‌شده همه اقلام (raw + depot).
 *
 * اقلام از کاتالوگ خوانده می‌شوند (مواد و محصولات) و موجودی هرکدام از
 * حرکت‌ها محاسبه می‌شود — مطابق rawView/depotView در Demo که تمام
 * اقلام کاتالوگ را با موجودی نشان می‌دهند (app/stock.js:۱۷ و ۲۲).
 */
export async function getStock(hideMoney: boolean): Promise<StockRow[] | StockRowNoMoney[]> {
  const [materials, products, onHand, used30] = await Promise.all([
    prisma.material.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    computeOnHand(),
    computeUsed30(),
  ]);

  const rows: StockRow[] = [];
  for (const m of materials) {
    rows.push(toStockRow(m, "raw", onHand, used30, 0));
  }
  for (const p of products) {
    rows.push(toStockRow(p, "depot", onHand, used30, 0));
  }

  if (hideMoney) {
    return rows.map(({ price, value, ...rest }) => rest);
  }
  return rows;
}

function toStockRow(
  item: ItemInfo,
  wh: Warehouse,
  onHand: OnHandMap,
  used30: Record<string, number>,
  reserved: number,
): StockRow {
  const h = onHand[key(wh, item.id)] ?? 0;
  const min = item.min ?? 0;
  const price = item.price ?? 0;
  return {
    itemId: item.id,
    name: item.name,
    code: item.code,
    unit: item.unit,
    wh,
    onHand: round3(h),
    reserved: round3(reserved),
    free: round3(freeQtyOf(h, reserved)),
    min,
    used30: round3(used30[item.id] ?? 0),
    price,
    value: Math.round(h * price),
  };
}

/** گردسازی سه‌رقم اعشار — مطابق num در Demo (app/core.js:۱۲). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * GET /api/stock/alerts — مواد زیر آستانه min (app/stock.js:۲۷).
 *
 * دکمه «درخواست خرید» در UI به صفحه خرید (فاز ۶) لینک می‌دهد —
 * PHASE_05 §۳.۳: فقط لینک داده‌ای فراهم می‌شود.
 */
export async function getStockAlerts(): Promise<StockAlert[]> {
  const [materials, onHand] = await Promise.all([
    prisma.material.findMany({ orderBy: { name: "asc" } }),
    computeOnHand(),
  ]);
  const alerts: StockAlert[] = [];
  for (const m of materials) {
    const h = onHand[key("raw", m.id)] ?? 0;
    if (m.min > 0 && h < m.min) {
      alerts.push({
        itemId: m.id,
        name: m.name,
        code: m.code,
        unit: m.unit,
        onHand: round3(h),
        min: m.min,
        shortfall: round3(m.min - h),
      });
    }
  }
  return alerts;
}

/**
 * POST /api/reservations/check — guard موجودی رزرو (PHASE_05 §۳.۹).
 *
 * Q-04 باز است (data-daccept در دمو بدون بررسی موجودی) → طبق PHASE_05
 * §۳.۹ مسدودسازی اجرا می‌شود: اگر qty از موجودی آزاد بیشتر باشد،
 * `ok: false` برمی‌گرداند و کلاینت باید جلوی ثبت را بگیرد.
 *
 * ورودی اقلام محصول (depot) است — مطابق رزرو سفارش در دمو (o.resv).
 */
export async function checkReservations(
  items: { productId: string; qty: number }[],
): Promise<ReservationCheckResult> {
  const onHand = await computeOnHand();
  const checked = items.map((it) => {
    const h = onHand[key("depot", it.productId)] ?? 0;
    const reserved = reservedQty(it.productId);
    const free = freeQtyOf(h, reserved);
    return {
      productId: it.productId,
      qty: it.qty,
      onHand: round3(h),
      reserved: round3(reserved),
      free: round3(free),
      ok: it.qty <= free,
    };
  });
  return { items: checked, ok: checked.every((c) => c.ok) };
}

