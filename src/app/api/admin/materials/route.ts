/**
 * /api/admin/materials — کاتالوگ مواد اولیه (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → catalog.materials.read (admin/management/production)؛ POST → catalog.materials.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { listMaterials, createMaterial } from "@modules/admin/services/catalog.service";
import { materialSaveSchema } from "@modules/admin/schemas/catalog.schema";

/** GET /api/admin/materials — همه مواد. */
export async function GET(): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.materials.read");

    const items = await listMaterials(shouldHideMoney(session));

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/admin/materials — ایجاد ماده اولیه. */
export async function POST(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.materials.edit");

    const raw = await req.json().catch(() => null);
    const input = parseOrFail(materialSaveSchema, raw, faErrorMap);

    const material = await createMaterial(input);

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
