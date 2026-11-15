/**
 * آزمون مسیرهای API تراکنش مالی — PHASE_06 §۶ (CD-04: ۵ مرحله).
 *
 * سرویس‌ها mock شده‌اند (منطق در txn.service.test.ts آزمون شده) ولی Zod‌ها
 * واقعی‌اند تا خطاهای ۴۰۰ واقعی باشند.
 *
 * پوشش:
 *  - ۲۰۰/۲۰۱ مسیر خوش؛
 *  - ۴۰۱ بدون کوکی؛
 *  - ۴۰۳ sales (بدون finance.*) و production (فقط finance.view، نه edit)؛
 *  - ۴۰۰ ورودی نامعتبر (Zod)؛
 *  - production → ۲۰۰ با hideMoney=true در سرویس (R-32).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modules/finance")>();
  return {
    ...actual,
    listTxns: vi.fn(),
    createTxn: vi.fn(),
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
import { ApiError } from "@core/errors";
import { GET, POST } from "./route";
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

const TXN_ROW = {
  id: "tx1",
  kind: "هزینه — اجاره",
  direction: "expense",
  amount: 40000,
  at: "1405/09/01",
  who: "مالک",
  note: null,
  byName: "علی",
  createdAt: "2026-11-01T00:00:00.000Z",
};

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("GET /api/txns", () => {
  it("admin → ۲۰۰ با پارامترهای فیلتر", async () => {
    seedSession(["admin"]);
    vi.mocked(finance.listTxns).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    const res = await GET(new Request("http://x/api/txns?kind=%D9%87%D8%B2%DB%8C%D9%86%D9%87%3A%20%D8%A7%D8%AC%D8%A7%D8%B1%D9%87&direction=expense&page=2"));

    expect(res.status).toBe(200);
    expect(vi.mocked(finance.listTxns).mock.calls[0]?.[0]).toMatchObject({ direction: "expense", page: 2 });
  });

  it("production → ۲۰۰ ولی hideMoney=true (R-32 / PHASE_06 §۹)", async () => {
    seedSession(["production"]);
    vi.mocked(finance.listTxns).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    const res = await GET(new Request("http://x/api/txns"));
    expect(res.status).toBe(200);
    expect(vi.mocked(finance.listTxns).mock.calls[0]?.[1]).toBe(true);
  });

  it("sales → ۴۰۳ (بدون finance.view)", async () => {
    seedSession(["sales"]);
    const res = await GET(new Request("http://x/api/txns"));
    expect(res.status).toBe(403);
    expect(finance.listTxns).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await GET(new Request("http://x/api/txns"));
    expect(res.status).toBe(401);
  });

  it("جهت نامعتبر → ۴۰۰", async () => {
    seedSession(["admin"]);
    const res = await GET(new Request("http://x/api/txns?direction=up"));
    expect(res.status).toBe(400);
    expect(finance.listTxns).not.toHaveBeenCalled();
  });

  it("page صفر → ۴۰۰", async () => {
    seedSession(["admin"]);
    const res = await GET(new Request("http://x/api/txns?page=0"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/txns", () => {
  it("admin → ۲۰۱ با نوع ثابت Demo", async () => {
    seedSession(["admin"]);
    vi.mocked(finance.createTxn).mockResolvedValue(TXN_ROW as never);

    const res = await POST(
      new Request("http://x/api/txns", {
        method: "POST",
        body: JSON.stringify({ kind: "هزینه: اجاره", amount: 40000, at: "1405/09/01" }),
      }),
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(finance.createTxn).mock.calls[0]?.[1]).toBe("u1");
    const body = (await res.json()) as { kind: string };
    expect(body.kind).toBe("هزینه — اجاره");
  });

  it("production → ۴۰۳ (finance.view ≠ finance.edit)", async () => {
    seedSession(["production"]);
    const res = await POST(
      new Request("http://x/api/txns", {
        method: "POST",
        body: JSON.stringify({ kind: "هزینه: اجاره", amount: 1, at: "1405/09/01" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(finance.createTxn).not.toHaveBeenCalled();
  });

  it("نوع اختراعی → ۴۰۰ (app/fin.js:145)", async () => {
    seedSession(["admin"]);
    const res = await POST(
      new Request("http://x/api/txns", {
        method: "POST",
        body: JSON.stringify({ kind: "هزینه: اختراعی", amount: 1000, at: "1405/09/01" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(finance.createTxn).not.toHaveBeenCalled();
  });

  it("مبلغ اعشاری → ۴۰۰ (CD-13)", async () => {
    seedSession(["admin"]);
    const res = await POST(
      new Request("http://x/api/txns", {
        method: "POST",
        body: JSON.stringify({ kind: "هزینه: اجاره", amount: 1000.5, at: "1405/09/01" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await POST(
      new Request("http://x/api/txns", {
        method: "POST",
        body: JSON.stringify({ kind: "هزینه: اجاره", amount: 1000, at: "1405/09/01" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("خطای سرویس به کد وضعیت ترجمه می‌شود (۴۰۹ نمونه)", async () => {
    seedSession(["admin"]);
    vi.mocked(finance.createTxn).mockRejectedValue(new ApiError(409, "CONFLICT", "تداخل"));
    const res = await POST(
      new Request("http://x/api/txns", {
        method: "POST",
        body: JSON.stringify({ kind: "هزینه: اجاره", amount: 1000, at: "1405/09/01" }),
      }),
    );
    expect(res.status).toBe(409);
  });
});
