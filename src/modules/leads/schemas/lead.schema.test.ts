/**
 * آزمون اسکیماهای Zod سرنخ — PHASE_3 درگاه خروج ۲ (زوج معتبر/نامعتبر).
 *
 * قوانین کسب‌وکار زیر پوشش داده می‌شوند (همه با ارجاع به Demo):
 *  - شماره باید نرمال‌شده ۱۱ رقم و آغاز با ۰ باشد (app/lead-core.js:54).
 *  - منبع ورود اجباری است (app/leads.js:324).
 *  - ورود به lost بدون دلیل ممنوع است (app/leads.js:474).
 *  - حداقل یکی از نتیجه/یادداشت پیگیری باید پر باشد (app/leads.js:393-399).
 */
import { describe, expect, it } from "vitest";
import {
  createFollowupSchema,
  createLeadSchema,
  leadLineSchema,
  leadStageSchema,
  listLeadsQuerySchema,
  moveStageSchema,
  updateLeadSchema,
} from "./lead.schema";

describe("createLeadSchema", () => {
  it("ورودی معتبر کامل → معتبر", () => {
    const parsed = createLeadSchema.safeParse({
      phone: "09121234567",
      source: "اینستاگرام",
      line: "prod",
      title: "علی رضایی",
      amount: 5_000_000,
      note: "تماس اول",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("09121234567");
      expect(parsed.data.line).toBe("prod");
      expect(parsed.data.amount).toBe(5_000_000);
    }
  });

  it("مقادیر پیش‌فرض line/title/note وقتی ارسال نشوند", () => {
    const parsed = createLeadSchema.safeParse({ phone: "09121234567", source: "تماس ورودی" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.line).toBe("prod");
      expect(parsed.data.title).toBe("");
      expect(parsed.data.note).toBe("");
      expect(parsed.data.amount).toBeUndefined();
    }
  });

  it("شماره نامعتبر (کوتاه) → نامعتبر با پیام فارسی Demo", () => {
    const parsed = createLeadSchema.safeParse({ phone: "12345", source: "تماس ورودی" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "phone");
      expect(issue?.message).toBe("شماره را کامل و درست وارد کنید (مثلاً ۰۹۱۲۱۲۳۴۵۶۷).");
    }
  });

  it("شماره با ارقام فارسی و فاصله → نرمال‌شده معتبر است", () => {
    const parsed = createLeadSchema.safeParse({ phone: " ۰۹۱۲ ۱۲۳ ۴۵۶۷ ", source: "تماس ورودی" });
    expect(parsed.success).toBe(true);
  });

  it("شماره با پیشوند ۹۸ (بدون ۰ آغاز) → نرمال‌شده معتبر است (core.js:538)", () => {
    const parsed = createLeadSchema.safeParse({ phone: "989121234567", source: "تماس ورودی" });
    expect(parsed.success).toBe(true);
  });

  it("شماره با ارقام غیرمجاز → نامعتبر", () => {
    const parsed = createLeadSchema.safeParse({ phone: "0912345abc", source: "تماس ورودی" });
    expect(parsed.success).toBe(false);
  });

  it("منبع گمشده → نامعتبر", () => {
    const parsed = createLeadSchema.safeParse({ phone: "09121234567" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "source")).toBe(true);
    }
  });

  it("منبع خارج از لیست ثابت → پیام «منبع ورود معتبر نیست.»", () => {
    const parsed = createLeadSchema.safeParse({ phone: "09121234567", source: "منبع-ساختگی" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "source");
      expect(issue?.message).toBe("منبع ورود معتبر نیست.");
    }
  });

  it("مبلغ منفی → نامعتبر (moneySchema)", () => {
    const parsed = createLeadSchema.safeParse({ phone: "09121234567", source: "تماس ورودی", amount: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "amount")).toBe(true);
    }
  });

  it("مبلغ اعشاری → نامعتبر (مبلغ همیشه عدد صحیح ریال است)", () => {
    const parsed = createLeadSchema.safeParse({
      phone: "09121234567",
      source: "تماس ورودی",
      amount: 1.5,
    });
    expect(parsed.success).toBe(false);
  });

  it("مبلغ null → معتبر (یعنی بدون مبلغ تخمینی)", () => {
    const parsed = createLeadSchema.safeParse({ phone: "09121234567", source: "تماس ورودی", amount: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.amount).toBeNull();
  });
});

describe("updateLeadSchema", () => {
  it("بدون فیلد → معتبر (یعنی «تغییر نده»)", () => {
    expect(updateLeadSchema.safeParse({}).success).toBe(true);
  });

  it("فقط title → معتبر، بقیه فیلدها نگه‌داشته نمی‌شوند", () => {
    const parsed = updateLeadSchema.safeParse({ title: "نام جدید" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("نام جدید");
      expect(parsed.data.source).toBeUndefined();
    }
  });

  it("amount: null مجاز است (پاک‌کردن مبلغ)", () => {
    expect(updateLeadSchema.safeParse({ amount: null }).success).toBe(true);
  });
});

describe("moveStageSchema", () => {
  it("جابه‌جایی مجاز به مرحله باز بدون دلیل → معتبر", () => {
    for (const to of ["raw", "opp", "pf", "won"] as const) {
      expect(moveStageSchema.safeParse({ to }).success).toBe(true);
    }
  });

  it("جابه‌جایی ممنوع: مرحله lost بدون دلیل → نامعتبر با پیام Demo", () => {
    const parsed = moveStageSchema.safeParse({ to: "lost" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "lostReason");
      expect(issue?.message).toBe("دلیل از دست رفتن را انتخاب کنید؛ در گزارش لازم است.");
    }
  });

  it("lost با دلیل خالی (فاصله) → نامعتبر", () => {
    const parsed = moveStageSchema.safeParse({ to: "lost", lostReason: "   " });
    expect(parsed.success).toBe(false);
  });

  it("lost با دلیل معتبر → معتبر", () => {
    const parsed = moveStageSchema.safeParse({ to: "lost", lostReason: "قیمت بالا" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.lostReason).toBe("قیمت بالا");
  });

  it("دلیل عمومی برای جابه‌جایی مجاز است", () => {
    const parsed = moveStageSchema.safeParse({ to: "opp", reason: "بازگردانده شد" });
    expect(parsed.success).toBe(true);
  });

  it("مرحله خارج از لیست → نامعتبر", () => {
    expect(moveStageSchema.safeParse({ to: "done" }).success).toBe(false);
  });
});

describe("createFollowupSchema", () => {
  it("یادداشت خالی و نتیجه خالی → نامعتبر", () => {
    const parsed = createFollowupSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "note");
      expect(issue?.message).toBe("حداقل یکی از نتیجه یا یادداشت باید پر باشد.");
    }
  });

  it("فقط یادداشت → معتبر", () => {
    const parsed = createFollowupSchema.safeParse({ note: "تماس گرفته شد" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note).toBe("تماس گرفته شد");
  });

  it("فقط نتیجه → معتبر", () => {
    const parsed = createFollowupSchema.safeParse({ result: "بله، مشتری پاسخ داد" });
    expect(parsed.success).toBe(true);
  });

  it("تاریخ بعدی معتبر با قالب ASCII → معتبر", () => {
    const parsed = createFollowupSchema.safeParse({ note: "x", nextAt: "1405/08/19" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nextAt).toBe("1405/08/19");
  });

  it("تاریخ بعدی نامعتبر → نامعتبر", () => {
    const parsed = createFollowupSchema.safeParse({ note: "x", nextAt: "1405/13/40" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "nextAt")).toBe(true);
    }
  });
});

describe("listLeadsQuerySchema", () => {
  it("پیش‌فرض‌های صفحه‌بندی وقتی چیزی ارسال نشود", () => {
    const parsed = listLeadsQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(50);
      expect(parsed.data.q).toBe("");
    }
  });

  it("مقادیر رشته‌ای page/pageSize coerce می‌شوند", () => {
    const parsed = listLeadsQuerySchema.safeParse({ page: "2", pageSize: "10" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.pageSize).toBe(10);
    }
  });

  it("page صفر یا منفی → نامعتبر", () => {
    expect(listLeadsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listLeadsQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it("stage خارج از لیست → نامعتبر", () => {
    expect(listLeadsQuerySchema.safeParse({ stage: "archived" }).success).toBe(false);
  });

  it("line خارج از لیست → نامعتبر", () => {
    expect(listLeadsQuerySchema.safeParse({ line: "other" }).success).toBe(false);
  });
});

describe("leadStageSchema / leadLineSchema", () => {
  it("مراحل پذیرفته‌شده", () => {
    for (const s of ["raw", "opp", "pf", "won", "lost"]) {
      expect(leadStageSchema.safeParse(s).success).toBe(true);
    }
  });

  it("خطوط پذیرفته‌شده", () => {
    expect(leadLineSchema.safeParse("prod").success).toBe(true);
    expect(leadLineSchema.safeParse("agency").success).toBe(true);
    expect(leadLineSchema.safeParse("x").success).toBe(false);
  });
});
