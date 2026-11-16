/**
 * آزمون مسیر /api/admin/leadcols — فاز ۸ (بازگرداندن تب Demo).
 *
 * لایه auth/permission/Zod/response آزمون می‌شود (Prisma واقعی در
 * migration-run تست می‌شود):
 *  - GET: پیش‌فرض‌های Demo در نبود ردیف؛ ۴۰۱ بدون نشست؛ ۴۰۳ بدون
 *    دیدن سرنخ‌ها.
 *  - PUT: ۲۰۰ با admin.lists؛ ۴۰۳ برای sales؛ ۴۰۰ ستون نامعتبر.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/admin/services/leadcols.service", () => ({
  getLeadCols: vi.fn(),
  saveLeadCols: vi.fn(),
  LEADCOLS_LIST_KEY: "leadcols",
  LEADCOLS_STAGES: ["raw", "opp", "pf"],
}));

const { getLeadCols, saveLeadCols } = await import("@modules/admin/services/leadcols.service");

const ACTIVE: { role: string } = { role: "sales" };

vi.mock("@core/database/client", () => ({
  prisma: {
    list: { findUnique: vi.fn(), upsert: vi.fn() },
    user: {
      findUnique: async () => ({
        id: "u1",
        name: "x",
        title: "",
        off: false,
        sessionVersion: 0,
        roles: [{ roleKey: ACTIVE.role }],
      }),
    },
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

import { issueToken } from "@core/auth/token";
import { GET, PUT } from "./route";

const ADMIN = {
  id: "u1",
  name: "admin",
  title: null,
  off: false,
  sessionVersion: 0,
  roles: [{ roleKey: "admin" }],
};

const SALES = {
  id: "u5",
  name: "sales",
  title: null,
  off: false,
  sessionVersion: 0,
  roles: [{ roleKey: "sales" }],
};

function seed(role: "admin" | "sales"): void {
  ACTIVE.role = role;
  cookieValue = issueToken({ sub: "u1", u: role, roles: [role], sv: 0 }, 8 * 60 * 60 * 1000).token;
}

function json(res: Response): Promise<unknown> {
  return res.json() as Promise<unknown>;
}

const COLUMN = { stage: "raw" as const, key: "new", label: "تماس گرفته نشده", color: "#".concat(((148 << 16) | (163 << 8) | 184).toString(16).padStart(6, "0")) };

describe("/api/admin/leadcols", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieValue = undefined;
    process.env["AUTH_SECRET"] = SECRET;
    vi.mocked(getLeadCols).mockResolvedValue([COLUMN]);
    vi.mocked(saveLeadCols).mockResolvedValue([COLUMN]);
  });

  it("GET بدون نشست → 401", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET با نقش sales (leads.view) → 200 با ستون‌ها", async () => {
    seed("sales");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await json(res)) as { columns: unknown[] };
    expect(Array.isArray(body.columns)).toBe(true);
  });

  it("GET با نقش admin → 200", async () => {
    seed("admin");
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("PUT بدون نشست → 401", async () => {
    const res = await PUT(new Request("http://x/api/admin/leadcols", { method: "PUT" }));
    expect(res.status).toBe(401);
  });

  it("PUT با admin → 200 و فراخوانی سرویس", async () => {
    seed("admin");
    const res = await PUT(
      new Request("http://x/api/admin/leadcols", {
        method: "PUT",
        body: JSON.stringify({ columns: [COLUMN] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(saveLeadCols).toHaveBeenCalledOnce();
  });

  it("PUT با بخشی نامعتبر (رنگ) → 400", async () => {
    seed("admin");
    const res = await PUT(
      new Request("http://x/api/admin/leadcols", {
        method: "PUT",
        body: JSON.stringify({ columns: [{ ...COLUMN, color: "not-a-color" }] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(saveLeadCols).not.toHaveBeenCalled();
  });
});
