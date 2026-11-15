/**
 * آزمون تجزیه و قالب‌بندی تاریخ شمسی (CD-06).
 */
import { describe, expect, it } from "vitest";
import { formatJalaliIso, formatJalaliFa, formatJalaliLong } from "./format";
import { parseJalali, parseJalaliIso } from "./parse";
import { addDays } from "./arithmetic";
import { daysInMonth } from "./jdf";

describe("parseJalali", () => {
  it("قالب‌های مجاز را تجزیه می‌کند", () => {
    expect(parseJalali("1405/08/19")).toEqual({ jy: 1405, jm: 8, jd: 19 });
    expect(parseJalali("1405-08-19")).toEqual({ jy: 1405, jm: 8, jd: 19 });
    expect(parseJalali("1405.8.19")).toEqual({ jy: 1405, jm: 8, jd: 19 });
    expect(parseJalali("۱۴۰۵/۰۸/۱۹")).toEqual({ jy: 1405, jm: 8, jd: 19 });
  });

  it("فاصله‌های اطراف نادیده گرفته می‌شوند", () => {
    expect(parseJalali("  1405/08/19  ")).toEqual({ jy: 1405, jm: 8, jd: 19 });
  });

  it("ورودی نامعتبر null برمی‌گرداند (بدون استثنا)", () => {
    expect(parseJalali("")).toBeNull();
    expect(parseJalali("1405")).toBeNull();
    expect(parseJalali("1405/08")).toBeNull();
    expect(parseJalali("1405/08/19/extra")).toBeNull();
    expect(parseJalali("1405/13/01")).toBeNull();
    expect(parseJalali("1405/00/01")).toBeNull();
    expect(parseJalali("1405/08/00")).toBeNull();
    expect(parseJalali("1405/08/32")).toBeNull();
    expect(parseJalali(null)).toBeNull();
    expect(parseJalali(undefined)).toBeNull();
    expect(parseJalali("abc/def/gh")).toBeNull();
  });

  it("روز بر اساس daysInMonth اعتبارسنجی می‌شود (تفاوت با Demo)", () => {
    // ۱۴۰۰ کبیسه نیست → ۳۰ اسفند ندارد
    expect(parseJalali("1400/12/30")).toBeNull();
    // ۱۳۹۹ کبیسه است → ۳۰ اسفند معتبر است
    expect(parseJalali("1399/12/30")).toEqual({ jy: 1399, jm: 12, jd: 30 });
    // ماه‌های ۳۰ روزه (مهر) روز ۳۱ ندارند
    expect(parseJalali("1405/07/31")).toBeNull();
    expect(parseJalali("1405/07/30")).toEqual({ jy: 1405, jm: 7, jd: 30 });
  });

  it("بازه سال محدود است (۱۳۰۰–۱۵۹۹)", () => {
    expect(parseJalali("1299/01/01")).toBeNull();
    expect(parseJalali("1600/01/01")).toBeNull();
    expect(parseJalali("1300/01/01")).toEqual({ jy: 1300, jm: 1, jd: 1 });
    expect(parseJalali("1599/01/01")).toEqual({ jy: 1599, jm: 1, jd: 1 });
  });
});

describe("parseJalaliIso", () => {
  it("قالب ذخیره‌سازی YYYY/MM/DD با ارقام ASCII", () => {
    expect(parseJalaliIso("۱۴۰۵/۸/۱۹")).toBe("1405/08/19");
    expect(parseJalaliIso("1405-8-19")).toBe("1405/08/19");
  });

  it("ورودی نامعتبر null", () => {
    expect(parseJalaliIso("")).toBeNull();
    expect(parseJalaliIso("1400/12/30")).toBeNull();
  });
});

describe("گردش کامل parse ↔ format", () => {
  it("هر تاریخ معتبر، تجزیه و قالب‌بندی مجدد به همان رشته برمی‌گردد", () => {
    const samples = ["1399/12/30", "1400/01/01", "1405/08/19", "1300/01/01", "1599/12/29"];
    for (const s of samples) {
      expect(formatJalaliIso(parseJalali(s)!)).toBe(s);
    }
  });

  it("تجزیه قالب فارسی از خروجی formatJalaliFa برمی‌گردد", () => {
    const d = { jy: 1405, jm: 8, jd: 19 };
    expect(parseJalali(formatJalaliFa(d))).toEqual(d);
  });
});

describe("قالب‌بندی نمایش", () => {
  it("formatJalaliIso ارقام ASCII", () => {
    expect(formatJalaliIso({ jy: 1405, jm: 8, jd: 9 })).toBe("1405/08/09");
  });

  it("formatJalaliFa ارقام فارسی", () => {
    expect(formatJalaliFa({ jy: 1405, jm: 8, jd: 19 })).toBe("۱۴۰۵/۰۸/۱۹");
  });

  it("formatJalaliLong نام ماه فارسی", () => {
    expect(formatJalaliLong({ jy: 1405, jm: 8, jd: 19 })).toBe("۱۹ آبان ۱۴۰۵");
    expect(formatJalaliLong({ jy: 1399, jm: 1, jd: 1 })).toBe("۱ فروردین ۱۳۹۹");
  });
});

describe("هماهنگی parse با موتور JDF", () => {
  it("روز بعد از ۲۹ اسفند در سال غیرکبیسه ۱ فروردین است", () => {
    const last = parseJalali("1400/12/29")!;
    const next = addDays(last, 1);
    expect(formatJalaliIso(next)).toBe("1401/01/01");
    expect(daysInMonth(1400, 12)).toBe(29);
  });
});
