/**
 * /api/finance/payables — گزارش پرداختنی‌ها (PHASE_06 §۵/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: GET → finance.view.
 *
 * پرداختنی‌ها = چک‌های صادره خرید (issued) + نسیه باقی‌مانده خریدهای
 * تأییدشده و پرداخت‌نشده، تجمیع‌شده بر اساس تأمین‌کننده (منبع قوانین:
 * fin-core.js:72-74).
 *
 * noMoney (R-32): فیلدهای پولی برای نقش‌های فاقد money.view حذف می‌شوند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { listPayables } from "@modules/finance";

/** GET /api/finance/payables — پرداختنی‌ها تجمیع‌شده بر اساس تأمین‌کننده. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "finance.view");

    // ۳) اعتبارسنجی — بدون ورودی (GET بدون پارامتر)

    // ۴) سرویس — noMoney نقش‌های فاقد money.view (R-32)
    const result = await listPayables(shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
