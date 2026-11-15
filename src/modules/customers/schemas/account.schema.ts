/**
 * اسکیماهای Zod حساب مشتری — اعتبارسنجی دوگانه (R-13) + PHASE_03 §۶.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - نام حساب فقط وقتی اجباری است که `kind !== "unknown"` باشد
 *    (Demo app/lead-core.js:۵۷ — سرنخ بدون حساب شناخته‌شده مجاز است).
 *  - شماره تلفن با `normalizePhone` نرمال می‌شود و باید ۱۱ رقمی با صفر
 *    شروع شود (Demo app/core.js:۵۳۸ normPhone).
 *  - شماره تکراری داخل همان درخواست هم رد می‌شود (برای جلوگیری از
 *    رکوردهای تکراری قبل از رسیدن به سرور).
 *
 * پیام‌های فیلد-level انگلیسی هستند (Q-XX deferred: دیکشنری پیام فارسی
 * به فاز بعد موکول شد)؛ فقط پیام خطاهای قانون کسب‌وکار فارسی است.
 */
import { z } from "zod";
import { isValidIranPhone, normalizePhone } from "@core/formatting";
import { paginationSchema } from "@core/validation";

/** نوع حساب — `unknown` یعنی سرنخ بدون حساب شناخته‌شده (lead-core.js:۵۷). */
export const accountKindSchema = z.enum([
  "customer",
  "supplier",
  "partner",
  "unknown",
]);

/** ورودی یک تلفن — `number` توسط Zod transform نرمال می‌شود. */
export const phoneInputSchema = z.object({
  kind: z.string().trim().max(32).default(""),
  number: z.string().trim().min(1).max(32),
});

/** تلفن نرمال‌شده — خروجی transform. */
export const phoneNormalizedSchema = phoneInputSchema.transform((p) => ({
  kind: p.kind,
  number: normalizePhone(p.number),
}));

/** مخاطب حساب — نام اجباری، سمت و تلفن اختیاری. */
export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(96),
  role: z.string().trim().max(96).default(""),
  phone: z.string().trim().max(32).default(""),
});

/**
 * ایجاد حساب — `kind !== "unknown"` نیازمند `name` است.
 *
 * این یک قانون کسب‌وکار Demo است: سرنخ‌های بدون حساب شناخته‌شده با
 * `kind = "unknown"` و بدون نام ذخیره می‌شوند (lead-core.js:۵۷).
 */
export const createAccountSchema = z
  .object({
    name: z.string().trim().max(192).default(""),
    kind: accountKindSchema,
    active: z.boolean().default(true),
    address: z.string().trim().max(512).default(""),
    note: z.string().trim().max(2048).default(""),
    phones: z.array(phoneNormalizedSchema).max(8).default([]),
    contacts: z.array(contactInputSchema).max(16).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.kind !== "unknown" && val.name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "نام حساب برای نوع غیر از unknown اجباری است.",
      });
    }
    const seen = new Set<string>();
    val.phones.forEach((p, i) => {
      if (!isValidIranPhone(p.number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phones", i, "number"],
          message: "شماره تلفن باید ۱۱ رقم و با ۰ شروع شود.",
        });
        return;
      }
      if (seen.has(p.number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phones", i, "number"],
          message: "این شماره تلفن در همین فرم تکرار شده است.",
        });
      }
      seen.add(p.number);
    });
    val.contacts.forEach((c, i) => {
      if (c.phone.length > 0 && !isValidIranPhone(normalizePhone(c.phone))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contacts", i, "phone"],
          message: "شماره تلفن مخاطب باید ۱۱ رقم و با ۰ شروع شود.",
        });
      }
    });
  });

/**
 * ویرایش حساب — همه فیلدها اختیاری؛ `undefined` یعنی «تغییر نده».
 *
 * توجه: `phones`/`contacts` وقتی ارسال شوند **جایگزین کامل** می‌شوند
 * (رفتار Demo در ذخیره حساب — بازنویسی آرایه). چون PHASE_03 فیلد `rev`
 * برای accounts در نظر نگرفته است، حفظ ردیف‌های موجود روی کلاینت است.
 */
export const updateAccountSchema = z
  .object({
    name: z.string().trim().max(192).optional(),
    kind: accountKindSchema.optional(),
    active: z.boolean().optional(),
    address: z.string().trim().max(512).optional(),
    note: z.string().trim().max(2048).optional(),
    phones: z.array(phoneNormalizedSchema).max(8).optional(),
    contacts: z.array(contactInputSchema).max(16).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind !== undefined && val.kind !== "unknown") {
      const name = val.name ?? "";
      if (name.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["name"],
          message: "نام حساب برای نوع غیر از unknown اجباری است.",
        });
      }
    }
    if (val.phones) {
      const seen = new Set<string>();
      val.phones.forEach((p, i) => {
        if (!isValidIranPhone(p.number)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["phones", i, "number"],
            message: "شماره تلفن باید ۱۱ رقم و با ۰ شروع شود.",
          });
          return;
        }
        if (seen.has(p.number)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["phones", i, "number"],
            message: "این شماره تلفن در همین فرم تکرار شده است.",
          });
        }
        seen.add(p.number);
      });
    }
    if (val.contacts) {
      val.contacts.forEach((c, i) => {
        if (c.phone.length > 0 && !isValidIranPhone(normalizePhone(c.phone))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["contacts", i, "phone"],
            message: "شماره تلفن مخاطب باید ۱۱ رقم و با ۰ شروع شود.",
          });
        }
      });
    }
  });

/** کوئری لیست حساب‌ها — جستجو + صفحه‌بندی + شامل حساب‌های غیرفعال. */
export const listAccountsQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(128).default(""),
  includeInactive: z.coerce.boolean().default(false),
});
