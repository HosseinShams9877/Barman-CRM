/**
 * /api/admin/materials/[id] — ویرایش ماده اولیه (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: PATCH → catalog.materials.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap, idParamSchema } from "@core/validation";
import { updateMaterial } from "@modules/admin/services/catalog.service";
import { materialSaveSchema } from "@modules/admin/schemas/catalog.schema";

/** PATCH /api/admin/materials/[id] — ویرایش ماده اولیه. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.materials.edit");

    const { id } = await ctx.params;
    parseOrFail(idParamSchema, { id }, faErrorMap);
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(materialSaveSchema, raw, faErrorMap);

    const material = await updateMaterial(id, input);

    return NextResponse.json(material, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
