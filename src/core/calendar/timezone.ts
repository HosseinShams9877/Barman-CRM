/**
 * تبدیل لحظه (UTC ms) ↔ تاریخ شمسی — قرارداد CD-06 / CD-07.
 *
 * منطقه زمانی ثابت Asia/Tehran با انحراف مثبت ۰۳:۳۰ (۱۲۶۰۰ ثانیه).
 * **Intl ممنوع است (R-16 / CLAUDE.md §۸)** و نیازی هم نیست: ساعت تابستانی
 * ایران از سال ۱۴۰۱ (۲۰۲۲) لغو شده و انحراف ثابت است. این تصمیم در
 * DECISION_LOG ثبت شده است.
 *
 * هیچ وابستگی خارجی و هیچ محاسبه محلی (localTime) وجود ندارد — خروجی روی
 * هر سروری یکسان است.
 */
import { jalaliToJdn, jdnToJalali } from "./jdf";
import type { JalaliDate } from "./jdf";

/** JDN مربوط به ۱۹۷۰-۰۱-۰۱ میلادی (مبدأ Unix). */
const JDN_EPOCH = 2440588;
const MS_PER_DAY = 86_400_000;

/** انحراف ثابت Asia/Tehran: +۰۳:۳۰ = ۱۲۶۰۰ ثانیه. */
export const TEHRAN_UTC_OFFSET_MS = 3.5 * 60 * 60 * 1000;

/**
 * لحظه (UTC ms) → تاریخ شمسی همان روز در تقویم تهران.
 *
 * روز از midnight محلی تهران محاسبه می‌شود، نه از روز UTC.
 */
export function instantToJalali(ms: number): JalaliDate {
  const epochDays = Math.floor((ms + TEHRAN_UTC_OFFSET_MS) / MS_PER_DAY);
  return jdnToJalali(epochDays + JDN_EPOCH);
}

/** لحظه (UTC ms) → تاریخ شمسی با ارقام فارسی، برای نمایش سریع در UI. */
export function instantToJalaliIso(ms: number): string {
  const date = instantToJalali(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.jy}/${pad(date.jm)}/${pad(date.jd)}`;
}

/**
 * تاریخ شمسی → لحظه (UTC ms) شروع همان روز در تقویم تهران
 * (یعنی midnight محلی تهران expressed as UTC).
 */
export function jalaliToInstant(date: JalaliDate): number {
  const epochDays = jalaliToJdn(date.jy, date.jm, date.jd) - JDN_EPOCH;
  return epochDays * MS_PER_DAY - TEHRAN_UTC_OFFSET_MS;
}

/** آغاز روز فعلی در تقویم تهران (UTC ms). */
export function startOfToday(now: number = Date.now()): number {
  const epochDays = Math.floor((now + TEHRAN_UTC_OFFSET_MS) / MS_PER_DAY);
  return epochDays * MS_PER_DAY - TEHRAN_UTC_OFFSET_MS;
}

/**
 * شماره روز هفته (۰ = شنبه … ۶ = جمعه) یک تاریخ شمسی.
 *
 * JDN 2451545 (۲۰۰۰-۰۱-۰۱ میلادی، شنبه) با پیمانه ۷ باقی‌مانده ۵ است،
 * پس `(jdn + 2) mod 7` نگاشت مستقیم به ایندکس JALALI_WEEKDAYS می‌شود.
 */
export function weekdayIndex(date: JalaliDate): number {
  const jdn = jalaliToJdn(date.jy, date.jm, date.jd);
  return ((jdn + 2) % 7 + 7) % 7;
}
