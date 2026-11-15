/**
 * اسکیماهای Zod کار تولید — پیام فارسی (CD-28) + اعتبارسنجی دوگانه (R-13).
 *
 * قوانین کسب‌کار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - محصول و مقدار الزامی است (app/prod.js:۱۱۸ — data-jnew).
 *  - فقط محصولات خط تولید (`line === "prod"`) — app/prod.js:۷۴.
 *  - QC: good + waste ≤ qty — طبق PHASE_05 §۳.۷/§۱۲ (در Demo بررسی
 *    سمت کلاینت وجود ندارد؛ دقیقاً در سرور اجرا می‌شود — انحراف در گزارش).
 *  - گذار وضعیت فقط طبق JOB_TRANSITIONS (state machine Demo).
 */
import { z } from "zod";
import { idParamSchema, paginationSchema } from "@core/validation";
import { JOB_STATUS, JOB_END_DEFAULT_DAYS } from "../constants";

/** مقدار مثبت با حداکثر ۱ میلیون — اعشاری مجاز (م² / کیلو). */
export const positiveQtySchema = z
  .number()
  .positive({ message: "مقدار باید بزرگ‌تر از صفر باشد." })
  .max(1_000_000, { message: "مقدار نمی‌تواند بیشتر از ۱٬۰۰۰٬۰۰۰ باشد." });

/** تاریخ پایان — UTC ms اختیاری (app/prod.js:۱۱۹: `end`). */
export const jobEndSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .optional()
  .nullable();

/** شناسه کار — الگوی PJ-501 (X.nextId("PJ") — core.js:364). */
export const jobIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((v) => /^PJ-\d+$/.test(v), {
    message: "شناسه کار معتبر نیست (مثال: PJ-501).",
  });

export const jobIdParamSchema = idParamSchema.extend({
  id: jobIdSchema,
});

/** وضعیت کار — برای فیلتر لیست و گذار. */
export const jobStatusSchema = z.enum(JOB_STATUS);

/**
 * ایجاد کار تولید — app/prod.js:۱۱۸ (data-jnew):
 * `if (!p || !(q > 0)) { X.toast("محصول و مقدار را وارد کنید"); return; }`
 */
export const createJobSchema = z.object({
  productId: z.string().trim().min(1, { message: "محصول الزامی است." }).max(64),
  qty: positiveQtySchema,
  color: z.string().trim().max(64).optional().nullable(),
  end: jobEndSchema,
});

/**
 * PATCH — فقط گذار وضعیت طبق state machine.
 * مقدار پیش‌فرض end برای نمایش در فرم کلاینت (app/prod.js:۷۵).
 */
export const updateJobSchema = z.object({
  status: jobStatusSchema,
});

/**
 * ثبت QC — data-jqc (app/prod.js:۱۲۴):
 * good و waste از ورودی خوانده می‌شوند و وضعیت به `sent` می‌رود.
 *
 * قانون `good + waste ≤ qty` در سرویس با خطای فارسی رد می‌شود
 * (PHASE_05 §۱۲ — تست سبز دروازه خروج ۳).
 */
export const qcSchema = z.object({
  good: positiveQtySchema,
  waste: z
    .number()
    .min(0, { message: "مقدار ضایعات نمی‌تواند منفی باشد." })
    .max(1_000_000, { message: "مقدار ضایعات بیش از حد مجاز است." }),
});

/**
 * دریافت در دپو — jrecv (app/stock.js:۷۳).
 * مقدار دریافت اختیاری است و پیش‌فرض آن `good` است (app/stock.js:۷۳).
 */
export const receiveJobSchema = z.object({
  qty: positiveQtySchema.optional(),
});

/** کوئری لیست کارها — فیلتر وضعیت + جستجو + صفحه‌بندی. */
export const jobListQuerySchema = paginationSchema.extend({
  status: jobStatusSchema.optional(),
  q: z.string().trim().max(64).default(""),
});

/** پیش‌فرض تاریخ پایان: امروز + ۳ روز — app/prod.js:۷۵. */
export const DEFAULT_END_MS = (): number => Date.now() + JOB_END_DEFAULT_DAYS * 24 * 60 * 60 * 1000;
