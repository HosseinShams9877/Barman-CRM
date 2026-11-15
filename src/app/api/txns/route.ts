/**
 * /api/txns — لیست و ثبت تراکنش‌های مالی (PHASE_06 §۶/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → finance.view، POST → finance.edit.
 *
 * نوع تراکنش باید یکی از ۸ گزینه ثابت فهرست Demo باشد (app/fin.js:145) —
 * جهت از نوع استنتاج می‌شود و از سوی کاربر پذیرفته نمی‌شود.
 *
 * noMoney (R-32): مبلغ تراکنش برای نقش‌های فاقد money.view در پاسخ
 * حذف می‌شود (فیلتر سرور — پنهان‌سازی در UI کافی نیست).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import {
  listTxns,
  createTxn,
  toTxnListParams,
  txnListQuerySchema,
  createTxnSchema,
} from "@modules/finance";

/** GET /api/txns — لیست تراکنش‌ها با فیلتر نوع/جهت. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "finance.view");

    // ۳) اعتبارسنجی — query string
    const url = new URL(req.url);
    const query = parseOrFail(
      txnListQuerySchema,
      {
        kind: url.searchParams.get("kind") ?? undefined,
        direction: url.searchParams.get("direction") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس — noMoney نقش‌های فاقد money.view (R-32)
    const result = await listTxns(
      { ...toTxnListParams(query), q: url.searchParams.get("q") ?? "" },
      shouldHideMoney(session),
    );

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/txns — ثبت هزینه/دریافت متفرقه با کلید ثابت Demo. */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "finance.edit");

    // ۳) اعتبارسنجی — بدنه JSON
    const raw = await readJsonBody(req);
    const input = parseOrFail(createTxnSchema, raw, faErrorMap);

    // ۴) سرویس — جهت و کلید ذخیره‌شده از kind استنتاج می‌شوند
    const txn = await createTxn(input, session.userId, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(txn, { status: 201 });
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
