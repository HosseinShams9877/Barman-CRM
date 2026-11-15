/**
 * سرویس فهرست کاربران — مدیریت کاربران (admin.users).
 *
 * این یک خدمات پلتفرمی فاز ۲ است (نه ماژول کسب‌کار — فاز ۳).
 * هدف: اجرای واقعی مجوز سرور در یک مسیر محافظت‌شده (CD-04).
 */
import { prisma } from "@core/database/client";
import type { Role } from "@core/permissions/matrix";

/** کاربر برای فهرست مدیریت — بدون هیچ داده احراز هویت (هش/نمک). */
export type AdminUserRow = {
  id: string;
  name: string;
  title: string;
  off: boolean;
  roles: Role[];
};

/**
 * فهرست کاربران — مرتب بر اساس نام.
 * `off` هم برمی‌گردد چون مدیر باید کاربران غیرفعال را ببیند.
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { roles: { select: { roleKey: true } } },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    title: u.title,
    off: u.off,
    roles: u.roles.map((r) => r.roleKey) as Role[],
  }));
}
