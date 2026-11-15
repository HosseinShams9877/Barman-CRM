/**
 * آزمون مسیر گزارش‌ها — PHASE_07 §۱۲ / دروازه خروج ۵ و ۸.
 *
 * پوشش:
 *  - ۲۰۰ مسیر خوش برای admin با bucketing پاس‌داده‌شده به سرویس؛
 *  - ۴۰۳ برای نقش بدون reports.view (production)؛
 *  - قانون scoping: نقش sales (leads.view بدون leads.viewAll) فقط
 *    داده‌های خودش (PHASE_07 §۸)؛
 *  - ۴۰۱ بدون کوکی نشست؛
 *  - ۴۰۰ kind نامعتبر.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/reports/services/leads.report", () => ({ leadsReport: vi.fn() }));
vi.mock("@modules/reports/services/sales.report", () => ({ salesReport: vi.fn() }));
vi.mock("@modules/reports/services/prod.report", () => ({ prodReport: vi.fn() }));
vi.mock("@modules/reports/services/fin.report", () => ({ finReport: vi.fn() }));

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
import { GET } from "./[kind]/route";
import * as leadsReportModule from "@modules/reports/services/leads.report";
import * as salesReportModule from "@modules/reports/services/sales.report";
import * as prodReportModule from "@modules/reports/services/prod.report";
import * as finReportModule from "@modules/reports/services/fin.report";

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

function reqFor(kind: string, days = 90): Request {
  return new Request(`http://x/api/reports/${kind}?days=${days}`);
}

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("GET /api/reports/[kind]", () => {
  it("admin → ۲۰۰ leads با عبور پارامترها به سرویس", async () => {
    seedSession(["admin"]);
    vi.mocked(leadsReportModule.leadsReport).mockResolvedValue({
      bySource: [],
      byOwner: [],
      lostReasons: [],
    });

    const res = await GET(reqFor("leads", 30), { params: Promise.resolve({ kind: "leads" }) });
    expect(res.status).toBe(200);
    const args = vi.mocked(leadsReportModule.leadsReport).mock.calls[0]?.[0];
    expect(args?.days).toBe(30);
  });

  it("line query به سرویس پاس می‌شود", async () => {
    seedSession(["admin"]);
    vi.mocked(salesReportModule.salesReport).mockResolvedValue({
      tiles: { orders: 0, conversion: 0 },
      byProduct: [],
      byMonth: [],
    });

    const res = await GET(
      new Request("http://x/api/reports/sales?days=90&line=prod"),
      { params: Promise.resolve({ kind: "sales" }) },
    );
    expect(res.status).toBe(200);
    const args = vi.mocked(salesReportModule.salesReport).mock.calls[0]?.[0];
    expect(args?.line).toBe("prod");
  });

  it("نقش production (بدون reports.view) → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await GET(reqFor("sales"), { params: Promise.resolve({ kind: "sales" }) });
    expect(res.status).toBe(403);
    expect(salesReportModule.salesReport).not.toHaveBeenCalled();
  });

  it("بدون کوکی نشست → ۴۰۱", async () => {
    const res = await GET(reqFor("sales"), { params: Promise.resolve({ kind: "sales" }) });
    expect(res.status).toBe(401);
  });

  it("kind نامعتبر → ۴۰۰", async () => {
    seedSession(["admin"]);
    const res = await GET(reqFor("unknown"), { params: Promise.resolve({ kind: "unknown" }) });
    expect(res.status).toBe(400);
    expect(leadsReportModule.leadsReport).not.toHaveBeenCalled();
  });

  it("دروازه خروج ۸: کاربر با دید گزارش ولی بدون leads.viewAll فقط داده خودش را می‌بیند", async () => {
    // ترکیب نقش‌ها: دید گزارش از finance + دید سرنخ از sales بدون viewAll.
    seedSession(["sales", "finance"]);
    vi.mocked(leadsReportModule.leadsReport).mockResolvedValue({
      bySource: [],
      byOwner: [],
      lostReasons: [],
    });

    const res = await GET(reqFor("leads"), { params: Promise.resolve({ kind: "leads" }) });
    expect(res.status).toBe(200);
    const args = vi.mocked(leadsReportModule.leadsReport).mock.calls[0]?.[0];
    expect(args?.scope).toEqual({ restrictToOwner: true, userId: "u1" });
    // دید مبلغ از finance می‌آید — scoping صرفاً مالکیت را محدود می‌کند.
    expect(args?.hideMoney).toBe(false);
  });

  it("salesManager (leads.viewAll) → بدون محدودیت مالک", async () => {
    seedSession(["salesManager"]);
    vi.mocked(leadsReportModule.leadsReport).mockResolvedValue({
      bySource: [],
      byOwner: [],
      lostReasons: [],
    });

    await GET(reqFor("leads"), { params: Promise.resolve({ kind: "leads" }) });
    const args = vi.mocked(leadsReportModule.leadsReport).mock.calls[0]?.[0];
    expect(args?.scope.restrictToOwner).toBe(false);
    expect(args?.hideMoney).toBe(false);
  });

  it("prod و fin هم از خدمات خود فراخوانی می‌شوند", async () => {
    seedSession(["admin"]);
    vi.mocked(prodReportModule.prodReport).mockResolvedValue({
      tiles: { good: 0, wastePct: 0 },
      late: [],
    });
    vi.mocked(finReportModule.finReport).mockResolvedValue({
      tiles: {},
      expensesByKind: [],
    });

    expect(
      (await GET(reqFor("prod"), { params: Promise.resolve({ kind: "prod" }) })).status,
    ).toBe(200);
    expect(
      (await GET(reqFor("fin"), { params: Promise.resolve({ kind: "fin" }) })).status,
    ).toBe(200);
    expect(vi.mocked(prodReportModule.prodReport).mock.calls[0]?.[0]).toBe(false);
    expect(vi.mocked(finReportModule.finReport).mock.calls[0]?.[0]).toMatchObject({ days: 90 });
  });
});
