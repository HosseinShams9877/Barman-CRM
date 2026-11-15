/**
 * /api/admin/users/[id] — ویرایش/غیرفعال‌سازی کاربر (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: PATCH → admin.users
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap, idParamSchema } from "@core/validation";
import { updateUser } from "@modules/admin/services/user.service";
import { userUpdateSchema } from "@modules/admin/schemas/admin.schema";

/** PATCH /api/admin/users/[id] — ویرایش کاربر (غیرفعال‌سازی نشست را باطل می‌کند). */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.users");

    // ۳) اعتبارسنجی — params + body
    const { id } = await ctx.params;
    parseOrFail(idParamSchema, { id }, faErrorMap);
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(userUpdateSchema, raw, faErrorMap);

    // ۴) سرویس
    const user = await updateUser(id, input);

    // ۵) پاسخ
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
