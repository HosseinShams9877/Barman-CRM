/**
 * /api/moves/[id] — ویرایش و حذف حرکت دستی (PHASE_05 §۷/§۸).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: inventory.moves.
 *
 * فقط حرکت‌های دستی (`open`/`out`/`adj`) قابل ویرایش/حذف‌اند —
 * حرکت‌های سیستمی (buy/prod/sale/use/job) به اسناد کسب‌کار گره خورده‌اند
 * و تغییر آن‌ها ممنوع است (PHASE_05 §۸).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { moveIdParamSchema, updateMoveSchema } from "@modules/inventory/schemas/move.schema";
import { deleteMove, updateMove } from "@modules/inventory/services/move.service";

/** PATCH /api/moves/[id] — ویرایش حرکت دستی. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "inventory.moves");

    // ۳) اعتبارسنجی — params و بدنه (پیام فارسی — CD-28)
    const { id } = parseOrFail(moveIdParamSchema, await ctx.params, faErrorMap);
    const input = parseOrFail(updateMoveSchema, await readJsonBody(req), faErrorMap);

    // ۴) سرویس — محدودیت kind سیستمی اینجا اجرا می‌شود
    const move = await updateMove(id, input, { userId: session.userId, roles: session.roles });

    // ۵) پاسخ
    return NextResponse.json(move, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** DELETE /api/moves/[id] — حذف حرکت دستی. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "inventory.moves");

    // ۳) اعتبارسنجی — params
    const { id } = parseOrFail(moveIdParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس
    await deleteMove(id);

    // ۵) پاسخ
    return new NextResponse(null, { status: 204 });
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
