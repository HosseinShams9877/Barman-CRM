/**
 * /api/admin/products — کاتالوگ محصولات — فهرست و ایجاد (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → catalog.products.read (همه نقش‌ها طبق SEE admin.js:11)؛ POST → catalog.products.edit
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { listProducts, createProduct } from "@modules/admin/services/catalog.service";
import { productSaveSchema } from "@modules/admin/schemas/catalog.schema";

/** GET /api/admin/products — همه محصولات (فعال و غیرفعال) با فرمول. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "catalog.products.read");

    // ۳/۴) خواندن کاتالوگ — noMoney نقش‌های فاقد money.view (R-32)
    const items = await listProducts(shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/admin/products — ایجاد محصول. */
export async function POST(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "catalog.products.edit");

    // ۳) اعتبارسنجی
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(productSaveSchema, raw, faErrorMap);

    // ۴) سرویس
    const product = await createProduct(input);

    // ۵) پاسخ
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
