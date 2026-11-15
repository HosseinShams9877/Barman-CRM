/**
 * آزمون مسیرهای API گزارش‌های مالی — PHASE_06 §۵ (CD-04: ۵ مرحله).
 *
 * پوشش:
 *  - ۲۰۰ مطالبات / پرداختنی / جریان نقدی برای admin و finance؛
 *  - production/depot → ۲۰۰ با hideMoney=true (R-32، صفحات بدون مبلغ)؛
 *  - sales → ۴۰۳ (بدون finance.view)؛
 *  - ۴۰۱ بدون کوکی؛
 *  - ۴۰۰ ماه نامعتبر در جریان نقدی (CD-06).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modules/finance")>();
  return {
    ...actual,
    listReceivables: vi.fn(),
    listPayables: vi.fn(),
    getCashflow: vi.fn(),
  };
});

vi.mock("@core/database/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    role: { upsert: vi.fn() },
    setting: { upsert: vi.fn() },
    rev: { upsert: vi.fn() },
    list: { upsert: vi.fn() },
    product: { count: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

type CookieStore = { get: (name: string) => { value: string } | undefined };
let cookieValue: string | undefined = undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "br_s" && cookieValue ? { value: cookieValue } : undefined),
  } satisfies CookieStore)),
}));

import { prisma } from "@core/database/client";
import { issueToken } from "@core/auth/token";
import { GET as receivablesGET } from "./receivables/route";
import { GET as payablesGET } from "./payables/route";
import { GET as cashflowGET } from "./cashflow/route";
import * as finance from "@modules/finance";

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

const EMPTY_RESULT = { groups: [], total: 0 } as never;
const EMPTY_CASHFLOW = { months: [], rows: [] } as never;

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("GET /api/finance/receivables", () => {
  it("finance → ۲۰۰", async () => {
    seedSession(["finance"]);
    vi.mocked(finance.listReceivables).mockResolvedValue(EMPTY_RESULT);
    const res = await receivablesGET();
    expect(res.status).toBe(200);
    expect(finance.listReceivables).toHaveBeenCalledTimes(1);
  });

  it("production → ۲۰۰ با hideMoney=true (R-32)", async () => {
    seedSession(["production"]);
    vi.mocked(finance.listReceivables).mockResolvedValue(EMPTY_RESULT);
    const res = await receivablesGET();
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.listReceivables).mock.calls[0]?.[0]).toBe(true);
  });

  it("depot → ۲۰۰ با hideMoney=true (R-32)", async () => {
    seedSession(["depot"]);
    vi.mocked(finance.listReceivables).mockResolvedValue(EMPTY_RESULT);
    const res = await receivablesGET();
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.listReceivables).mock.calls[0]?.[0]).toBe(true);
  });

  it("sales → ۴۰۳ (بدون finance.view)", async () => {
    seedSession(["sales"]);
    const res = await receivablesGET();
    expect(res.status).toBe(403);
    expect(finance.listReceivables).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await receivablesGET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/finance/payables", () => {
  it("admin → ۲۰۰", async () => {
    seedSession(["admin"]);
    vi.mocked(finance.listPayables).mockResolvedValue(EMPTY_RESULT);
    const res = await payablesGET();
    expect(res.status).toBe(200);
    expect(finance.listPayables).toHaveBeenCalledTimes(1);
  });

  it("production → ۲۰۰ با hideMoney=true (R-32)", async () => {
    seedSession(["production"]);
    vi.mocked(finance.listPayables).mockResolvedValue(EMPTY_RESULT);
    const res = await payablesGET();
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.listPayables).mock.calls[0]?.[0]).toBe(true);
  });

  it("sales → ۴۰۳", async () => {
    seedSession(["sales"]);
    const res = await payablesGET();
    expect(res.status).toBe(403);
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await payablesGET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/finance/cashflow", () => {
  it("admin → ۲۰۰ بدون فیلتر ماه (همه ماه‌ها)", async () => {
    seedSession(["admin"]);
    vi.mocked(finance.getCashflow).mockResolvedValue(EMPTY_CASHFLOW);
    const res = await cashflowGET(new Request("http://x/api/finance/cashflow"));
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.getCashflow).mock.calls[0]?.[1]).toBeNull();
  });

  it("admin → ۲۰۰ با فیلتر ماه معتبر", async () => {
    seedSession(["admin"]);
    vi.mocked(finance.getCashflow).mockResolvedValue(EMPTY_CASHFLOW);
    const res = await cashflowGET(new Request("http://x/api/finance/cashflow?month=1405%2F09"));
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.getCashflow).mock.calls[0]?.[1]).toBe("1405/09");
  });

  it("production → ۲۰۰ با hideMoney=true (R-32)", async () => {
    seedSession(["production"]);
    vi.mocked(finance.getCashflow).mockResolvedValue(EMPTY_CASHFLOW);
    const res = await cashflowGET(new Request("http://x/api/finance/cashflow"));
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.getCashflow).mock.calls[0]?.[0]).toBe(true);
  });

  it("ماه نامعتبر → ۴۰۰ (CD-06)", async () => {
    seedSession(["admin"]);
    const res = await cashflowGET(new Request("http://x/api/finance/cashflow?month=1405"));
    expect(res.status).toBe(400);
    expect(finance.getCashflow).not.toHaveBeenCalled();
  });

  it("sales → ۴۰۳", async () => {
    seedSession(["sales"]);
    const res = await cashflowGET(new Request("http://x/api/finance/cashflow"));
    expect(res.status).toBe(403);
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await cashflowGET(new Request("http://x/api/finance/cashflow"));
    expect(res.status).toBe(401);
  });
});
