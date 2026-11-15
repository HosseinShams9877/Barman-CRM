/**
 * آزمون اسکیمای حساب مشتری — PHASE_3 درگاه خروج ۲.
 *
 * قوانین کسب‌وکار (ارجاع به Demo):
 *  - نام حساب فقط وقتی kind !== unknown است اجباری است (app/lead-core.js:57).
 *  - شماره تلفن نرمال‌شده باید ۱۱ رقم و آغاز با ۰ باشد (app/core.js:538).
 *  - شماره تکراری داخل همان درخواست رد می‌شود.
 */
import { describe, expect, it } from "vitest";
import {
  accountKindSchema,
  createAccountSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from "./account.schema";

describe("createAccountSchema", () => {
  it("حساب مشتری با نام و تلفن معتبر → معتبر + نرمال‌سازی تلفن", () => {
    const parsed = createAccountSchema.safeParse({
      name: "شرکت نمونه",
      kind: "customer",
      phones: [{ kind: "همراه", number: "09121234567" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("شرکت نمونه");
      expect(parsed.data.phones[0]?.number).toBe("09121234567");
      expect(parsed.data.active).toBe(true);
      expect(parsed.data.contacts).toEqual([]);
    }
  });

  it("kind=customer بدون نام → نامعتبر با پیام قانون کسب‌وکار", () => {
    const parsed = createAccountSchema.safeParse({ kind: "customer" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "name");
      expect(issue?.message).toBe("نام حساب برای نوع غیر از unknown اجباری است.");
    }
  });

  it("kind=unknown بدون نام → معتبر (سرنخ بدون حساب شناخته‌شده)", () => {
    const parsed = createAccountSchema.safeParse({ kind: "unknown" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("");
  });

  it("تلفن نامعتبر → نامعتبر با پیام فارسی", () => {
    const parsed = createAccountSchema.safeParse({
      name: "x",
      kind: "customer",
      phones: [{ kind: "", number: "12345" }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "phones.0.number");
      expect(issue?.message).toBe("شماره تلفن باید ۱۱ رقم و با ۰ شروع شود.");
    }
  });

  it("تلفن تکراری داخل همان فرم → نامعتبر", () => {
    const parsed = createAccountSchema.safeParse({
      name: "x",
      kind: "customer",
      phones: [
        { kind: "", number: "09121234567" },
        { kind: "", number: "09121234567" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "phones.1.number");
      expect(issue?.message).toBe("این شماره تلفن در همین فرم تکرار شده است.");
    }
  });

  it("تلفن مخاطب نامعتبر → نامعتبر", () => {
    const parsed = createAccountSchema.safeParse({
      name: "x",
      kind: "customer",
      contacts: [{ name: "رضا", phone: "98765" }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "contacts.0.phone")).toBe(true);
    }
  });

  it("تلفن مخاطب خالی → معتبر (اختیاری)", () => {
    const parsed = createAccountSchema.safeParse({
      name: "x",
      kind: "customer",
      contacts: [{ name: "رضا" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("بیش از ۸ تلفن → نامعتبر", () => {
    const parsed = createAccountSchema.safeParse({
      name: "x",
      kind: "customer",
      phones: Array.from({ length: 9 }, (_, i) => ({ kind: "", number: `0912123456${i}` })),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("updateAccountSchema", () => {
  it("بدون فیلد → معتبر", () => {
    expect(updateAccountSchema.safeParse({}).success).toBe(true);
  });

  it("تغییر kind به customer بدون name → نامعتبر", () => {
    const parsed = updateAccountSchema.safeParse({ kind: "customer" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "name")).toBe(true);
    }
  });

  it("تغییر kind به unknown بدون name → معتبر", () => {
    expect(updateAccountSchema.safeParse({ kind: "unknown" }).success).toBe(true);
  });

  it("phones ارسالی جایگزین کامل می‌شوند (آرایه معتبر)", () => {
    const parsed = updateAccountSchema.safeParse({
      phones: [{ kind: "دفتری", number: "02122334455" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("listAccountsQuerySchema", () => {
  it("پیش‌فرض‌ها", () => {
    const parsed = listAccountsQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.q).toBe("");
      expect(parsed.data.includeInactive).toBe(false);
      expect(parsed.data.page).toBe(1);
    }
  });

  it("includeInactive به‌صورت coerce بولی کار می‌کند", () => {
    const parsed = listAccountsQuerySchema.safeParse({ includeInactive: "1" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.includeInactive).toBe(true);
  });

  it("kind خارج از لیست → نامعتبر", () => {
    expect(accountKindSchema.safeParse("vip").success).toBe(false);
    expect(accountKindSchema.safeParse("customer").success).toBe(true);
  });
});
