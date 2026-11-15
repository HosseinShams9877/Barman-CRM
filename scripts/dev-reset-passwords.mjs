/**
 * ابزار یکبار آزمون فاز ۵ — بازنشانی گذرواژهٔ کاربران نقش‌های production/sales
 * در پایگاه دادهٔ توسعه (dev.db). تغییر دیتای توسعه است، نه schema/migration.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const password = "test-pass-1405";

const users = await prisma.user.findMany({ select: { id: true, name: true, roles: true } });
for (const u of users) {
  const roleKeys = u.roles.map((r) => r.roleKey).join(",");
  if (u.name === "prod1" || u.name === "ali-sales") {
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hash(password, 10) } });
    console.log(`reset ${u.name} (roles: ${roleKeys})`);
  } else {
    console.log(`skip ${u.name} (roles: ${roleKeys})`);
  }
}
await prisma.$disconnect();
console.log("done, password:", password);
