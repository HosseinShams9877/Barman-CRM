/**
 * /api/admin/products/[id] — ویرایش محصول (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: PATCH → catalog.products.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap, idParamSchema } from "@core/validation";
import { updateProduct } from "@modules/admin/services/catalog.service";
import { productSaveSchema } from "@modules/admin/schemas/catalog.schema";

/** PATCH /api/admin/products/[id] — ویرایش محصول. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.products.edit");

    // ۳) اعتبارسنجی — params + body
    const { id } = await ctx.params;
    parseOrFail(idParamSchema, { id }, faErrorMap);
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(productSaveSchema, raw, faErrorMap);

    // ۴) سرویس
    const product = await updateProduct(id, input);

    // ۵) پاسخ
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
