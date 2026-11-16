/**
 * Seed پایگاه داده توسعه — فاز ۲ (PHASE_02 §۳).
 *
 * فقط داده‌های ساختاری می‌سازد:
 *   - ۷ نقش ثابت Demo (کلیدها دقیقاً از app/core.js)
 *   - یک کاربر مدیر برای ورود اولیه
 *   - ردیف‌های singleton تنظیمات و rev
 *   - ۷ کلید فهرست ثابت (خالی)
 *
 * هیچ داده کسب‌کاری (مشتری، سرنخ، سفارش، کاتالوگ محصول) از Demo
 * کپی نمی‌شود — مهاجرت داده مربوط به فاز ۸ است (MIGRATION_STRATEGY).
 *
 * اجرا: npx prisma db seed
 */
import bcrypt from "bcryptjs";
// پسوند صریح برای اجرای مستقیم با node --experimental-strip-types
import { prisma } from "./client.ts";
import { ROLE_LABELS, ROLES } from "../permissions/matrix.ts";

/** ۷ نقش Demo — منبع: app/core.js ROLES + ROLE_LABELS (منبع واحد برچسب نقش) */
export const SEED_ROLES: ReadonlyArray<{ key: string; name: string }> = ROLES.map((key) => ({
  key,
  name: ROLE_LABELS[key],
}));

/** مقدارهای پیش‌فرض تنظیمات — منبع: meta.settings در Demo (داده ساختاری) */
export const SEED_SETTINGS = {
  vat: 10,
  validDays: 3,
  rate: 3,
  // admin هم‌سطح management است (PERMISSION_MATRIX فاز ۲: admin = ALL).
  // نکته CD-25: مقدار null در سطح کل ستون یا هر کلید نقش یعنی «نامحدود».
  discountCap: { admin: 100, sales: 3, salesManager: 8, management: 100, finance: 0 },
  company: {
    name: "بارمان",
    en: "BARMAN 3D WORKS",
    tagline: "تولیدکننده انواع دیوارپوش سه‌بعدی",
    phone: "۰۲۱-۴۴۰۰۰۰۰۰",
    address: "تهران، شهرک صنعتی",
    bale: "ble.ir/Barman3Dworks",
  },
} as const;

/** ۷ کلید فهرست ثابت — منبع: meta.lists در Demo */
export const SEED_LIST_KEYS = [
  "sources",
  "roles",
  "results",
  "lost",
  "projects",
  "channels",
  "waste",
] as const;

const ADMIN_NAME = process.env["SEED_ADMIN_NAME"] ?? "admin";
const ADMIN_PASSWORD =
  process.env["SEED_ADMIN_PASSWORD"] ?? "barman-admin-1405";
const ADMIN_ROLES = ["admin"];

/**
 * اجرای seed پایگاه داده توسعه.
 *
 * **فاز ۸ (اصلاح):** این تابع فقط زمانی اجرا می‌شود که seed.ts مستقیم
 * به‌عنوان اسکریپت اجرا شود (npx prisma db seed). اجرای آن در زمان
 * import ممنوع است چون prisma singleton را $disconnect می‌کند و همه
 * کوئری‌های بعدی برنامه را می‌شکند (گزارش فاز ۸ — مهاجرت).
 */
export async function seed(): Promise<void> {
  const now = Date.now();

  for (const role of SEED_ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: role,
    });
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { name: ADMIN_NAME },
    update: {},
    create: {
      name: ADMIN_NAME,
      title: "ادمین سیستم",
      off: false,
      passwordHash,
      passwordSalt: null,
      sessionVersion: 0,
      rev: 0,
      createdAt: now,
      updatedAt: now,
      roles: {
        create: ADMIN_ROLES.map((roleKey) => ({ roleKey })),
      },
    },
  });

  await prisma.setting.upsert({
    where: { id: 0 },
    update: {},
    create: { id: 0, ...SEED_SETTINGS, updatedAt: now, rev: 0 },
  });

  await prisma.rev.upsert({
    where: { key: "global" },
    update: {},
    create: { key: "global", value: 0, updatedAt: now },
  });

  for (const key of SEED_LIST_KEYS) {
    await prisma.list.upsert({
      where: { key },
      update: {},
      create: { key, items: [], updatedAt: now, rev: 0 },
    });
  }

  const userCount = await prisma.user.count();
  const productCount = await prisma.product.count();
  console.log(
    `seeded: ${SEED_ROLES.length} roles, ${userCount} user (admin), settings, rev, ${SEED_LIST_KEYS.length} lists — catalog: ${productCount} products (empty)`,
  );
}

// فقط هنگام اجرای مستقیم به‌عنوان اسکریپت (نه import). pathToFileURL در
// محیط مرورگر وجود ندارد (native-url shim در Next) — اگر این فایل از
// مسیر کلاینت import شود، ارزیابی ماژول نباید شکست بخورد.
let isMainModule = false;
try {
  const { pathToFileURL } = await import("node:url");
  isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
} catch {
  isMainModule = false;
}
if (isMainModule) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
