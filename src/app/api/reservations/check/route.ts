/**
 * /api/reservations/check — بررسی موجودی آزاد قبل از ثبت سفارش (PHASE_05 §۳.۹).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: orders.view (فرم سفارش فاز ۴).
 *
 * این اندپوینت فقط‌خواندنی است و رزروی ذخیره نمی‌کند — Q-04 باز است و
 * `Order.resv` در فاز ۴ پیاده نشده. کاربرد آن: gate در کلاینت + سرور
 * برای جلوگیری از ثبت بیش از موجودی آزاد (app/stock.js:۶۸).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { reservationCheckSchema } from "@modules/inventory/schemas/move.schema";
import { checkReservations } from "@modules/inventory/services/stock.service";

/** POST /api/reservations/check — بررسی موجودی آزاد اقلام محصول. */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "orders.view");

    // ۳) اعتبارسنجی — بدنه JSON (پیام فارسی — CD-28)
    const raw = await readJsonBody(req);
    const input = parseOrFail(reservationCheckSchema, raw, faErrorMap);

    // ۴) سرویس
    const result = await checkReservations(input.items);

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** خواندن بدنه JSON با مدیریت بدنه خالی/نامعتبر (۴۰۰). */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    return {};
  }
}
