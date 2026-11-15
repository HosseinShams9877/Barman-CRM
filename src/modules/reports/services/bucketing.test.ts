/**
 * آزمون bucketing ماهانه — رفع R-11 (PHASE_07 §۱۲ / دروازه خروج ۵).
 *
 * مشکل Demo (reports.js:32): `fa(X.fDate(t)).slice(0,7)` — برش رشتهای روی
 * تاریخ نمایشی. با تغییر قالب یا درهم‌آمیختن ارقام فارسی/انگلیسی کلید
 * ماه خراب می‌شد. این آزمون با بازگشت مستقل (jalaliToInstant) کلیدها را
 * برای داده نامتقارن بررسی می‌کند.
 */
import { describe, expect, it } from "vitest";
import { monthKeyOf, rangeFrom, MS_PER_DAY } from "./bucketing";
import { instantToJalaliIso, jalaliToInstant } from "@core/calendar";

describe("monthKeyOf — کلید ماه شمسی (R-11)", () => {
  it("قالب ثابت `YYYY/MM` با ارقام ASCII", () => {
    const key = monthKeyOf(jalaliToInstant({ jy: 1405, jm: 8, jd: 19 }));
    expect(key).toMatch(/^\d{4}\/\d{2}$/);
    expect(key).toBe(monthKeyOf(jalaliToInstant({ jy: 1405, jm: 8, jd: 19 })));
  });

  it("همه روزهای یک ماه یک کلید می‌دهند (شروع/میان/پایان ماه (آبان ۳۰ روزه))", () => {
    const start = jalaliToInstant({ jy: 1405, jm: 8, jd: 1 });
    expect(monthKeyOf(start)).toBe("1405/08");
    expect(monthKeyOf(jalaliToInstant({ jy: 1405, jm: 8, jd: 19 }))).toBe("1405/08");
    expect(monthKeyOf(jalaliToInstant({ jy: 1405, jm: 8, jd: 30 }))).toBe("1405/08");
  });

  it("مرز ماه: روز اول ماه بعد کلید جدید می‌دهد", () => {
    expect(monthKeyOf(jalaliToInstant({ jy: 1405, jm: 9, jd: 1 }))).toBe("1405/09");
    expect(monthKeyOf(jalaliToInstant({ jy: 1406, jm: 1, jd: 1 }))).toBe("1406/01");
  });

  it("داده نامتقارن — کلید با تاریخ کامل قرارداد سازگار است (دروازه خروج ۵)", () => {
    // بازه گسترده با فاصله‌های نامتقارن — شبیه‌سازی داده واقعی گزارش.
    const samples = [
      jalaliToInstant({ jy: 1404, jm: 1, jd: 1 }),
      jalaliToInstant({ jy: 1404, jm: 12, jd: 29 }),
      jalaliToInstant({ jy: 1405, jm: 8, jd: 19 }),
      jalaliToInstant({ jy: 1405, jm: 12, jd: 1 }),
      jalaliToInstant({ jy: 1406, jm: 3, jd: 15 }),
    ];
    for (const ms of samples) {
      // کلید ماه باید پیشوند تاریخ کامل `YYYY/MM/DD` باشد.
      expect(monthKeyOf(ms)).toBe(instantToJalaliIso(ms).slice(0, 7));
    }
  });

  it("کلیدها با مقایسه رشتهای صعودی مرتب می‌شوند", () => {
    const keys = [
      jalaliToInstant({ jy: 1406, jm: 1, jd: 1 }),
      jalaliToInstant({ jy: 1404, jm: 5, jd: 10 }),
      jalaliToInstant({ jy: 1405, jm: 8, jd: 19 }),
    ]
      .map((ms) => monthKeyOf(ms))
      .sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(["1404/05", "1405/08", "1406/01"]);
  });
});

describe("rangeFrom — بازه روزهای اخیر (reports.js:14)", () => {
  it("from = now - days × روز", () => {
    const now = jalaliToInstant({ jy: 1405, jm: 8, jd: 19 });
    expect(rangeFrom(90, now)).toBe(now - 90 * MS_PER_DAY);
    expect(rangeFrom(30, now)).toBe(now - 30 * MS_PER_DAY);
  });
});
