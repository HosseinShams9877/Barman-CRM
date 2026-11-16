import { prisma } from "@core/database/client";
import { instantToJalaliIso } from "@core/calendar";
import { isIncompleteCheque } from "@modules/orders/lib/cheque";
import type { Role } from "@core/permissions";
import { calcOrder } from "@modules/orders/services/order.service";
import { getSettings } from "@modules/settings";
import { listReceivables } from "@modules/finance/services/receivable.service";
import { listPayables } from "@modules/finance/services/payable.service";
import { ROLE_TASKS, matchesTask, type TaskOrder, type TaskDefinition } from "../constants/tasks";

export type DashboardWorkspace = {
  today: string;
  now: number;
  orders: TaskOrder[];
  queues: { task: TaskDefinition; items: TaskOrder[] }[];
  followups: { id: string; customer: string; due: string; note: string }[];
  buyWaiting: number;
  finance?: { receivable: number; overdue: number; payable: number };
};

/** Demo home.js queues and side cards; all scope/money filtering happens here. */
export async function getDashboardWorkspace(role: Role, userId: string, restrictToOwner: boolean, hideMoney: boolean): Promise<DashboardWorkspace> {
  const now = Date.now();
  const today = instantToJalaliIso(now);
  const settings = await getSettings();
  const rawOrders = await prisma.order.findMany({
    where: { status: "open", ...(restrictToOwner ? { ownerId: userId } : {}) },
    include: { account: { select: { name: true } }, items: true, cheques: true },
    orderBy: { due: "asc" },
  });
  const orders: TaskOrder[] = rawOrders.map((o) => ({
    id: o.id, stage: o.stage, ownerId: o.ownerId, customer: o.account?.name ?? "مشتری انتخاب نشده", due: Number(o.due),
    incompleteCheques: o.cheques.filter(isIncompleteCheque).length,
    ...(hideMoney ? {} : { total: calcOrder(o.items, { discPct: o.discPct, discAmt: o.discAmt, ship: o.ship, install: o.install, noVat: o.noVat, vat: settings.vat }).total }),
  }));
  const queues = ROLE_TASKS[role].map((task) => ({ task, items: orders.filter((o) => matchesTask(o, task, userId, now)) }));
  const followups = role === "sales" || role === "salesManager" ? (await prisma.lead.findMany({
    where: { stage: { notIn: ["won", "lost"] }, ...(role === "sales" ? { ownerId: userId } : {}) },
    include: { account: { select: { name: true } }, followups: { where: { nextAt: { not: null } }, orderBy: { at: "desc" }, take: 1 } },
  })).flatMap((l) => {
    const next = l.followups[0];
    return next?.nextAt && next.nextAt <= today ? [{ id: l.id, customer: l.account?.name ?? l.title, due: next.nextAt, note: next.note }] : [];
  }).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6) : [];
  const buyWaiting = ["management", "finance", "production", "depot"].includes(role) ? await prisma.buy.count({ where: { status: role === "management" ? "req" : role === "finance" ? "ok" : "fin" } }) : 0;
  let finance: DashboardWorkspace["finance"];
  if (!hideMoney && (role === "management" || role === "finance")) {
    const [rec, pay] = await Promise.all([listReceivables(false), listPayables(false)]);
    const until = instantToJalaliIso(now + 8 * 86400000);
    const recRows = rec.groups.flatMap((g) => g.rows);
    const payRows = pay.groups.flatMap((g) => g.rows);
    const sum = (rows: (typeof recRows[number] | typeof payRows[number])[]) => rows.reduce((total, row) => total + ("amount" in row && typeof row.amount === "number" ? row.amount : 0), 0);
    finance = {
      receivable: sum(recRows.filter((r) => r.due && r.due >= today && r.due < until)),
      overdue: sum(recRows.filter((r) => r.due && r.due < today)),
      payable: sum(payRows.filter((r) => r.due && r.due >= today && r.due < until)),
    };
  }
  return { today, now, orders, queues, followups, buyWaiting, ...(finance ? { finance } : {}) };
}
