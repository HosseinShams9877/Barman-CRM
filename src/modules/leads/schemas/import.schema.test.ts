/**
 * آزمون اسکیمای ورود گروهی — PHASE_3 درگاه خروج ۲.
 */
import { describe, expect, it } from "vitest";
import { importLeadsSchema } from "./import.schema";

describe("importLeadsSchema", () => {
  it("CSV معتبر با line پیش‌فرض", () => {
    const parsed = importLeadsSchema.safeParse({
      csv: "phone,source\n09121234567,اینستاگرام",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.line).toBe("prod");
      expect(parsed.data.csv).toContain("09121234567");
    }
  });

  it("line معتبر ارسالی حفظ می‌شود", () => {
    const parsed = importLeadsSchema.safeParse({ csv: "phone\n09121234567", line: "agency" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.line).toBe("agency");
  });

  it("line نامعتبر → نامعتبر", () => {
    expect(importLeadsSchema.safeParse({ csv: "x", line: "nope" }).success).toBe(false);
  });

  it("csv خالی → نامعتبر (حداقل یک خط لازم است)", () => {
    expect(importLeadsSchema.safeParse({ csv: "" }).success).toBe(false);
  });

  it("بیش از حداکثر اندازه (۵۱۲KB) → نامعتبر", () => {
    expect(importLeadsSchema.safeParse({ csv: "x".repeat(512 * 1024 + 1) }).success).toBe(false);
  });

  it("ownerId اختیاری است", () => {
    const parsed = importLeadsSchema.safeParse({ csv: "phone\n09121234567", ownerId: "u2" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.ownerId).toBe("u2");
  });
});
