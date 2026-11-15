const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({ select: { id: true, name: true, roles: true } });
  console.log("users:", JSON.stringify(users, null, 1));
  const orders = await p.order.findMany({ select: { id: true, stage: true, status: true, line: true, items: true, prod: true } });
  console.log("orders:", orders.length);
  for (const o of orders) console.log(" ", o.id, "stage", o.stage, o.status, "line", o.line, "items:", JSON.stringify(o.items));
  const ho = await p.orderHandoff.findMany();
  console.log("handoffs:", JSON.stringify(ho, (k,v) => typeof v === "bigint" ? v.toString() : v, 1));
  const m = await p.material.count(); const mv = await p.move.count(); const b = await p.bomItem.count(); const j = await p.job.count();
  console.log({ materials: m, moves: mv, bom: b, jobs: j });
  const prod = await p.product.findMany({ select: { id: true, code: true, name: true, unit: true, price: true } });
  console.log("products:", JSON.stringify(prod));
})().finally(() => p.$disconnect());
