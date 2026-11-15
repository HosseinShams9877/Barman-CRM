/**
 * موتور تقویم هجری شمسی — لوله انتشار (CD-02).
 *
 * تنها موتور تقویم پروژه (R-16 / CLAUDE.md §۸). بدون Intl، بدون وابستگی خارجی.
 */
export { JALALI_MIN_YEAR, JALALI_MAX_YEAR, JALALI_MONTHS, JALALI_WEEKDAYS } from "./constants";
export type { JalaliDate, GregorianDate } from "./jdf";
export {
  gregorianToJdn,
  jdnToGregorian,
  jalaliToGregorian,
  jalaliToJdn,
  jdnToJalali,
  daysInMonth,
  isLeapJalali,
  isValidJalali,
} from "./jdf";
export { formatJalaliIso, formatJalaliFa, formatJalaliLong } from "./format";
export { parseJalali, parseJalaliIso } from "./parse";
export {
  addDays,
  addMonths,
  addYears,
  startOfMonth,
  endOfMonth,
  compareJalali,
  diffDays,
} from "./arithmetic";
export {
  TEHRAN_UTC_OFFSET_MS,
  instantToJalali,
  instantToJalaliIso,
  jalaliToInstant,
  startOfToday,
  weekdayIndex,
} from "./timezone";
