/**
 * آزمون سرویس ورود/خروج — D-01.
 *
 * موارد کلیدی:
 *   - ورود موفق (bcrypt) با صدور کوکی
 *   - پیام یکسان خطای ورود (بدون نشت وجود حساب)
 *   - **ارتقای شفاف scrypt → bcrypt**: ورود با هش قدیمی Demo، سپس
 *     به‌روزرسانی هش در DB با رمز واردشده — کاربر متوجه نمی‌شود.
 *   - خروج: افزایش sessionVersion (باطل‌کردن نشست در سرور)
 */
import { scryptSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../database/client";
import { attemptLogin, logout, permissionsFor } from "./service";
import { hashPassword } from "./passwords";

vi.mock("../database/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const SECRET = "test-secret-for-hmac-signing-0123456789";
const PASSWORD = "barman-12345";
const SALT = "0123456789abcdef";

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

async function seedUser(overrides: Partial<DbUser> = {}): Promise<DbUser> {
  const user: DbUser = {
    id: "u1",
    name: "ali",
    title: "مدیر فروش",
    off: false,
    passwordHash: await hashPassword(PASSWORD),
    passwordSalt: null,
    sessionVersion: 0,
    roles: [{ roleKey: "salesManager" }],
    ...overrides,
  };
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
  return user;
}

function legacyHash(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function captureUpdate(): ReturnType<typeof vi.fn> {
  return vi.mocked(prisma.user.update);
}

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
});

describe("attemptLogin — ورود موفق", () => {
  it("رمز درست → کوکی نشست + اطلاعات عمومی", async () => {
    await seedUser();
    const result = await attemptLogin("ali", PASSWORD);

    expect(result.cookie).toContain("br_s=");
    expect(result.cookie).toContain("HttpOnly");
    expect(result.user.id).toBe("u1");
    expect(result.user.name).toBe("ali");
    expect(result.user.roles).toEqual(["salesManager"]);
    expect(result.user.noMoney).toBe(false);
    expect(result.user.permissions).toContain("orders.view");
    expect(result.user.permissions).toContain("money.view");
  });

  it("هش bcrypt به‌روزرسانی نمی‌شود", async () => {
    const user = await seedUser();
    const update = captureUpdate();
    await attemptLogin("ali", PASSWORD);
    expect(update).not.toHaveBeenCalled();
    expect(user.passwordHash).toContain("$2");
  });
});

describe("attemptLogin — پیام یکسان خطا (ضد نشت)", () => {
  it("کاربر ناشناخته → ۴۰۱ با پیام یکسان", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    await expect(attemptLogin("ghost", PASSWORD)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "نام کاربری یا رمز عبور نادرست است.",
    });
  });

  it("رمز اشتباه → همین پیام", async () => {
    await seedUser();
    await expect(attemptLogin("ali", "wrong")).rejects.toMatchObject({
      status: 401,
      message: "نام کاربری یا رمز عبور نادرست است.",
    });
  });

  it("کاربر غیرفعال → همین پیام (R-02)", async () => {
    await seedUser({ off: true });
    await expect(attemptLogin("ali", PASSWORD)).rejects.toMatchObject({
      status: 401,
      message: "نام کاربری یا رمز عبور نادرست است.",
    });
  });
});

describe("ارتقای شفاف scrypt → bcrypt (D-01)", () => {
  it("ورود با هش legacy Demo موفق است", async () => {
    await seedUser({
      passwordHash: legacyHash(PASSWORD, SALT),
      passwordSalt: SALT,
    });
    const result = await attemptLogin("ali", PASSWORD);
    expect(result.cookie).toContain("br_s=");
    expect(result.user.id).toBe("u1");
  });

  it("رمز اشتباه برای هش legacy رد می‌شود", async () => {
    await seedUser({
      passwordHash: legacyHash(PASSWORD, SALT),
      passwordSalt: SALT,
    });
    await expect(attemptLogin("ali", "wrong")).rejects.toMatchObject({ status: 401 });
  });

  it("پس از ورود موفق، هش به bcrypt ارتقا و salt پاک می‌شود", async () => {
    await seedUser({
      passwordHash: legacyHash(PASSWORD, SALT),
      passwordSalt: SALT,
    });
    const update = captureUpdate();
    await attemptLogin("ali", PASSWORD);

    expect(update).toHaveBeenCalledTimes(1);
    const args = update.mock.calls[0]?.[0];
    expect(args?.where?.id).toBe("u1");
    expect(typeof args?.data?.passwordHash).toBe("string");
    expect(args?.data?.passwordHash.startsWith("$2")).toBe(true);
    expect(args?.data?.passwordSalt).toBeNull();
  });

  it("هش ارتقایافته همان رمز را می‌پذیرد", async () => {
    await seedUser({
      passwordHash: legacyHash(PASSWORD, SALT),
      passwordSalt: SALT,
    });
    const update = captureUpdate();
    await attemptLogin("ali", PASSWORD);

    const args = update.mock.calls[0]?.[0];
    const newHash: string = args?.data?.passwordHash;
    // هش جدید bcrypt واقعی است و رمز درست را تأیید می‌کند
    const { verifyPassword } = await import("./passwords");
    expect(await verifyPassword(PASSWORD, newHash, null)).toBe(true);
    expect(await verifyPassword("wrong", newHash, null)).toBe(false);
  });
});

describe("logout", () => {
  it("sessionVersion یک واحد افزایش می‌یابد و کوکی پاک می‌شود", async () => {
    const update = captureUpdate();
    const cookie = await logout("u1");

    expect(update).toHaveBeenCalledTimes(1);
    const args = update.mock.calls[0]?.[0];
    expect(args?.where?.id).toBe("u1");
    expect(args?.data?.sessionVersion).toEqual({ increment: 1 });
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("br_s=");
  });
});

describe("permissionsFor", () => {
  it("اجتماع مجوزهای همه نقش‌ها", () => {
    const perms = permissionsFor(["sales", "production"]);
    expect(perms).toContain("leads.view");
    expect(perms).toContain("production.view");
    // production در فاز ۶ دید خرید/مالی بدون مبلغ دریافت می‌کند (R-32)
    expect(perms).toContain("finance.view");
    expect(perms).not.toContain("money.view");
  });

  it("admin همه مجوزها را دارد", () => {
    // ۲۷ مجوز فاز ۱–۶ + ۹ مجوز کاتالوگ/مدیریت فاز ۷ = ۳۶.
    expect(permissionsFor(["admin"]).length).toBe(36);
  });

  it("نقش نامعتبر مجوزی ندارد", () => {
    expect(permissionsFor([])).toEqual([]);
    expect(permissionsFor(["ghost" as never])).toEqual([]);
  });

  it("noMoney: production و depot مبالغ نمی‌بینند (R-32)", () => {
    expect(permissionsFor(["production"])).not.toContain("money.view");
    expect(permissionsFor(["depot"])).not.toContain("money.view");
    expect(permissionsFor(["finance"])).toContain("money.view");
  });
});
