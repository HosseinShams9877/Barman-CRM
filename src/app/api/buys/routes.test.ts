/**
 * آزمون مسیرهای API خرید — PHASE_06 درگاه خروج ۴ (CD-04: ۵ مرحله).
 *
 * مسیرها مستقیماً فراخوانی می‌شوند؛ سرویس‌ها mock شده‌اند (منطق کسب‌وکار
 * در فایل سرویس آزمون شده است) ولی Zod‌ها واقعی‌اند تا خطاهای ۴۰۰ واقعی
 * باشند. Prisma فقط برای حل نشست mock شده است.
 *
 * پوشش:
 *  - ۲۰۰/۲۰۱ مسیر خوش برای همه ۶ مسیر؛
 *  - ۴۰۱ بدون کوکی نشست؛
 *  - ۴۰۳ نقش بدون مجوز (sales بدون purchasing.* / finance.*)؛
 *  - ۴۰۰ ورودی نامعتبر (Zod)؛
 *  - ۴۰۹/۴۰۴ خطاهای سرویس به پاسخ ترجمه می‌شوند؛
 *  - production → ۲۰۰ بدون فیلدهای پولی (R-32 / PHASE_06 §۹).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/purchasing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modules/purchasing")>();
  return {
    ...actual,
    listBuys: vi.fn(),
    createBuy: vi.fn(),
    getBuy: vi.fn(),
    updateBuy: vi.fn(),
    approveBuy: vi.fn(),
    financeBuy: vi.fn(),
    receiveBuy: vi.fn(),
    payBuyCheque: vi.fn(),
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
import { GET as buysGET, POST as buysPOST } from "./route";
import { GET as buyGET, PATCH as buyPATCH } from "./[id]/route";
import { POST as approvePOST } from "./[id]/approve/route";
import { POST as financePOST } from "./[id]/finance/route";
import { POST as receivePOST } from "./[id]/receive/route";
import { PATCH as chequePATCH } from "./[id]/cheques/[cid]/route";
import * as buyService from "@modules/purchasing";

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

const BUY_DETAIL = {
  id: "BY-101",
  status: "req",
  total: 120000,
  rev: 0,
  items: [{ materialName: "ماده ۱", qty: 10, price: 12000 }],
  cheques: [],
};

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("GET /api/buys", () => {
  it("admin → ۲۰۰ و لیست خریدها", async () => {
    seedSession(["admin"]);
    vi.mocked(buyService.listBuys).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    const res = await buysGET(new Request("http://x/api/buys"));

    expect(res.status).toBe(200);
    expect(buyService.listBuys).toHaveBeenCalled();
  });

  it("production → ۲۰۰ ولی noMoney در سرویس اعمال می‌شود (R-32)", async () => {
    seedSession(["production"]);
    vi.mocked(buyService.listBuys).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    const res = await buysGET(new Request("http://x/api/buys"));

    expect(res.status).toBe(200);
    expect(vi.mocked(buyService.listBuys).mock.calls[0]?.[1]).toBe(true);
  });

  it("sales → ۴۰۳ (بدون purchasing.view)", async () => {
    seedSession(["sales"]);
    const res = await buysGET(new Request("http://x/api/buys"));
    expect(res.status).toBe(403);
    expect(buyService.listBuys).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await buysGET(new Request("http://x/api/buys"));
    expect(res.status).toBe(401);
  });

  it("status نامعتبر → ۴۰۰", async () => {
    seedSession(["admin"]);
    const res = await buysGET(new Request("http://x/api/buys?status=nope"));
    expect(res.status).toBe(400);
    expect(buyService.listBuys).not.toHaveBeenCalled();
  });
});

describe("POST /api/buys", () => {
  it("admin → ۲۰۱ با اقلام معتبر", async () => {
    seedSession(["admin"]);
    vi.mocked(buyService.createBuy).mockResolvedValue(BUY_DETAIL as never);

    const res = await buysPOST(
      new Request("http://x/api/buys", {
        method: "POST",
        body: JSON.stringify({ items: [{ materialId: "mat-1", qty: 10, price: 12000 }] }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("BY-101");
  });

  it("بدون قلم → ۴۰۰ (app/buy.js:138)", async () => {
    seedSession(["admin"]);
    const res = await buysPOST(
      new Request("http://x/api/buys", { method: "POST", body: JSON.stringify({ items: [] }) }),
    );
    expect(res.status).toBe(400);
    expect(buyService.createBuy).not.toHaveBeenCalled();
  });

  it("depot → ۴۰۳ (inventory.moves ≠ purchasing.edit)", async () => {
    seedSession(["depot"]);
    const res = await buysPOST(
      new Request("http://x/api/buys", { method: "POST", body: JSON.stringify({ items: [] }) }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/buys/[id]", () => {
  it("admin → ۲۰۰", async () => {
    seedSession(["admin"]);
    vi.mocked(buyService.getBuy).mockResolvedValue(BUY_DETAIL as never);
    const res = await buyGET(new Request("http://x/api/buys/BY-101"), {
      params: Promise.resolve({ id: "BY-101" }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(buyService.getBuy).mock.calls[0]?.[0]).toBe("BY-101");
  });

  it("production → ۲۰۰ با hideMoney=true (PHASE_06 §۹)", async () => {
    seedSession(["production"]);
    vi.mocked(buyService.getBuy).mockResolvedValue(BUY_DETAIL as never);
    const res = await buyGET(new Request("http://x/api/buys/BY-101"), {
      params: Promise.resolve({ id: "BY-101" }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(buyService.getBuy).mock.calls[0]?.[1]).toBe(true);
  });

  it("404 خرید ناموجود از سرویس", async () => {
    seedSession(["admin"]);
    vi.mocked(buyService.getBuy).mockRejectedValue(new ApiError(404, "NOT_FOUND", "خرید پیدا نشد."));
    const res = await buyGET(new Request("http://x/api/buys/BY-404"), {
      params: Promise.resolve({ id: "BY-404" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/buys/[id]", () => {
  it("admin → ۲۰۰ با rev", async () => {
    seedSession(["admin"]);
    vi.mocked(buyService.updateBuy).mockResolvedValue({ ...BUY_DETAIL, rev: 1 } as never);
    const res = await buyPATCH(
      new Request("http://x/api/buys/BY-101", {
        method: "PATCH",
        body: JSON.stringify({ rev: 0, note: "تست" }),
      }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(buyService.updateBuy).mock.calls[0]?.[1]).toMatchObject({ rev: 0 });
  });

  it("عدم تطابق rev → ۴۰۹ (R-06)", async () => {
    seedSession(["admin"]);
    vi.mocked(buyService.updateBuy).mockRejectedValue(new ApiError(409, "CONFLICT", "تغییر همزمان"));
    const res = await buyPATCH(
      new Request("http://x/api/buys/BY-101", {
        method: "PATCH",
        body: JSON.stringify({ rev: 0 }),
      }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(409);
  });

  it("بدون rev → ۴۰۰", async () => {
    seedSession(["admin"]);
    const res = await buyPATCH(
      new Request("http://x/api/buys/BY-101", { method: "PATCH", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(400);
    expect(buyService.updateBuy).not.toHaveBeenCalled();
  });
});

describe("POST /api/buys/[id]/approve — purchasing.approve", () => {
  it("management → ۲۰۰", async () => {
    seedSession(["management"]);
    vi.mocked(buyService.approveBuy).mockResolvedValue({ ...BUY_DETAIL, status: "ok" } as never);
    const res = await approvePOST(
      new Request("http://x/api/buys/BY-101/approve", { method: "POST", body: JSON.stringify({ rev: 0 }) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(200);
  });

  it("finance → ۴۰۳ (finance.approve ≠ purchasing.approve)", async () => {
    seedSession(["finance"]);
    const res = await approvePOST(
      new Request("http://x/api/buys/BY-101/approve", { method: "POST", body: JSON.stringify({ rev: 0 }) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(403);
    expect(buyService.approveBuy).not.toHaveBeenCalled();
  });
});

describe("POST /api/buys/[id]/finance — finance.approve", () => {
  it("finance → ۲۰۰ با چک‌ها (app/buy.js:231)", async () => {
    seedSession(["finance"]);
    vi.mocked(buyService.financeBuy).mockResolvedValue({ ...BUY_DETAIL, status: "fin" } as never);
    const res = await financePOST(
      new Request("http://x/api/buys/BY-101/finance", {
        method: "POST",
        body: JSON.stringify({ rev: 1, cheques: [{ amount: 120000, due: "1405/10/01" }] }),
      }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(buyService.financeBuy).mock.calls[0]?.[1]).toMatchObject({ cheques: [{ amount: 120000 }] });
  });

  it("depot → ۴۰۳ (بدون finance.approve)", async () => {
    seedSession(["depot"]);
    const res = await financePOST(
      new Request("http://x/api/buys/BY-101/finance", { method: "POST", body: JSON.stringify({ rev: 1 }) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/buys/[id]/receive — inventory.moves + اتصال انبار", () => {
  it("depot → ۲۰۰ (تحویل انبار)", async () => {
    seedSession(["depot"]);
    vi.mocked(buyService.receiveBuy).mockResolvedValue({ ...BUY_DETAIL, status: "recv" } as never);
    const res = await receivePOST(
      new Request("http://x/api/buys/BY-101/receive", { method: "POST", body: JSON.stringify({ rev: 1 }) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(200);
    expect(buyService.receiveBuy).toHaveBeenCalled();
  });

  it("رسید تکراری → ۴۰۹ (بدون حرکت یتیم)", async () => {
    seedSession(["depot"]);
    vi.mocked(buyService.receiveBuy).mockRejectedValue(new ApiError(409, "CONFLICT", "قبلاً وارد انبار شده"));
    const res = await receivePOST(
      new Request("http://x/api/buys/BY-101/receive", { method: "POST", body: JSON.stringify({ rev: 1 }) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(409);
  });

  it("production → ۴۰۳ (inventory.moves ندارد)", async () => {
    seedSession(["production"]);
    const res = await receivePOST(
      new Request("http://x/api/buys/BY-101/receive", { method: "POST", body: JSON.stringify({ rev: 1 }) }),
      { params: Promise.resolve({ id: "BY-101" }) },
    );
    expect(res.status).toBe(403);
    expect(buyService.receiveBuy).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/buys/[id]/cheques/[cid] — finance.edit", () => {
  it("finance → ۲۰۰ با status=paid (app/fin.js:143)", async () => {
    seedSession(["finance"]);
    vi.mocked(buyService.payBuyCheque).mockResolvedValue({ ...BUY_DETAIL, status: "fin" } as never);
    const res = await chequePATCH(
      new Request("http://x/api/buys/BY-101/cheques/chq1", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: "BY-101", cid: "chq1" }) },
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(buyService.payBuyCheque).mock.calls[0]?.[1]).toBe("chq1");
  });

  it("status غیر paid → ۴۰۰", async () => {
    seedSession(["finance"]);
    const res = await chequePATCH(
      new Request("http://x/api/buys/BY-101/cheques/chq1", {
        method: "PATCH",
        body: JSON.stringify({ status: "issued" }),
      }),
      { params: Promise.resolve({ id: "BY-101", cid: "chq1" }) },
    );
    expect(res.status).toBe(400);
    expect(buyService.payBuyCheque).not.toHaveBeenCalled();
  });

  it("چک پاس‌شده مجدد → ۴۰۹", async () => {
    seedSession(["finance"]);
    vi.mocked(buyService.payBuyCheque).mockRejectedValue(new ApiError(409, "CONFLICT", "قبلاً پاس شده"));
    const res = await chequePATCH(
      new Request("http://x/api/buys/BY-101/cheques/chq1", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: "BY-101", cid: "chq1" }) },
    );
    expect(res.status).toBe(409);
  });

  it("depot → ۴۰۳ (بدون finance.edit)", async () => {
    seedSession(["depot"]);
    const res = await chequePATCH(
      new Request("http://x/api/buys/BY-101/cheques/chq1", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: "BY-101", cid: "chq1" }) },
    );
    expect(res.status).toBe(403);
  });
});
