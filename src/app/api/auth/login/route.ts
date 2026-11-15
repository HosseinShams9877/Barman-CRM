/**
 * POST /api/auth/login — ورود، صدور نشست در کوکی امن (D-01).
 *
 * الگوی ۵ مرحله‌ای CD-04 بدون گام مجوز (مسیر عمومی).
 */
import { NextResponse } from "next/server";
import { attemptLogin } from "@core/auth";
import { errorToResponse } from "@core/errors";
import {
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { loginSchema } from "@modules/auth/schemas";

export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت: مسیر عمومی — نشست قبلی لازم نیست.
    // ۲) مجوز: بدون نیاز (ورود یک عملیات عمومی است).
    // ۳) اعتبارسنجی Zod:
    const input = parseOrFail(loginSchema, await readBody(req), faErrorMap);

    // ۴) سرویس (منطق کسب‌کار در core/auth):
    const { cookie, user } = await attemptLogin(input.name, input.password);

    // ۵) پاسخ:
    const res = NextResponse.json({ user }, { status: 200 });
    res.headers.set("Set-Cookie", cookie);
    return res;
  } catch (error) {
    return errorToResponse(error);
  }
}

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
