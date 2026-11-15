/**
 * /api/stock/alerts — مواد زیر آستانه min (PHASE_05 §۳.۳/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: inventory.view.
 * قانون: `m.min && h < m.min` — app/stock.js:۲۷.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { getStockAlerts } from "@modules/inventory/services/stock.service";

/** GET /api/stock/alerts — فهرست مواد کمتر از حداقل موجودی. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "inventory.view");

    // ۳/۴) بدون ورودی — سرویس
    const alerts = await getStockAlerts();

    // ۵) پاسخ
    return NextResponse.json({ items: alerts }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
