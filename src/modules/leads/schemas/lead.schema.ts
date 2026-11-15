/**
 * اسکیماهای Zod سرنخ — اعتبارسنجی دوگانه (R-13) + PHASE_03 §۶/§۷.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - شماره سرنخ جدید باید نرمال‌شده ۱۱ رقم و آغاز‌شده با ۰ باشد
 *    (app/lead-core.js:54).
 *  - منبع ورود سرنخ اجباری است و باید یکی از مقادیر لیست sources باشد
 *    (app/leads.js:324: «منبع ورود را انتخاب کنید؛ برای گزارش لازم است»).
 *  - ورود به مرحله lost بدون دلیل ممنوع است (app/leads.js:474).
 *
 * پیام‌های فیلد-level انگلیسی هستند (Q-XX deferred: دیکشنری پیام فارسی
 * به فاز بعد موکول شد)؛ فقط پیام خطاهای قانون کسب‌وکار فارسی است.
 */
import { z } from "zod";
import { isValidIranPhone, normalizePhone } from "@core/formatting";
import { jalaliDateSchema, moneySchema, paginationSchema } from "@core/validation";
import { LEAD_SOURCES } from "../constants/lists";

/** خط سرنخ — app/core.js:199. */
export const leadLineSchema = z.enum(["prod", "agency"]);

/** مرحله سرنخ — server/export.js:48. */
export const leadStageSchema = z.enum(["raw", "opp", "pf", "won", "lost"]);

/** منبع سرنخ — یکی از مقادیر ثابت data.js:76. */
export const leadSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((v) => (LEAD_SOURCES as readonly string[]).includes(v), {
    message: "منبع ورود معتبر نیست.",
  });

/**
 * ایجاد سرنخ — شماره و منبع اجباری (app/lead-core.js:52-65).
 *
 * `phone` توسط transform نرمال می‌شود؛ اعتبارسنجی نهایی ۱۱رقمی در
 * `superRefine` انجام می‌شود تا پیام فارسی Demo حفظ شود.
 */
export const createLeadSchema = z
  .object({
    phone: z.string().trim().min(1).max(32),
    source: leadSourceSchema,
    line: leadLineSchema.default("prod"),
    title: z.string().trim().max(192).default(""),
    amount: moneySchema.nullable().optional(),
    note: z.string().trim().max(2048).default(""),
    ownerId: z.string().trim().min(1).max(64).optional(),
  })
  .superRefine((val, ctx) => {
    const p = normalizePhone(val.phone);
    if (!isValidIranPhone(p)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "شماره را کامل و درست وارد کنید (مثلاً ۰۹۱۲۱۲۳۴۵۶۷).",
      });
    }
  });

/**
 * ویرایش سرنخ — همه فیلدها اختیاری؛ `undefined` یعنی «تغییر نده».
 *
 * `ownerId` فقط با مجوز `leads.assign` قابل تغییر است (CD-23) —
 * این بررسی در Route Handler انجام می‌شود، نه در اینجا.
 */
export const updateLeadSchema = z.object({
  title: z.string().trim().max(192).optional(),
  source: leadSourceSchema.optional(),
  amount: moneySchema.nullable().optional(),
  note: z.string().trim().max(2048).optional(),
  ownerId: z.string().trim().min(1).max(64).optional(),
});

/**
 * جابه‌جایی مرحله سرنخ (PHASE_03 §۷: PATCH /api/leads/[id]).
 *
 * قانون Demo: انتقال به «از دست رفته» بدون دلیل ممنوع است
 * (app/leads.js:474: «دلیل را انتخاب کنید؛ در گزارش لازم است»).
 * reasons در app/data.js:79 (LOST_REASONS).
 */
export const moveStageSchema = z
  .object({
    to: leadStageSchema,
    /** دلیل از دست رفتن — فقط برای to = "lost" اجباری. */
    lostReason: z.string().trim().max(192).optional(),
    /**
     * دلیل عمومی جابه‌جایی — فقط در متن تاریخچه ضمیمه می‌شود.
     * کاربرد اصلی: دکمه بازگرداندن با مقدار «بازگردانده شد»
     * (app/leads.js:539).
     */
    reason: z.string().trim().max(192).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.to === "lost" && (!val.lostReason || val.lostReason.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lostReason"],
        message: "دلیل از دست رفتن را انتخاب کنید؛ در گزارش لازم است.",
      });
    }
  });

/** کوئری لیست سرنخ‌ها — فیلتر خط/مرحله/کارشناس + جستجو + صفحه‌بندی. */
export const listLeadsQuerySchema = paginationSchema.extend({
  line: leadLineSchema.optional(),
  stage: leadStageSchema.optional(),
  ownerId: z.string().trim().min(1).max(64).optional(),
  q: z.string().trim().max(128).default(""),
});

/** ثبت پیگیری («چی شد؟») — نتیجه اختیاری، یادداشت و تاریخ بعدی (PHASE_03 §۹). */
export const createFollowupSchema = z
  .object({
    /** نتیجه تماس — یکی از مقادیر FOLLOWUP_RESULTS (data.js:78). */
    result: z.string().trim().max(96).default(""),
    note: z.string().trim().max(2048).default(""),
    /** تاریخ پیگیری بعدی — `YYYY/MM/DD` ارقام ASCII (CD-06 / PHASE_03 §۹). */
    nextAt: jalaliDateSchema.optional(),
  })
  .refine((val) => val.result.length > 0 || val.note.length > 0, {
    message: "حداقل یکی از نتیجه یا یادداشت باید پر باشد.",
    path: ["note"],
  });
