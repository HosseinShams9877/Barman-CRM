/**
 * /api/buys/[id]/cheques/[cid] — پاس کردن چک صادره `issued → paid`
 * (PHASE_06 §۷ / app/fin.js).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: `finance.edit`. تنها تغییر مجاز چک `issued → paid` است
 * (در سرویس بررسی می‌شود — ۴۰۰).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { chequeParamSchema, updateBuyChequeSchema, payBuyCheque } from "@modules/purchasing";

type ChequeRouteContext = { params: Promise<{ id: string; cid: string }> };

/** PATCH /api/buys/[id]/cheques/[cid] — ثبت پرداخت چک صادره. */
export async function PATCH(req: Request, ctx: ChequeRouteContext): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "finance.edit");

    // ۳) اعتبارسنجی — پارامترهای مسیر + بدنه
    const { id, cid } = parseOrFail(chequeParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    parseOrFail(updateBuyChequeSchema, raw, faErrorMap);

    // ۴) سرویس
    const buy = await payBuyCheque(
      id,
      cid,
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
