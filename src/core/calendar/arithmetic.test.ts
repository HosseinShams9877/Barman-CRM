/**
 * آزمون حساب تاریخ شمسی (addDays/addMonths/addYears/...).
 *
 * addMonths دقیقاً مطابق addJMonths در Demo (app/core.js) است —
 * سرریز روز با تعداد روزهای ماه مقصد محدود می‌شود.
 */
import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  compareJalali,
  diffDays,
  endOfMonth,
  startOfMonth,
} from "./arithmetic";

describe("addDays", () => {
  it("روز ساده", () => {
    expect(addDays({ jy: 1405, jm: 8, jd: 19 }, 1)).toEqual({ jy: 1405, jm: 8, jd: 20 });
    expect(addDays({ jy: 1405, jm: 8, jd: 19 }, -1)).toEqual({ jy: 1405, jm: 8, jd: 18 });
  });

  it("عبور از مرز ماه", () => {
    expect(addDays({ jy: 1405, jm: 8, jd: 30 }, 1)).toEqual({ jy: 1405, jm: 9, jd: 1 });
    expect(addDays({ jy: 1405, jm: 9, jd: 1 }, -1)).toEqual({ jy: 1405, jm: 8, jd: 30 });
  });

  it("عبور از مرز سال (۲۹ اسفند غیرکبیسه)", () => {
    expect(addDays({ jy: 1400, jm: 12, jd: 29 }, 1)).toEqual({ jy: 1401, jm: 1, jd: 1 });
  });

  it("عبور از مرز سال کبیسه (۳۰ اسفند)", () => {
    expect(addDays({ jy: 1399, jm: 12, jd: 30 }, 1)).toEqual({ jy: 1400, jm: 1, jd: 1 });
  });

  it("یک سال کامل گردش می‌کند", () => {
    expect(addDays({ jy: 1405, jm: 1, jd: 1 }, 365)).toEqual({ jy: 1406, jm: 1, jd: 1 });
  });
});

describe("addMonths — منطق Demo addJMonths", () => {
  it("ماه ساده", () => {
    expect(addMonths({ jy: 1405, jm: 1, jd: 15 }, 1)).toEqual({ jy: 1405, jm: 2, jd: 15 });
  });

  it("۳۱ فروردین + ۱ ماه = ۳۱ اردیبهشت (سرریز مجاز در ماه ۳۱ روزه)", () => {
    expect(addMonths({ jy: 1405, jm: 1, jd: 31 }, 1)).toEqual({ jy: 1405, jm: 2, jd: 31 });
  });

  it("۳۱ مرداد + ۱ ماه = ۳۱ شهریور (ماه هدف هم ۳۱ روز است — سرریز مجاز)", () => {
    // شهریور ماه ششم است و ماه‌های ۱–۶ همه ۳۱ روز دارند — محدود نمی‌شود
    expect(addMonths({ jy: 1405, jm: 5, jd: 31 }, 1)).toEqual({ jy: 1405, jm: 6, jd: 31 });
  });

  it("۳۱ شهریور + ۱ ماه = ۳۰ مهر (محدود شدن به ماه ۳۰ روزه — Demo addJMonths)", () => {
    // مهر ماه هفتم است و ۳۰ روز دارد → Math.min(31, 30) = 30
    expect(addMonths({ jy: 1405, jm: 6, jd: 31 }, 1)).toEqual({ jy: 1405, jm: 7, jd: 30 });
  });

  it("۳۰ بهمن + ۱ ماه = ۲۹ اسفند در سال غیرکبیسه", () => {
    expect(addMonths({ jy: 1400, jm: 11, jd: 30 }, 1)).toEqual({ jy: 1400, jm: 12, jd: 29 });
    expect(addMonths({ jy: 1399, jm: 11, jd: 30 }, 1)).toEqual({ jy: 1399, jm: 12, jd: 30 });
  });

  it("عبور از مرز سال", () => {
    expect(addMonths({ jy: 1405, jm: 12, jd: 10 }, 1)).toEqual({ jy: 1406, jm: 1, jd: 10 });
    expect(addMonths({ jy: 1406, jm: 1, jd: 10 }, -1)).toEqual({ jy: 1405, jm: 12, jd: 10 });
  });

  it("ماه منفی سرریز سال را درست حساب می‌کند", () => {
    expect(addMonths({ jy: 1405, jm: 1, jd: 15 }, -1)).toEqual({ jy: 1404, jm: 12, jd: 15 });
    expect(addMonths({ jy: 1405, jm: 3, jd: 1 }, -14)).toEqual({ jy: 1404, jm: 1, jd: 1 });
  });

  it("۱۲ ماه = ۱ سال", () => {
    expect(addMonths({ jy: 1405, jm: 8, jd: 19 }, 12)).toEqual({ jy: 1406, jm: 8, jd: 19 });
  });
});

describe("addYears", () => {
  it("سال ساده", () => {
    expect(addYears({ jy: 1405, jm: 8, jd: 19 }, 1)).toEqual({ jy: 1406, jm: 8, jd: 19 });
  });

  it("۲۹ اسفند + ۱ سال در سال کبیسه محدود می‌شود", () => {
    expect(addYears({ jy: 1399, jm: 12, jd: 30 }, 1)).toEqual({ jy: 1400, jm: 12, jd: 29 });
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("ابتدا و انتهای ماه", () => {
    expect(startOfMonth({ jy: 1405, jm: 8, jd: 19 })).toEqual({ jy: 1405, jm: 8, jd: 1 });
    expect(endOfMonth({ jy: 1405, jm: 8, jd: 19 })).toEqual({ jy: 1405, jm: 8, jd: 30 });
    expect(endOfMonth({ jy: 1405, jm: 1, jd: 19 })).toEqual({ jy: 1405, jm: 1, jd: 31 });
  });

  it("اسفند در سال کبیسه", () => {
    expect(endOfMonth({ jy: 1399, jm: 12, jd: 1 }).jd).toBe(30);
    expect(endOfMonth({ jy: 1400, jm: 12, jd: 1 }).jd).toBe(29);
  });
});

describe("compareJalali / diffDays", () => {
  it("مقایسه", () => {
    expect(compareJalali({ jy: 1405, jm: 8, jd: 19 }, { jy: 1405, jm: 8, jd: 19 })).toBe(0);
    expect(compareJalali({ jy: 1405, jm: 8, jd: 18 }, { jy: 1405, jm: 8, jd: 19 })).toBe(-1);
    expect(compareJalali({ jy: 1405, jm: 8, jd: 20 }, { jy: 1405, jm: 8, jd: 19 })).toBe(1);
  });

  it("فاصله روزانه", () => {
    expect(diffDays({ jy: 1405, jm: 8, jd: 1 }, { jy: 1405, jm: 8, jd: 19 })).toBe(18);
    expect(diffDays({ jy: 1405, jm: 8, jd: 19 }, { jy: 1405, jm: 8, jd: 1 })).toBe(-18);
    expect(diffDays({ jy: 1399, jm: 12, jd: 30 }, { jy: 1400, jm: 1, jd: 1 })).toBe(1);
  });
});
