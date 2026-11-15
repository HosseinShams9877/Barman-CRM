/**
 * آزمون اسکیمای خرید — PHASE_06 درگاه خروج: اعتبارسنجی با پیام فارسی.
 *
 * سهام کلیدی:
 *  - بدنه معتبر ایجاد/ویرایش قابل پذیرش است؛
 *  - خرید بدون قلم → خطای فارسی (app/buy.js:138)؛
 *  - قیمت/مقدار نامعتبر → پیام فارسی (CD-13)؛
 *  - `rev` الزامی در ویرایش و گذارها (R-06)؛
 *  - سررسید چک باید تاریخ شمسی معتبر باشد (CD-06)؛
 *  - query لیست صفحه‌بندی/وضعیت را اعتبارسنجی می‌کند.
 *
 * پیام‌ها با faErrorMap فارسی بررسی می‌شوند (CD-28).
 */
import { describe, expect, it } from "vitest";
import { faErrorMap } from "@core/validation";
import {
  approveBuySchema,
  buyListQuerySchema,
  createBuySchema,
  financeBuySchema,
  receiveBuySchema,
  updateBuySchema,
} from "./buy.schema";
import { createBuyChequeSchema, updateBuyChequeSchema } from "./buy-cheque.schema";

const FA = { error: faErrorMap as never };
const VALID_ITEM = { materialId: "mat-1", qty: 10, price: 5000 };
const VALID_CHEQUE = { amount: 100000, due: "1405/09/01", sayad: "1234567890" };

describe("createBuySchema", () => {
  it("بدنه معتبر بدون تأمین‌کننده قابل پذیرش است", () => {
    const parsed = createBuySchema.safeParse({ items: [VALID_ITEM] }, FA);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(1);
      expect(parsed.data.supplierId).toBeUndefined();
      expect(parsed.data.note).toBeUndefined();
    }
  });

  it("بدنه معتبر با تأمین‌کننده و یادداشت", () => {
    const parsed = createBuySchema.safeParse(
      {
        supplierId: "sup-1",
        items: [VALID_ITEM, { materialId: "mat-2", qty: 2.5, price: 12000 }],
        note: "خرید TEST",
      },
      FA,
    );
    expect(parsed.success).toBe(true);
  });

  it("خرید بدون قلم → خطای فارسی (app/buy.js:138)", () => {
    const parsed = createBuySchema.safeParse({ items: [] }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("حداقل یک قلم خرید لازم است.");
    }
  });

  it("قیمت اعشاری → پیام فارسی (CD-13)", () => {
    const parsed = createBuySchema.safeParse(
      { items: [{ materialId: "mat-1", qty: 1, price: 5000.5 }] },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("قیمت واحد باید عدد صحیح باشد.");
    }
  });

  it("قیمت منفی → پیام فارسی", () => {
    const parsed = createBuySchema.safeParse(
      { items: [{ materialId: "mat-1", qty: 1, price: -1 }] },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("قیمت واحد باید بیشتر از صفر باشد.");
    }
  });

  it("مقدار صفر → پیام فارسی", () => {
    const parsed = createBuySchema.safeParse(
      { items: [{ materialId: "mat-1", qty: 0, price: 100 }] },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("مقدار باید بیشتر از صفر باشد.");
    }
  });

  it("فقدان items → رد شدن با پیام فارسی", () => {
    const parsed = createBuySchema.safeParse({}, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("مقدار نامعتبر");
    }
  });

  it("بیش از ۱۰۰ قلم → خطا", () => {
    const parsed = createBuySchema.safeParse(
      { items: Array.from({ length: 101 }, () => ({ ...VALID_ITEM })) },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("۱۰۰");
    }
  });
});

describe("updateBuySchema", () => {
  it("ویرایش معتبر با rev الزامی (R-06)", () => {
    const parsed = updateBuySchema.safeParse({ rev: 0, note: "ویرایش" }, FA);
    expect(parsed.success).toBe(true);
  });

  it("بدون rev → رد (R-06)", () => {
    const parsed = updateBuySchema.safeParse({ note: "ویرایش" }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("مقدار نامعتبر");
    }
  });

  it("rev منفی → پیام فارسی", () => {
    const parsed = updateBuySchema.safeParse({ rev: -1 }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("شماره بازنگری نامعتبر است.");
    }
  });

  it("یادداشت بیش از ۵۰۰ نویسه → خطا", () => {
    const parsed = updateBuySchema.safeParse({ rev: 0, note: "ا".repeat(501) }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("۵۰۰");
    }
  });
});

describe("buyListQuerySchema", () => {
  it("مقادیر پیش‌فرض صفحه/اندازه صفحه", () => {
    const parsed = buyListQuerySchema.safeParse({}, FA);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(50);
      expect(parsed.data.q).toBe("");
    }
  });

  it("status نامعتبر → خطا", () => {
    const parsed = buyListQuerySchema.safeParse({ status: "unknown" }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("وضعیت خرید نامعتبر است.");
    }
  });

  it("page از رشته به عدد تبدیل و اعتبارسنجی می‌شود", () => {
    const parsed = buyListQuerySchema.safeParse({ page: "3" }, FA);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.page).toBe(3);

    const bad = buyListQuerySchema.safeParse({ page: "0" }, FA);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe("صفحه نامعتبر است.");
    }
  });

  it("pageSize بیش از ۲۰۰ → خطا", () => {
    const parsed = buyListQuerySchema.safeParse({ pageSize: 201 }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("اندازه صفحه نمی‌تواند بیشتر از ۲۰۰ باشد.");
    }
  });
});

describe("گذارهای وضعیت (approve/finance/receive)", () => {
  it("approve با rev معتبر قابل پذیرش است", () => {
    const parsed = approveBuySchema.safeParse({ rev: 2 }, FA);
    expect(parsed.success).toBe(true);
  });

  it("approve با rev اعشاری → خطا", () => {
    const parsed = approveBuySchema.safeParse({ rev: 2.5 }, FA);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("شماره بازنگری باید عدد صحیح باشد.");
    }
  });

  it("finance با چک‌های معتبر قابل پذیرش است (app/buy.js:231)", () => {
    const parsed = financeBuySchema.safeParse({ rev: 1, cheques: [VALID_CHEQUE] }, FA);
    expect(parsed.success).toBe(true);
  });

  it("finance بدون چک هم مجاز است (خرید نقدی)", () => {
    const parsed = financeBuySchema.safeParse({ rev: 1 }, FA);
    expect(parsed.success).toBe(true);
  });

  it("receive فقط rev می‌گیرد", () => {
    const parsed = receiveBuySchema.safeParse({ rev: 2 }, FA);
    expect(parsed.success).toBe(true);

    const bad = receiveBuySchema.safeParse({}, FA);
    expect(bad.success).toBe(false);
  });
});

describe("createBuyChequeSchema", () => {
  it("چک معتبر با شماره صیادی اختیاری", () => {
    const parsed = createBuyChequeSchema.safeParse(VALID_CHEQUE, FA);
    expect(parsed.success).toBe(true);
  });

  it("سررسید نامعتبر → خطای فارسی (CD-06)", () => {
    const parsed = createBuyChequeSchema.safeParse(
      { amount: 1000, due: "1405/13/01" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("تاریخ");
    }
  });

  it("مبلغ اعشاری → خطا (CD-13)", () => {
    const parsed = createBuyChequeSchema.safeParse(
      { amount: 100.5, due: "1405/09/01" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("مبلغ چک باید عدد صحیح باشد.");
    }
  });

  it("شماره صیادی با حروف → خطا (app/buy.js:231)", () => {
    const parsed = createBuyChequeSchema.safeParse(
      { amount: 1000, due: "1405/09/01", sayad: "1234abc" },
      FA,
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("شماره صیادی باید ۱۰ تا ۱۶ رقم باشد.");
    }
  });
});

describe("updateBuyChequeSchema", () => {
  it("فقط `paid` مجاز است (app/fin.js:143)", () => {
    const parsed = updateBuyChequeSchema.safeParse({ status: "paid" }, FA);
    expect(parsed.success).toBe(true);

    const bad = updateBuyChequeSchema.safeParse({ status: "issued" }, FA);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe("فقط علامت‌گذاری چک به‌عنوان پاس‌شده مجاز است.");
    }
  });
});
