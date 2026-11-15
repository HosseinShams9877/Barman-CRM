/**
 * GET /api/auth/me — نشست جاری + مجوزهای محاسبه‌شده در سرور (D-01).
 *
 * الگوی ۵ مرحله‌ای CD-04. مسیر نیازمند نشست معتبر است (در غیر این صورت ۴۰۱).
 */
import { NextResponse } from "next/server";
import { requireSession, SESSION_COOKIE, toPublicUser } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { cookies } from "next/headers";

export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت: نشست از کوکی سرور خوانده می‌شود
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز: هر کاربری مجوز خواندن نشست خود را دارد.
    // ۳) اعتبارسنجی: بدون ورودی.
    // ۴) سرویس: اطلاعات عمومی از نشست (بدون کوئری اضافی — نقش‌ها در نشست هستند)
    const user = toPublicUser(session.userId, session.name, session.title, session.roles);

    // ۵) پاسخ
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
