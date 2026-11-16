import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const root = resolve(import.meta.dirname, "..");
const prisma = new PrismaClient({ datasources: { db: { url: `file:${resolve(root, ".cache/ui-parity/review.db").replaceAll("\\", "/")}` } } });
try {
  const user = await prisma.user.findUniqueOrThrow({ where: { name: "ui-review-admin" } });
  const sales = await prisma.user.findUniqueOrThrow({ where: { name: "ui-review-sales" } });
  const product = await prisma.product.findFirstOrThrow({ where: { line: "prod", active: true } });
  const material = await prisma.material.findFirstOrThrow();
  const account = await prisma.account.findFirstOrThrow();
  const supplier = await prisma.supplier.findFirstOrThrow();
  const now = BigInt(Date.now());
  for (const [id, ownerId] of [["LD-UI-own", sales.id], ["LD-UI-other", user.id]]) await prisma.lead.upsert({ where: { id }, update: {}, create: { id, title: id, stage: "raw", line: "prod", source: "سایت", accountId: account.id, ownerId, createdAt: now, updatedAt: now } });
  for (let stage = 1; stage <= 11; stage++) {
    const id = `PF-UI${String(stage).padStart(2, "0")}`;
    await prisma.order.upsert({ where: { id }, update: {}, create: {
      id, stage, status: "open", line: "prod", accountId: account.id, ownerId: sales.id, createdById: user.id,
      createdAt: now, updatedAt: now, stageAt: now, due: now + BigInt(86400000),
      items: { create: { productId: product.id, qty: 5, price: product.price, discount: 0, color: "" } },
      cheques: { create: { sayad: "1234567890123456", amount: 100000, due: "1405/09/01", bank: "بانک نمونه", owner: "بارمان", status: "hand", createdAt: now, updatedAt: now } },
      payments: { create: { amount: 100000, kind: "cash", date: "1405/08/25", createdAt: now, byUserId: user.id } },
      ...(stage >= 7 ? { prod: { start: "1405/08/25", end: "1405/09/01", acceptedAt: Number(now), startedAt: Number(now), note: "", qc: null } } : {}),
    } });
    if (stage === 9) await prisma.orderHandoff.upsert({ where: { id: `TR-${id.slice(3)}` }, update: {}, create: { id: `TR-${id.slice(3)}`, orderId: id, lines: [{ productId: product.id, qty: 5, color: "" }], at: now, byUserId: user.id } });
  }
  // Remove only the invalid review IDs in this explicitly isolated clone.
  await prisma.job.deleteMany({ where: { id: { in: ["plan", "run", "qc", "sent", "done"].map((s) => `PJ-UI-${s}`) } } });
  for (const [index, status] of ["plan", "run", "qc", "sent", "done"].entries()) await prisma.job.upsert({ where: { id: `PJ-${99001 + index}` }, update: {}, create: {
    id: `PJ-${99001 + index}`, productId: product.id, qty: 5, status, end: now + BigInt(86400000), good: status === "sent" || status === "done" ? 5 : null, waste: 0, bomSnapshot: [], createdBy: user.id, createdAt: now, updatedAt: now,
  } });
  for (const status of ["req", "ok", "fin", "recv"]) await prisma.buy.upsert({ where: { id: `BY-UI-${status}` }, update: {}, create: {
    id: `BY-UI-${status}`, status, supplierId: supplier.id, total: 1000000, createdBy: user.id, createdAt: now, updatedAt: now,
    items: { create: { materialId: material.id, qty: 10, price: 100000 } },
  } });
  await prisma.orderCheque.updateMany({ where: { orderId: { in: Array.from({ length: 11 }, (_, i) => `PF-UI${String(i + 1).padStart(2, "0")}`) } }, data: { status: "hand" } });
  await prisma.buyCheque.upsert({ where: { id: "CHQ-UI-out" }, update: { status: "issued" }, create: { id: "CHQ-UI-out", buyId: "BY-UI-fin", amount: 1000000, due: "1405/09/01", sayad: "1234567890123456", status: "issued" } });
  writeFileSync(resolve(root, ".cache/ui-parity/fixtures.json"), JSON.stringify({ orders: 11, jobs: 5, buys: 4, originalDatabaseTouched: false }));
  console.log("Clone-only stage/form fixtures ready.");
} finally { await prisma.$disconnect(); }
