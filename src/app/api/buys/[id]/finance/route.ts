/**
 * /api/buys/[id]/finance — تأیید مالی خرید `ok → fin` با ثبت چک‌های صادره
 * (PHASE_06 §۷ / app/buy.js:231).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: `finance.approve` (نقش مالی/مدیریت — CD-26 / PHASE_06 §۷).
 * چک‌ها فقط در این مرحله و با وضعیت `issued` ثبت می‌شوند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { buyIdParamSchema, financeBuySchema, financeBuy } from "@modules/purchasing";

type FinanceRouteContext = { params: Promise<{ id: string }> };

/** POST /api/buys/[id]/finance — تأیید مالی و ثبت چک‌های صادره. */
export async function POST(req: Request, ctx: FinanceRouteContext): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "finance.approve");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(buyIdParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(financeBuySchema, raw, faErrorMap);

    // ۴) سرویس
    const buy = await financeBuy(
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
