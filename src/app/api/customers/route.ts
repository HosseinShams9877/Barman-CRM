/**
 * /api/customers — لیست و ایجاد حساب مشتری (PHASE_03 §۷).
 *
 * هر دو مسیر الگوی ۵ مرحله‌ای CD-04 را طی می‌کنند:
 *   auth → permission → Zod → service → response
 *
 * مجوزها: GET → customers.view، POST → customers.create (CD-23).
 */
import { NextResponse } from "next/server";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import {
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { listAccountsQuerySchema, createAccountSchema } from "@modules/customers/schemas/account.schema";
import { listAccounts, createAccount } from "@modules/customers/services/account.service";
import { cookies } from "next/headers";

/** GET /api/customers — لیست حساب‌ها با جستجو و صفحه‌بندی. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "customers.view");

    // ۳) اعتبارسنجی — query string
    const url = new URL(req.url);
    const query = parseOrFail(
      listAccountsQuerySchema,
      {
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        includeInactive: url.searchParams.get("includeInactive") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس
    const result = await listAccounts(query);

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/customers — ایجاد حساب (phones/contacts اختیاری). */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "customers.create");

    // ۳) اعتبارسنجی — بدنه JSON
    const raw = await readJsonBody(req);
    const input = parseOrFail(createAccountSchema, raw, faErrorMap);

    // ۴) سرویس — قانون تکرار تلفن در اینجا اجرا می‌شود (۴۰۹)
    const account = await createAccount(input);

    // ۵) پاسخ
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** خواندن بدنه JSON با مدیریت بدنه خالی/نامعتبر (۴۰۰). */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    return {};
  }
}
