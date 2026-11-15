/**
 * /api/admin/products/[id]/bom — فرمول تولید محصول (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → catalog.bom.read (admin/management/production)؛ PUT → catalog.bom.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap, idParamSchema } from "@core/validation";
import { getBom, saveBom } from "@modules/admin/services/bom.service";
import { bomSaveSchema } from "@modules/admin/schemas/catalog.schema";

/** GET /api/admin/products/[id]/bom — فرمول محصول با مواد. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "catalog.bom.read");

    // ۳) اعتبارسنجی — params
    const { id } = await ctx.params;
    parseOrFail(idParamSchema, { id }, faErrorMap);

    // ۴) سرویس — noMoney (R-32)
    const bom = await getBom(id, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(bom, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PUT /api/admin/products/[id]/bom — ذخیره کامل فرمول. */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.bom.edit");

    const { id } = await ctx.params;
    parseOrFail(idParamSchema, { id }, faErrorMap);
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(bomSaveSchema, raw, faErrorMap);

    const bom = await saveBom(id, input);

    return NextResponse.json(bom, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
