import { prisma } from "@core/database/client";
import { forbidden, notFound, badRequest } from "@core/errors";
import { getLeadCols } from "@modules/admin/services/leadcols.service";
import type { LeadListScope } from "./lead.service";
import type { LeadStageKey } from "../constants/STAGE";

/** Demo lead-core.js autoSub/subOf; custom positions use List records, no schema change. */
export function automaticColumn(stage: string, result: string | null, orderStage?: number): string {
  if (stage === "raw") return result === null ? "new" : /پاسخ نداد|مشغول/.test(result) ? "retry" : "talk";
  if (stage === "pf") return !orderStage || orderStage <= 3 ? "inside" : orderStage === 4 ? "sent" : "pay";
  return ({ "کاتالوگ / نمونه خواست": "sample", "بازدید یا جلسه هماهنگ شد": "visit", "پیش‌فاکتور خواست": "ready", "متراژ و نیاز مشخص شد": "ready" } as Record<string,string>)[result ?? ""] ?? "talk";
}

export async function getLeadBoard(scope: LeadListScope) {
  const [columns, leads, positions] = await Promise.all([
    getLeadCols(),
    prisma.lead.findMany({ where: scope.restrictToOwner ? { ownerId: scope.userId } : {}, include: { followups: { where: { kind: "note" }, orderBy: { at: "desc" } }, orders: { orderBy: { createdAt: "desc" }, take: 1 }, interest: { include: { product: { select: { name: true } } } } } }),
    prisma.list.findMany({ where: { key: { startsWith: "lead-position:" } } }),
  ]);
  return { columns, records: leads.map((l) => {
    const last = l.followups[0];
    const order = l.orders[0];
    const config = columns.filter((c) => c.stage === l.stage);
    const manual = positions.find((p) => p.key === `lead-position:${l.id}:${l.stage}`);
    const value = manual?.items;
    const key = value && typeof value === "object" && !Array.isArray(value) && typeof value.key === "string" ? value.key : null;
    const auto = automaticColumn(l.stage, last?.result ?? null, order?.stage);
    const override = key && config.some((c) => c.key === key) && (l.stage === "pf" || !last || Number(manual?.updatedAt) >= Number(last.at));
    return { id: l.id, column: override ? key : config.some((c) => c.key === auto) ? auto : config[0]?.key ?? "", tries: l.followups.length, lastResult: last?.result ?? "", lastNote: last?.note ?? "", lastAt: last ? Number(last.at) : null, orderId: order?.id ?? null, orderStage: order?.stage ?? null, products: l.interest.map((i) => i.product.name) };
  }) };
}

export async function setLeadColumn(id: string, stage: LeadStageKey, column: string, scope: LeadListScope) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw notFound("سرنخ پیدا نشد.");
  if (scope.restrictToOwner && lead.ownerId !== scope.userId) throw forbidden("دسترسی به این سرنخ ندارید.");
  if (lead.stage !== stage || !(await getLeadCols()).some((c) => c.stage === stage && c.key === column)) throw badRequest("ستون با مرحله سرنخ مطابقت ندارد.");
  const key = `lead-position:${id}:${stage}`;
  await prisma.list.upsert({ where: { key }, create: { key, items: { key: column }, updatedAt: Date.now(), rev: 0 }, update: { items: { key: column }, updatedAt: Date.now(), rev: { increment: 1 } } });
  return { id, column };
}
