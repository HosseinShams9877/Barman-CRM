/**
 * آزمون‌های اسکیمای Zod کار تولید — PHASE_05 §۱۲ (دروازه خروج ۱).
 *
 * پیام فارسی (CD-28) + قوانین مطابق Demo:
 *  - محصول و مقدار الزامی (app/prod.js:۱۱۸)؛
 *  - QC: good مثبت، waste نامنفی (app/prod.js:۱۲۴)؛
 *  - شناسه کار PJ- (X.nextId("PJ") — core.js:364).
 */
import { describe, expect, it } from "vitest";
import {
  createJobSchema,
  jobIdParamSchema,
  jobIdSchema,
  jobListQuerySchema,
  qcSchema,
  receiveJobSchema,
  updateJobSchema,
} from "./job.schema";

const validCreate = {
  productId: "p1",
  qty: 100,
};

describe("createJobSchema — ایجاد کار تولید", () => {
  it("ورودی معتبر قابل قبول است", () => {
    const parsed = createJobSchema.parse(validCreate);
    expect(parsed.productId).toBe("p1");
    expect(parsed.qty).toBe(100);
    expect(parsed.color).toBeUndefined();
    expect(parsed.end).toBeUndefined();
  });

  it("رنگ و تاریخ پایان اختیاری مجازند", () => {
    const parsed = createJobSchema.parse({
      ...validCreate,
      color: "سفید",
      end: 1_800_000_000_000,
    });
    expect(parsed.color).toBe("سفید");
    expect(parsed.end).toBe(1_800_000_000_000);
  });

  it("محصول الزامی است (app/prod.js:۱۱۸)", () => {
    const parsed = createJobSchema.safeParse({ ...validCreate, productId: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("محصول الزامی است");
    }
  });

  it("مقدار باید مثبت باشد", () => {
    const zero = createJobSchema.safeParse({ ...validCreate, qty: 0 });
    expect(zero.success).toBe(false);
    if (!zero.success) {
      expect(zero.error.issues[0]!.message).toContain(
        "مقدار باید بزرگ‌تر از صفر باشد",
      );
    }
    expect(createJobSchema.safeParse({ ...validCreate, qty: -5 }).success).toBe(false);
  });

  it("مقدار اعشاری مجاز است (متر مربع)", () => {
    expect(createJobSchema.safeParse({ ...validCreate, qty: 12.5 }).success).toBe(true);
  });

  it("مقدار بیش از سقف رد می‌شود", () => {
    const parsed = createJobSchema.safeParse({ ...validCreate, qty: 2_000_000 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("۱٬۰۰۰٬۰۰۰");
    }
  });

  it("end باید عدد صحیح مثبت باشد", () => {
    expect(
      createJobSchema.safeParse({ ...validCreate, end: -1 }).success,
    ).toBe(false);
    expect(
      createJobSchema.safeParse({ ...validCreate, end: null }).success,
    ).toBe(true);
  });
});

describe("qcSchema — ثبت کنترل کیفیت", () => {
  it("good مثبت و waste نامنفی قابل قبول است", () => {
    const parsed = qcSchema.parse({ good: 80, waste: 4 });
    expect(parsed.good).toBe(80);
    expect(parsed.waste).toBe(4);
  });

  it("waste صفر مجاز است", () => {
    expect(qcSchema.safeParse({ good: 80, waste: 0 }).success).toBe(true);
  });

  it("good باید مثبت باشد", () => {
    const parsed = qcSchema.safeParse({ good: 0, waste: 0 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain(
        "مقدار باید بزرگ‌تر از صفر باشد",
      );
    }
  });

  it("waste منفی رد می‌شود با پیام فارسی", () => {
    const parsed = qcSchema.safeParse({ good: 80, waste: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("ضایعات");
    }
  });
});

describe("receiveJobSchema — دریافت در دپو", () => {
  it("بدون qty مجاز است (پیش‌فرض good — app/stock.js:۷۳)", () => {
    const parsed = receiveJobSchema.parse({});
    expect(parsed.qty).toBeUndefined();
  });

  it("qty مثبت مجاز است", () => {
    expect(receiveJobSchema.safeParse({ qty: 78 }).success).toBe(true);
    expect(receiveJobSchema.safeParse({ qty: 0 }).success).toBe(false);
  });
});

describe("updateJobSchema — گذار وضعیت", () => {
  it("وضعیت معتبر قابل قبول است", () => {
    const parsed = updateJobSchema.parse({ status: "plan" });
    expect(parsed.status).toBe("plan");
  });

  it("وضعیت نامعتبر رد می‌شود", () => {
    expect(updateJobSchema.safeParse({ status: "waiting" }).success).toBe(false);
  });
});

describe("jobIdSchema / jobIdParamSchema — شناسه کار", () => {
  it("الگوی PJ- معتبر است", () => {
    expect(jobIdSchema.safeParse("PJ-501").success).toBe(true);
    expect(jobIdParamSchema.safeParse({ id: "PJ-501" }).success).toBe(true);
  });

  it("شناسه خارج از الگو رد می‌شود با پیام فارسی", () => {
    const parsed = jobIdSchema.safeParse("501");
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toContain("PJ-");
    }
    expect(jobIdSchema.safeParse("PF-1201").success).toBe(false);
  });
});

describe("jobListQuerySchema — کوئری لیست کارها", () => {
  it("پیش‌فرض‌ها برقرارند", () => {
    const parsed = jobListQuerySchema.parse({});
    expect(parsed.q).toBe("");
    expect(parsed.status).toBeUndefined();
    expect(parsed.page).toBe(1);
  });

  it("فیلتر وضعیت و جستجو اعمال می‌شود", () => {
    const parsed = jobListQuerySchema.parse({ status: "run", q: " پنل " });
    expect(parsed.status).toBe("run");
    expect(parsed.q).toBe("پنل");
  });

  it("وضعیت نامعتبر رد می‌شود", () => {
    expect(jobListQuerySchema.safeParse({ status: "waiting" }).success).toBe(false);
  });
});
