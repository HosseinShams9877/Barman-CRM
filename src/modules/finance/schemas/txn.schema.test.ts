/**
 * آزمون اسکیمای تراکنش مالی — PHASE_06 درگاه خروج (CD-28).
 *
 * سهام کلیدی:
 *  - نوع باید یکی از ۸ گزینه ثابت Demo باشد (app/fin.js:145)؛
 *  - مبلغ عدد صحیح مثبت به ریال (CD-13)؛
 *  - تاریخ خالص `YYYY/MM/DD` با ارقام ASCII (CD-06)؛
 *  - جهت از سوی کاربر پذیرفته نمی‌شود (app/fin.js:147)؛
 *  - ماه جریان نقدی `YYYY/MM` ASCII.
 */
import { describe, expect, it } from "vitest";
import { faErrorMap } from "@core/validation";
import { cashflowQuerySchema, createTxnSchema, txnListQuerySchema } from "./txn.schema";
import { EXPENSE_KIND_LABELS } from "../constants";

const FA = { error: faErrorMap as never };

describe("createTxnSchema", () => {
  it("هزینه معتبر قابل پذیرش است", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: حقوق پرسنل", amount: 50000000, at: "1405/09/01" },
      FA,
    );
    expect(parsed.success).toBe(true);
  });

  it("دریافت متفرقه معتبر قابل پذیرش است", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "دریافت متفرقه", amount: 1200000, at: "1405/09/10", who: "شخص", note: "تبصره" },
      FA,
    );
    expect(parsed.success).toBe(true);
  });

  it("هر ۸ گزینه ثابت Demo قابل پذیرش است (app/fin.js:145)", () => {
    for (const kind of EXPENSE_KIND_LABELS) {
      const parsed = createTxnSchema.safeParse({ kind, amount: 1000, at: "1405/09/01" }, FA);
      expect(parsed.success, `kind=${kind}`).toBe(true);
    }
    expect(EXPENSE_KIND_LABELS).toHaveLength(8);
  });

  it("نوع خارج از فهرست ثابت → خطای فارسی", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اختراعی", amount: 1000, at: "1405/09/01" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        "نوع تراکنش باید یکی از گزینه‌های ثابت فهرست باشد.",
      );
    }
  });

  it("مبلغ اعشاری → خطای فارسی (CD-13)", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 1000.5, at: "1405/09/01" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("مبلغ تراکنش باید عدد صحیح باشد.");
    }
  });

  it("مبلغ صفر → خطای فارسی", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 0, at: "1405/09/01" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("مبلغ تراکنش باید بیشتر از صفر باشد.");
    }
  });

  it("تاریخ نامعتبر → خطای فارسی (CD-06)", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 1000, at: "1405/13/01" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("تاریخ");
    }
  });

  it("تاریخ با ارقام فارسی هم مانند core معتبر شمرده می‌شود (CD-06)", () => {
    // parseJalali ارقام فارسی را می‌پذیرد — رفتار تأیید‌شده core
    // (src/core/validation/schemas.test.ts)؛ اینجا فقط یکپارچگی بررسی می‌شود.
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 1000, at: "۱۴۰۵/۰۹/۰۱" },
      FA,
    );
    expect(parsed.success).toBe(true);
  });

  it("ماه نامعتبر حتی با ارقام فارسی رد می‌شود", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 1000, at: "۱۴۰۵/۱۳/۰۱" },
      FA,
    );
    expect(parsed.success).toBe(false);
  });

  it("فیلد جهت از سوی کاربر پذیرفته نمی‌شود (app/fin.js:147)", () => {
    // direction در اسکیما وجود ندارد — مقدار اضافی نادیده گرفته می‌شود
    // (strict نیست) ولی هیچ مسیری جهت را از ورودی نمی‌پذیرد.
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 1000, at: "1405/09/01", direction: "income" },
      FA,
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("direction" in parsed.data).toBe(false);
    }
  });

  it("یادداشت بیش از ۵۰۰ نویسه → خطا", () => {
    const parsed = createTxnSchema.safeParse(
      { kind: "هزینه: اجاره", amount: 1000, at: "1405/09/01", note: "ا".repeat(501) },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("۵۰۰");
    }
  });
});

describe("txnListQuerySchema", () => {
  it("مقادیر پیش‌فرض صفحه/اندازه صفحه", () => {
    const parsed = txnListQuerySchema.safeParse({}, FA);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(50);
    }
  });

  it("جهت نامعتبر → خطای فارسی", () => {
    const parsed = txnListQuerySchema.safeParse({ direction: "up" }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("جهت تراکنش نامعتبر است.");
    }
  });

  it("جهت‌های مجاز expense/income", () => {
    for (const direction of ["expense", "income"] as const) {
      const parsed = txnListQuerySchema.safeParse({ direction }, FA);
      expect(parsed.success).toBe(true);
    }
  });

  it("page صفر → خطا", () => {
    const parsed = txnListQuerySchema.safeParse({ page: 0 }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("صفحه نامعتبر است.");
    }
  });
});

describe("cashflowQuerySchema", () => {
  it("ماه معتبر ASCII قابل پذیرش است", () => {
    const parsed = cashflowQuerySchema.safeParse({ month: "1405/09" }, FA);
    expect(parsed.success).toBe(true);
  });

  it("ماه با رقم واحد هم مجاز است (۰۹/۹ یکسان)", () => {
    expect(cashflowQuerySchema.safeParse({ month: "1405/9" }, FA).success).toBe(true);
  });

  it("ماه نامعتبر → خطای فارسی", () => {
    for (const month of ["1405/13", "1405", "1405/9/1", "۱۴۰۵/۰۹", "abc"]) {
      const parsed = cashflowQuerySchema.safeParse({ month }, FA);
      expect(parsed.success, `month=${month}`).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(
          "ماه باید با قالب YYYY/MM و ارقام ASCII باشد.",
        );
      }
    }
  });

  it("بدون ماه هم مجاز است (همه ماه‌ها)", () => {
    const parsed = cashflowQuerySchema.safeParse({}, FA);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.month).toBeUndefined();
  });
});
