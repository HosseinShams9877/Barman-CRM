/**
 * آزمون قالب‌بندی اعداد و مبالغ — پیاده‌سازی وفادار Demo (app/core.js).
 */
import { describe, expect, it } from "vitest";
import { parseFaNumber, toEnDigits, toFaDigits } from "./digits";
import { formatMoney, formatNumber } from "./money";
import { ROUND_STEP, roundToStep } from "./rnd";

describe("toFaDigits", () => {
  it("ارقام ASCII → فارسی", () => {
    expect(toFaDigits("1405/08/19")).toBe("۱۴۰۵/۰۸/۱۹");
    expect(toFaDigits(1234567)).toBe("۱۲۳۴۵۶۷");
  });

  it("null/undefined → رشته خالی", () => {
    expect(toFaDigits(null)).toBe("");
    expect(toFaDigits(undefined)).toBe("");
  });
});

describe("toEnDigits", () => {
  it("ارقام فارسی → ASCII", () => {
    expect(toEnDigits("۱۴۰۵/۰۸/۱۹")).toBe("1405/08/19");
  });

  it("جداکننده هزارگان فارسی حذف، جداکننده اعشار به نقطه", () => {
    expect(toEnDigits("۱٬۲۳۴٬۵۶۷")).toBe("1234567");
    expect(toEnDigits("۱۲٫۵")).toBe("12.5");
  });
});

describe("parseFaNumber", () => {
  it("اعداد فارسی", () => {
    expect(parseFaNumber("۱۲۳")).toBe(123);
    expect(parseFaNumber("۱٬۲۰۰")).toBe(1200);
    expect(parseFaNumber("۱۲٫۵")).toBe(12.5);
  });

  it("ورودی نامعتبر → ۰ (Demo: numIn)", () => {
    expect(parseFaNumber("")).toBe(0);
    expect(parseFaNumber("abc")).toBe(0);
    expect(parseFaNumber(null)).toBe(0);
  });
});

describe("formatMoney (Demo: money)", () => {
  it("گردسازی + گروه‌بندی سه‌تایی + ارقام فارسی", () => {
    expect(formatMoney(1234567)).toBe("۱٬۲۳۴٬۵۶۷");
    expect(formatMoney(0)).toBe("۰");
  });

  it("مقادیر اعشاری گرد می‌شوند", () => {
    expect(formatMoney(1234.5)).toBe("۱٬۲۳۵");
  });

  it("ورودی نامعتبر ۰ می‌شود", () => {
    expect(formatMoney(null)).toBe("۰");
    expect(formatMoney(undefined)).toBe("۰");
    expect(formatMoney("abc")).toBe("۰");
  });
});

describe("formatNumber (Demo: num)", () => {
  it("بدون اعشار: گرد به سه رقم", () => {
    expect(formatNumber(12.3456)).toBe("۱۲٫۳۴۶");
  });

  it("با d: دقیقاً d رقم اعشار", () => {
    expect(formatNumber(12.3456, 1)).toBe("۱۲٫۳");
    expect(formatNumber(12.3456, 2)).toBe("۱۲٫۳۵");
    expect(formatNumber(12, 2)).toBe("۱۲٫۰۰");
  });

  it("ورودی نامعتبر ۰", () => {
    expect(formatNumber(null, 2)).toBe("۰٫۰۰");
  });
});

describe("roundToStep (R-08)", () => {
  it("گردسازی به ضریب ۱۰۰٬۰۰۰ ریال", () => {
    expect(roundToStep(149999)).toBe(100000);
    expect(roundToStep(150000)).toBe(200000);
    expect(roundToStep(100000)).toBe(100000);
    expect(roundToStep(0)).toBe(0);
  });

  it("مقادیر منفی و نامعتبر", () => {
    expect(roundToStep(-149999)).toBe(-100000);
    expect(roundToStep(null)).toBe(0);
    expect(roundToStep("abc")).toBe(0);
  });

  it("ROUND_STEP برابر ۱۰۰۰۰۰ است", () => {
    expect(ROUND_STEP).toBe(100000);
  });
});
