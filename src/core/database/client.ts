/**
 * کلاینت Priska به‌صورت Singleton — فاز ۲ (CD-04 service layer).
 *
 * Next.js در حالت dev هات‌ری‌لود می‌شود و بدون محافظ، چند نمونه
 * PrismaClient ساخته می‌شود که اتصال‌های SQLite را پر می‌کند.
 * این الگوی رسمی Prisma برای Next.js است.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma["prisma"] ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma["prisma"] = prisma;
}
