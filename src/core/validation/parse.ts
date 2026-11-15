/**
 * پل Zod → ApiError — تبدیل خطای اعتبارسنجی به ۴۰۰ با فیلدها (R-13).
 *
 * هر Route Handler این helper را فراخوانی می‌کند تا خطای Zod به پاکت
 * استاندارد `{ error: { code: "VALIDATION", message, fields } }` تبدیل شود.
 */
import { ZodError, type ZodType, type z } from "zod";
import { badRequest, type FieldErrors } from "../errors";

/** نوع نقشه خطا — همان قرارداد `z.core.$ZodErrorMap` زود ۴. */
export type ErrorMapFn = z.core.$ZodErrorMap;

/**
 * تجزیه Zod با خطای ۴۰۰ استاندارد.
 *
 *   const input = parseOrFail(listSchema, raw);
 *   const body  = parseOrFail(createOrderSchema, raw, faErrorMap); // پیام فارسی (CD-28)
 *
 * پارامتر سوم (errorMap) صرفاً اختیاری و **اضافی** است: فاز ۱–۳ آن را پاس
 * نمی‌دهد و رفتارشان دقیقاً مثل قبل می‌ماند (بدون retrofit — CD-28).
 * پیام‌های صریح متناسب روی اسکیما همیشه بر این نقشه ارجح هستند.
 */
export function parseOrFail<T>(schema: ZodType<T>, raw: unknown, errorMap?: ErrorMapFn): T {
  const result =
    errorMap !== undefined
      ? schema.safeParse(raw, { error: errorMap as never })
      : schema.safeParse(raw);
  if (result.success) return result.data;
  throw badRequest("ورودی نامعتبر است.", zodErrorToFields(result.error));
}

/** تبدیل ZodError به نقشه فیلد → پیام فارسی. */
export function zodErrorToFields(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    const existing = fields[key];
    const message = issue.message || "مقدار نامعتبر است.";
    // اولین پیام هر فیلد نگه داشته می‌شود تا پیام‌ها کوتاه بمانند
    if (!existing) fields[key] = message;
  }
  return fields;
}
