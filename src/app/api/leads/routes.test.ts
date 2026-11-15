/**
 * آزمون مسیرهای API سرنخ‌ها — PHASE_3 درگاه خروج ۴ (CD-04: ۵ مرحله).
 *
 * مسیرها مستقیماً فراخوانی می‌شوند؛ سرویس‌ها و Prisma mock شده‌اند تا
 * لایه auth/permission/Zod/response در معرض آزمون قرار گیرد.
 *
 * پوشش:
 *  - ۲۰۰/۲۰۱ مسیر خوش؛
 *  - ۴۰۱ بدون کوکی نشست؛
 *  - ۴۰۳ برای هر مسیر با نقش production (بدون هیچ مجوز leads.*) — A-3.5؛
 *  - ۴۰۰ ورودی نامعتبر (Zod)؛
 *  - ۴۰۴ سرنخ ناموجود (از سرویس)؛
 *  - ۴۰۹ شماره تکراری (از سرویس)؛
 *  - محدوده دید sales روی GET /api/leads (R-02) و leads.assign روی POST/PATCH.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

// سرویس‌ها mock شده‌اند — منطق کسب‌وکار در فایل‌های سرویس آزمون شده است
vi.mock("@modules/leads/services/lead.service", () => ({
  listLeads: vi.fn(),
  createLead: vi.fn(),
  getLead: vi.fn(),
  updateLead: vi.fn(),
  moveLeadStage: vi.fn(),
  importLeads: vi.fn(),
}));
vi.mock("@modules/leads/services/followup.service", () => ({
  listFollowups: vi.fn(),
  addFollowup: vi.fn(),
}));

// Prisma — فقط حل نشست نیازمند user.findUnique است
vi.mock("@core/database/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    role: { upsert: vi.fn() },
    account: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    accountPhone: { findFirst: vi.fn(), findMany: vi.fn() },
    lead: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    leadFollowup: { findMany: vi.fn(), create: vi.fn() },
    setting: { upsert: vi.fn() },
    rev: { upsert: vi.fn() },
    list: { upsert: vi.fn() },
    product: { count: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

// کوکی سرور — مغز نشست
type CookieStore = { get: (name: string) => { value: string } | undefined };
let cookieValue: string | undefined = undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "br_s" && cookieValue ? { value: cookieValue } : undefined),
  } satisfies CookieStore)),
}));

import { prisma } from "@core/database/client";
import { issueToken } from "@core/auth/token";
import { ApiError } from "@core/errors";
import { GET as leadsGET, POST as leadsPOST } from "./route";
import { GET as leadGET, PATCH as leadPATCH } from "./[id]/route";
import { GET as followupsGET, POST as followupsPOST } from "./[id]/followups/route";
import { POST as importPOST } from "./import/route";
import * as leadService from "@modules/leads/services/lead.service";
import * as followupService from "@modules/leads/services/followup.service";

/** نشست کاربر معتبر: کوکی امضا شده + کاربر متناظر در DB (نقش‌ها از ماتریس CD-23). */
function seedSession(roles: string[]): void {
  cookieValue = issueToken({ sub: "u1", u: "ali", roles, sv: 0 }, 8 * 60 * 60 * 1000).token;
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "u1",
    name: "ali",
    title: "کارشناس",
    off: false,
    passwordHash: null,
    passwordSalt: null,
    sessionVersion: 0,
    roles: roles.map((roleKey) => ({ roleKey })),
  } as never);
}

async function json(res: Response): Promise<unknown> {
  return res.json();
}

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("GET /api/leads", () => {
  it("admin → ۲۰۰ و محدوده دید بدون محدودیت مالک", async () => {
    seedSession(["admin"]);
    vi.mocked(leadService.listLeads).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    const res = await leadsGET(new Request("http://x/api/leads"));

    expect(res.status).toBe(200);
    const args = vi.mocked(leadService.listLeads).mock.calls[0];
    expect(args?.[1]).toEqual({ restrictToOwner: false, userId: "u1" });
  });

  it("sales → ۲۰۰ با محدوده دید فقط سرنخ‌های خودش (R-02)", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.listLeads).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    const res = await leadsGET(new Request("http://x/api/leads"));

    expect(res.status).toBe(200);
    const args = vi.mocked(leadService.listLeads).mock.calls[0];
    expect(args?.[1]).toEqual({ restrictToOwner: true, userId: "u1" });
  });

  it("query string به سرویس پاس می‌شود", async () => {
    seedSession(["salesManager"]);
    vi.mocked(leadService.listLeads).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    await leadsGET(new Request("http://x/api/leads?page=2&pageSize=10&stage=won&q=0912"));

    const query = vi.mocked(leadService.listLeads).mock.calls[0]?.[0];
    expect(query).toMatchObject({ page: 2, pageSize: 10, stage: "won", q: "0912" });
  });

  it("production → ۴۰۳ (A-3.5 — هر مسیر)", async () => {
    seedSession(["production"]);
    const res = await leadsGET(new Request("http://x/api/leads"));
    expect(res.status).toBe(403);
    expect(leadService.listLeads).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await leadsGET(new Request("http://x/api/leads"));
    expect(res.status).toBe(401);
  });

  it("page نامعتبر → ۴۰۰ بدون فراخوانی سرویس", async () => {
    seedSession(["admin"]);
    const res = await leadsGET(new Request("http://x/api/leads?page=0"));
    expect(res.status).toBe(400);
    expect(leadService.listLeads).not.toHaveBeenCalled();
  });
});

describe("POST /api/leads", () => {
  const VALID_BODY = {
    phone: "09121234567",
    source: "تماس ورودی",
    line: "prod",
    title: "علی",
    amount: 5_000_000,
    note: "",
  };

  it("sales → ۲۰۱ و createLead با کاربر نشست", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.createLead).mockResolvedValue({ id: "LD-1001" } as never);

    const res = await leadsPOST(
      new Request("http://x/api/leads", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(leadService.createLead).mock.calls[0]?.[1]).toBe("u1");
  });

  it("body نامعتبر (شماره کوتاه) → ۴۰۰", async () => {
    seedSession(["sales"]);
    const res = await leadsPOST(
      new Request("http://x/api/leads", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, phone: "12345" }),
      }),
    );
    expect(res.status).toBe(400);
    const payload = (await json(res)) as { error: { fields?: unknown } };
    expect(payload.error.fields).toBeDefined();
    expect(leadService.createLead).not.toHaveBeenCalled();
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await leadsPOST(
      new Request("http://x/api/leads", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );
    expect(res.status).toBe(403);
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await leadsPOST(
      new Request("http://x/api/leads", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );
    expect(res.status).toBe(401);
  });

  it("sales با ownerId کاربر دیگر → ۴۰۳ (leads.assign — CD-23)", async () => {
    seedSession(["sales"]);
    const res = await leadsPOST(
      new Request("http://x/api/leads", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, ownerId: "u9" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(leadService.createLead).not.toHaveBeenCalled();
  });

  it("salesManager با ownerId کاربر دیگر → ۲۰۱ (leads.assign دارد)", async () => {
    seedSession(["salesManager"]);
    vi.mocked(leadService.createLead).mockResolvedValue({ id: "LD-1002" } as never);
    const res = await leadsPOST(
      new Request("http://x/api/leads", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, ownerId: "u9" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(leadService.createLead).mock.calls[0]?.[0].ownerId).toBe("u9");
  });

  it("تکرار شماره → ۴۰۹ با پاکت استاندارد", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.createLead).mockRejectedValue(
      new ApiError(409, "CONFLICT", "این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود."),
    );
    const res = await leadsPOST(
      new Request("http://x/api/leads", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );
    expect(res.status).toBe(409);
    const payload = (await json(res)) as { error: { message: string } };
    expect(payload.error.message).toContain("تکراری");
  });
});

describe("GET /api/leads/[id]", () => {
  it("sales → ۲۰۰ و getLead با شناسه مسیر", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.getLead).mockResolvedValue({ id: "LD-1001" } as never);

    const res = await leadGET(new Request("http://x/api/leads/LD-1001"), {
      params: Promise.resolve({ id: "LD-1001" }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(leadService.getLead).mock.calls[0]?.[0]).toBe("LD-1001");
  });

  it("سرنخ ناموجود → ۴۰۴", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.getLead).mockRejectedValue(new ApiError(404, "NOT_FOUND", "سرنخ مورد نظر پیدا نشد."));
    const res = await leadGET(new Request("http://x/api/leads/LD-999"), {
      params: Promise.resolve({ id: "LD-999" }),
    });
    expect(res.status).toBe(404);
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await leadGET(new Request("http://x/api/leads/LD-1001"), {
      params: Promise.resolve({ id: "LD-1001" }),
    });
    expect(res.status).toBe(403);
    expect(leadService.getLead).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/leads/[id]", () => {
  it("ویرایش فیلد → ۲۰۰ و updateLead صدا زده می‌شود", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.updateLead).mockResolvedValue({ id: "LD-1001" } as never);

    const res = await leadPATCH(
      new Request("http://x/api/leads/LD-1001", {
        method: "PATCH",
        body: JSON.stringify({ title: "نام جدید" }),
      }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(leadService.updateLead).mock.calls[0]?.[1]).toEqual({ title: "نام جدید" });
    expect(leadService.moveLeadStage).not.toHaveBeenCalled();
  });

  it("بدنه با فیلد to → جابه‌جایی مرحله (moveLeadStage)", async () => {
    seedSession(["sales"]);
    vi.mocked(leadService.moveLeadStage).mockResolvedValue({ id: "LD-1001" } as never);

    const res = await leadPATCH(
      new Request("http://x/api/leads/LD-1001", {
        method: "PATCH",
        body: JSON.stringify({ to: "opp", reason: "بازگردانده شد" }),
      }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(leadService.moveLeadStage).mock.calls[0]?.[1]).toEqual({
      to: "opp",
      reason: "بازگردانده شد",
    });
    expect(leadService.updateLead).not.toHaveBeenCalled();
  });

  it("جابه‌جایی به lost بدون دلیل → ۴۰۰ (leads.js:474)", async () => {
    seedSession(["sales"]);
    const res = await leadPATCH(
      new Request("http://x/api/leads/LD-1001", {
        method: "PATCH",
        body: JSON.stringify({ to: "lost" }),
      }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );
    expect(res.status).toBe(400);
    expect(leadService.moveLeadStage).not.toHaveBeenCalled();
  });

  it("ویرایش با ownerId توسط sales → ۴۰۳ (leads.assign)", async () => {
    seedSession(["sales"]);
    const res = await leadPATCH(
      new Request("http://x/api/leads/LD-1001", {
        method: "PATCH",
        body: JSON.stringify({ ownerId: "u9" }),
      }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );
    expect(res.status).toBe(403);
    expect(leadService.updateLead).not.toHaveBeenCalled();
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await leadPATCH(
      new Request("http://x/api/leads/LD-1001", { method: "PATCH", body: JSON.stringify({ title: "x" }) }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );
    expect(res.status).toBe(403);
  });

  it("بدنه آرایه → ۴۰۰", async () => {
    seedSession(["sales"]);
    const res = await leadPATCH(
      new Request("http://x/api/leads/LD-1001", { method: "PATCH", body: "[1,2]" }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/leads/[id]/followups", () => {
  it("sales → ۲۰۰ با ردیف‌های تاریخچه", async () => {
    seedSession(["sales"]);
    vi.mocked(followupService.listFollowups).mockResolvedValue([
      { id: "f1", at: 1, kind: "note", result: "", note: "تماس", nextAt: null, byUserId: "u1", byName: "ali" },
    ]);

    const res = await followupsGET(new Request("http://x/api/leads/LD-1001/followups"), {
      params: Promise.resolve({ id: "LD-1001" }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(followupService.listFollowups).mock.calls[0]?.[0]).toBe("LD-1001");
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await followupsGET(new Request("http://x/api/leads/LD-1001/followups"), {
      params: Promise.resolve({ id: "LD-1001" }),
    });
    expect(res.status).toBe(403);
    expect(followupService.listFollowups).not.toHaveBeenCalled();
  });
});

describe("POST /api/leads/[id]/followups", () => {
  it("sales → ۲۰۱ و addFollowup با کاربر نشست", async () => {
    seedSession(["sales"]);
    vi.mocked(followupService.addFollowup).mockResolvedValue({
      id: "f9",
      at: 5,
      kind: "note",
      result: "",
      note: "تماس گرفته شد",
      nextAt: "1405/08/19",
      byUserId: "u1",
      byName: "ali",
    });

    const res = await followupsPOST(
      new Request("http://x/api/leads/LD-1001/followups", {
        method: "POST",
        body: JSON.stringify({ note: "تماس گرفته شد", nextAt: "1405/08/19" }),
      }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );

    expect(res.status).toBe(201);
    const args = vi.mocked(followupService.addFollowup).mock.calls[0];
    expect(args?.[0]).toBe("LD-1001");
    expect(args?.[2]).toBe("u1");
  });

  it("یادداشت و نتیجه خالی → ۴۰۰ (leads.js:393)", async () => {
    seedSession(["sales"]);
    const res = await followupsPOST(
      new Request("http://x/api/leads/LD-1001/followups", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );
    expect(res.status).toBe(400);
    expect(followupService.addFollowup).not.toHaveBeenCalled();
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await followupsPOST(
      new Request("http://x/api/leads/LD-1001/followups", {
        method: "POST",
        body: JSON.stringify({ note: "x" }),
      }),
      { params: Promise.resolve({ id: "LD-1001" }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/leads/import", () => {
  it("salesManager → ۲۰۰ با گزارش ردیف‌به‌ردیف (حتی با ردیف‌های نامعتبر)", async () => {
    seedSession(["salesManager"]);
    vi.mocked(leadService.importLeads).mockResolvedValue({
      created: 1,
      failed: 1,
      rows: [
        { row: 1, ok: true, phone: "09121234567" },
        { row: 2, ok: false, phone: "123", error: "شماره نامعتبر" },
      ],
    });

    const res = await importPOST(
      new Request("http://x/api/leads/import", {
        method: "POST",
        body: JSON.stringify({ csv: "phone,source\n09121234567,تماس ورودی\n123,تماس ورودی" }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = (await json(res)) as { created: number; failed: number };
    expect(payload.created).toBe(1);
    expect(payload.failed).toBe(1);
  });

  it("csv خالی → ۴۰۰", async () => {
    seedSession(["salesManager"]);
    const res = await importPOST(
      new Request("http://x/api/leads/import", { method: "POST", body: JSON.stringify({ csv: "" }) }),
    );
    expect(res.status).toBe(400);
    expect(leadService.importLeads).not.toHaveBeenCalled();
  });

  it("sales با ownerId کاربر دیگر → ۴۰۳ (leads.assign)", async () => {
    seedSession(["sales"]);
    const res = await importPOST(
      new Request("http://x/api/leads/import", {
        method: "POST",
        body: JSON.stringify({ csv: "phone\n09121234567", ownerId: "u9" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(leadService.importLeads).not.toHaveBeenCalled();
  });

  it("production → ۴۰۳ (leads.import ندارد)", async () => {
    seedSession(["production"]);
    const res = await importPOST(
      new Request("http://x/api/leads/import", {
        method: "POST",
        body: JSON.stringify({ csv: "phone\n09121234567" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
