/**
 * آزمون اسکیماهای مشترک Zod — R-13 (اعتبارسنجی دوگانه).
 */
import { describe, expect, it } from "vitest";
import {
  idParamSchema,
  jalaliDateSchema,
  moneySchema,
  nonNegativeIntSchema,
  optionalTextSchema,
  paginationSchema,
  phoneSchema,
  positiveIntSchema,
  requiredTextSchema,
} from "./schemas";
import { parseOrFail } from "./parse";
import { badRequest } from "../errors";

describe("jalaliDateSchema", () => {
  it("تاریخ معتبر قبول", () => {
    expect(jalaliDateSchema.safeParse("1405/08/19").success).toBe(true);
    expect(jalaliDateSchema.safeParse("۱۳۹۹/۱۲/۳۰").success).toBe(true);
  });

  it("تاریخ نامعتبر رد", () => {
    expect(jalaliDateSchema.safeParse("1405/13/01").success).toBe(false);
    expect(jalaliDateSchema.safeParse("1400/12/30").success).toBe(false);
    expect(jalaliDateSchema.safeParse("").success).toBe(false);
    expect(jalaliDateSchema.safeParse("1299/01/01").success).toBe(false);
  });

  it("پیام فارسی خطا", () => {
    const r = jalaliDateSchema.safeParse("1405/13/01");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("تاریخ");
  });
});

describe("idParamSchema", () => {
  it("cuid قبول، خالی رد", () => {
    expect(idParamSchema.safeParse({ id: "clxyz123" }).success).toBe(true);
    expect(idParamSchema.safeParse({ id: "" }).success).toBe(false);
    expect(idParamSchema.safeParse({}).success).toBe(false);
  });
});

describe("moneySchema / nonNegativeIntSchema / positiveIntSchema", () => {
  it("مبلغ: عدد صحیح نامنفی", () => {
    expect(moneySchema.safeParse(100000).success).toBe(true);
    expect(moneySchema.safeParse(0).success).toBe(true);
    expect(moneySchema.safeParse(-1).success).toBe(false);
    expect(moneySchema.safeParse(1.5).success).toBe(false);
    expect(moneySchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true);
    expect(moneySchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });

  it("nonNegativeInt", () => {
    expect(nonNegativeIntSchema.safeParse(0).success).toBe(true);
    expect(nonNegativeIntSchema.safeParse(-5).success).toBe(false);
    expect(nonNegativeIntSchema.safeParse(2.5).success).toBe(false);
  });

  it("positiveInt", () => {
    expect(positiveIntSchema.safeParse(1).success).toBe(true);
    expect(positiveIntSchema.safeParse(0).success).toBe(false);
    expect(positiveIntSchema.safeParse(-1).success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("پیش‌فرض امن: صفحه ۱، اندازه ۵۰", () => {
    const r = paginationSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(50);
    }
  });

  it("رشته به عدد تبدیل می‌شود (query string)", () => {
    const r = paginationSchema.safeParse({ page: "2", pageSize: "10" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.page).toBe(2);
  });

  it("مقادیر نامعتبر رد می‌شوند", () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 201 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: "abc" }).success).toBe(false);
  });
});

describe("optionalTextSchema / requiredTextSchema", () => {
  it("متن اختیاری: حداکثر max، trim می‌شود", () => {
    const s = optionalTextSchema(10);
    expect(s.safeParse("  hello  ").data).toBe("hello");
    expect(s.safeParse(undefined).success).toBe(true);
    expect(s.safeParse("a".repeat(11)).success).toBe(false);
  });

  it("متن اجباری: خالی رد می‌شود", () => {
    const s = requiredTextSchema(10);
    expect(s.safeParse("hello").success).toBe(true);
    expect(s.safeParse("   ").success).toBe(false);
    expect(s.safeParse("").success).toBe(false);
    expect(s.safeParse("a".repeat(11)).success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("اشکال مجاز", () => {
    expect(phoneSchema.safeParse("021-12345678").success).toBe(true);
    expect(phoneSchema.safeParse("+98 21 12345678").success).toBe(true);
    expect(phoneSchema.safeParse("(021) 12345678").success).toBe(true);
    expect(phoneSchema.safeParse(undefined).success).toBe(true);
  });

  it("متن نامعتبر رد با پیام فارسی", () => {
    const r = phoneSchema.safeParse("abc");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("تلفن");
  });
});

describe("parseOrFail", () => {
  it("ورودی معتبر → داده", () => {
    expect(parseOrFail(jalaliDateSchema, "1405/08/19")).toBe("1405/08/19");
  });

  it("ورودی نامعتبر → ApiError ۴۰۰ با فیلدها", () => {
    try {
      parseOrFail(paginationSchema, { page: 0 });
      throw new Error("نباید به اینجا برسد");
    } catch (e) {
      expect(e).toBeInstanceOf(badRequest().constructor);
      const err = e as { status: number; code: string; fields?: Record<string, string> };
      expect(err.status).toBe(400);
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.fields).toBeDefined();
      expect(err.fields?.["page"]).toBeDefined();
    }
  });

  it("کد BAD_REQUEST و نه VALIDATION برای ورودی نامعتبر", () => {
    expect(badRequest().code).toBe("BAD_REQUEST");
  });
});
