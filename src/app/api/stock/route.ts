/**
 * /api/stock — موجودی محاسبه‌شده از حرکت‌ها (PHASE_05 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: inventory.view.
 *
 * موجودی **همیشه** از جمع جبری حرکت‌ها محاسبه می‌شود — هیچ فیلد
 * موجودی ذخیره نمی‌شود (CD-08 / app/core.js:۲۰۶).
 *
 * noMoney (R-32 / app/stock.js:۳۱): نقش‌های بدون money.view نسخه
 * بدون قیمت/ارزش دریافت می‌کنند — فیلتر در سرور.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { getStock } from "@modules/inventory/services/stock.service";

/** GET /api/stock — موجودی محاسبه‌شده همه اقلام (raw + depot). */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور
    requirePermission(session, "inventory.view");

    // ۳/۴) بدون ورودی — سرویس (فیلتر پولی R-32)
    const rows = await getStock(shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
