/**
 * /api/moves — لیست و ثبت حرکت‌های انبار (PHASE_05 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → inventory.view، POST → inventory.moves (CD-26 dotted).
 *
 * ۹ نوع حرکت در MOVE_KINDS (app/stock.js:۱۴) — ثبت دستی فقط kinds
 * دستی مجاز است؛ حرکت‌های سیستمی از عملیات کسب‌کار ساخته می‌شوند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { moveListQuerySchema, createMoveSchema } from "@modules/inventory/schemas/move.schema";
import { createMove, listMoves } from "@modules/inventory/services/move.service";

/** GET /api/moves — لیست حرکت‌ها با فیلتر انبار/نوع و جستجو. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور
    requirePermission(session, "inventory.view");

    // ۳) اعتبارسنجی — query string (پیام فارسی — CD-28)
    const url = new URL(req.url);
    const query = parseOrFail(
      moveListQuerySchema,
      {
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        wh: url.searchParams.get("wh") ?? undefined,
        kind: url.searchParams.get("kind") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس
    const result = await listMoves({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      wh: query.wh ?? null,
      kind: query.kind ?? null,
    });

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/moves — ثبت حرکت دستی (open/out/adj/waste). */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "inventory.moves");

    // ۳) اعتبارسنجی — بدنه JSON (پیام فارسی — CD-28)
    const raw = await readJsonBody(req);
    const input = parseOrFail(createMoveSchema, raw, faErrorMap);

    // ۴) سرویس — guard موجودی خروج دپو اینجا اجرا می‌شود (app/stock.js:۶۸)
    const move = await createMove(input, { userId: session.userId, roles: session.roles });

    // ۵) پاسخ
    return NextResponse.json(move, { status: 201 });
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
