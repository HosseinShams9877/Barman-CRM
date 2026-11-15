/**
 * سرویس مدیریت کاربران — PHASE_07 §۵ / دروازه خروج ۱.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - نام کاربر اجباری و یکتاست (admin.js:125؛ طرح داده @unique).
 *  - هر کاربر دقیقاً یک نقش دارد (admin.js:124 — select تک‌انتخابی).
 *  - غیرفعال‌سازی (`off`) کاربر را حذف نمی‌کند تا تاریخچه معتبر بماند
 *    (PHASE_07 §۱). کاربر غیرفعال نمی‌تواند وارد شود (core/auth/session).
 *  - غیرفعال‌سازی نشست‌های قبلی را باطل می‌کند: `sessionVersion` یک
 *    واحد افزایش می‌یابد (PHASE_07 §۸ — پیوند با فاز ۲).
 *  - رمز اولیه با bcrypt هش می‌شود (CD-17).
 */
import { prisma } from "@core/database/client";
import { conflict, notFound } from "@core/errors";
import { hashPassword } from "@core/auth/passwords";
import type { Role } from "@core/permissions";
import type { UserCreateInput, UserUpdateInput } from "../schemas/admin.schema";

/** کاربر مدیریت — بدون هش/نمک در پاسخ. */
export type AdminUserRow = {
  id: string;
  name: string;
  title: string;
  off: boolean;
  roles: Role[];
};

const now = () => Date.now();

function toRow(u: {
  id: string;
  name: string;
  title: string;
  off: boolean;
  roles: { roleKey: string }[];
}): AdminUserRow {
  return {
    id: u.id,
    name: u.name,
    title: u.title,
    off: u.off,
    roles: u.roles.map((r) => r.roleKey as Role),
  };
}

/** فهرست کاربران — مرتب بر اساس نام (شامل غیرفعال‌ها). */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }],
    include: { roles: { select: { roleKey: true } } },
  });
  return users.map(toRow);
}

/** ایجاد کاربر — نام یکتا + رمز اولیه. */
export async function createUser(input: UserCreateInput): Promise<AdminUserRow> {
  const dup = await prisma.user.findUnique({ where: { name: input.name } });
  if (dup) throw conflict("این نام کاربری قبلاً گرفته شده است.");

  const ts = now();
  const user = await prisma.user.create({
    data: {
      name: input.name,
      title: input.title,
      off: input.off,
      passwordHash: await hashPassword(input.password),
      passwordSalt: null,
      createdAt: ts,
      updatedAt: ts,
      roles: { create: [{ roleKey: input.role }] },
    },
    include: { roles: { select: { roleKey: true } } },
  });
  return toRow(user);
}

/**
 * ویرایش کاربر — نام/نقش/سمت/وضعیت/رمز.
 *
 * `off = true` شدن نشست‌های فعال را باطل می‌کند (`sessionVersion` افزایش).
 * رمز خالی (undefined) یعنی بدون تغییر.
 */
export async function updateUser(id: string, input: UserUpdateInput): Promise<AdminUserRow> {
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { roles: { select: { roleKey: true } } },
  });
  if (!existing) throw notFound("کاربر پیدا نشد.");

  if (input.name !== undefined && input.name !== existing.name) {
    const dup = await prisma.user.findUnique({ where: { name: input.name } });
    if (dup) throw conflict("این نام کاربری قبلاً گرفته شده است.");
  }

  // فعال‌سازی مجدد کاربر نیازی به افزایش sessionVersion ندارد؛
  // غیرفعال‌سازی باید نشست‌های قدیمی را باطل کند (PHASE_07 §۸).
  const deactivate = input.off === true && !existing.off;

  const ts = now();
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.off !== undefined ? { off: input.off } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await hashPassword(input.password), passwordSalt: null }
        : {}),
      ...(input.role !== undefined
        ? {
            roles: {
              deleteMany: {},
              create: [{ roleKey: input.role }],
            },
          }
        : {}),
      ...(deactivate ? { sessionVersion: { increment: 1 } } : {}),
      updatedAt: ts,
      rev: { increment: 1 },
    },
    include: { roles: { select: { roleKey: true } } },
  });
  return toRow(user);
}
