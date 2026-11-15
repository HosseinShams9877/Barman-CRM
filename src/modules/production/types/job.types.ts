/**
 * انواع کار تولید — نقشه‌ی مستقیم مدل `Job` (prisma/schema.prisma:۸۱۰)
 * و فیلدهای Demo (app/prod.js:۱۱۹).
 */
import type { JobStatus } from "../constants";

/** یک قلم از پیش‌نمایش BOM — مطابق bomSnapshot در Schema (§۶). */
export interface BomLine {
  /** شناسه ماده اولیه */
  materialId: string;
  /** کد ماده، مثلاً RM-101 */
  code: string;
  /** نام ماده */
  name: string;
  /** واحد شمارش، مثلاً «کیلو» */
  unit: string;
  /** مقدار مصرف به ازای یک واحد محصول (BomItem.qty) */
  perUnit: number;
  /** مقدار کل لازم = perUnit × تعداد محصول */
  total: number;
  /** موجودی فعلی انبار مواد (برای نمایش کسری) */
  onHand: number;
  /** کسری: max(0, total − onHand) — bomShort در Demo (core.js:۲۲۶) */
  short: number;
}

/** خروجی پیش‌نمایش BOM — محاسبه قبل از ایجاد کار (app/prod.js:۱۱۱). */
export interface BomPreview {
  lines: BomLine[];
  /** جمع کسری‌ها — اگر خالی نباشد، شروع تولید مسدود می‌شود (prod.js:۱۲۱). */
  shortages: { materialId: string; name: string; need: number; have: number; short: number }[];
}

/** بدنه ایجاد کار — app/prod.js:۱۱۸. */
export interface CreateJobInput {
  productId: string;
  qty: number;
  color?: string | null;
  /** تاریخ پایان برنامه‌ریزی‌شده (UTC ms) — app/prod.js:۱۱۹ */
  end?: number | null;
}

/** بدنه PATCH — فقط گذار وضعیت طبق state machine. */
export interface UpdateJobInput {
  status: JobStatus;
}

/** بدنه ثبت QC — data-jqc (app/prod.js:۱۲۴). */
export interface QcInput {
  good: number;
  waste: number;
}

/** بدنه دریافت در دپو — jrecv (app/stock.js:۷۳). */
export interface ReceiveInput {
  /** مقدار دریافت‌شده — پیش‌فرض good (app/stock.js:۷۳). */
  qty?: number;
}

/** ردیف کار تولید برای لیست — app/prod.js:۷۸. */
export interface JobRow {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  qty: number;
  color: string | null;
  end: number | null;
  status: JobStatus;
  statusLabel: string;
  good: number | null;
  waste: number | null;
  startedAt: number | null;
  qcAt: number | null;
  recvQty: number | null;
  recvAt: number | null;
  /** تاریخ پایان با فرمت `YYYY/MM/DD` ASCII (CD-06) */
  endDay: string | null;
  createdAt: number;
  createdByName: string;
}

/** جزئیات کار — JobRow + پیش‌نمایش BOM ذخیره‌شده. */
export interface JobDetail extends JobRow {
  bomSnapshot: BomLine[];
}

/** پارامترهای لیست کارها. */
export interface JobListParams {
  status: JobStatus | null;
  q: string;
  page: number;
  pageSize: number;
}

/** نتیجه صفحه‌بندی لیست. */
export interface JobListResult {
  items: JobRow[];
  total: number;
  page: number;
  pageSize: number;
}
