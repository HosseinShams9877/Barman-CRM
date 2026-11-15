/**
 * /api/catalog/products — فهرست محصولات برای فرم تولید (PHASE_05 §۱۰).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: داشتن حداقل یکی از
 * `inventory.view` / `production.view` (CD-26 dotted).
 *
 * پاسخ شامل BOM هر محصول است تا کلاینت پیش‌نمایش زنده را همانند Demo
 * محاسبه کند (app/prod.js:111 — bomNeed در کلاینت).
 *
 * noMoney (R-32): قیمت محصولات برای نقش‌های بدون money.view حذف می‌شود.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requireAnyPermission, shouldHideMoney } from "@core/permissions";
import { prisma } from "@core/database/client";

/** GET /api/catalog/products — همه محصولات فعال با BOM. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — حداقل یکی از مجوزهای انبار/تولید
    requireAnyPermission(session, ["inventory.view", "production.view"]);

    // ۳/۴) بدون ورودی — خواندن کاتالوگ
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { bom: true },
    });

    const hideMoney = shouldHideMoney(session);
    const items = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      line: p.line,
      category: p.category,
      unit: p.unit,
      days: p.days,
      colors: p.colors,
      bom: p.bom.map((b) => ({ materialId: b.materialId, qty: b.qty })),
      // R-32: فیلتر پولی در سرور
      ...(hideMoney ? {} : { price: p.price }),
    }));

    // ۵) پاسخ
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
