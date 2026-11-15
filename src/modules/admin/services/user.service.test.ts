/**
 * آزمون سرویس مدیریت کاربران — PHASE_07 §۱۲ / دروازه خروج ۱.
 *
 * نقشه قوانین Demo (admin.js:115-129):
 *  - نام یکتاست (admin.js:125)
 *  - هر کاربر یک نقش (admin.js:124)
 *  - غیرفعال‌سازی حذف نمی‌کند و نشست را باطل می‌کند (PHASE_07 §۸)
 *  - رمز با bcrypt هش می‌شود (CD-17)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@core/auth/passwords", () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
}));

import { prisma } from "@core/database/client";
import { createUser, listAdminUsers, updateUser } from "./user.service";
import { hashPassword } from "@core/auth/passwords";

const mocked = vi.mocked(prisma) as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
const mockedHash = vi.mocked(hashPassword);

const NEW_USER = {
  name: "نگار صادقی",
  role: "sales" as const,
  title: "کارشناس فروش",
  off: false,
  password: "secret123",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAdminUsers", () => {
  it("فهرست با نقش‌ها — بدون هش در خروجی", async () => {
    mocked.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "admin",
        title: "ادمین",
        off: false,
        roles: [{ roleKey: "admin" }],
      },
    ]);

    const rows = await listAdminUsers();
    expect(rows[0]!.roles).toEqual(["admin"]);
    expect(rows[0]).not.toHaveProperty("passwordHash");
  });
});

describe("createUser", () => {
  it("نام تکراری → conflict", async () => {
    mocked.user.findUnique.mockResolvedValue({ id: "u1", name: "نگار صادقی" });
    await expect(createUser(NEW_USER)).rejects.toMatchObject({ status: 409 });
  });

  it("رمز با bcrypt هش می‌شود و یک نقش ثبت می‌شود", async () => {
    mocked.user.findUnique.mockResolvedValue(null);
    mocked.user.create.mockImplementation(async (a: never) => ({
      ...(a as { data: Record<string, unknown> }).data,
      id: "u2",
      roles: [{ roleKey: "sales" }],
    }));

    const row = await createUser(NEW_USER);
    expect(row.roles).toEqual(["sales"]);

    const call = mocked.user.create.mock.calls[0]![0] as {
      data: {
        passwordHash: string;
        passwordSalt: string | null;
        roles: { create: { roleKey: string }[] };
      };
    };
    expect(call.data.passwordHash).toBe("hashed:secret123");
    expect(call.data.passwordSalt).toBeNull();
    expect(call.data.roles.create).toEqual([{ roleKey: "sales" }]);
    expect(mockedHash).toHaveBeenCalledWith("secret123");
  });
});

describe("updateUser", () => {
  it("کاربر غایب → notFound", async () => {
    mocked.user.findUnique.mockResolvedValue(null);
    await expect(updateUser("u9", { title: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("غیرفعال‌سازی → sessionVersion یک واحد افزایش می‌یابد (دروازه خروج ۱)", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: false,
      roles: [{ roleKey: "sales" }],
    });
    mocked.user.update.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: true,
      roles: [{ roleKey: "sales" }],
    });

    await updateUser("u1", { off: true });
    const call = mocked.user.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { off: boolean; sessionVersion?: { increment: number }; rev: { increment: number } };
    };
    expect(call.data.off).toBe(true);
    expect(call.data.sessionVersion).toEqual({ increment: 1 });
    expect(call.data.rev).toEqual({ increment: 1 });
  });

  it("فعال‌سازی مجدد → sessionVersion تغییر نمی‌کند", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: true,
      roles: [{ roleKey: "sales" }],
    });
    mocked.user.update.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: false,
      roles: [{ roleKey: "sales" }],
    });

    await updateUser("u1", { off: false });
    const call = mocked.user.update.mock.calls[0]![0] as {
      data: { sessionVersion?: { increment: number } };
    };
    expect(call.data.sessionVersion).toBeUndefined();
  });

  it("تغییر نقش — نقش قبلی حذف و نقش جدید ثبت می‌شود (admin.js:127)", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: false,
      roles: [{ roleKey: "sales" }],
    });
    mocked.user.update.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: false,
      roles: [{ roleKey: "salesManager" }],
    });

    await updateUser("u1", { role: "salesManager" });
    const call = mocked.user.update.mock.calls[0]![0] as {
      data: { roles: { deleteMany: Record<string, never>; create: { roleKey: string }[] } };
    };
    expect(call.data.roles.deleteMany).toEqual({});
    expect(call.data.roles.create).toEqual([{ roleKey: "salesManager" }]);
  });

  it("رمز خالی → بدون تغییر هش", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "",
      off: false,
      roles: [{ roleKey: "sales" }],
    });
    mocked.user.update.mockResolvedValue({
      id: "u1",
      name: "نگار",
      title: "مدیر",
      off: false,
      roles: [{ roleKey: "sales" }],
    });

    await updateUser("u1", { title: "مدیر" });
    const call = mocked.user.update.mock.calls[0]![0] as { data: { passwordHash?: string } };
    expect(call.data.passwordHash).toBeUndefined();
    expect(mockedHash).not.toHaveBeenCalled();
  });
});
