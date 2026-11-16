import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { errorToResponse } from "@core/errors";
import { listFinanceCheques } from "@modules/finance/services/cheque-ledger.service";
const schema = z.object({ direction: z.enum(["rec", "pay"]) });
export async function GET(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "finance.view");
    const input = parseOrFail(schema, { direction: new URL(req.url).searchParams.get("direction") }, faErrorMap);
    return NextResponse.json(await listFinanceCheques(input.direction, shouldHideMoney(session)));
  } catch (error) { return errorToResponse(error); }
}
