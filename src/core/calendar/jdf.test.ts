/**
 * آزمون Crossover کامل JDF — CLAUDE.md §۱۲ (موتور تقویم).
 *
 * هر روز شمسی در بازه ۱۳۰۰–۱۵۹۹ دو بار تبدیل می‌شود:
 *   شمسی → میلادی → JDN → شمسی    (گردش کامل)
 *   JDN → میلادی → JDN             (برعکس دقیق)
 *
 * اگر دو پیاده‌سازی مستقل (j2gDemo و Fliegel–Van Flandern) ناهماهنگ باشند،
 * این آزمون آن را نشان می‌دهد.
 */
import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  gregorianToJdn,
  isLeapJalali,
  jalaliToGregorian,
  jalaliToJdn,
  jdnToGregorian,
  jdnToJalali,
} from "./jdf";

describe("gregorianToJdn / jdnToGregorian", () => {
  it("مبدأ JDN شناخته‌شده: ۲۰۰۰-۰۱-۰۱ = 2451545", () => {
    expect(gregorianToJdn(2000, 1, 1)).toBe(2451545);
  });

  it("برعکس دقیق برای همه JDN در بازه ۲۰۰ سال", () => {
    for (let jdn = 2451545 - 400 * 365; jdn <= 2451545 + 200 * 366; jdn += 1) {
      const g = jdnToGregorian(jdn);
      expect(gregorianToJdn(g.gy, g.gm, g.gd)).toBe(jdn);
    }
  });
});

describe("crossover کامل شمسی (۱۳۰۰–۱۵۹۹)", () => {
  it("هر روز شمسی با گردش کامل به خودش برمی‌گردد", () => {
    let count = 0;
    for (let jy = 1300; jy <= 1599; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        const dim = daysInMonth(jy, jm);
        for (let jd = 1; jd <= dim; jd += 1) {
          const g = jalaliToGregorian(jy, jm, jd);
          const jdn = gregorianToJdn(g.gy, g.gm, g.gd);
          expect(jdnToJalali(jdn)).toEqual({ jy, jm, jd });
          count += 1;
        }
      }
    }
    // ۳۰۰ سال × ۳۶۵.۲۵ ≈ بیش از صد هزار روز — همه پوشش داده شده‌اند
    expect(count).toBeGreaterThan(100_000);
  });

  it("jalaliToJdn و jdnToJalali معکوس یکدیگرند", () => {
    for (let jy = 1390; jy <= 1410; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        const dim = daysInMonth(jy, jm);
        for (let jd = 1; jd <= dim; jd += 1) {
          const jdn = jalaliToJdn(jy, jm, jd);
          const back = jdnToJalali(jdn);
          expect(back).toEqual({ jy, jm, jd });
          expect(jalaliToJdn(back.jy, back.jm, back.jd)).toBe(jdn);
        }
      }
    }
  });
});

describe("ساختار ماه‌ها و کبیسه", () => {
  it("شش ماه ابتدایی همیشه ۳۱ روز، پنج ماه میانی ۳۰ روز", () => {
    for (let jy = 1300; jy <= 1599; jy += 1) {
      for (let jm = 1; jm <= 6; jm += 1) expect(daysInMonth(jy, jm)).toBe(31);
      for (let jm = 7; jm <= 11; jm += 1) expect(daysInMonth(jy, jm)).toBe(30);
      expect(daysInMonth(jy, 12)).toBeGreaterThanOrEqual(29);
      expect(daysInMonth(jy, 12)).toBeLessThanOrEqual(30);
    }
  });

  it("۱۳۹۹ کبیسه است (اسفند ۳۰ روز) و ۱۴۰۰ نیست", () => {
    expect(isLeapJalali(1399)).toBe(true);
    expect(daysInMonth(1399, 12)).toBe(30);
    expect(isLeapJalali(1400)).toBe(false);
    expect(daysInMonth(1400, 12)).toBe(29);
  });

  it("اسفند ۳۰ در سال کبیسه به ۱ فروردین سال بعد می‌رسد", () => {
    const last = jalaliToJdn(1399, 12, 30);
    const next = jalaliToJdn(1400, 1, 1);
    expect(next - last).toBe(1);
    expect(jdnToJalali(last + 1)).toEqual({ jy: 1400, jm: 1, jd: 1 });
  });

  it("سال‌های کبیسه در بازه ۱۳۰۰–۱۵۹۹ وجود دارند و همه اسفند ۳۰ دارند", () => {
    const leaps: number[] = [];
    for (let jy = 1300; jy <= 1599; jy += 1) {
      if (isLeapJalali(jy)) leaps.push(jy);
    }
    expect(leaps.length).toBeGreaterThan(50);
    expect(leaps.includes(1399)).toBe(true);
    expect(leaps.includes(1400)).toBe(false);
  });
});

describe("تاریخ‌های مبهم (نقاط مرزی)", () => {
  it("۱۳۹۹/۱۲/۲۹ در سال کبیسه معتبر است و فردا ۱۳۹۹/۱۲/۳۰ است", () => {
    expect(jdnToJalali(jalaliToJdn(1399, 12, 29) + 1)).toEqual({ jy: 1399, jm: 12, jd: 30 });
  });

  it("روز ۳۱ در ماه ۳۰ روزه نامعتبر است (jdnToJalali هرگز آن را برنمی‌گرداند)", () => {
    // ۱۴۰۰/۰۷/۳۱ وجود ندارد — روز بعد از ۱۴۰۰/۰۷/۳۰ باید ۱۴۰۰/۰۸/۰۱ باشد
    expect(jdnToJalali(jalaliToJdn(1400, 7, 30) + 1)).toEqual({ jy: 1400, jm: 8, jd: 1 });
  });
});
