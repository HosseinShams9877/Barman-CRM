/**
 * آزمون نقشه خطای فارسی Zod — CD-28 (فاز ۴).
 *
 * یک تست به ازای هر issue code ترجمه‌شده (دستور مالک فاز ۴) +
 * بررسی اولویت پیام صریح اسکیما بر نقشه (بدون retrofit فاز ۱–۳).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { faErrorMap, faIssueMessage } from "./zodLocale";

describe("faIssueMessage — به ازای هر issue code", () => {
  it("invalid_type: نوع مورد انتظار به فارسی", () => {
    const out = z.string().safeParse(5, { error: faErrorMap });
    if (!out.success) {
      expect(out.error.issues[0]?.message).toBe("مقدار نامعتبر است؛ متن مورد انتظار بود.");
      expect(faIssueMessage({ code: "invalid_type", expected: "int" })).toContain("عدد صحیح");
    } else expect.fail("باید نامعتبر باشد");
  });

  it("too_small (string): تعداد نویسه با ارقام فارسی", () => {
    const out = z.string().min(3).safeParse("a", { error: faErrorMap });
    if (!out.success) {
      expect(out.error.issues[0]?.message).toBe("باید حداقل ۳ نویسه باشد.");
    } else expect.fail("باید نامعتبر باشد");
  });

  it("too_small (number): حد پایین عددی", () => {
    const out = z.number().min(5).safeParse(1, { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید بزرگ‌تر یا مساوی ۵ باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("too_big (string): حد بالای نویسه", () => {
    const out = z.string().max(3).safeParse("abcd", { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید حداکثر ۳ نویسه باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("too_big (number): حد بالای عددی", () => {
    const out = z.number().max(5).safeParse(9, { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید کوچک‌تر یا مساوی ۵ باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("too_small (number, مرز غیرشامل — .positive()): حداقل ۰ غیرشامل", () => {
    // `.positive()` یعنی حداقل ۰ به‌صورت انحصاری → مقدار ۰ رد می‌شود
    const out = z.number().int().positive().safeParse(0, { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید بزرگ‌تر از ۰ باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("too_big (number, مرز غیرشامل — .negative()): حداکثر ۰ غیرشامل", () => {
    const out = z.number().negative().safeParse(0, { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید کوچک‌تر از ۰ باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("too_small (array): تعداد اعضای فهرست", () => {
    const out = z.array(z.string()).min(2).safeParse(["a"], { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید حداقل ۲ مورد داشته باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("invalid_format: قالب نامعتبر", () => {
    const out = z.email().safeParse("x", { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("رایانامه نامعتبر است.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("invalid_format (regex): الگوی دلخواه", () => {
    const out = z
      .string()
      .regex(/^0\d{10}$/)
      .safeParse("1", { error: faErrorMap });
    if (!out.success) {
      expect(out.error.issues[0]?.message).toBe("مقدار با الگوی مورد انتظار مطابقت ندارد.");
    } else expect.fail("باید نامعتبر باشد");
  });

  it("not_multiple_of: ضریب مورد انتظار", () => {
    const out = z.number().multipleOf(3).safeParse(4, { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید ضریبی از ۳ باشد.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("unrecognized_keys: فهرست کلیدهای ناشناخته", () => {
    const out = z.object({ a: z.string() }).strict().safeParse({ a: "x", b: 1 }, { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("فیلدهای ناشناخته: «b».");
    else expect.fail("باید نامعتبر باشد");
  });

  it("invalid_union: هیچ‌یک از حالت‌ها", () => {
    const out = z.union([z.string(), z.number()]).safeParse(true, { error: faErrorMap });
    if (!out.success) {
      expect(out.error.issues[0]?.message).toBe("مقدار با هیچ‌یک از حالت‌های مجاز مطابقت ندارد.");
    } else expect.fail("باید نامعتبر باشد");
  });

  it("invalid_key: کلید نامعتبر", () => {
    const msg = faIssueMessage({ code: "invalid_key" });
    expect(msg).toBe("کلید نامعتبر است.");
  });

  it("invalid_element: عضو نامعتبر فهرست", () => {
    const msg = faIssueMessage({ code: "invalid_element" });
    expect(msg).toBe("یکی از مقادیر فهرست نامعتبر است.");
  });

  it("invalid_value: گزینه‌های مجاز (enum)", () => {
    const out = z.enum(["a", "b"]).safeParse("x", { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("باید یکی از گزینه‌های مجاز انتخاب شود.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("custom: پیام پیش‌فرض برای قانون سفارشی", () => {
    const out = z
      .string()
      .refine(() => false)
      .safeParse("x", { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("مقدار نامعتبر است.");
    else expect.fail("باید نامعتبر باشد");
  });

  it("کد ناشناخته → پیام پیش‌فرض", () => {
    expect(faIssueMessage({ code: "some_new_code" })).toBe("مقدار نامعتبر است.");
  });
});

describe("اولویت پیام‌ها (بدون retrofit فاز ۱–۳)", () => {
  it("پیام صریح روی اسکیما بر faErrorMap ارجح است", () => {
    // همان الگوی فاز ۱–۳: پیام فارسی inline — نباید بازنویسی شود
    const out = z.string().min(3, "پیام سطح اسکیما").safeParse("a", { error: faErrorMap });
    if (!out.success) expect(out.error.issues[0]?.message).toBe("پیام سطح اسکیما");
    else expect.fail("باید نامعتبر باشد");
  });

  it("issue تودرتو (داخل object) هم پیام فارسی می‌گیرد", () => {
    const schema = z.object({ name: z.string().min(3), age: z.number().int() });
    const out = schema.safeParse({ name: "a", age: 1.5 }, { error: faErrorMap });
    if (!out.success) {
      const messages = out.error.issues.map((i) => i.message);
      expect(messages).toContain("باید حداقل ۳ نویسه باشد.");
      expect(messages).toContain("مقدار نامعتبر است؛ عدد صحیح مورد انتظار بود.");
    } else expect.fail("باید نامعتبر باشد");
  });

  it("بدون errorMap رفتار فاز ۱–۳ تغییر نمی‌کند (پیام انگلیسی زود)", () => {
    const out = z.string().min(3).safeParse("a");
    if (!out.success) expect(out.error.issues[0]?.message).toMatch(/Too small/);
    else expect.fail("باید نامعتبر باشد");
  });
});
