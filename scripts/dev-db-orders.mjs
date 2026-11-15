import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const orders = await prisma.order.findMany({
  select: { id: true, stage: true, status: true, line: true, accountId: true },
});
console.log("orders:", orders.map((o) => JSON.stringify(o)).join("\n  "));

const handoffs = await prisma.orderHandoff.findMany();
console.log(
  "handoffs:",
  handoffs.map((h) => JSON.stringify(h, (k, v) => (typeof v === "bigint" ? Number(v) : v))).join("\n  "),
);

const moves = await prisma.move.findMany({ orderBy: { at: "asc" } });
console.log(
  "moves:",
  moves.map((m) => JSON.stringify(m, (k, v) => (typeof v === "bigint" ? Number(v) : v))).join("\n  "),
);

const bom = await prisma.bomItem.findMany();
console.log("bom:", bom.map((b) => JSON.stringify(b)).join("\n  "));

await prisma.$disconnect();
