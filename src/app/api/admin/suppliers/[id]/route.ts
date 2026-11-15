/**
 * /api/admin/suppliers/[id] — ویرایش تأمین‌کننده (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: PATCH → catalog.suppliers.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap, idParamSchema } from "@core/validation";
import { updateSupplier } from "@modules/admin/services/supplier.service";
import { supplierSaveSchema } from "@modules/admin/schemas/admin.schema";

/** PATCH /api/admin/suppliers/[id] — ویرایش تأمین‌کننده. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.suppliers.edit");

    const { id } = await ctx.params;
    parseOrFail(idParamSchema, { id }, faErrorMap);
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(supplierSaveSchema, raw, faErrorMap);

    const supplier = await updateSupplier(id, input);

    return NextResponse.json(supplier, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
