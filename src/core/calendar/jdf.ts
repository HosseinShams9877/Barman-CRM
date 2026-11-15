/**
 * هسته تبدیل JDF — تقویم شمسی ↔ میلادی ↔ JDN.
 *
 * `jalaliToGregorian` پیاده‌سازی دقیق `j2g` در Demo (app/core.js:554) است.
 * بقیه توابع از روی آن ساخته شده‌اند:
 *
 *   - `jalaliToJdn`  = gregorianToJdn ∘ jalaliToGregorian
 *   - `jdnToJalali`  = جستجوی سال/ماه روی `jalaliToJdn` (برعکس دقیق)
 *   - `daysInMonth`  = فاصله JDN ابتدای دو ماه پی‌درپی
 *   - `isLeap`       = daysInMonth(y, 12) === 30 (مانند jDays در Demo)
 *
 * به این ترتیب یک موتور واحد داریم (نه چند موتور موازی) و هرگونه خطا
 * در تست crossover دیده می‌شود.
 */

export type JalaliDate = { jy: number; jm: number; jd: number };
export type GregorianDate = { gy: number; gm: number; gd: number };

const floor = Math.floor;

/** JDN تاریخ میلادی — الگوریتم Fliegel–Van Flandern. */
export function gregorianToJdn(gy: number, gm: number, gd: number): number {
  const a = floor((14 - gm) / 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  return (
    gd +
    floor((153 * m + 2) / 5) +
    365 * y +
    floor(y / 4) -
    floor(y / 100) +
    floor(y / 400) -
    32045
  );
}

/** برعکس gregorianToJdn — الگوریتم Fliegel–Van Flandern. */
export function jdnToGregorian(jdn: number): GregorianDate {
  let l = jdn + 68569;
  const n = floor((4 * l) / 146097);
  l = l - floor((146097 * n + 3) / 4);
  const i = floor((4000 * (l + 1)) / 1461001);
  l = l - floor((1461 * i) / 4) + 31;
  const j = floor((80 * l) / 2447);
  const gd = l - floor((2447 * j) / 80);
  l = floor(j / 11);
  const gm = j + 2 - 12 * l;
  const gy = 100 * (n - 49) + i + l;
  return { gy, gm, gd };
}

/**
 * تبدیل شمسی → میلادی — پیاده‌سازی وفادار `j2g` در Demo (app/core.js:554).
 * هیچ تغییری در ریاضیات داده نشده است (ـ در Demo معادل Math.floor است و
 * پیش‌کاهش `--days` دقیقاً حفظ شده).
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  let y = jy + 1595;
  let days =
    -355668 +
    365 * y +
    floor(y / 33) * 8 +
    floor(((y % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    days -= 1;
    gy += 100 * floor(days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const gd = days + 1;
  const feb =
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28;
  const monthLengths = [0, 31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let d = gd;
  for (let m = 0; m < 13; m += 1) {
    const len = monthLengths[m];
    if (len === undefined) break;
    if (d <= len) break;
    d -= len;
    gm = m + 1;
  }
  if (gm === 0) gm = 1;
  return { gy, gm, gd: d };
}

/** تبدیل شمسی → JDN. */
export function jalaliToJdn(jy: number, jm: number, jd: number): number {
  const g = jalaliToGregorian(jy, jm, jd);
  return gregorianToJdn(g.gy, g.gm, g.gd);
}

/** تبدیل JDN → شمسی — برعکس دقیق jalaliToJdn. */
export function jdnToJalali(jdn: number): JalaliDate {
  const { gy } = jdnToGregorian(jdn);
  // تخمین سال شمسی (حداکثر یک واحد خطا دارد) سپس اصلاح:
  let jy = gy - 621;
  while (jalaliToJdn(jy + 1, 1, 1) <= jdn) jy += 1;
  while (jalaliToJdn(jy, 1, 1) > jdn) jy -= 1;

  let jm = 1;
  let jd = 1;
  for (let m = 1; m <= 12; m += 1) {
    const start = jalaliToJdn(jy, m, 1);
    const end = m < 12 ? jalaliToJdn(jy, m + 1, 1) : jalaliToJdn(jy + 1, 1, 1);
    if (jdn >= start && jdn < end) {
      jm = m;
      jd = jdn - start + 1;
      break;
    }
    if (m === 12) {
      // jdn در بازه مجاز نیست — به آخرین روز سال باز می‌گردد (امکان‌پذیر نیست)
      jm = 12;
      jd = jdn - jalaliToJdn(jy, 12, 1) + 1;
    }
  }
  return { jy, jm, jd };
}

/**
 * تعداد روزهای ماه شمسی — استنتاج از jalaliToJdn.
 * دقیقاً معادل jDays در Demo: ۶ ماه اول ۳۱ روز، ۵ ماه بعدی ۳۰ روز،
 * اسفند در سال کبیسه ۳۰ روز وگرنه ۲۹ روز.
 */
export function daysInMonth(jy: number, jm: number): number {
  if (jm < 1 || jm > 12) return 0;
  const start = jalaliToJdn(jy, jm, 1);
  const next = jm < 12 ? jalaliToJdn(jy, jm + 1, 1) : jalaliToJdn(jy + 1, 1, 1);
  return next - start;
}

/** سال کبیسه شمسی — اسفند ۳۰ روز دارد (همان منطق jDays در Demo). */
export function isLeapJalali(jy: number): boolean {
  return daysInMonth(jy, 12) === 30;
}

/** اعتبارسنجی تاریخ شمسی. */
export function isValidJalali(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) {
    return false;
  }
  if (jm < 1 || jm > 12) return false;
  if (jd < 1) return false;
  return jd <= daysInMonth(jy, jm);
}
