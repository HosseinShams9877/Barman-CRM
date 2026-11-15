/**
 * آزمون‌های منطق علامت‌گذاری حرکت‌ها — PHASE_05 §۱۲ (دروازه خروج ۱).
 *
 * جمع جبری qty موجودی را می‌دهد (app/core.js:۲۰۶) — پس علامت هر kind
 * دقیقاً طبق Demo تعیین می‌شود:
 *  - kinds ورودی (open/buy/prod/job) مثبت؛
 *  - kinds خروجی (use/sale/out) منفی؛
 *  - `adj` مستقیم (دوطرفه — adj−/adj+ در app/stock.js:۵۳/۸۸).
 */
import { describe, expect, it } from "vitest";
import { signedQty, isSystemKind } from "./kinds";

describe("signedQty — علامت بر اساس kind", () => {
  it("kinds ورودی مثبت می‌شوند (open/buy/prod/job)", () => {
    expect(signedQty("open", 10)).toBe(10);
    expect(signedQty("buy", 10)).toBe(10);
    expect(signedQty("prod", 10)).toBe(10);
    expect(signedQty("job", 10)).toBe(10);
  });

  it("kinds خروجی منفی می‌شوند (use/sale/out/waste...)", () => {
    expect(signedQty("use", 10)).toBe(-10);
    expect(signedQty("sale", 10)).toBe(-10);
    expect(signedQty("out", 10)).toBe(-10);
  });

  it("waste در raw منفی است (خروج مواد)", () => {
    expect(signedQty("waste", 4)).toBe(-4);
  });

  it("adj مقدار علامت‌دار مستقیم عبور می‌کند (دوطرفه)", () => {
    expect(signedQty("adj", -3)).toBe(-3);
    expect(signedQty("adj", 3)).toBe(3);
  });

  it("مقدار منفی ورودی برای kind خروجی همچنان منفی می‌شود (abs)", () => {
    // کلاینت مثبت می‌فرستد ولی اگر منفی فرستاد، علامت kind حاکم است
    expect(signedQty("use", -10)).toBe(-10);
    expect(signedQty("prod", -10)).toBe(10);
  });
});

describe("isSystemKind — kinds سیستمی برای ثبت دستی (PHASE_05 §۸)", () => {
  it("kinds سیستمی فقط از عملیات کسب‌کار ساخته می‌شوند", () => {
    expect(isSystemKind("buy")).toBe(true);
    expect(isSystemKind("prod")).toBe(true);
    expect(isSystemKind("sale")).toBe(true);
    expect(isSystemKind("use")).toBe(true);
    expect(isSystemKind("job")).toBe(true);
  });

  it("kinds دستی قابل ثبت/ویرایش توسط کاربر انبارند", () => {
    expect(isSystemKind("open")).toBe(false);
    expect(isSystemKind("out")).toBe(false);
    expect(isSystemKind("adj")).toBe(false);
    expect(isSystemKind("waste")).toBe(false);
  });
});
