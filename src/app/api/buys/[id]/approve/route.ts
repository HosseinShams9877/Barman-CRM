/**
 * /api/buys/[id]/approve — تأیید مدیریت خرید `req → ok` (PHASE_06 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: `purchasing.approve` (نقش مدیریت/مالی — CD-26 / PHASE_06 §۷).
 * بدنه: `{ rev }` برای کنترل همزمانی خوش‌بینانه.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { buyIdParamSchema, approveBuySchema, approveBuy } from "@modules/purchasing";

type ApproveRouteContext = { params: Promise<{ id: string }> };

/** POST /api/buys/[id]/approve — تأیید درخواست خرید توسط مدیریت. */
export async function POST(req: Request, ctx: ApproveRouteContext): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "purchasing.approve");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(buyIdParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(approveBuySchema, raw, faErrorMap);

    // ۴) سرویس
    const buy = await approveBuy(
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
