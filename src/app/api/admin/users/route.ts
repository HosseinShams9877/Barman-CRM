/**
 * /api/admin/users — فهرست و ایجاد کاربر (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET/POST → admin.users (فقط admin/management — FULL در admin.js:9)
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { listAdminUsers, createUser } from "@modules/admin/services/user.service";
import { userCreateSchema } from "@modules/admin/schemas/admin.schema";

/** GET /api/admin/users — فهرست کاربران با نقش و وضعیت. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "admin.users");

    // ۳/۴) بدون ورودی — خواندن فهرست
    const users = await listAdminUsers();

    // ۵) پاسخ
    return NextResponse.json({ items: users }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/admin/users — ایجاد کاربر با رمز اولیه. */
export async function POST(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.users");

    // ۳) اعتبارسنجی
    const raw = await req.json().catch(() => null);
    const input = parseOrFail(userCreateSchema, raw, faErrorMap);

    // ۴) سرویس
    const user = await createUser(input);

    // ۵) پاسخ
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
