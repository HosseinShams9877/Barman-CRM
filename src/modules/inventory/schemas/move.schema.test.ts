/**
 * آزمون‌های اسکیمای Zod حرکت‌های انبار — PHASE_05 §۱۲ (دروازه خروج ۱).
 *
 * پیام‌ها باید فارسی باشند (CD-28) و قوانین مطابق Demo باشند:
 *  - ثبت دستی فقط kinds دستی (app/stock.js:۵۳/۸۶)؛
 *  - مقدار مثبت برای kinds با جهت ثابت، علامت‌دار برای adj؛
 *  - علت حرکت الزامی (app/stock.js:۶۶-۶۷)؛
 *  - بررسی رزرو با اقلام مثبت (PHASE_05 §۳.۹).
 */
import { describe, expect, it } from "vitest";
import {
  createMoveSchema,
  moveIdParamSchema,
  moveListQuerySchema,
  reservationCheckSchema,
  updateMoveSchema,
} from "./move.schema";

const validBase = {
  wh: "raw" as const,
  itemId: "m1",
  qty: 10,
  kind: "out" as const,
  note: "خروج دستی",
};

describe("createMoveSchema — ثبت دستی حرکت", () => {
  it("ورودی معتبر قابل قبول است", () => {
    const parsed = createMoveSchema.parse(validBase);
    expect(parsed.qty).toBe(10);
    expect(parsed.kind).toBe("out");
  });

  it("kinds دستی مجازند (open/out/adj/waste)", () => {
    for (const kind of ["open", "out", "adj", "waste"] as const) {
      const parsed = createMoveSchema.safeParse({ ...validBase, kind });
      expect(parsed.success).toBe(true);
    }
  });

  it("kind سیستمی رد می‌شود با پیام فارسی", () => {
    for (const kind of ["buy", "prod", "sale", "use", "job"] as const) {
      const parsed = createMoveSchema.safeParse({ ...validBase, kind });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]!.message).toContain(
          "ثبت این نوع حرکت به‌صورت دستی مجاز نیست",
        );
      }
    }
  });

  it("انبار نامعتبر رد می‌شود", () => {
    const parsed = createMoveSchema.safeParse({
      ...validBase,
      wh: "shop",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("انبار");
    }
  });

  it("مقدار صفر برای kind با جهت ثابت رد می‌شود", () => {
    const parsed = createMoveSchema.safeParse({ ...validBase, qty: 0 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain(
        "مقدار باید بیشتر از صفر باشد",
      );
    }
  });

  it("مقدار منفی برای kind با جهت ثابت رد می‌شود (علامت در سرویس)", () => {
    const parsed = createMoveSchema.safeParse({ ...validBase, qty: -5 });
    expect(parsed.success).toBe(false);
  });

  it("adj مقدار منفی می‌پذیرد (دوطرفه) ولی صفر را رد می‌کند", () => {
    expect(createMoveSchema.safeParse({ ...validBase, kind: "adj", qty: -3 }).success).toBe(true);
    expect(createMoveSchema.safeParse({ ...validBase, kind: "adj", qty: 3 }).success).toBe(true);
    const zero = createMoveSchema.safeParse({ ...validBase, kind: "adj", qty: 0 });
    expect(zero.success).toBe(false);
  });

  it("علت حرکت الزامی است (app/stock.js:۶۶)", () => {
    const parsed = createMoveSchema.safeParse({ ...validBase, note: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("علت حرکت الزامی است");
    }
  });

  it("قلم حرکت الزامی است", () => {
    const parsed = createMoveSchema.safeParse({ ...validBase, itemId: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("قلم حرکت الزامی است");
    }
  });

  it("مقدار خارج از بازه رد می‌شود", () => {
    expect(
      createMoveSchema.safeParse({ ...validBase, qty: 2_000_000 }).success,
    ).toBe(false);
  });
});

describe("updateMoveSchema — ویرایش حرکت دستی", () => {
  it("فقط یادداشت مجاز است", () => {
    const parsed = updateMoveSchema.parse({ note: "اصلاح علت" });
    expect(parsed.note).toBe("اصلاح علت");
  });

  it("qty مثبت برای kinds با جهت ثابت مجاز است", () => {
    expect(updateMoveSchema.safeParse({ qty: 12 }).success).toBe(true);
  });

  it("qty منفی فقط برای adj معنا دارد ولی اسکما آن را می‌پذیرد", () => {
    // محدودیت kind در سرویس بررسی می‌شود (PHASE_05 §۸) — اسکما فقط صفر را رد می‌کند.
    expect(updateMoveSchema.safeParse({ qty: -12 }).success).toBe(true);
  });

  it("qty صفر رد می‌شود", () => {
    const parsed = updateMoveSchema.safeParse({ qty: 0 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain(
        "مقدار باید بیشتر از صفر باشد",
      );
    }
  });
});

describe("moveListQuerySchema — کوئری لیست", () => {
  it("پیش‌فرض‌ها برقرارند", () => {
    const parsed = moveListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.q).toBe("");
    expect(parsed.wh).toBeUndefined();
    expect(parsed.kind).toBeUndefined();
  });

  it("فیلتر انبار و kind اعمال می‌شود", () => {
    const parsed = moveListQuerySchema.parse({ wh: "depot", kind: "sale", q: " RM " });
    expect(parsed.wh).toBe("depot");
    expect(parsed.kind).toBe("sale");
    expect(parsed.q).toBe("RM");
  });

  it("انبار نامعتبر رد می‌شود", () => {
    expect(moveListQuerySchema.safeParse({ wh: "shop" }).success).toBe(false);
  });

  it("صفحه‌بندی عددی صحیح مثبت می‌خواهد", () => {
    expect(moveListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(moveListQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
    expect(moveListQuerySchema.safeParse({ page: "2" }).success).toBe(true);
  });
});

describe("moveIdParamSchema — پارامتر مسیر", () => {
  it("شناسه معتبر قابل قبول است", () => {
    expect(moveIdParamSchema.safeParse({ id: "mv-abc123" }).success).toBe(true);
  });

  it("شناسه خالی رد می‌شود", () => {
    expect(moveIdParamSchema.safeParse({ id: "" }).success).toBe(false);
  });
});

describe("reservationCheckSchema — بررسی رزرو (PHASE_05 §۳.۹)", () => {
  it("اقلام مثبت قابل قبولند", () => {
    const parsed = reservationCheckSchema.parse({
      items: [{ productId: "p1", qty: 3 }],
    });
    expect(parsed.items).toHaveLength(1);
  });

  it("حداقل یک قلم لازم است", () => {
    const parsed = reservationCheckSchema.safeParse({ items: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("حداقل یک قلم");
    }
  });

  it("مقدار رزرو باید مثبت باشد", () => {
    const parsed = reservationCheckSchema.safeParse({
      items: [{ productId: "p1", qty: 0 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain(
        "مقدار باید بیشتر از صفر باشد",
      );
    }
  });

  it("بیش از ۱۰۰ قلم رد می‌شود", () => {
    const parsed = reservationCheckSchema.safeParse({
      items: Array.from({ length: 101 }, () => ({ productId: "p1", qty: 1 })),
    });
    expect(parsed.success).toBe(false);
  });
});
