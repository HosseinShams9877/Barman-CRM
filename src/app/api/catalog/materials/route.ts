/**
 * /api/catalog/materials — فهرست مواد اولیه با موجودی (PHASE_05 §۱۰).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: داشتن حداقل یکی از
 * `inventory.view` / `production.view` (CD-26 dotted).
 *
 * پاسخ شامل موجودی محاسبه‌شده هر ماده (از حرکت‌ها) است تا کلاینت
 * پیش‌نمایش زنده کسری را همانند Demo محاسبه کند (app/prod.js:111).
 *
 * noMoney (R-32): قیمت مواد و ارزش برای نقش‌های بدون money.view حذف می‌شود.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requireAnyPermission, shouldHideMoney } from "@core/permissions";
import { prisma } from "@core/database/client";
import { computeOnHand } from "@modules/inventory/services/stock.service";

/** GET /api/catalog/materials — همه مواد با موجودی انبار raw. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — حداقل یکی از مجوزهای انبار/تولید
    requireAnyPermission(session, ["inventory.view", "production.view"]);

    // ۳/۴) خواندن کاتالوگ + محاسبه موجودی از حرکت‌ها (CD-08)
    const [materials, onHand] = await Promise.all([
      prisma.material.findMany({ orderBy: { name: "asc" } }),
      computeOnHand(),
    ]);

    const hideMoney = shouldHideMoney(session);
    const items = materials.map((m) => {
      const h = onHand[`raw|${m.id}`] ?? 0;
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        min: m.min,
        onHand: Math.round(h * 1000) / 1000,
        // R-32: فیلتر پولی در سرور
        ...(hideMoney ? {} : { price: m.price }),
      };
    });

    // ۵) پاسخ
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
