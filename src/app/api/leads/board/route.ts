import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { requirePermission, hasPermission } from "@core/permissions";
import { errorToResponse } from "@core/errors";
import { parseOrFail, faErrorMap } from "@core/validation";
import { getLeadBoard, setLeadColumn } from "@modules/leads/services/board.service";
import { leadStageSchema } from "@modules/leads/schemas/lead.schema";

export async function GET() {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "leads.view");
    const scope = { userId: session.userId, restrictToOwner: !hasPermission(session, "leads.viewAll") };
    return NextResponse.json(await getLeadBoard(scope));
  } catch (error) { return errorToResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "leads.edit");
    const input = parseOrFail(z.object({ id: z.string().min(1).max(64), stage: leadStageSchema, column: z.string().min(1).max(64) }), await request.json(), faErrorMap);
    return NextResponse.json(await setLeadColumn(input.id, input.stage, input.column, { userId: session.userId, restrictToOwner: !hasPermission(session, "leads.viewAll") }));
  } catch (error) { return errorToResponse(error); }
}
