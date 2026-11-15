/**
 * POST /api/customers/[id]/deactivate — غیرفعال‌سازی نرم حساب (PHASE_03 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: customers.edit (CD-23). حساب فقط غیرفعال می‌شود — حذف فیزیکی وجود ندارد.
 */
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { jsonNoContent } from "@core/api";
import { requirePermission } from "@core/permissions";
import {
  idParamSchema,
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { deactivateAccount } from "@modules/customers/services/account.service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "customers.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس
    await deactivateAccount(id);

    // ۵) پاسخ — بدون محتوا
    return jsonNoContent();
  } catch (error) {
    return errorToResponse(error);
  }
}
