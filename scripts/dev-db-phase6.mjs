/**
 * ابزار یکبار آزمون فاز ۶ — پیکربندی پایگاه دادهٔ توسعه (dev.db):
 *   - ایجاد یک تأمین‌کننده مواد خام (kind: "raw") برای فرم خرید؛
 *   - ایجاد کاربر نقش finance (fin1) برای آزمون‌های مجوز مالی؛
 *   - بازنشانی گذرواژهٔ همه کاربران به test-pass-1405.
 *
 * تغییر دیتای توسعه است، نه schema/migration.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const password = "test-pass-1405";

const roles = await prisma.role.findMany({ select: { key: true } });
console.log("roles:", roles.map((r) => r.key).join(","));

const existing = await prisma.supplier.findMany({ where: { kind: "raw" } });
if (existing.length === 0) {
  const sup = await prisma.supplier.create({
    data: { name: "تأمین‌کننده آریا", kind: "raw", phone: "۰۹۱۲۰۰۰۰۰۰۰", terms: "چک ۳۰ روزه" },
  });
  console.log("supplier created:", sup.id, sup.name);
} else {
  console.log("raw supplier exists:", existing[0].name);
}

const pw = await hash(password, 10);
let fin = await prisma.user.findUnique({ where: { name: "fin1" } });
if (!fin) {
  fin = await prisma.user.create({
    data: {
      name: "fin1",
      title: "مالی",
      passwordHash: pw,
      roles: { create: [{ role: { connect: { key: "finance" } } }] },
    },
  });
  console.log("finance user created:", fin.id);
} else {
  console.log("finance user exists:", fin.id);
}

const res = await prisma.user.updateMany({ data: { passwordHash: pw } });
console.log("passwords reset for", res.count, "users");

await prisma.$disconnect();
console.log("done, password:", password);
