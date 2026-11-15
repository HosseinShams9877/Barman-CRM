/**
 * POST /api/auth/logout — خروج، باطل‌کردن نشست در سرور (D-01).
 *
 * الگوی ۵ مرحله‌ای CD-04. خروج idempotent است: نبودن نشست خطا نیست —
 * فقط کوکی پاک می‌شود.
 */
import { NextResponse } from "next/server";
import { logout, resolveSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { buildExpiredCookie } from "@core/auth/cookie";
import { cookies } from "next/headers";

export async function POST(): Promise<Response> {
  try {
    // ۱) احراز هویت: نشست از کوکی سرور حل می‌شود.
    // ۲) مجوز: خروج از نشست خودِ کاربر — مجوز اضافی لازم نیست.
    // ۳) اعتبارسنجی: بدون ورودی.
    const store = await cookies();
    const session = await resolveSession(store.get(SESSION_COOKIE)?.value);

    // ۲۰۴ نباید body داشته باشد — فقط هدر Set-Cookie اهمیت دارد
    const res = new NextResponse(null, { status: 204 });

    if (session) {
      // ۴) سرویس: باطل‌کردن نشست در سرور (افزایش sessionVersion)
      const cookie = await logout(session.userId);
      res.headers.set("Set-Cookie", cookie);
    } else {
      // نشست معتبر نبود — پاک‌کردن کوکی کافی است (خروج idempotent)
      res.headers.set("Set-Cookie", buildExpiredCookie());
    }

    // ۵) پاسخ
    return res;
  } catch (error) {
    return errorToResponse(error);
  }
}
