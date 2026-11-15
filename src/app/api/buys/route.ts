/**
 * /api/buys — لیست و ثبت درخواست خرید (PHASE_06 §‌۶/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → purchasing.view، POST → purchasing.edit.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import {
  buyListQuerySchema,
  createBuySchema,
  toListParams,
  listBuys,
  createBuy,
} from "@modules/purchasing";

/** GET /api/buys — لیست خریدها با فیلتر وضعیت/تأمین‌کننده و جستجو. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "purchasing.view");

    // ۳) اعتبارسنجی — query string
    const url = new URL(req.url);
    const query = parseOrFail(
      buyListQuerySchema,
      {
        status: url.searchParams.get("status") ?? undefined,
        supplierId: url.searchParams.get("supplierId") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس — noMoney نقش‌های فاقد money.view (R-32)
    const result = await listBuys(toListParams(query), shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/buys — ثبت درخواست خرید با وضعیت `req`. */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "purchasing.edit");

    // ۳) اعتبارسنجی — بدنه JSON
    const raw = await readJsonBody(req);
    const input = parseOrFail(createBuySchema, raw, faErrorMap);

    // ۴) سرویس
    const buy = await createBuy(input, {
      userId: session.userId,
      roles: session.roles,
    });

    // ۵) پاسخ
    return NextResponse.json(buy, { status: 201 });
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
