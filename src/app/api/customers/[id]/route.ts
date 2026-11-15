/**
 * /api/customers/[id] — جزئیات و ویرایش یک حساب (PHASE_03 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → customers.view، PATCH → customers.edit (CD-23).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import {
  idParamSchema,
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { updateAccountSchema } from "@modules/customers/schemas/account.schema";
import { getAccount, updateAccount } from "@modules/customers/services/account.service";

/** GET /api/customers/[id] — جزئیات حساب شامل مخاطبین و تلفن‌ها. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "customers.view");

    // ۳) اعتبارسنجی — پارامتر مسیر
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس
    const account = await getAccount(id);

    // ۵) پاسخ
    return NextResponse.json(account, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH /api/customers/[id] — به‌روزرسانی حساب (phones/contacts جایگزینی کامل). */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "customers.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(updateAccountSchema, raw, faErrorMap);

    // ۴) سرویس
    const account = await updateAccount(id, input);

    // ۵) پاسخ
    return NextResponse.json(account, { status: 200 });
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