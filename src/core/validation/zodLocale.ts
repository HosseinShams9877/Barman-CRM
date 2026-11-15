/**
 * نقشه خطای فارسی Zod — CD-28 (فاز ۴).
 *
 * کدهای issue زود ۴ (zod/v4/core/errors.d.ts) را به پیام فارسی برمی‌گرداند.
 * این نقشه از نوع `z.core.\$ZodErrorMap` است و **در زمان parse** از طریق
 * پارامتر اختیاری `parseOrFail(schema, raw, faErrorMap)` پاس داده می‌شود.
 *
 * اولویت پیام‌ها (تأییدشده با آزمون زنده):
 *   ۱) پیام صریح روی خود اسکیما (مثلاً `.min(3, "پیام")` یا `ctx.addIssue({message}))`
 *      — همیشه برنده است؛ بنابراین پیام‌های فارسی inline فاز ۱–۳ دست‌نخورده می‌مانند.
 *   ۲) این نقشه (context error map) — فقط برای issueهای بدون پیام صریح.
 *
 * مکانیزم `z.config()` سراسری عمداً به‌کار گرفته نشد، چون پیام اسکیماهای
 * فاز ۱–۳ را هم تغییر می‌داد (دستور مالک: «Do NOT retrofit Phase 1–3 routes»).
 *
 * اسکیماهای فاز ۱–۳ بدون تغییر باقی می‌مانند (known gap — انحراف D-7 فاز ۳).
 */
import { z } from "zod";

/** زیرمجموعه‌ای از شکل issue زود که این نقشه از آن می‌خواند. */
type FaIssue = {
  code: string;
  expected?: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  /** مرز انحصاری (مثلاً `.positive()` یعنی حداقل ۰ غیرشامل). */
  inclusive?: boolean;
  format?: string;
  divisor?: number | bigint;
  keys?: string[];
  values?: readonly (string | number)[];
};

/** برچسب فارسی انواع Zod برای کد `invalid_type`. */
const TYPE_LABELS: Record<string, string> = {
  string: "متن",
  number: "عدد",
  int: "عدد صحیح",
  bigint: "عدد صحیح بزرگ",
  boolean: "بله/خیر",
  date: "تاریخ",
  array: "فهرست",
  object: "شیء",
  set: "مجموعه",
  file: "فایل",
  null: "تهی",
  undefined: "تعریف‌نشده",
  symbol: "نماد",
  function: "تابع",
};

/** برچسب فارسی قالب‌های `invalid_format` که در پروژه استفاده می‌شوند. */
const FORMAT_LABELS: Record<string, string> = {
  email: "رایانامه نامعتبر است.",
  url: "نشانی اینترنتی نامعتبر است.",
  uuid: "شناسه یکتا (UUID) نامعتبر است.",
  regex: "مقدار با الگوی مورد انتظار مطابقت ندارد.",
  starts_with: "مقدار با پیشوند مورد انتظار شروع نمی‌شود.",
  ends_with: "مقدار به پسوند مورد انتظار ختم نمی‌شود.",
  includes: "مقدار شامل متن مورد انتظار نیست.",
  datetime: "تاریخ و زمان نامعتبر است.",
  date: "تاریخ نامعتبر است.",
  time: "زمان نامعتبر است.",
  duration: "بازه زمانی نامعتبر است.",
  ipv4: "نشانی IPv4 نامعتبر است.",
  ipv6: "نشانی IPv6 نامعتبر است.",
  cidripv4: "بازه IPv4 نامعتبر است.",
  cidripv6: "بازه IPv6 نامعتبر است.",
  base64: "متن کدگذاری‌شده (Base64) نامعتبر است.",
  hex: "متن مبنای شانزده نامعتبر است.",
  jwt: "توکن JWT نامعتبر است.",
  nanoid: "شناسه Nano ID نامعتبر است.",
  cuid: "شناسه CUID نامعتبر است.",
  ulid: "شناسه ULID نامعتبر است.",
};

/** تبدیل عدد/BigInt بزرگ به نمایش فارسی (CD-06: ارقام فارسی در UI). */
function toFa(value: number | bigint): string {
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}

/** برچسب حاشیه: مرز شامل (پیش‌فرض) یا غیرشامل (`.positive()`/`.negative()`). */
function boundWord(inclusive: boolean | undefined, atLeast: boolean): string {
  const exclusive = inclusive === false;
  if (atLeast) return exclusive ? "باید بزرگ‌تر از" : "باید بزرگ‌تر یا مساوی";
  return exclusive ? "باید کوچک‌تر از" : "باید کوچک‌تر یا مساوی";
}

/**
 * پیام فارسی برای یک issue زود.
 * خروجی `undefined` یعنی «پیام پیش‌فرض زود استفاده شود» (هرگز در عمل رخ نمی‌دهد).
 */
export function faIssueMessage(issue: FaIssue): string {
  switch (issue.code) {
    case "invalid_type": {
      const expected = issue.expected ? TYPE_LABELS[issue.expected] ?? issue.expected : "مقدار";
      return `مقدار نامعتبر است؛ ${expected} مورد انتظار بود.`;
    }
    case "too_small": {
      const min = issue.minimum;
      const hasMin = min !== undefined;
      switch (issue.origin) {
        case "string":
          return hasMin ? `باید حداقل ${toFa(min)} نویسه باشد.` : "متن کوتاه است.";
        case "array":
        case "set":
          return hasMin ? `باید حداقل ${toFa(min)} مورد داشته باشد.` : "فهرست خالی است.";
        case "number":
        case "int":
        case "bigint":
          return hasMin
            ? `${boundWord(issue.inclusive, true)} ${toFa(min)} باشد.`
            : "مقدار کوچک است.";
        case "date":
          return "تاریخ باید دیرتر یا مساوی مقدار مجاز باشد.";
        default:
          return "مقدار از حد مجاز کوچک‌تر است.";
      }
    }
    case "too_big": {
      const max = issue.maximum;
      const hasMax = max !== undefined;
      switch (issue.origin) {
        case "string":
          return hasMax ? `باید حداکثر ${toFa(max)} نویسه باشد.` : "متن بلند است.";
        case "array":
        case "set":
          return hasMax ? `باید حداکثر ${toFa(max)} مورد داشته باشد.` : "فهرست بلند است.";
        case "number":
        case "int":
        case "bigint":
          return hasMax
            ? `${boundWord(issue.inclusive, false)} ${toFa(max)} باشد.`
            : "مقدار بزرگ است.";
        case "date":
          return "تاریخ باید زودتر یا مساوی مقدار مجاز باشد.";
        default:
          return "مقدار از حد مجاز بزرگ‌تر است.";
      }
    }
    case "invalid_format": {
      const format = issue.format;
      if (format && FORMAT_LABELS[format]) return FORMAT_LABELS[format] as string;
      return "مقدار با قالب مورد انتظار مطابقت ندارد.";
    }
    case "not_multiple_of":
      return issue.divisor !== undefined
        ? `باید ضریبی از ${toFa(issue.divisor)} باشد.`
        : "مقدار نامعتبر است.";
    case "unrecognized_keys": {
      const keys = issue.keys ?? [];
      return keys.length > 0
        ? `فیلدهای ناشناخته: ${keys.map((k) => `«${k}»`).join("، ")}.`
        : "فیلد ناشناخته وجود دارد.";
    }
    case "invalid_union":
      return "مقدار با هیچ‌یک از حالت‌های مجاز مطابقت ندارد.";
    case "invalid_key":
      return "کلید نامعتبر است.";
    case "invalid_element":
      return "یکی از مقادیر فهرست نامعتبر است.";
    case "invalid_value":
      return "باید یکی از گزینه‌های مجاز انتخاب شود.";
    case "custom":
      return "مقدار نامعتبر است.";
    default:
      return "مقدار نامعتبر است.";
  }
}

/**
 * نقشه خطای فارسی — پاس‌داده‌شده به `parseOrFail(schema, raw, errorMap)`.
 *
 *   const input = parseOrFail(createOrderSchema, raw, faErrorMap);
 */
export const faErrorMap: z.core.$ZodErrorMap = (issue) => faIssueMessage(issue as FaIssue);
