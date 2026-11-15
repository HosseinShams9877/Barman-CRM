/**
 * مرحله ۳ مهاجرت — نرمال‌سازی تاریخ (MIGRATION_STRATEGY §۳.۳ / Q-10 / R-07).
 *
 * Demo دو قالب تاریخ دارد:
 *  ۱)instant — میلی‌ثانیه UTC (created، updated، moves.t، hist[].t، …)
 *  ۲) date-only ذخیره‌شده به‌مس UTC ms یا رشته `YYYY/MM/DD` (با ارقام فارسی
 *     یا ASCII) — سررسید چک، تاریخ پرداخت، prod.start/end.
 *
 * قدم خروجی فاز ۸ (CD-06):
 *  - instants بدون تغییر مقدار عددی منتقل می‌شوند (UTC ms).
 *  - date-only‌ها به `YYYY/MM/DD` با ارقام ASCII تبدیل می‌شوند.
 *
 * **اصلاح ساکت ممنوع** — هر تاریخی که قابل تجزیه نباشد، `null` برمی‌گرداند
 * و فراخواننده آن را در فهرست رد‌شده‌ها ثبت می‌کند (R-27).
 */
import { instantToJalaliIso, parseJalaliIso } from "@core/calendar";

const PERSIAN_DIGITS = /[۰-۹]/g;

/** تبدیل ارقام فارسی به ASCII (بدون تغییر سایر کاراکترها). */
export function toAsciiDigits(input: string): string {
  return input.replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * تبدیل یک instant (UTC ms) به تاریخ خالص `YYYY/MM/DD` ASCII.
 *
 * @returns تاریخ جلالی نرمال‌شده یا null اگر ورودی فاقد مقدار معتبر باشد.
 */
export function instantToDate(input: unknown): string | null {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) return null;
  return instantToJalaliIso(input);
}

/**
 * نرمال‌سازی یک فیلد date-only با هر دو قالب Demo (R-07).
 *
 * ورودی‌های پذیرفته‌شده:
 *  - عدد مثبت → سال‌جلالی مرکز زمان (UTC ms)
 *  - رشته `YYYY/MM/DD` (ارقام فارسی یا ASCII)
 *
 * @returns `YYYY/MM/DD` ASCII یا null در صورت غیرقابل تجزیه بودن.
 */
export function normalizeDateOnly(input: unknown): string | null {
  if (typeof input === "number") return instantToDate(input);
  if (typeof input === "string") {
    const candidate = toAsciiDigits(input.trim());
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(candidate)) {
      // parseJalaliIso اعتبارسنجی بازه روز/ماه و قالب‌بندی padding را انجام می‌دهد.
      return parseJalaliIso(candidate);
    }
    // رشته عددی (ms به‌صورت متن) را هم می‌پذیریم — Demo گاهی رشته می‌فرستد.
    const asNumber = Number(candidate);
    if (Number.isFinite(asNumber) && asNumber > 0) return instantToDate(asNumber);
  }
  return null;
}

/**
 * نرمال‌سازی یک instant (UTC ms) — بدون تغییر مقدار معتبر.
 *
 * @returns عدد یا null اگر مقدار غیرعددی/غیرمثبت باشد.
 */
export function normalizeInstant(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) return input;
  if (typeof input === "string") {
    const candidate = toAsciiDigits(input.trim());
    const asNumber = Number(candidate);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  }
  return null;
}

/**
 * نرمال‌سازی تاریخ سررسید چک / پرداخت — اولویت با فیلد `due` داخل `chq`
 * و سپس `t` ثبت سند (Demo هنگام ثبت چک، `t` را پر می‌کند).
 */
export function chequeDue(chqDue: unknown, fallbackT: unknown): string | null {
  return normalizeDateOnly(chqDue) ?? normalizeDateOnly(fallbackT);
}
