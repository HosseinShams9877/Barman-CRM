/**
 * تست‌های واحد اسکیماهای سفارش (PHASE_04 §۱۲).
 *
 * پوشش:
 *  - شماره صیادی: ۱۶ رقم لازم (order.js:622)؛ ۱۵ رقمی رد؛ خالی مجاز (Q-06)
 *  - قانون تخفیف: درصد ۰..۱۰۰ (order.js:143 + CD-25 در سرویس)
 *  - قانون جمع برنامه: PAYMENT_TOLERANCE = ۱ ریال (order.js:147 ok4)
 *  - چک‌لیست آماده‌سازی: همه موارد (order.js:562)
 *  - کنترل کیفیت: دلیل ضایعات اجباری (order.js:520)
 *  - تاریخ تولید: پایان ≥ شروع (order.js:719)
 *  - لغو فقط با دلیل (order.js:59)
 *  - ایجاد: حداقل یک قلم با qty/قیمت مثبت (order.js:147 ok1/ok2)
 *  - اتحاد متمایز اقدامات مرحله
 *
 * پیام‌ها با faErrorMap فارسی بررسی می‌شوند (CD-28).
 */
import { describe, expect, it } from "vitest";
import { faErrorMap } from "@core/validation";
import {
  cancelOrderSchema,
  createChequeSchema,
  createOrderSchema,
  PAYMENT_TOLERANCE,
  planBuilderSchema,
  prepActionSchema,
  qcActionSchema,
  stageActionSchema,
  updateOrderSchema,
} from "./order.schema";
import { PREP_CHECKS, SAYAD_LENGTH } from "../constants";

const OK_DUE = "1405/09/01";
const SAYAD_16 = "1234567890123456";
const SAYAD_15 = "123456789012345";

describe("createChequeSchema — شماره صیادی (order.js:622)", () => {
  it("۱۶ رقم پذیرفته می‌شود", () => {
    const r = createChequeSchema.safeParse(
      { sayad: SAYAD_16, amount: 1_000_000, due: OK_DUE },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(true);
  });

  it("۱۵ رقم رد می‌شود", () => {
    const r = createChequeSchema.safeParse(
      { sayad: SAYAD_15, amount: 1_000_000, due: OK_DUE },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain(String(SAYAD_LENGTH));
    }
  });

  it("خالی مجاز است (Q-06 — چک ناقص)", () => {
    const r = createChequeSchema.safeParse(
      { sayad: "", amount: 1_000_000, due: OK_DUE },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(true);
  });

  it("ارقام غیرعددی رد می‌شود", () => {
    const r = createChequeSchema.safeParse(
      { sayad: "1234abcd90123456", amount: 1_000_000, due: OK_DUE },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(false);
  });

  it("مبلغ مثبت و سررسید معتبر لازم است", () => {
    expect(
      createChequeSchema.safeParse({ sayad: SAYAD_16, amount: 0, due: OK_DUE }).success,
    ).toBe(false);
    expect(
      createChequeSchema.safeParse({ sayad: SAYAD_16, amount: 100, due: "1405/13/01" })
        .success,
    ).toBe(false);
  });
});

describe("discountPctSchema — درصد تخفیف (CD-25 مقدمات)", () => {
  const valid = (discPct: number) =>
    createOrderSchema.safeParse({ items: [{ productId: "P1", qty: 1, price: 1000 }], discPct });

  it("۰ و ۱۰۰ و مقادیر میانی پذیرفته", () => {
    expect(valid(0).success).toBe(true);
    expect(valid(15).success).toBe(true);
    expect(valid(100).success).toBe(true);
  });

  it("منفی و بیشتر از ۱۰۰ رد می‌شود", () => {
    expect(valid(-1).success).toBe(false);
    expect(valid(101).success).toBe(false);
  });

  it("اعشاری رد می‌شود", () => {
    expect(valid(12.5).success).toBe(false);
  });
});

describe("PAYMENT_TOLERANCE — تلورانس جمع برنامه (order.js:147 ok4)", () => {
  it("برابر با ۱ ریال است", () => {
    expect(PAYMENT_TOLERANCE).toBe(1);
    expect(Math.abs(1_000_000 - 999_999.5)).toBeLessThan(PAYMENT_TOLERANCE);
    expect(Math.abs(1_000_000 - 999_998)).toBeGreaterThanOrEqual(PAYMENT_TOLERANCE);
  });
});

describe("planBuilderSchema — پارامترهای مولد (order.js:118-132)", () => {
  it("پیش‌فرض‌ها معتبرند", () => {
    const r = planBuilderSchema.safeParse({}, { error: faErrorMap as never });
    expect(r.success).toBe(true);
  });

  it("preMode=amt با مبلغ صفر رد می‌شود", () => {
    const r = planBuilderSchema.safeParse(
      { preMode: "amt", preAmt: 0 },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("پیش‌پرداخت");
    }
  });

  it("preMode=amt با مبلغ مثبت پذیرفته", () => {
    expect(
      planBuilderSchema.safeParse({ preMode: "amt", preAmt: 500_000 }).success,
    ).toBe(true);
  });

  it("preMode=pct با درصد خارج از بازه رد می‌شود", () => {
    expect(planBuilderSchema.safeParse({ preMode: "pct", pre: 150 }).success).toBe(false);
    expect(planBuilderSchema.safeParse({ preMode: "pct", pre: -5 }).success).toBe(false);
  });

  it("تعداد چک ۱..۱۲ است", () => {
    expect(planBuilderSchema.safeParse({ n: 0 }).success).toBe(false);
    expect(planBuilderSchema.safeParse({ n: 13 }).success).toBe(false);
    expect(planBuilderSchema.safeParse({ n: 12 }).success).toBe(true);
  });
});

describe("prepActionSchema — چک‌لیست آماده‌سازی (order.js:562)", () => {
  it("بدون چک‌ها رد می‌شود", () => {
    const r = prepActionSchema.safeParse(
      { action: "prep", packs: 2, checks: [] },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(false);
  });

  it("چک‌های ناقص رد می‌شود", () => {
    const r = prepActionSchema.safeParse(
      { action: "prep", packs: 2, checks: [PREP_CHECKS[0]] },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(false);
  });

  it("همه چک‌ها پذیرفته می‌شود", () => {
    const r = prepActionSchema.safeParse(
      { action: "prep", packs: 2, checks: [...PREP_CHECKS] },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(true);
  });
});

describe("qcActionSchema — کنترل کیفیت (order.js:520)", () => {
  it("ضایعات بدون دلیل رد می‌شود", () => {
    const r = qcActionSchema.safeParse(
      { action: "qc", good: 100, waste: 3 },
      { error: faErrorMap as never },
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("ضایعات");
    }
  });

  it("ضایعات با دلیل پذیرفته می‌شود", () => {
    expect(
      qcActionSchema.safeParse({ action: "qc", good: 100, waste: 3, why: "خرابی قالب" })
        .success,
    ).toBe(true);
  });

  it("بدون ضایعات لازم نیست دلیل باشد", () => {
    expect(qcActionSchema.safeParse({ action: "qc", good: 100, waste: 0 }).success).toBe(
      true,
    );
  });

  it("تعداد تولید مثبت لازم است", () => {
    expect(qcActionSchema.safeParse({ action: "qc", good: 0, waste: 0 }).success).toBe(
      false,
    );
  });
});

describe("cancelOrderSchema — دلیل لغو (order.js:59)", () => {
  it("بدون دلیل رد، با دلیل پذیرفته", () => {
    expect(cancelOrderSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ reason: "قیمت توافق نشد" }).success).toBe(true);
  });

  it("دلیل طولانی‌تر از ۱۹۲ نویسه رد", () => {
    expect(cancelOrderSchema.safeParse({ reason: "x".repeat(193) }).success).toBe(false);
  });
});

describe("createOrderSchema — اقلام (order.js:147 ok1/ok2)", () => {
  it("بدون قلم رد می‌شود", () => {
    expect(createOrderSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("قلم با qty/قیمت غیرمثبت رد", () => {
    expect(
      createOrderSchema.safeParse({ items: [{ productId: "P1", qty: 0, price: 100 }] })
        .success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({ items: [{ productId: "P1", qty: 1, price: 0 }] })
        .success,
    ).toBe(false);
  });

  it("قلم با تخفیف قلم ۰..۱۰۰ و پیش‌فرض صفر", () => {
    expect(
      createOrderSchema.safeParse({
        items: [{ productId: "P1", qty: 2, price: 100, discount: 20 }],
      }).success,
    ).toBe(true);
    const withDefault = createOrderSchema.safeParse({
      items: [{ productId: "P1", qty: 2, price: 100 }],
    });
    expect(withDefault.success).toBe(true);
    if (withDefault.success) {
      expect(withDefault.data.items[0]?.discount).toBe(0);
    }
  });

  it("تخفیف قلم خارج از بازه رد", () => {
    expect(
      createOrderSchema.safeParse({
        items: [{ productId: "P1", qty: 1, price: 100, discount: 150 }],
      }).success,
    ).toBe(false);
  });

  it("اعتبار پیش‌فاکتور ۱..۳۶۵ روز", () => {
    expect(createOrderSchema.safeParse({ items: [], validDays: 0 }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({
        items: [{ productId: "P1", qty: 1, price: 100 }],
        validDays: 400,
      }).success,
    ).toBe(false);
  });
});

describe("updateOrderSchema", () => {
  it("ویرایش با اقلام دارای id لازم است", () => {
    expect(
      updateOrderSchema.safeParse({
        items: [{ id: "i1", productId: "P1", qty: 1, price: 100 }],
      }).success,
    ).toBe(true);
    expect(
      updateOrderSchema.safeParse({
        items: [{ productId: "P1", qty: 1, price: 100 }],
      }).success,
    ).toBe(false);
  });

  it("بدنه خالی مجاز است (یعنی «تغییر نده»)", () => {
    expect(updateOrderSchema.safeParse({}).success).toBe(true);
  });

  it("planBuilder معتبر در ویرایش پذیرفته", () => {
    expect(
      updateOrderSchema.safeParse({ planBuilder: { pre: 30, rest: "cheque", n: 3 } })
        .success,
    ).toBe(true);
    expect(updateOrderSchema.safeParse({ planBuilder: { n: 99 } }).success).toBe(false);
  });
});

describe("stageActionSchema — اتحاد متمایز اقدامات", () => {
  it("اقدام ناشناخته رد", () => {
    expect(
      stageActionSchema.safeParse({ action: "teleport" }, { error: faErrorMap as never })
        .success,
    ).toBe(false);
  });

  it("اقدام send نیاز به via دارد", () => {
    expect(stageActionSchema.safeParse({ action: "send" }).success).toBe(false);
    expect(stageActionSchema.safeParse({ action: "send", via: ["sms"] }).success).toBe(
      true,
    );
  });

  it("اقدام deliver به جای تمام فیلدهای خود لازم است", () => {
    // deliver نیازی به via ندارد و فیلدهای ناشناخته (مثل via) توسط Zod strip می‌شوند
    expect(stageActionSchema.safeParse({ action: "deliver", to: "حسن" }).success).toBe(
      true,
    );
    expect(stageActionSchema.safeParse({ action: "deliver" }).success).toBe(false);
    expect(
      stageActionSchema.safeParse({ action: "deliver", to: "" }).success,
    ).toBe(false);
  });
});
