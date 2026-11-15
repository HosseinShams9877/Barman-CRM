/**
 * آزمون سرویس سرنخ‌ها — PHASE_3 درگاه خروج ۳ (مسیر خوش + نقض قانون کسب‌وکار).
 *
 * Prisma کامل mock شده است؛ سهام کلیدی:
 *  - شماره تکراری → ۴۰۹ با پیام Demo (app/leads.js:334).
 *  - گردسازی مبلغ به ۱۰۰٬۰۰۰ (R-08).
 *  - ورود به lost نیازمند دلیل است و lostFrom ذخیره می‌شود (app/leads.js:474-475).
 *  - بازگرداندن از lost، دلیل و lostFrom را پاک می‌کند (app/leads.js:539).
 *  - محدوده دید نقش sales فقط سرنخ‌های خودش (app/leads.js:15).
 *  - رویداد تاریخچه kind="stage" و "in" با قالب متن Demo (lead-core.js:73).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => {
  const tx = {
    account: { create: vi.fn() },
    lead: { create: vi.fn(), update: vi.fn() },
    leadFollowup: { create: vi.fn() },
    accountPhone: { deleteMany: vi.fn() },
    accountContact: { deleteMany: vi.fn() },
  };
  return {
    prisma: {
      account: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      accountPhone: { findFirst: vi.fn(), findMany: vi.fn() },
      lead: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      leadFollowup: { findMany: vi.fn(), create: vi.fn() },
      // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
      role: { upsert: vi.fn() },
      user: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
      setting: { upsert: vi.fn() },
      rev: { upsert: vi.fn() },
      list: { upsert: vi.fn() },
      product: { count: vi.fn() },
      $disconnect: vi.fn(),
      // تراکنش: کول‌بک با همان شئ tx اجرا می‌شود
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
      __tx: tx,
    },
  };
});

import { prisma } from "@core/database/client";
import {
  createLead,
  importLeads,
  listLeads,
  moveLeadStage,
  updateLead,
} from "./lead.service";
import type { LeadListScope } from "./lead.service";

const mocked = vi.mocked(prisma) as unknown as {
  account: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  accountPhone: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  lead: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  leadFollowup: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    account: { create: ReturnType<typeof vi.fn> };
    lead: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    leadFollowup: { create: ReturnType<typeof vi.fn> };
  };
};

/**
 * پارامترهای لیست — معادل z.infer<typeof listLeadsQuerySchema>
 * (stage به‌صورت literal union نگه داشته می‌شود تا با امضای
 * listLeads مطابق باشد).
 */
type ListQuery = {
  page: number;
  pageSize: number;
  q: string;
  line?: "prod" | "agency";
  stage?: "raw" | "opp" | "pf" | "won" | "lost";
};

const LIST_QUERY: ListQuery = { page: 1, pageSize: 50, q: "" };
const ALL_SCOPE: LeadListScope = { restrictToOwner: false, userId: "u1" };

/** یک رکورد سرنخ کامل برای findUnique شامل includeهای سرویس. */
function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "LD-1001",
    line: "prod",
    stage: "raw",
    title: "علی رضایی",
    amount: null,
    source: "اینستاگرام",
    note: "",
    accountId: "AC-101",
    ownerId: "u1",
    lostReason: null,
    lostFrom: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    account: {
      id: "AC-101",
      name: "",
      phones: [{ number: "09121234567" }],
      contacts: [],
    },
    owner: { name: "ali" },
    followups: [],
    interest: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listLeads — محدوده دید و فیلترها", () => {
  it("نقش sales: فیلتر ownerId در سرور تحمیل می‌شود (leads.viewAll)", async () => {
    mocked.lead.count.mockResolvedValue(0);
    mocked.lead.findMany.mockResolvedValue([]);
    await listLeads(LIST_QUERY, { restrictToOwner: true, userId: "u1" });
    const args = mocked.lead.findMany.mock.calls[0]?.[0] as { where: { ownerId?: string } };
    expect(args.where.ownerId).toBe("u1");
  });

  it("نقش با leads.viewAll: فیلتر ownerId روی کاربر اعمال نمی‌شود", async () => {
    mocked.lead.count.mockResolvedValue(0);
    mocked.lead.findMany.mockResolvedValue([]);
    await listLeads(LIST_QUERY, ALL_SCOPE);
    const args = mocked.lead.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where.ownerId).toBeUndefined();
  });

  it("فیلتر line/stage به where اضافه می‌شود", async () => {
    mocked.lead.count.mockResolvedValue(0);
    mocked.lead.findMany.mockResolvedValue([]);
    await listLeads({ ...LIST_QUERY, line: "agency", stage: "won" }, ALL_SCOPE);
    const args = mocked.lead.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where.line).toBe("agency");
    expect(args.where.stage).toBe("won");
  });

  it("جستجو روی id، نام حساب، شماره و مخاطب", async () => {
    mocked.lead.count.mockResolvedValue(0);
    mocked.lead.findMany.mockResolvedValue([]);
    await listLeads({ ...LIST_QUERY, q: "0912" }, ALL_SCOPE);
    const args = mocked.lead.findMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(Array.isArray(args.where.OR)).toBe(true);
    expect(args.where.OR.length).toBeGreaterThan(0);
  });

  it("آیتم لیست ساخته می‌شود و nextAt از آخرین رویداد خوانده می‌شود", async () => {
    mocked.lead.count.mockResolvedValue(1);
    mocked.lead.findMany.mockResolvedValue([leadRow()]);
    mocked.leadFollowup.findMany.mockResolvedValue([
      { leadId: "LD-1001", nextAt: "1405/08/19" },
    ]);
    const out = await listLeads(LIST_QUERY, ALL_SCOPE);
    expect(out.total).toBe(1);
    expect(out.items[0]?.id).toBe("LD-1001");
    expect(out.items[0]?.nextAt).toBe("1405/08/19");
  });

  it("صفحه‌بندی: skip/take از page/pageSize محاسبه می‌شود", async () => {
    mocked.lead.count.mockResolvedValue(0);
    mocked.lead.findMany.mockResolvedValue([]);
    await listLeads({ ...LIST_QUERY, page: 3, pageSize: 20 }, ALL_SCOPE);
    const args = mocked.lead.findMany.mock.calls[0]?.[0] as { skip: number; take: number };
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
  });
});

describe("createLead — مسیر خوش", () => {
  it("حساب ناشناس + سرنخ raw + رویداد ورود با منبع ساخته می‌شود", async () => {
    mocked.accountPhone.findFirst.mockResolvedValue(null);
    mocked.account.findMany.mockResolvedValue([{ id: "AC-101" }]);
    mocked.lead.findMany.mockResolvedValue([{ id: "LD-1001" }]);
    mocked.lead.findUnique.mockResolvedValue(leadRow());

    const out = await createLead(
      { phone: "09121234567", source: "اینستاگرام", line: "prod", title: "علی", amount: 5_000_000, note: "" },
      "u1",
    );

    expect(out.id).toBe("LD-1001");

    // شناسه‌های متوالی از SEQ0 (AC-101 / LD-1001 موجود → AC-102 / LD-1002)
    const accountCreate = mocked.__tx.account.create.mock.calls[0]?.[0] as { data: { id: string; kind: string } };
    expect(accountCreate.data.id).toBe("AC-102");
    expect(accountCreate.data.kind).toBe("unknown");

    const leadCreate = mocked.__tx.lead.create.mock.calls[0]?.[0] as { data: { id: string; stage: string; ownerId: string } };
    expect(leadCreate.data.id).toBe("LD-1002");
    expect(leadCreate.data.stage).toBe("raw");
    expect(leadCreate.data.ownerId).toBe("u1");

    const event = mocked.__tx.leadFollowup.create.mock.calls[0]?.[0] as { data: { kind: string; note: string } };
    expect(event.data.kind).toBe("in");
    expect(event.data.note).toBe("ورود شماره — منبع: اینستاگرام");
  });

  it("مبلغ به ۱۰۰٬۰۰۰ گرد می‌شود (R-08)", async () => {
    mocked.accountPhone.findFirst.mockResolvedValue(null);
    mocked.account.findMany.mockResolvedValue([]);
    mocked.lead.findMany.mockResolvedValue([]);
    mocked.lead.findUnique.mockResolvedValue(leadRow());

    await createLead(
      { phone: "09121234567", source: "تماس ورودی", line: "prod", title: "", amount: 1_234_567, note: "" },
      "u1",
    );
    const leadCreate = mocked.__tx.lead.create.mock.calls[0]?.[0] as { data: { amount: number | null } };
    expect(leadCreate.data.amount).toBe(1_200_000);
  });

  it("ownerId صریح بر self-assign ارجح است (در Route Handler با leads.assign محدود می‌شود)", async () => {
    mocked.accountPhone.findFirst.mockResolvedValue(null);
    mocked.account.findMany.mockResolvedValue([]);
    mocked.lead.findMany.mockResolvedValue([]);
    mocked.lead.findUnique.mockResolvedValue(leadRow());

    await createLead(
      { phone: "09121234567", source: "تماس ورودی", line: "prod", title: "", amount: null, note: "", ownerId: "u9" },
      "u1",
    );
    const leadCreate = mocked.__tx.lead.create.mock.calls[0]?.[0] as { data: { ownerId: string } };
    expect(leadCreate.data.ownerId).toBe("u9");
  });
});

describe("createLead — نقض قانون کسب‌وکار", () => {
  it("شماره تکرار شده → ۴۰۹ با پیام Demo (app/leads.js:334)", async () => {
    mocked.accountPhone.findFirst.mockResolvedValue({ accountId: "AC-101" });

    await expect(
      createLead({ phone: "09121234567", source: "تماس ورودی", line: "prod", title: "", amount: null, note: "" }, "u1"),
    ).rejects.toMatchObject({
      status: 409,
      message: "این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود.",
    });
    // هیچ تراکنشی نباید اجرا شود
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });
});

describe("updateLead", () => {
  it("سرنخ پیدا نشد → ۴۰۴", async () => {
    mocked.lead.findUnique.mockResolvedValue(null);
    await expect(updateLead("LD-999", { title: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("فقط فیلدهای ارسالی به‌روزرسانی می‌شوند و amount گرد می‌شود", async () => {
    mocked.lead.findUnique.mockResolvedValue(leadRow());
    mocked.lead.findUnique
      .mockResolvedValueOnce(leadRow())
      .mockResolvedValueOnce(leadRow({ amount: 2_000_000, title: "نام جدید" }));
    await updateLead("LD-1001", { title: "نام جدید", amount: 1_990_000 });
    const args = mocked.lead.update.mock.calls[0]?.[0] as { where: { id: string }; data: Record<string, unknown> };
    expect(args.where.id).toBe("LD-1001");
    expect(args.data.title).toBe("نام جدید");
    expect(args.data.amount).toBe(2_000_000);
    expect(args.data.note).toBeUndefined();
  });
});

describe("moveLeadStage", () => {
  it("سرنخ پیدا نشد → ۴۰۴", async () => {
    mocked.lead.findUnique.mockResolvedValue(null);
    await expect(moveLeadStage("LD-999", { to: "opp" }, "u1")).rejects.toMatchObject({ status: 404 });
  });

  it("جابه‌جایی به همان مرحله → no-op بدون رویداد", async () => {
    mocked.lead.findUnique.mockResolvedValue(leadRow());
    mocked.lead.findUnique.mockResolvedValueOnce(leadRow()).mockResolvedValueOnce(leadRow());
    await moveLeadStage("LD-1001", { to: "raw" }, "u1");
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });

  it("جابه‌jایی معمولی رویداد kind=stage با قالب متن Demo ثبت می‌کند (lead-core.js:73)", async () => {
    mocked.lead.findUnique.mockResolvedValueOnce(leadRow()).mockResolvedValueOnce(leadRow({ stage: "opp" }));
    await moveLeadStage("LD-1001", { to: "opp", reason: "بازگردانده شد" }, "u1");
    const update = mocked.__tx.lead.update.mock.calls[0]?.[0] as { data: { stage: string } };
    expect(update.data.stage).toBe("opp");
    const event = mocked.__tx.leadFollowup.create.mock.calls[0]?.[0] as { data: { kind: string; note: string } };
    expect(event.data.kind).toBe("stage");
    expect(event.data.note).toContain("←");
    expect(event.data.note).toContain("بازگردانده شد");
  });

  it("ورود به lost: lostReason و lostFrom ذخیره می‌شوند (leads.js:474-475)", async () => {
    mocked.lead.findUnique.mockResolvedValueOnce(leadRow()).mockResolvedValueOnce(leadRow({ stage: "lost", lostFrom: "raw" }));
    await moveLeadStage("LD-1001", { to: "lost", lostReason: "قیمت بالا" }, "u1");
    const update = mocked.__tx.lead.update.mock.calls[0]?.[0] as {
      data: { stage: string; lostReason: string | null; lostFrom: string | null };
    };
    expect(update.data.stage).toBe("lost");
    expect(update.data.lostReason).toBe("قیمت بالا");
    expect(update.data.lostFrom).toBe("raw");
  });

  it("بازگرداندن از lost: دلیل و lostFrom پاک می‌شوند (leads.js:539)", async () => {
    mocked.lead.findUnique
      .mockResolvedValueOnce(leadRow({ stage: "lost", lostReason: "قیمت بالا", lostFrom: "pf" }))
      .mockResolvedValueOnce(leadRow({ stage: "opp" }));
    await moveLeadStage("LD-1001", { to: "opp", reason: "بازگردانده شد" }, "u1");
    const update = mocked.__tx.lead.update.mock.calls[0]?.[0] as {
      data: { lostReason: string | null; lostFrom: string | null };
    };
    expect(update.data.lostReason).toBeNull();
    expect(update.data.lostFrom).toBeNull();
  });
});

describe("importLeads — ورود گروهی", () => {
  it("سرتیتر بدون ستون phone → کل فایل رد می‌شود با یک پیام", async () => {
    const out = await importLeads({ csv: "name,note\nx,y", line: "prod" }, "u1");
    expect(out.created).toBe(0);
    expect(out.failed).toBe(1);
    expect(out.rows[0]?.error).toContain("ستون phone");
    expect(prisma.accountPhone.findMany).not.toHaveBeenCalled();
  });

  it("ردیف نامعتبر گزارش فارسی می‌گیرد و ردیف معتبر ساخته می‌شود", async () => {
    mocked.accountPhone.findMany.mockResolvedValue([]);
    mocked.account.findMany.mockResolvedValue([]);
    mocked.lead.findMany.mockResolvedValue([]);

    const out = await importLeads(
      {
        csv: "phone,source\n12345,اینستاگرام\n09121234567,تماس ورودی\n09121234567,تماس ورودی",
        line: "prod",
      },
      "u1",
    );

    expect(out.created).toBe(1);
    expect(out.failed).toBe(2);
    // ردیف ۱: شماره نامعتبر
    expect(out.rows.find((r) => r.row === 1)?.error).toContain("شماره را کامل و درست وارد کنید");
    // ردیف ۳: تکرار درون‌فایلی
    expect(out.rows.find((r) => r.row === 3)?.error).toContain("تکرار شده است");
    // ردیف ۲: ساخته شد
    const ok = out.rows.find((r) => r.row === 2);
    expect(ok?.ok).toBe(true);

    const accountCreate = mocked.__tx.account.create.mock.calls[0]?.[0] as { data: { id: string; kind: string } };
    expect(accountCreate.data.id).toBe("AC-101");
    const leadCreate = mocked.__tx.lead.create.mock.calls[0]?.[0] as { data: { id: string; source: string } };
    expect(leadCreate.data.id).toBe("LD-1001");
    expect(leadCreate.data.source).toBe("تماس ورودی");
  });

  it("شماره تکرار در پایگاه داده → رد با پیام ۴۰۹ Demo", async () => {
    mocked.accountPhone.findMany.mockResolvedValue([{ number: "09121234567" }]);
    mocked.account.findMany.mockResolvedValue([]);
    mocked.lead.findMany.mockResolvedValue([]);

    const out = await importLeads(
      { csv: "phone,source\n09121234567,اینستاگرام", line: "prod" },
      "u1",
    );
    expect(out.created).toBe(0);
    expect(out.failed).toBe(1);
    expect(out.rows[0]?.error).toBe("این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود.");
  });

  it("منبع گمشده در ردیف → رد با پیام Demo (leads.js:324)", async () => {
    const out = await importLeads({ csv: "phone\n09121234567", line: "prod" }, "u1");
    expect(out.failed).toBe(1);
    expect(out.rows[0]?.error).toContain("منبع ورود را انتخاب کنید");
  });

  it("نتایج به ترتیب خط فایل مرتب می‌شوند", async () => {
    mocked.accountPhone.findMany.mockResolvedValue([]);
    mocked.account.findMany.mockResolvedValue([]);
    mocked.lead.findMany.mockResolvedValue([]);
    const out = await importLeads(
      { csv: "phone,source\n09122222222,تماس ورودی\n123,تماس ورودی\n09121111111,تماس ورودی", line: "prod" },
      "u1",
    );
    const rows = out.rows.map((r) => r.row);
    expect(rows).toEqual([1, 2, 3]);
  });
});
