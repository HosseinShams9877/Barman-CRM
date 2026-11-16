/**
 * انواع قرارداد انبار — مشترک بین سرویس، API و کلاینت (CD-02).
 *
 * قرارداد تاریخ (CD-06 / CD-07):
 *  - `day`: تاریخ خالص شمسی `YYYY/MM/DD` با ارقام ASCII.
 *  - `at`: لحظه زمان به‌صورت UTC ms.
 *
 * noMoney (R-32 / app/stock.js:۳۱): نقش‌های بدون `money.view` نسخه‌های
 * بدون قیمت/ارزش دریافت می‌کنند — فیلتر سمت سرور.
 */
import type { MoveKind, Warehouse } from "../constants";

/** یک حرکت انبار — `moves` تنها منبع حقیقت موجودی است (CD-08). */
export type MoveRow = {
  id: string;
  wh: Warehouse;
  /** شناسه محصول (depot) یا ماده (raw). */
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  /** مقدار علامت‌دار ذخیره‌شده — ورود مثبت، خروج منفی (core.js:۲۰۶). */
  qty: number;
  kind: MoveKind;
  kindLabel: string;
  /** سند مرجع: PF- (سفارش)، BY- (خرید)، PJ- (کار تولید). */
  ref: string | null;
  /** لحظه حرکت — UTC ms. */
  at: number;
  /** تاریخ روز حرکت — `YYYY/MM/DD` ارقام ASCII. */
  day: string;
  byName: string | null;
  note: string;
};

export type MoveListParams = {
  wh: Warehouse | null;
  kind: MoveKind | null;
  q: string;
  page: number;
  pageSize: number;
};

export type MoveListResult = {
  items: MoveRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * موجودی محاسبه‌شده یک قلم در یک انبار — read-time aggregation (CD-08).
 *
 * مطابق depotView دمو (app/stock.js:۱۸): h = onHand، r = reserved،
 * f = max(0, h − r)؛ value فقط برای نقش‌های غیر-OPS.
 */
export type StockRow = {
  inTransit?: number;
  itemId: string;
  name: string;
  code: string;
  unit: string;
  wh: Warehouse;
  /** جمع جبری qty حرکت‌ها (core.js:۲۰۶). */
  onHand: number;
  /** مجموع رزرو سفارش‌های باز — تا اضافه شدن رزرو در پلتفرم صفر است. */
  reserved: number;
  /** max(0, onHand − reserved) — موجودی آزاد (core.js:۲۰۸). */
  free: number;
  /** آستانه حداقل مواد (app/stock.js:۲۷: `m.min && h < m.min`). */
  min: number;
  /** مصرف ۳۰ روز اخیر — مجموع |qty| خروج‌های raw (useView دمو). */
  used30: number;
  /** قیمت واحد به ریال — فقط نقش‌های دارای money.view. */
  price: number;
  /** ارزش = onHand × price — فقط نقش‌های دارای money.view. */
  value: number;
};

/** نسخه noMoney — بدون قیمت و ارزش (R-32). */
export type StockRowNoMoney = Omit<StockRow, "price" | "value">;

/** ماده‌ای زیر آستانه min — `/api/stock/alerts` (app/stock.js:۲۷). */
export type StockAlert = {
  itemId: string;
  name: string;
  code: string;
  unit: string;
  onHand: number;
  min: number;
  /** کمبود = min − onHand. */
  shortfall: number;
};

/**
 * نتیجه بررسی رزرو — guard موجودی (PHASE_05 §۳.۹ / `/api/reservations/check`).
 * مطابق freeQty در Demo (app/core.js:۲۰۸): free = max(0, onHand − reserved).
 */
export type ReservationCheckItem = {
  productId: string;
  qty: number;
  onHand: number;
  reserved: number;
  free: number;
  /** آیا qty از موجودی آزاد تجاوز نمی‌کند؟ */
  ok: boolean;
};

export type ReservationCheckResult = {
  items: ReservationCheckItem[];
  /** همه اقلام ok هستند؟ */
  ok: boolean;
};
