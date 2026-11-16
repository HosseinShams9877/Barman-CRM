import { prisma } from "@core/database/client";
import type { FinanceCheque } from "../types/cheque.types";

/** Demo fin.js chqView includes cleared/paid cheque history as well as open cheques. */
export async function listFinanceCheques(direction: "rec" | "pay", hideMoney: boolean): Promise<{ items: FinanceCheque[] }> {
  if (direction === "rec") {
    const rows = await prisma.orderCheque.findMany({ include: { order: { include: { account: { select: { name: true } } } } }, orderBy: [{ due: "asc" }, { id: "asc" }] });
    return { items: rows.map((r) => ({ id: r.id, documentId: r.orderId, party: r.order.account?.name ?? r.orderId, owner: r.owner, bank: r.bank, sayad: r.sayad, due: r.due, status: r.status, ...(hideMoney ? {} : { amount: r.amount }) })) };
  }
  const rows = await prisma.buyCheque.findMany({ include: { buy: { include: { supplier: { select: { name: true } } } } }, orderBy: [{ due: "asc" }, { id: "asc" }] });
  return { items: rows.map((r) => ({ id: r.id, documentId: r.buyId, party: r.buy.supplier?.name ?? "بدون تأمین‌کننده", owner: r.buy.supplier?.name ?? "", bank: "", sayad: r.sayad ?? "", due: r.due, status: r.status, ...(hideMoney ? {} : { amount: r.amount }) })) };
}
