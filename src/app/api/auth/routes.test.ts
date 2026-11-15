/**
 * آزمون مسیرهای API احراز هویت — CD-04 (الگوی ۵ مرحله‌ای).
 *
 * مسیرها مستقیماً فراخوانی می‌شوند با mock کردن `next/headers`
 * (برای کوکی) و Prisma (برای DB). توکن واقعی HMAC امضا می‌شود.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-for-hmac-signing-0123456789";

// mock کردن Prisma قبل از import مسیرها
vi.mock("@core/database/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// mock کردن next/headers — مغز کوکی سرور
type CookieStore = { get: (name: string) => { value: string } | undefined };
let cookieValue: string | undefined = undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "br_s" && cookieValue ? { value: cookieValue } : undefined),
  } satisfies CookieStore)),
}));

import { prisma } from "@core/database/client";
import { POST as loginPOST } from "./login/route";
import { POST as logoutPOST } from "./logout/route";
import { GET as meGET } from "./me/route";
import { GET as usersGET } from "../users/route";
import { issueToken } from "@core/auth/token";
import { hashPassword } from "@core/auth/passwords";

const PASSWORD = "barman-12345";
// هش bcrypt یکبار ساخته می‌شود (هش کردن در هر تست کند است)
let bcryptHash: string;

type DbUser = {
  id: string;
  name: string;
  title: string;
  off: boolean;
  passwordHash: string | null;
  passwordSalt: string | null;
  sessionVersion: number;
  roles: { roleKey: string }[];
};

function seedUser(roles: string[], overrides: Partial<DbUser> = {}): DbUser {
  const user: DbUser = {
    id: "u1",
    name: "ali",
    title: "مدیر فروش",
    off: false,
    passwordHash: bcryptHash,
    passwordSalt: null,
    sessionVersion: 0,
    roles: roles.map((roleKey) => ({ roleKey })),
    ...overrides,
  };
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue([user] as never);
  return user;
}

function setCookie(roles: string[], sv = 0): void {
  cookieValue = issueToken({ sub: "u1", u: "ali", roles, sv }, 8 * 60 * 60 * 1000).token;
}

async function body(res: Response): Promise<unknown> {
  return res.json();
}

beforeEach(async () => {
  process.env["AUTH_SECRET"] = SECRET;
  cookieValue = undefined;
  bcryptHash = await hashPassword(PASSWORD);
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.user.findMany).mockReset();
});

describe("POST /api/auth/login", () => {
  it("ورود موفق → ۲۰۰ + Set-Cookie + اطلاعات کاربر", async () => {
    seedUser(["salesManager"]);
    const req = new Request("http://x/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ name: "ali", password: PASSWORD }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("br_s=");
    expect(res.headers.get("Set-Cookie")).toContain("HttpOnly");
    const json = (await body(res)) as { user: { name: string; roles: string[] } };
    expect(json.user.name).toBe("ali");
    expect(json.user.roles).toEqual(["salesManager"]);
  });

  it("رمز اشتباه → ۴۰۱ با پاکت استاندارد، بدون Set-Cookie", async () => {
    seedUser(["salesManager"]);
    const req = new Request("http://x/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ name: "ali", password: "wrong" }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const json = (await body(res)) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toContain("نام کاربری");
  });

  it("body نامعتبر (JSON خراب) → ۴۰۰", async () => {
    const req = new Request("http://x/api/auth/login", {
      method: "POST",
      body: "not-json",
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(400);
  });

  it("فیلدهای گمشده → ۴۰۰ با fields", async () => {
    const req = new Request("http://x/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ name: "ali" }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(400);
    const json = (await body(res)) as { error: { fields?: Record<string, string> } };
    expect(json.error.fields?.["password"]).toBeDefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("با نشست معتبر → ۲۰۴ + sessionVersion افزایش + کوکی پاک", async () => {
    seedUser(["sales"]);
    setCookie(["sales"]);
    const res = await logoutPOST();
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    const update = vi.mocked(prisma.user.update);
    expect(update).toHaveBeenCalledTimes(1);
    const args = update.mock.calls[0]?.[0];
    expect(args?.where?.id).toBe("u1");
    expect(args?.data?.sessionVersion).toEqual({ increment: 1 });
  });

  it("بدون نشست → ۲۰۴ (idempotent) بدون دسترسی DB", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(vi.mocked(prisma.user.update)).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/me", () => {
  it("با نشست معتبر → ۲۰۰ + مجوزهای محاسبه‌شده", async () => {
    seedUser(["admin"]);
    setCookie(["admin"]);
    const res = await meGET();
    expect(res.status).toBe(200);
    const json = (await body(res)) as {
      user: { name: string; permissions: string[]; noMoney: boolean };
    };
    expect(json.user.name).toBe("ali");
    expect(json.user.permissions).toContain("admin.users");
    expect(json.user.noMoney).toBe(false);
  });

  it("بدون نشست → ۴۰۱", async () => {
    const res = await meGET();
    expect(res.status).toBe(401);
    const json = (await body(res)) as { error: { code: string } };
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("نشست با sessionVersion قدیمی → ۴۰۱", async () => {
    seedUser(["sales"], { sessionVersion: 5 });
    setCookie(["sales"], 0);
    const res = await meGET();
    expect(res.status).toBe(401);
  });

  it("کاربر غیرفعال → ۴۰۱ (R-02)", async () => {
    seedUser(["sales"], { off: true });
    setCookie(["sales"]);
    const res = await meGET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users — مسیر محافظت‌شده (admin.users)", () => {
  it("admin → ۲۰۰ با فهرست کاربران", async () => {
    seedUser(["admin"]);
    setCookie(["admin"]);
    const res = await usersGET();
    expect(res.status).toBe(200);
    const json = (await body(res)) as {
      users: { id: string; name: string; roles: string[] }[];
    };
    expect(json.users.length).toBeGreaterThan(0);
    expect(json.users[0]?.name).toBe("ali");
    expect(json.users[0]?.roles).toEqual(["admin"]);
  });

  it("management → ۲۰۰", async () => {
    seedUser(["management"]);
    setCookie(["management"]);
    expect((await usersGET()).status).toBe(200);
  });

  it("sales → ۴۰۳ (مجوز ندارد)", async () => {
    seedUser(["sales"]);
    setCookie(["sales"]);
    const res = await usersGET();
    expect(res.status).toBe(403);
    const json = (await body(res)) as { error: { code: string } };
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("production → ۴۰۳", async () => {
    seedUser(["production"]);
    setCookie(["production"]);
    expect((await usersGET()).status).toBe(403);
  });

  it("depot → ۴۰۳", async () => {
    seedUser(["depot"]);
    setCookie(["depot"]);
    expect((await usersGET()).status).toBe(403);
  });

  it("بدون احراز هویت → ۴۰۱ (قبل از بررسی مجوز)", async () => {
    const res = await usersGET();
    expect(res.status).toBe(401);
    const json = (await body(res)) as { error: { code: string } };
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
