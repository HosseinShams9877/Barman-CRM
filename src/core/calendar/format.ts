/**
 * قالب‌بندی تاریخ شمسی — نمایش و ذخیره‌سازی (CD-06 / CD-07).
 *
 * دو قالب مجزا:
 *   - `formatJalaliIso`:  `YYYY/MM/DD` با ارقام ASCII — برای ذخیره‌سازی و قراردادها
 *   - `formatJalaliFa`:   ارقام فارسی برای نمایش در UI
 *   - `formatJalaliLong`: تاریخ با نام ماه فارسی برای نمایش
 */
import { JALALI_MONTHS } from "./constants";
import { toFaDigits } from "../formatting/digits";
import type { JalaliDate } from "./jdf";

const pad = (n: number): string => String(n).padStart(2, "0");

/** `1405/08/19` — قالب ذخیره‌سازی (ارقام ASCII). */
export function formatJalaliIso(date: JalaliDate): string {
  return `${date.jy}/${pad(date.jm)}/${pad(date.jd)}`;
}

/** `۱۴۰۵/۰۸/۱۹` — قالب نمایش (ارقام فارسی). */
export function formatJalaliFa(date: JalaliDate): string {
  return toFaDigits(formatJalaliIso(date));
}

/** `۱۴ آبان ۱۴۰۵` — قابل‌خواندن برای انسان. */
export function formatJalaliLong(date: JalaliDate): string {
  const month = JALALI_MONTHS[date.jm - 1] ?? "";
  return `${toFaDigits(date.jd)} ${month} ${toFaDigits(date.jy)}`;
}
