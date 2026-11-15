/**
 * آزمون تبدیل لحظه (UTC ms) ↔ تاریخ شمسی در تقویم تهران (CD-07).
 *
 * انحراف ثابت +۰۳:۳۰ (ساعت تابستانی ایران لغو شده) — Intl استفاده نمی‌شود.
 */
import { describe, expect, it } from "vitest";
import {
  TEHRAN_UTC_OFFSET_MS,
  instantToJalali,
  instantToJalaliIso,
  jalaliToInstant,
  startOfToday,
  weekdayIndex,
} from "./timezone";
import { jalaliToGregorian, jalaliToJdn } from "./jdf";

const MS_PER_DAY = 86_400_000;

describe("jalaliToInstant / instantToJalali", () => {
  it("گردش کامل برای نمونه‌ها", () => {
    const samples = [
      { jy: 1405, jm: 1, jd: 1 },
      { jy: 1405, jm: 8, jd: 19 },
      { jy: 1399, jm: 12, jd: 30 },
      { jy: 1400, jm: 12, jd: 29 },
    ];
    for (const d of samples) {
      expect(instantToJalali(jalaliToInstant(d))).toEqual(d);
    }
  });

  it("شروع روز بر اساس midnight محلی تهران، نه UTC", () => {
    // ۱۴۰۵/۰۸/۱۹ در تقویم تهران: از ۲۰۲۶-۱۱-۰۸ ۲۰:۳۰ UTC شروع می‌شود
    const start = jalaliToInstant({ jy: 1405, jm: 8, jd: 19 });
    expect(start % MS_PER_DAY).toBe(MS_PER_DAY - TEHRAN_UTC_OFFSET_MS);
    expect(instantToJalali(start)).toEqual({ jy: 1405, jm: 8, jd: 19 });
    expect(instantToJalali(start - 1)).toEqual({ jy: 1405, jm: 8, jd: 18 });
    expect(instantToJalali(start + MS_PER_DAY - 1)).toEqual({ jy: 1405, jm: 8, jd: 19 });
    expect(instantToJalali(start + MS_PER_DAY)).toEqual({ jy: 1405, jm: 8, jd: 20 });
  });

  it("یک روز کامل در تقویم تهران ۸۶۴۰۰۰۰ میلی‌ثانیه است", () => {
    const a = jalaliToInstant({ jy: 1405, jm: 8, jd: 19 });
    const b = jalaliToInstant({ jy: 1405, jm: 8, jd: 20 });
    expect(b - a).toBe(MS_PER_DAY);
  });
});

describe("instantToJalaliIso", () => {
  it("قالب ذخیره‌سازی YYYY/MM/DD", () => {
    const start = jalaliToInstant({ jy: 1405, jm: 8, jd: 19 });
    expect(instantToJalaliIso(start)).toBe("1405/08/19");
  });
});

describe("startOfToday", () => {
  it("بازگشت به همان روز instantToJalali", () => {
    const now = jalaliToInstant({ jy: 1405, jm: 8, jd: 19 }) + 3 * 60 * 60 * 1000;
    const today = startOfToday(now);
    expect(today).toBe(jalaliToInstant(instantToJalali(now)));
  });
});

describe("weekdayIndex", () => {
  it("JDN 2451545 (۲۰۰۰-۰۱-۰۱، شنبه) → ۰", () => {
    expect(((2451545 + 2) % 7 + 7) % 7).toBe(0);
  });

  it("۱ فروردین ۱۴۰۵ شنبه است (Nowruz ۱۴۰۵ = ۲۰۲۶-۰۳-۲۱)", () => {
    const g = jalaliToGregorian(1405, 1, 1);
    expect(g).toEqual({ gy: 2026, gm: 3, gd: 21 });
    expect(weekdayIndex({ jy: 1405, jm: 1, jd: 1 })).toBe(0);
  });

  it("مقادیر در بازه ۰–۶", () => {
    for (let jd = 1; jd <= 30; jd += 1) {
      const i = weekdayIndex({ jy: 1405, jm: 8, jd });
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(6);
    }
  });

  it("یک روز بعد، شماره روز هفته یک واحد بیشتر (mod ۷)", () => {
    const a = weekdayIndex({ jy: 1405, jm: 8, jd: 19 });
    const b = weekdayIndex({ jy: 1405, jm: 8, jd: 20 });
    expect((b - a + 7) % 7).toBe(1);
  });

  it("هماهنگی با jalaliToJdn — تغییرات با JDN", () => {
    const jdn = jalaliToJdn(1405, 8, 19);
    expect(weekdayIndex({ jy: 1405, jm: 8, jd: 19 })).toBe(((jdn + 2) % 7 + 7) % 7);
  });
});
