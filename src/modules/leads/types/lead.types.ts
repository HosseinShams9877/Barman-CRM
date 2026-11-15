/**
 * انواع قرارداد سرنخ‌ها — مشترک بین سرویس، API و کلاینت (CD-02).
 *
 * قرارداد تاریخ (CD-06 / PHASE_03 §۹):
 *  - `nextAt`: تاریخ خالص شمسی `YYYY/MM/DD` با ارقام ASCII.
 *  - `at`/`createdAt`/`updatedAt`: لحظه زمان به‌صورت UTC ms.
 */
import type { LeadLineKey } from "../constants/LINE";
import type { LeadStageKey } from "../constants/STAGE";

export type LeadStageKeyType = LeadStageKey;

export type LeadCardPhones = {
  /** شماره‌های نرمال‌شده حساب مرتبط (نمایش با formatPhoneFa). */
  phones: string[];
  /** نام حساب مرتبط — رشته خالی برای سرنخ‌های ناشناس. */
  name: string;
};

export type LeadListItem = {
  id: string;
  line: LeadLineKey;
  stage: LeadStageKey;
  title: string;
  /** مبلغ تخمینی به ریال، گردشده به ۱۰۰٬۰۰۰ (R-08) — nullable. */
  amount: number | null;
  source: string;
  note: string;
  accountId: string | null;
  account: LeadCardPhones | null;
  ownerId: string | null;
  ownerName: string | null;
  /** فقط برای stage = "lost" — دلیل از دست رفتن (app/leads.js:475). */
  lostReason: string | null;
  /** مرحله‌ای که سرنخ از آن به lost رفته — برای بازگرداندن (leads.js:539). */
  lostFrom: LeadStageKey | null;
  /** تاریخ پیگیری بعدی — `YYYY/MM/DD` ارقام ASCII یا null. */
  nextAt: string | null;
  createdAt: number;
  updatedAt: number;
};

export type FollowupRow = {
  id: string;
  /** لحظه رویداد — UTC ms. */
  at: number;
  /** نوع رویداد: "in" | "stage" | "note" | "lost" (app/lead-core.js:72-73). */
  kind: string;
  /** نتیجه تماس — یکی از مقادیر FOLLOWUP_RESULTS (data.js:78). */
  result: string;
  note: string;
  /** تاریخ پیگیری بعدی — `YYYY/MM/DD` ارقام ASCII یا null. */
  nextAt: string | null;
  byUserId: string | null;
  byName: string | null;
};

export type LeadDetail = LeadListItem & {
  followups: FollowupRow[];
  /** شناسه محصولات موردنظر — کاتالوگ در فاز ۴ متصل می‌شود. */
  interest: string[];
};

export type LeadListResult = {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type LeadListParams = {
  line: LeadLineKey | null;
  stage: LeadStageKey | null;
  ownerId: string | null;
  q: string;
};
