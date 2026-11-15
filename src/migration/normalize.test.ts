/**
 * آزمون نرمال‌سازی تاریخ — مرحله ۳ (MIGRATION_STRATEGY §۳.۳ / Q-10 / R-07).
 */
import { describe, expect, it } from "vitest";
import { toAsciiDigits, instantToDate, normalizeDateOnly, normalizeInstant, chequeDue } from "./normalize";

describe("toAsciiDigits", () => {
  it("ارقام فارسی را به ASCII تبدیل می‌کند", () => {
    expect(toAsciiDigits("۱۴۰۵/۰۸/۱۹")).toBe("1405/08/19");
    expect(toAsciiDigits("1405/08/19")).toBe("1405/08/19");
  });
});

describe("instantToDate — UTC ms → YYYY/MM/DD", () => {
  it("مهر زمانی معتبر → تاریخ خالص", () => {
    // 1791799605345 ms → 1405/03/01 (تقویم تهران)
    const iso = instantToDate(1791799605345);
    expect(iso).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(iso).not.toBeNull();
  });

  it("ورودی نامعتبر → null بدون استثنا", () => {
    expect(instantToDate(0)).toBeNull();
    expect(instantToDate(-5)).toBeNull();
    expect(instantToDate(NaN)).toBeNull();
    expect(instantToDate("1405/08/19")).toBeNull();
    expect(instantToDate(null)).toBeNull();
  });
});

describe("normalizeDateOnly — هر دو قالب Demo (R-07)", () => {
  it("قالب اول: عدد (UTC ms)", () => {
    expect(normalizeDateOnly(1791799605345)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("قالب دوم: رشته YYYY/MM/DD با ارقام فارسی", () => {
    expect(normalizeDateOnly("۱۴۰۵/۰۸/۱۹")).toBe("1405/08/19");
    expect(normalizeDateOnly("1405/08/19")).toBe("1405/08/19");
    expect(normalizeDateOnly("1405/8/9")).toBe("1405/08/09");
  });

  it("رشته عددی (ms به‌صورت متن)", () => {
    expect(normalizeDateOnly("1791799605345")).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("تاریخ نامعتبر → null (اصلاح ساکت ممنوع)", () => {
    expect(normalizeDateOnly("1405/13/01")).toBeNull();
    expect(normalizeDateOnly("1405/08/32")).toBeNull();
    expect(normalizeDateOnly("نامعتبر")).toBeNull();
    expect(normalizeDateOnly(undefined)).toBeNull();
  });
});

describe("normalizeInstant", () => {
  it("عدد معتبر بدون تغییر", () => {
    expect(normalizeInstant(1791799605345)).toBe(1791799605345);
  });

  it("رشته عددی → عدد", () => {
    expect(normalizeInstant("1791799605345")).toBe(1791799605345);
  });

  it("مقدار نامعتبر → null", () => {
    expect(normalizeInstant("abc")).toBeNull();
    expect(normalizeInstant(0)).toBeNull();
    expect(normalizeInstant(null)).toBeNull();
  });
});

describe("chequeDue", () => {
  it("اولویت با due داخل chq", () => {
    expect(chequeDue(1794391605345, 1791889605345)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("عدم وجود due → fallback به زمان ثبت", () => {
    expect(chequeDue(undefined, 1791889605345)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(chequeDue(null, null)).toBeNull();
  });
});
