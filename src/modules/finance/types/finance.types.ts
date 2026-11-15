/**
 * انواع قرارداد گزارش‌های مالی — مطالبات، بدهی و جریان نقدی
 * (PHASE_06 §۵/§۱۲).
 *
 * همه فیلدهای پولی برای نقش‌های noMoney حذف می‌شوند (R-32).
 *
 * مطالبات (Receivables): تجمیع بر اساس حساب — چک‌های دریافتی +
 * نسیه باقی‌مانده سفارش‌ها.
 *
 * بدهی (Payables): چک‌های صادره خرید (issued) + مطالبات تأمین‌کنندگان
 * (مجموع خریدهای تأییدشده و پرداخت‌نشده).
 *
 * جریان نقدی (Cashflow): bucketing ماهانه بر اساس JDN (Q-12 / R-11).
 */
import type { TxnDirection } from "../constants";

// --- مطالبات -----------------------------------------------------------------

/** ردیف مطالبات — یک چک دریافتی یا نسیه باقی‌مانده. */
export type ReceivableRow = {
  accountId: string;
  accountName: string;
  orderId: string | null;
  /** "cheque" = چک دریافتی، "balance" = نسیه باقی‌مانده سفارش. */
  kind: "cheque" | "balance";
  amount: number;
  /** سررسید `YYYY/MM/DD` برای چک؛ null برای نسیه. */
  due: string | null;
};

export type ReceivableRowNoMoney = Omit<ReceivableRow, "amount">;

/** تجمیع مطالبات یک حساب. */
export type ReceivableGroup = {
  accountId: string;
  accountName: string;
  rows: ReceivableRow[];
  chequeAmount: number;
  balanceAmount: number;
  total: number;
};

export type ReceivableGroupNoMoney = Omit<
  ReceivableGroup,
  "rows" | "chequeAmount" | "balanceAmount" | "total"
> & {
  rows: ReceivableRowNoMoney[];
};

export type ReceivablesResult = {
  groups: ReceivableGroup[];
  total: number;
};

export type ReceivablesResultNoMoney = {
  groups: ReceivableGroupNoMoney[];
};

// --- بدهی --------------------------------------------------------------------

/** ردیف بدهی — یک چک صادره یا نسیه باقی‌مانده خرید. */
export type PayableRow = {
  supplierId: string | null;
  supplierName: string | null;
  buyId: string | null;
  /** "cheque" = چک صادره خرید، "balance" = نسیه باقی‌مانده خرید. */
  kind: "cheque" | "balance";
  amount: number;
  /** سررسید `YYYY/MM/DD` برای چک؛ null برای نسیه. */
  due: string | null;
};

export type PayableRowNoMoney = Omit<PayableRow, "amount">;

/** تجمیع بدهی یک تأمین‌کننده. */
export type PayableGroup = {
  supplierId: string;
  supplierName: string;
  rows: PayableRow[];
  chequeAmount: number;
  balanceAmount: number;
  total: number;
};

export type PayableGroupNoMoney = Omit<
  PayableGroup,
  "rows" | "chequeAmount" | "balanceAmount" | "total"
> & {
  rows: PayableRowNoMoney[];
};

export type PayablesResult = {
  groups: PayableGroup[];
  total: number;
};

export type PayablesResultNoMoney = {
  groups: PayableGroupNoMoney[];
};

// --- جریان نقدی ----------------------------------------------------------------

/** ردیف جریان نقدی — یک رویداد پولی در یک ماه. */
export type CashflowRow = {
  /** ماه شمسی `YYYY/MM` (از JDN محاسبه می‌شود — Q-12). */
  month: string;
  /** عنوان رویداد — مثلاً «چک صادره خرید» یا برچسب نوع تراکنش. */
  label: string;
  direction: TxnDirection;
  amount: number;
  /** تاریخ رویداد — `YYYY/MM/DD` ASCII. */
  at: string;
};

export type CashflowRowNoMoney = Omit<CashflowRow, "amount">;

/** تجمیع یک ماه. */
export type CashflowMonth = {
  month: string;
  income: number;
  expense: number;
  /** خالص = income − expense. */
  net: number;
};

export type CashflowMonthNoMoney = Omit<CashflowMonth, "income" | "expense" | "net">;

export type CashflowResult = {
  months: CashflowMonth[];
  rows: CashflowRow[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
};

export type CashflowResultNoMoney = {
  months: CashflowMonthNoMoney[];
  rows: CashflowRowNoMoney[];
};
