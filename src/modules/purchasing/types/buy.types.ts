/**
 * انواع قرارداد خرید — مشترک بین سرویس، API و کلاینت (CD-02 / PHASE_06 §۶).
 *
 * قرارداد تاریخ (CD-06 / CD-07):
 *  - `chequeDue`: تاریخ خالص شمسی `YYYY/MM/DD` با ارقام ASCII.
 *  - `createdAt`/`updatedAt`/`at`: لحظه زمان به‌صورت UTC ms.
 *
 * نقش‌های بدون `money.view` نسخه‌های بدون فیلد پولی دریافت می‌کنند
 * (R-32/noMoney — فیلتر سمت سرور، طبق رسم فاز ۴/۵).
 */
import type { BuyStatus, ChequeStatus } from "../constants";

// --- اقلام -------------------------------------------------------------

/** قلم خرید — نسخه کامل (با فیلدهای پولی). */
export type BuyItemRow = {
  id: string;
  materialId: string;
  /** نام ماده خام — سرویس از کاتالوگ پر می‌کند. */
  materialName: string;
  /** کد ماده (مثلاً RM-101). */
  materialCode: string;
  /** واحد شمارش (مثلاً «کیلو»). */
  unit: string;
  qty: number;
  /** قیمت واحد به ریال — عدد صحیح (CD-13). */
  price: number;
};

/** قلم خرید — نسخه noMoney (بدون قیمت). */
export type BuyItemRowNoMoney = Omit<BuyItemRow, "price">;

// --- چک‌ها --------------------------------------------------------------

export type BuyChequeRow = {
  id: string;
  /** مبلغ به ریال — عدد صحیح. */
  amount: number;
  /** سررسید — `YYYY/MM/DD` ارقام ASCII. */
  due: string;
  /** شماره صیادی (اختیاری). */
  sayad: string | null;
  status: ChequeStatus;
};

/** چک خرید — نسخه noMoney (فقط سررسید و وضعیت). */
export type BuyChequeRowNoMoney = Omit<BuyChequeRow, "amount">;

// --- تاریخچه وضعیت ------------------------------------------------------

export type BuyStatusLogRow = {
  id: string;
  fromStatus: BuyStatus | null;
  toStatus: BuyStatus;
  /** لحظه انتقال — UTC ms. */
  at: number;
  byName: string | null;
  /** یادداشت انتقال — متن ورودی log خرید در Demo (app/fin-core.js:35). */
  note: string | null;
};

// --- ردیف لیست -----------------------------------------------------------

/** نتیجه محاسبه خرید — محاسبه‌شده، نه ذخیره‌شده (CD-29). */
export type BuyCalc = {
  /** مبلغ کل خرید — مجموع qty × price اقلام (برابر با buys.total). */
  total: number;
  /** جمع مبالغ چک‌های ثبت‌شده. */
  paid: number;
  /**بدهی باقی‌مانده — max(0, total − paid) (fin-core.js:24). */
  due: number;
};

/** ردیف لیست خرید — نسخه کامل. */
export type BuyListItem = {
  id: string;
  status: BuyStatus;
  supplierId: string | null;
  supplierName: string | null;
  /** تعداد اقلام — فیلد غیرپولی. */
  itemCount: number;
  createdByName: string | null;
  /** تاریخ ایجاد — `YYYY/MM/DD` ارقام ASCII. */
  createdAt: string;
  calc: BuyCalc;
  rev: number;
};

/** ردیف لیست خرید — نسخه noMoney (بدون calc). */
export type BuyListItemNoMoney = Omit<BuyListItem, "calc">;

// --- جزئیات --------------------------------------------------------------

/** جزئیات خرید — نسخه کامل. */
export type BuyDetail = {
  id: string;
  status: BuyStatus;
  supplierId: string | null;
  supplierName: string | null;
  note: string | null;
  createdByName: string | null;
  /** تاریخ ایجاد — `YYYY/MM/DD` ارقام ASCII. */
  createdAt: string;
  updatedAt: number;
  rev: number;
  items: BuyItemRow[];
  cheques: BuyChequeRow[];
  statusLog: BuyStatusLogRow[];
  calc: BuyCalc;
};

/** جزئیات خرید — نسخه noMoney. */
export type BuyDetailNoMoney = Omit<
  BuyDetail,
  "calc" | "items" | "cheques"
> & {
  items: BuyItemRowNoMoney[];
  cheques: BuyChequeRowNoMoney[];
};

// --- پارامترها و نتیجه لیست ----------------------------------------------

export type BuyListParams = {
  status: BuyStatus | null;
  supplierId: string | null;
  q: string;
  page: number;
  pageSize: number;
};

export type BuyListResult = {
  items: BuyListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type BuyListResultNoMoney = {
  items: BuyListItemNoMoney[];
  total: number;
  page: number;
  pageSize: number;
};
