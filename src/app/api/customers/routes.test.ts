/**
 * آزمون مسیرهای API حساب‌های مشتری — PHASE_3 درگاه خروج ۴ (CD-04: ۵ مرحله).
 *
 * مسیرها مستقیماً فراخوانی می‌شوند؛ سرویس‌ها و Prisma mock شده‌اند تا
 * لایه auth/permission/Zod/response در معرض آزمون قرار گیرد.
 *
 * پوشش:
 *  - ۲۰۰/۲۰۱/۲۰۴ مسیر خوش؛
 *  - ۴۰۱ بدون کوکی نشست؛
 *  - ۴۰۳ برای هر مسیر با نقش production (بدون هیچ مجوز customers.*) — A-3.5؛
 *  - ۴۰۰ ورودی نامعتبر (Zod)؛
 *  - ۴۰۴ حساب ناموجود (از سرویس)؛
 *  - ۴۰۹ شماره تکراری (از سرویس)؛
 *  - فیلتر includeInactive از query string به سرویس پاس می‌شود.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

// سرویس‌ها mock شده‌اند — منطق کسب‌وکار در فایل سرویس آزمون شده است
vi.mock("@modules/customers/services/account.service", () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
  deactivateAccount: vi.fn(),
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
import { GET as customersGET, POST as customersPOST } from "./route";
import { GET as accountGET, PATCH as accountPATCH } from "./[id]/route";
import { POST as deactivatePOST } from "./[id]/deactivate/route";
import * as accountService from "@modules/customers/services/account.service";

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

describe("GET /api/customers", () => {
  it("admin → ۲۰۰ و لیست حساب‌ها", async () => {
    seedSession(["admin"]);
    vi.mocked(accountService.listAccounts).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    const res = await customersGET(new Request("http://x/api/customers"));

    expect(res.status).toBe(200);
    expect(vi.mocked(accountService.listAccounts)).toHaveBeenCalled();
  });

  it("query string به سرویس پاس می‌شود (includeInactive/q/صفحه‌بندی)", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.listAccounts).mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 });

    await customersGET(
      new Request("http://x/api/customers?page=2&pageSize=10&q=0912&includeInactive=true"),
    );

    const query = vi.mocked(accountService.listAccounts).mock.calls[0]?.[0];
    expect(query).toMatchObject({ page: 2, pageSize: 10, q: "0912", includeInactive: true });
  });

  it("production → ۴۰۳ (A-3.5 — هر مسیر)", async () => {
    seedSession(["production"]);
    const res = await customersGET(new Request("http://x/api/customers"));
    expect(res.status).toBe(403);
    expect(accountService.listAccounts).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await customersGET(new Request("http://x/api/customers"));
    expect(res.status).toBe(401);
  });

  it("page نامعتبر → ۴۰۰ بدون فراخوانی سرویس", async () => {
    seedSession(["sales"]);
    const res = await customersGET(new Request("http://x/api/customers?page=abc"));
    expect(res.status).toBe(400);
    expect(accountService.listAccounts).not.toHaveBeenCalled();
  });
});

describe("POST /api/customers", () => {
  const VALID_BODY = {
    name: "شرکت نمونه",
    kind: "customer",
    active: true,
    address: "تهران",
    note: "",
    phones: [{ kind: "همراه", number: "09121234567" }],
    contacts: [],
  };

  it("sales → ۲۰۱ و createAccount صدا زده می‌شود", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.createAccount).mockResolvedValue({ id: "AC-101" } as never);

    const res = await customersPOST(
      new Request("http://x/api/customers", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(accountService.createAccount).mock.calls[0]?.[0].name).toBe("شرکت نمونه");
  });

  it("body نامعتبر (بدون نام) → ۴۰۰", async () => {
    seedSession(["sales"]);
    const res = await customersPOST(
      new Request("http://x/api/customers", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, name: "" }),
      }),
    );
    expect(res.status).toBe(400);
    const payload = (await json(res)) as { error: { fields?: unknown } };
    expect(payload.error.fields).toBeDefined();
    expect(accountService.createAccount).not.toHaveBeenCalled();
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await customersPOST(
      new Request("http://x/api/customers", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );
    expect(res.status).toBe(403);
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await customersPOST(
      new Request("http://x/api/customers", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );
    expect(res.status).toBe(401);
  });

  it("شماره تکراری → ۴۰۹ با پاکت استاندارد (order.js:288)", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.createAccount).mockRejectedValue(
      new ApiError(409, "CONFLICT", "این شماره برای «شرکت رقیب» ثبت شده؛ از فهرست انتخابش کنید."),
    );
    const res = await customersPOST(
      new Request("http://x/api/customers", { method: "POST", body: JSON.stringify(VALID_BODY) }),
    );
    expect(res.status).toBe(409);
    const payload = (await json(res)) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe("CONFLICT");
    expect(payload.error.message).toContain("شرکت رقیب");
  });
});

describe("GET /api/customers/[id]", () => {
  it("sales → ۲۰۰ و getAccount با شناسه مسیر", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.getAccount).mockResolvedValue({ id: "AC-101" } as never);

    const res = await accountGET(new Request("http://x/api/customers/AC-101"), {
      params: Promise.resolve({ id: "AC-101" }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(accountService.getAccount).mock.calls[0]?.[0]).toBe("AC-101");
  });

  it("حساب ناموجود → ۴۰۴", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.getAccount).mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "حساب مورد نظر پیدا نشد."),
    );
    const res = await accountGET(new Request("http://x/api/customers/AC-999"), {
      params: Promise.resolve({ id: "AC-999" }),
    });
    expect(res.status).toBe(404);
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await accountGET(new Request("http://x/api/customers/AC-101"), {
      params: Promise.resolve({ id: "AC-101" }),
    });
    expect(res.status).toBe(403);
    expect(accountService.getAccount).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/customers/[id]", () => {
  it("sales → ۲۰۰ و updateAccount با فیلدهای ارسالی", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.updateAccount).mockResolvedValue({ id: "AC-101" } as never);

    const res = await accountPATCH(
      new Request("http://x/api/customers/AC-101", {
        method: "PATCH",
        body: JSON.stringify({ name: "نام جدید" }),
      }),
      { params: Promise.resolve({ id: "AC-101" }) },
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(accountService.updateAccount).mock.calls[0]?.[1]).toEqual({ name: "نام جدید" });
  });

  it("بدنه خالی → ۲۰۰ (یعنی هیچ تغییری نده)", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.updateAccount).mockResolvedValue({ id: "AC-101" } as never);

    const res = await accountPATCH(
      new Request("http://x/api/customers/AC-101", { method: "PATCH", body: "" }),
      { params: Promise.resolve({ id: "AC-101" }) },
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(accountService.updateAccount).mock.calls[0]?.[1]).toEqual({});
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await accountPATCH(
      new Request("http://x/api/customers/AC-101", { method: "PATCH", body: JSON.stringify({ name: "x" }) }),
      { params: Promise.resolve({ id: "AC-101" }) },
    );
    expect(res.status).toBe(403);
    expect(accountService.updateAccount).not.toHaveBeenCalled();
  });

  it("حساب ناموجود → ۴۰۴", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.updateAccount).mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "حساب مورد نظر پیدا نشد."),
    );
    const res = await accountPATCH(
      new Request("http://x/api/customers/AC-999", { method: "PATCH", body: JSON.stringify({ name: "x" }) }),
      { params: Promise.resolve({ id: "AC-999" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/customers/[id]/deactivate", () => {
  it("sales → ۲۰۴ (حذف نرم، بدون بدنه پاسخ)", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.deactivateAccount).mockResolvedValue({ id: "AC-101", active: false } as never);

    const res = await deactivatePOST(
      new Request("http://x/api/customers/AC-101/deactivate", { method: "POST" }),
      { params: Promise.resolve({ id: "AC-101" }) },
    );

    expect(res.status).toBe(204);
    expect(vi.mocked(accountService.deactivateAccount).mock.calls[0]?.[0]).toBe("AC-101");
  });

  it("حساب ناموجود → ۴۰۴", async () => {
    seedSession(["sales"]);
    vi.mocked(accountService.deactivateAccount).mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "حساب مورد نظر پیدا نشد."),
    );
    const res = await deactivatePOST(
      new Request("http://x/api/customers/AC-999/deactivate", { method: "POST" }),
      { params: Promise.resolve({ id: "AC-999" }) },
    );
    expect(res.status).toBe(404);
  });

  it("production → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await deactivatePOST(
      new Request("http://x/api/customers/AC-101/deactivate", { method: "POST" }),
      { params: Promise.resolve({ id: "AC-101" }) },
    );
    expect(res.status).toBe(403);
    expect(accountService.deactivateAccount).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await deactivatePOST(
      new Request("http://x/api/customers/AC-101/deactivate", { method: "POST" }),
      { params: Promise.resolve({ id: "AC-101" }) },
    );
    expect(res.status).toBe(401);
  });
});
