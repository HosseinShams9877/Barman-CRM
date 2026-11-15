/**
 * GET /api/users — فهرست کاربران (نیازمند مجوز admin.users).
 *
 * مسیر محافظت‌شدهٔ نمونه برای اجرای مجوز در سمت سرور (CD-04 / D-01).
 * هر نقشی غیر از management/admin باید ۴۰۳ دریافت کند.
 */
import { NextResponse } from "next/server";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { listUsers } from "@modules/users/services/listUsers";
import { cookies } from "next/headers";

export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت: نشست از کوکی سرور
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز: منبع حقیقت در سرور (پنهان‌سازی دکمه کافی نیست — R-02)
    requirePermission(session, "admin.users");

    // ۳) اعتبارسنجی: بدون ورودی.
    // ۴) سرویس:
    const users = await listUsers();

    // ۵) پاسخ:
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
