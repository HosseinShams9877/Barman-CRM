/**
 * /api/buys/[id]/receive — تحویل خرید `fin → recv` و ثبت حرکت‌های `buy`
 * (PHASE_06 §۸ — اتصال خرید به انبار).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: `inventory.moves` (تحویل انبار — PHASE_06 §۷).
 *
 * حرکت‌های `buy` در همان تراکنش پایگاه داده ایجاد می‌شوند
 * (بدون حرکت یتیم و بدون شمارش مضاعف)؛ تحویل تکراری → ۴۰۹.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { buyIdParamSchema, receiveBuySchema, receiveBuy } from "@modules/purchasing";

type ReceiveRouteContext = { params: Promise<{ id: string }> };

/** POST /api/buys/[id]/receive — تحویل کالا و ورود به انبار مواد خام. */
export async function POST(req: Request, ctx: ReceiveRouteContext): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "inventory.moves");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(buyIdParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(receiveBuySchema, raw, faErrorMap);

    // ۴) سرویس — تراکنشی: حرکت buy + تغییر وضعیت، همه یا هیچ
    const buy = await receiveBuy(
      id,
      input,
      {
        userId: session.userId,
        roles: session.roles,
      },
      shouldHideMoney(session),
    );

    // ۵) پاسخ
    return NextResponse.json(buy, { status: 200 });
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
