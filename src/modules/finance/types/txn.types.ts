/**
 * انواع قرارداد تراکنش مالی (PHASE_06 §۶).
 *
 * `amount` برای نقش‌های noMoney (R-32) حذف می‌شود — تشخیص سمت client
 * با `"amount" in row`.
 */
import type { TxnDirection } from "../constants";

/** ردیف تراکنش — نسخه کامل (نقش با money.view). */
export type TxnRow = {
  id: string;
  /** کلید ذخیره‌شده — مثلاً «هزینه — اجاره» (app/fin.js:147). */
  kind: string;
  direction: TxnDirection;
  amount: number;
  /** تاریخ تراکنش — `YYYY/MM/DD` ASCII (CD-06). */
  at: string;
  who: string | null;
  note: string | null;
  byName: string | null;
  /** تاریخ ثبت — `YYYY/MM/DD` ASCII. */
  createdAt: string;
};

/** ردیف تراکنش — نسخه noMoney (R-32: بدون مبلغ). */
export type TxnRowNoMoney = Omit<TxnRow, "amount">;

/** نتیجه لیست صفحه‌بندی‌شده — نسخه کامل. */
export type TxnListResult = {
  items: TxnRow[];
  /** تعداد کل رکوردهای منطبق. */
  total: number;
  page: number;
  pageSize: number;
};

export type TxnListResultNoMoney = {
  items: TxnRowNoMoney[];
  total: number;
  page: number;
  pageSize: number;
};

/** پارامترهای لیست سرویس — مشابه خرید. */
export type TxnListParams = {
  kind: string | null;
  direction: TxnDirection | null;
  q: string;
  page: number;
  pageSize: number;
};
