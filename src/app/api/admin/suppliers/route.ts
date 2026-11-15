/**
 * /api/admin/suppliers — مدیریت تأمین‌کنندگان (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → catalog.suppliers.read (admin/management/finance)؛ POST → catalog.suppliers.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { listAllSuppliers, createSupplier } from "@modules/admin/services/supplier.service";
import { supplierSaveSchema } from "@modules/admin/schemas/admin.schema";

/** GET /api/admin/suppliers — همه تأمین‌کنندگان (raw + agency). */
export async function GET(): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.suppliers.read");

    const items = await listAllSuppliers();

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/admin/suppliers — ایجاد تأمین‌کننده. */
export async function POST(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.suppliers.edit");

    const raw = await req.json().catch(() => null);
    const input = parseOrFail(supplierSaveSchema, raw, faErrorMap);

    const supplier = await createSupplier(input);

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
