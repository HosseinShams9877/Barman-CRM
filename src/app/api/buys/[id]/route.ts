/**
 * /api/buys/[id] — جزئیات و ویرایش درخواست خرید (PHASE_06 §۶/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → purchasing.view، PATCH → purchasing.edit.
 * ویرایش فقط در وضعیت `req` مجاز است (در سرویس بررسی می‌شود — ۴۰۰).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import {
  buyIdParamSchema,
  updateBuySchema,
  getBuy,
  updateBuy,
} from "@modules/purchasing";

type BuyRouteContext = { params: Promise<{ id: string }> };

/** GET /api/buys/[id] — جزئیات خرید شامل اقلام، چک‌ها و تاریخچه وضعیت. */
export async function GET(_req: Request, ctx: BuyRouteContext): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "purchasing.view");

    // ۳) اعتبارسنجی — پارامتر مسیر
    const { id } = parseOrFail(buyIdParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس — noMoney نقش‌های فاقد money.view (R-32)
    const buy = await getBuy(id, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(buy, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH /api/buys/[id] — ویرایش خرید در وضعیت `req` با کنترل `rev`. */
export async function PATCH(req: Request, ctx: BuyRouteContext): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "purchasing.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه JSON
    const { id } = parseOrFail(buyIdParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(updateBuySchema, raw, faErrorMap);

    // ۴) سرویس
    const buy = await updateBuy(
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
