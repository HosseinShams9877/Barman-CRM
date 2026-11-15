/**
 * آزمون مسیرهای خروجی — PHASE_07 §۱۲ / دروازه خروج ۷.
 *
 * پوشش:
 *  - ۲۰۰/۴۰۳ مجوزها (admin.settings برای zip/json، leads.view برای CSV)؛
 *  - ۴۰۱ بدون کوکی نشست؛
 *  - scoping CSV برای نقش sales (PHASE_07 §۸).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/export/services/snapshot.service", () => ({
  buildSnapshot: vi.fn(),
  leadsCsvRows: vi.fn(),
}));

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
import { POST as zipPOST } from "./zip/route";
import { POST as jsonPOST } from "./json/route";
import { POST as csvPOST } from "./leads-csv/route";
import * as snapshotService from "@modules/export/services/snapshot.service";

function seedSession(roles: string[]): void {
  cookieValue = issueToken({ sub: "u1", u: "نگار صادقی", roles, sv: 0 }, 8 * 60 * 60 * 1000).token;
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "u1",
    name: "نگار صادقی",
    title: "کارشناس",
    off: false,
    passwordHash: null,
    passwordSalt: null,
    sessionVersion: 0,
    roles: roles.map((roleKey) => ({ roleKey })),
  } as never);
}

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("POST /api/export/zip", () => {
  it("admin → ۲۰۰ با Content-Type زیپ", async () => {
    seedSession(["admin"]);
    vi.mocked(snapshotService.buildSnapshot).mockResolvedValue({ meta: {}, orders: [], docs: {}, seq: [] });

    const res = await zipPOST();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/zip");
  });

  it("sales (بدون admin.settings) → ۴۰۳", async () => {
    seedSession(["sales"]);
    const res = await zipPOST();
    expect(res.status).toBe(403);
    expect(snapshotService.buildSnapshot).not.toHaveBeenCalled();
  });

  it("بدون کوکی → ۴۰۱", async () => {
    const res = await zipPOST();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/export/json", () => {
  it("management → ۲۰۰ JSON", async () => {
    seedSession(["management"]);
    vi.mocked(snapshotService.buildSnapshot).mockResolvedValue({
      meta: { version: 7 },
      orders: [],
      docs: {},
      seq: [],
    });

    const res = await jsonPOST();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("finance → ۴۰۳ (خروجی کامل فقط مدیر)", async () => {
    seedSession(["finance"]);
    const res = await jsonPOST();
    expect(res.status).toBe(403);
  });
});

describe("POST /api/export/leads-csv", () => {
  it("sales → ۲۰۰ فقط سرنخ‌های خودش (scoping — PHASE_07 §۸)", async () => {
    seedSession(["sales"]);
    vi.mocked(snapshotService.leadsCsvRows).mockResolvedValue([
      {
        id: "LD-1",
        accountName: "الف",
        accountKind: "person",
        accountCity: "",
        phones: [],
        contacts: [],
        line: "prod",
        stage: "raw",
        ownerName: "نگار صادقی",
        source: "",
        interest: [],
        amount: null,
        nextAt: null,
        nextSubject: null,
        callCount: 0,
        lastResult: "",
        lostReason: null,
        note: "",
        orderIds: [],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "LD-2",
        accountName: "ب",
        accountKind: "person",
        accountCity: "",
        phones: [],
        contacts: [],
        line: "prod",
        stage: "raw",
        ownerName: "علی توکلی",
        source: "",
        interest: [],
        amount: null,
        nextAt: null,
        nextSubject: null,
        callCount: 0,
        lastResult: "",
        lostReason: null,
        note: "",
        orderIds: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ]);

    const res = await csvPOST();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");

    const body = await res.text();
    const ids = body.split("\r\n").slice(1).map((l) => l.split(",")[0]);
    expect(ids).toEqual(["LD-1"]); // LD-2 مال کاربر دیگر — فیلتر شد
  });

  it("production (بدون leads.view) → ۴۰۳", async () => {
    seedSession(["production"]);
    const res = await csvPOST();
    expect(res.status).toBe(403);
  });
});
