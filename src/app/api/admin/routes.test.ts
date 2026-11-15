/**
 * آزمون مسیرهای API مدیریت — PHASE_07 §۱۲ / دروازه خروج ۳.
 *
 * مسیرها مستقیماً فراخوانی می‌شوند؛ سرویس‌ها و Prisma mock شده‌اند تا
 * لایه auth/permission/Zod/response در معرض آزمون قرار گیرد.
 *
 * پوشش:
 *  - ۲۰۰/۲۰۱ مسیر خوش برای admin؛
 *  - ۴۰۳ نقش‌های غیرمجاز طبق ماتریس SEE/EDIT (admin.js:9-13)؛
 *  - ۴۰۱ بدون کوکی نشست؛
 *  - ۴۰۰ ورودی نامعتبر (Zod).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

vi.mock("@modules/admin/services/user.service", () => ({
  listAdminUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("@modules/admin/services/catalog.service", () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  listMaterials: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
}));
vi.mock("@modules/admin/services/bom.service", () => ({
  getBom: vi.fn(),
  saveBom: vi.fn(),
}));
vi.mock("@modules/admin/services/supplier.service", () => ({
  listAllSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}));
vi.mock("@modules/admin/services/lists.service", () => ({
  listLists: vi.fn(),
  saveLists: vi.fn(),
}));
vi.mock("@modules/admin/services/settings.service", () => ({
  saveSettings: vi.fn(),
}));
vi.mock("@modules/settings/services/settings.service", () => ({
  getSettings: vi.fn(),
  DEFAULT_SETTINGS: {},
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
import { GET as usersGET, POST as usersPOST } from "./users/route";
import { PATCH as userPATCH } from "./users/[id]/route";
import { GET as productsGET, POST as productsPOST } from "./products/route";
import { PATCH as productPATCH } from "./products/[id]/route";
import { GET as bomGET, PUT as bomPUT } from "./products/[id]/bom/route";
import { GET as materialsGET, POST as materialsPOST } from "./materials/route";
import { GET as suppliersGET } from "./suppliers/route";
import { GET as listsGET, PUT as listsPUT } from "./lists/route";
import { GET as settingsGET, PATCH as settingsPATCH } from "./settings/route";
import * as userService from "@modules/admin/services/user.service";
import * as catalog from "@modules/admin/services/catalog.service";
import * as bomService from "@modules/admin/services/bom.service";
import * as supplierService from "@modules/admin/services/supplier.service";
import * as listsService from "@modules/admin/services/lists.service";
import * as settingsService from "@modules/admin/services/settings.service";
import * as platformSettings from "@modules/settings/services/settings.service";

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

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  vi.clearAllMocks();
});

describe("دروازه خروج ۳: مسیرهای فقط-مدیر (admin.users / admin.lists / admin.settings)", () => {
  it("GET /api/admin/users → ۲۰۰ برای admin", async () => {
    seedSession(["admin"]);
    vi.mocked(userService.listAdminUsers).mockResolvedValue([]);

    const res = await usersGET();
    expect(res.status).toBe(200);
  });

  it("GET /api/admin/users → ۴۰۳ برای finance (FULL نیست — admin.js:9)", async () => {
    seedSession(["finance"]);
    const res = await usersGET();
    expect(res.status).toBe(403);
    expect(userService.listAdminUsers).not.toHaveBeenCalled();
  });

  it("GET /api/admin/lists → ۲۰۰ برای admin، ۴۰۳ برای sales (دروازه خروج ۳)", async () => {
    seedSession(["admin"]);
    vi.mocked(listsService.listLists).mockResolvedValue([]);
    expect((await listsGET()).status).toBe(200);

    vi.clearAllMocks();
    seedSession(["sales"]);
    const res = await listsGET();
    expect(res.status).toBe(403);
    expect(listsService.listLists).not.toHaveBeenCalled();
  });

  it("PUT /api/admin/lists → ۲۰۰ برای management (همه ۷ فهرست با هم — admin.js:174)", async () => {
    seedSession(["management"]);
    vi.mocked(listsService.saveLists).mockResolvedValue([]);

    const all = Object.fromEntries(
      ["sources", "roles", "results", "lost", "projects", "channels", "waste"].map((k) => [
        k,
        k === "sources" ? ["تماس"] : [],
      ]),
    );
    const res = await listsPUT(
      new Request("http://x/api/admin/lists", {
        method: "PUT",
        body: JSON.stringify({ lists: all }),
      }),
    );
    expect(res.status).toBe(200);
    const args = vi.mocked(listsService.saveLists).mock.calls[0];
    expect(args?.[0]).toEqual({ lists: all });
  });

  it("PUT /api/admin/lists → ۴۰۳ برای production ( با وجود دید materials/bom)", async () => {
    seedSession(["production"]);
    const res = await listsPUT(
      new Request("http://x/api/admin/lists", {
        method: "PUT",
        body: JSON.stringify({ lists: { lost: ["قیمت"] } }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("PATCH /api/admin/settings → ۲۰۰ برای admin، ۴۰۳ برای sales", async () => {
    seedSession(["admin"]);
    vi.mocked(settingsService.saveSettings).mockResolvedValue({
      vat: 10,
      validDays: 3,
      discountCap: null,
      company: { name: "", en: "", tagline: "", phone: "", address: "", bale: "" },
    });
    const res = await settingsPATCH(
      new Request("http://x/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ vat: 10, validDays: 3, company: {} }),
      }),
    );
    expect(res.status).toBe(200);

    vi.clearAllMocks();
    seedSession(["sales"]);
    const res2 = await settingsPATCH(
      new Request("http://x/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ vat: 10, validDays: 3, company: {} }),
      }),
    );
    expect(res2.status).toBe(403);
  });

  it("GET /api/admin/settings → ۴۰۱ بدون کوکی نشست", async () => {
    const res = await settingsGET();
    expect(res.status).toBe(401);
  });
});

describe("مسیرهای کاتالوک — ماتریس SEE/EDIT (admin.js:11-12)", () => {
  it("GET /api/admin/products → ۲۰۰ برای sales (SEE همه) و hideMoney در سرور", async () => {
    seedSession(["sales"]);
    vi.mocked(catalog.listProducts).mockResolvedValue([]);

    const res = await productsGET();
    expect(res.status).toBe(200);
    expect(catalog.listProducts).toHaveBeenCalledWith(true); // sales فاقد money.view
  });

  it("POST /api/admin/products → ۲۰۱ برای admin، ۴۰۳ برای sales (ویرایش فقط FULL)", async () => {
    seedSession(["admin"]);
    vi.mocked(catalog.createProduct).mockResolvedValue({
      id: "p1",
      code: "BR-139",
      name: "پنل",
      line: "prod",
      category: "",
      unit: "مترمربع",
      price: 100000,
      days: 2,
      active: true,
      supplierId: null,
      colors: [] as string[],
    });

    const body = {
      code: "BR-139",
      name: "پنل",
      line: "prod",
      unit: "مترمربع",
      price: 100000,
    };
    const res = await productsPOST(
      new Request("http://x/api/admin/products", { method: "POST", body: JSON.stringify(body) }),
    );
    expect(res.status).toBe(201);

    vi.clearAllMocks();
    seedSession(["sales"]);
    const res2 = await productsPOST(
      new Request("http://x/api/admin/products", { method: "POST", body: JSON.stringify(body) }),
    );
    expect(res2.status).toBe(403);
  });

  it("GET /api/admin/materials → ۲۰۰ برای production، ۴۰۳ برای sales", async () => {
    seedSession(["production"]);
    vi.mocked(catalog.listMaterials).mockResolvedValue([]);
    expect((await materialsGET()).status).toBe(200);

    vi.clearAllMocks();
    seedSession(["sales"]);
    expect((await materialsGET()).status).toBe(403);
  });

  it("POST /api/admin/materials → ۲۰۱ برای production (edit materials)", async () => {
    seedSession(["production"]);
    vi.mocked(catalog.createMaterial).mockResolvedValue({
      id: "m1",
      code: "RM-1",
      name: "رزین",
      unit: "کیلو",
      price: 5000,
      min: 0,
    });

    const res = await materialsPOST(
      new Request("http://x/api/admin/materials", {
        method: "POST",
        body: JSON.stringify({ code: "RM-1", name: "رزین", unit: "کیلو", price: 5000 }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it("GET BOM → ۲۰۰ برای production، ۴۰۳ برای depot", async () => {
    seedSession(["production"]);
    vi.mocked(bomService.getBom).mockResolvedValue({
      productId: "p1",
      productName: "پنل",
      productUnit: "مترمربع",
      items: [],
    });
    const res = await bomGET(new Request("http://x"), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);

    vi.clearAllMocks();
    seedSession(["depot"]);
    const res2 = await bomGET(new Request("http://x"), { params: Promise.resolve({ id: "p1" }) });
    expect(res2.status).toBe(403);
  });

  it("PUT BOM → ۲۰۰ برای production (edit bom)، ۴۰۳ برای depot", async () => {
    seedSession(["production"]);
    vi.mocked(bomService.saveBom).mockResolvedValue({
      productId: "p1",
      productName: "پنل",
      productUnit: "مترمربع",
      items: [],
    });
    const res = await bomPUT(
      new Request("http://x/api/admin/products/p1/bom", {
        method: "PUT",
        body: JSON.stringify({ items: [{ materialId: "m1", qty: 2 }] }),
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res.status).toBe(200);

    vi.clearAllMocks();
    seedSession(["depot"]);
    const res2 = await bomPUT(
      new Request("http://x/api/admin/products/p1/bom", {
        method: "PUT",
        body: JSON.stringify({ items: [] }),
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res2.status).toBe(403);
  });

  it("PATCH /api/admin/products/[id] → ۴۰۳ برای production (products را فقط FULL ویرایش می‌کند)", async () => {
    seedSession(["production"]);
    const res = await productPATCH(
      new Request("http://x/api/admin/products/p1", {
        method: "PATCH",
        body: JSON.stringify({ code: "BR-1", name: "پنل", line: "prod", unit: "مترمربع", price: 100 }),
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/suppliers → ۲۰۰ برای finance، ۴۰۳ برای production", async () => {
    seedSession(["finance"]);
    vi.mocked(supplierService.listAllSuppliers).mockResolvedValue([]);
    expect((await suppliersGET()).status).toBe(200);

    vi.clearAllMocks();
    seedSession(["production"]);
    expect((await suppliersGET()).status).toBe(403);
  });
});

describe("اعتبارسنجی ورودی (Zod)", () => {
  it("POST /api/admin/users → ۴۰۹/۴۰۰ ورودی نامعتبر", async () => {
    seedSession(["admin"]);
    const res = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: "x", role: "sales", password: "12" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it("POST /api/admin/users → رمز هش‌شده به سرویس پاس می‌شود", async () => {
    seedSession(["admin"]);
    vi.mocked(userService.createUser).mockResolvedValue({
      id: "u2",
      name: "نگار",
      title: "",
      off: false,
      roles: ["sales"],
    });

    const res = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: "نگار", role: "sales", password: "secret123" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(userService.createUser).mock.calls[0]?.[0]).toMatchObject({
      name: "نگار",
      role: "sales",
    });
  });

  it("PATCH /api/admin/users/[id] → غیرفعال‌سازی به سرویس پاس می‌شود", async () => {
    seedSession(["admin"]);
    vi.mocked(userService.updateUser).mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: true,
      roles: ["sales"],
    });

    const res = await userPATCH(
      new Request("http://x/api/admin/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ off: true }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(userService.updateUser).mock.calls[0]?.[1]).toEqual({ off: true });
  });

  it("GET /api/admin/settings → تنظیمات خوانده می‌شود", async () => {
    seedSession(["management"]);
    vi.mocked(platformSettings.getSettings).mockResolvedValue({
      vat: 10,
      validDays: 3,
      rate: 3,
      discountCap: null,
      company: { name: "بارمان", en: "", tagline: "", phone: "", address: "", bale: "" },
    });
    const res = await settingsGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { vat: number };
    expect(body.vat).toBe(10);
  });
});
