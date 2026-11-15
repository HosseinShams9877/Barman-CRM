/**
 * انواع قرارداد سفارش‌ها/پیش‌فاکتورها — مشترک بین سرویس، API و کلاینت (CD-02).
 *
 * قرارداد تاریخ (CD-06 / CD-07):
 *  - `dueDate`/`paymentDate`/`chequeDue`: تاریخ خالص شمسی `YYYY/MM/DD` با ارقام ASCII.
 *  - `createdAt`/`updatedAt`/`stageAt`/`at`: لحظه زمان به‌صورت UTC ms.
 *
 * نقش‌های بدون `money.view` نسخه‌های بدون فیلد پولی دریافت می‌کنند (R-32/noMoney —
 * فیلتر سمت سرور، طبق `app/order.js:11` در Demo که OPS مبالغ را نمی‌بیند).
 */
import type { OrderStageKey, OrderStatus, StageOwnerRole } from "../constants";

// --- اقلام -------------------------------------------------------------

/** قلم سفارش — نسخه کامل (با فیلدهای پولی). */
export type OrderItemRow = {
  id: string;
  productId: string;
  /** نام محصول در زمان نمایش — سرویس از کاتالوگ پر می‌کند. */
  productName: string;
  /** کد محصول (Demo: p.code). */
  productCode: string;
  /** واحد شمارش محصول (مثلاً "متر مربع"). */
  unit: string;
  qty: number;
  price: number;
  /** درصد تخفیف این قلم (PHASE_04 §۶). */
  discount: number;
  color: string;
};

/** قلم سفارش — نسخه noMoney (بدون قیمت و تخفیف). */
export type OrderItemRowNoMoney = Omit<OrderItemRow, "price" | "discount">;

// --- محاسبه مبالغ (Demo calc(o) — app/core.js:231-240) -------------------

/** نتیجه محاسبه مبالغ سفارش — همیشه محاسبه می‌شود، نه ذخیره‌شده (CD-29). */
export type OrderCalc = {
  /** جمع اقلام قبل از تخفیف: Σ qty × price. */
  sub: number;
  /** مبلغ تخفیف: round(sub × discPct / ۱۰۰) + discAmt. */
  disc: number;
  /** هزینه‌های جانبی: حمل + نصب. */
  extra: number;
  /** مبلغ خالص بعد از تخفیف و هزینه‌های جانبی. */
  net: number;
  /** مالیات بر ارزش افزوده — صفر اگر noVat (calc(o)). */
  vat: number;
  /** مبلغ نهایی قابل پرداخت. */
  total: number;
};

// --- برنامه پرداخت (genPlan — order.js:118-132) --------------------------

/** یک قدم از برنامه پرداخت پیشنهادی. */
export type PlanRow = {
  /** نوع قدم: پیش‌پرداخت نقدی، چک یا اعتبار ( rest ). */
  kind: "cash" | "cheque" | "credit";
  /** مبلغ به ریال، گردشده به ۱۰۰٬۰۰۰ (R-08). */
  amount: number;
  /** سررسید — `YYYY/MM/DD` ارقام ASCII. */
  due: string | null;
  /** برچسب نمایشی (مثلاً «پیش‌پرداخت ۵۰٪»). */
  label: string;
};

/** نتیجه مولد برنامه پرداخت — محاسبه خالص سمت سرور، بدون ذخیره‌سازی. */
export type PlanResult = {
  preset: string;
  rows: PlanRow[];
  /** جمع مبالغ برنامه — باید با total برابر باشد (تلورانس ۱ ریال). */
  sum: number;
};

// --- پرداخت‌ها و چک‌ها -----------------------------------------------------

export type PaymentRow = {
  id: string;
  kind: "cash" | "card";
  amount: number;
  /** تاریخ پرداخت — `YYYY/MM/DD` ارقام ASCII. */
  date: string;
  void: boolean;
  note: string;
  byName: string | null;
  createdAt: number;
};

export type ChequeRow = {
  id: string;
  /** شماره صیادی — دقیقاً ۱۶ رقم یا خالی (Q-06). */
  sayad: string;
  amount: number;
  /** سررسید — `YYYY/MM/DD` ارقام ASCII. */
  due: string;
  status: "hand" | "bank" | "clear" | "bounce";
  bank: string;
  owner: string;
  note: string;
  createdAt: number;
  updatedAt: number;
};

// --- تاریخچه مرحله --------------------------------------------------------

export type StageLogRow = {
  id: string;
  fromStage: number | null;
  toStage: number;
  /** لحظه انتقال — UTC ms. */
  at: number;
  byName: string | null;
  note: string;
  /** نوع انتقال: "stage" | "back" | "skip" | "cancel" | "done". */
  kind: string;
};

/** سند تحویل TR- (qc — order.js:728-747). */
export type HandoffRow = {
  id: string;
  lines: { productId: string; qty: number; color: string }[];
  at: number;
  byName: string | null;
  note: string;
};

// --- آیتم لیست -------------------------------------------------------------

export type OrderListItem = {
  id: string;
  stage: number;
  stageKey: OrderStageKey;
  status: OrderStatus;
  line: "prod" | "agency";
  accountId: string | null;
  accountName: string | null;
  contactName: string | null;
  leadId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  /** درصد تخفیف کل. */
  discPct: number;
  /** محاسبه مبالغ (CD-29) — فقط برای نقش‌های دارای money.view. */
  calc: OrderCalc;
  /** جمع پرداخت‌ها + چک‌های تأییدشده (core.js:245-250 paid). */
  paid: number;
  /** مانده (`total − paid` — core.js:250 balance). */
  balance: number;
  /** تعداد اقلام. */
  itemCount: number;
  /** سررسید نهایی — `YYYY/MM/DD` ارقام ASCII یا null. */
  dueDate: string | null;
  stageAt: number;
  createdAt: number;
  updatedAt: number;
};

/** آیتم لیست — نسخه noMoney: بدون calc/paid/balance/diskPct (R-32). */
export type OrderListItemNoMoney = Omit<
  OrderListItem,
  "calc" | "paid" | "balance" | "discPct"
>;

// --- جزئیات ----------------------------------------------------------------

/** ساختمان برنامه تولید (Demo: o.prod — order.js:719-747). */
export type ProdSchedule = {
  /** شروع تولید — `YYYY/MM/DD` ارقام ASCII. */
  start: string;
  /** پایان تولید — `YYYY/MM/DD` ارقام ASCII (بعد از شروع). */
  end: string;
  acceptedAt: number | null;
  startedAt: number | null;
  note: string;
  /** نتیجه کنترل کیفیت {good, waste, why} (order.js:520). */
  qc: { good: number; waste: number; why: string } | null;
  /** مواد مصرف‌شده در شروع تولید — materialId → مقدار (order.js:726). */
  used: Record<string, number> | null;
};

/** ساختمان آماده‌سازی بار (Demo: o.prep — order.js:762). */
export type PrepInfo = {
  t: number;
  packs: number;
  /** چک‌لیست تیک‌خورده — زیرمجموعه PREP_CHECKS. */
  checks: string[];
  note: string;
};

/** ساختمان تحویل (Demo: o.delivered — order.js:573-576). */
export type DeliveredInfo = {
  t: number;
  /** نام تحویل‌گیرنده. */
  to: string;
};

/** توافق مشتری در قطعی‌سازی (Demo: o.agreed — order.js:452-472). */
export type AgreedInfo = {
  t: number;
  /** نحوه توافق — یکی از کلیدهای AGREED_HOW (order.js:391). */
  how: string;
  note: string;
};

export type OrderDetail = OrderListItem & {
  note: string;
  /** اعتبار پیش‌فاکتور به روز (settings.validDays). */
  validDays: number;
  /** بدون مالیات (calc(o)). */
  noVat: boolean;
  /** هزینه حمل. */
  ship: number;
  /** هزینه نصب. */
  install: number;
  /** مبلغ تخفیف ثابت (calc(o)). */
  discAmt: number;
  preset: string;
  /** مراحل پرش‌شده ۶/۷/۸ (finalize — order.js:470-471). */
  skipped: number[];
  /** یادداشت بازگشت {by, t, text} (data-rvgo). */
  backNote: { by: string; t: number; text: string } | null;
  smOk: { by: string; t: number } | null;
  mgrOk: { by: string; t: number } | null;
  /** مهرهای زمانی هر مرحله {stage: t}. */
  times: Record<string, number>;
  sent: { via: string; at: number } | null;
  prod: ProdSchedule | null;
  prep: PrepInfo | null;
  delivered: DeliveredInfo | null;
  agreed: AgreedInfo | null;
  cancelReason: string | null;
  items: OrderItemRow[];
  payments: PaymentRow[];
  cheques: ChequeRow[];
  stageLog: StageLogRow[];
  handoffs: HandoffRow[];
  /** نقش مسئول مرحله فعلی (STAGES.who — core.js:156-168). */
  stageWho: StageOwnerRole;
  /** مهلت انجام مرحله فعلی به UTC ms از stageAt. */
  stageDue: number;
};

/** جزئیات — نسخه noMoney: اقلام بدون قیمت و بدون فیلدهای پولی. */
export type OrderDetailNoMoney = Omit<
  OrderDetail,
  "calc" | "paid" | "balance" | "discPct" | "discAmt" | "ship" | "install"
> & {
  items: OrderItemRowNoMoney[];
};

export type OrderListResult<T = OrderListItem | OrderListItemNoMoney> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type OrderListParams = {
  stage: number | null;
  status: OrderStatus | null;
  ownerId: string | null;
  q: string;
  page: number;
  pageSize: number;
};

/** نتیجه پرینت امن (R-01) — داده کامل سفارش برای صفحه چاپ توکن‌دار. */
export type PrintableOrder = OrderDetail & {
  company: {
    name: string;
    en: string;
    tagline: string;
    phone: string;
    address: string;
    bale: string;
  };
  vatRate: number;
};
