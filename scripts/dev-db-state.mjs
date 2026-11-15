import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const counts = await Promise.all([
  prisma.user.count(),
  prisma.role.count(),
  prisma.material.count(),
  prisma.product.count(),
  prisma.bomItem.count(),
  prisma.account.count(),
  prisma.order.count(),
  prisma.orderItem.count(),
  prisma.move.count(),
  prisma.job.count(),
  prisma.orderHandoff.count(),
  prisma.lead.count(),
]);
const labels = [
  "users", "roles", "materials", "products", "bom", "accounts",
  "orders", "orderItems", "moves", "jobs", "handoffs", "leads",
];
labels.forEach((l, i) => console.log(l, counts[i]));

console.log(
  "users:",
  (await prisma.user.findMany({ select: { id: true, name: true, roles: true } }))
    .map((u) => JSON.stringify(u))
    .join("\n  "),
);
console.log(
  "products:",
  (await prisma.product.findMany({ select: { id: true, code: true, name: true, line: true, active: true } }))
    .map((p) => JSON.stringify(p))
    .join("\n  "),
);
console.log(
  "materials:",
  (await prisma.material.findMany({ select: { id: true, code: true, name: true } }))
    .map((m) => JSON.stringify(m))
    .join("\n  "),
);

await prisma.$disconnect();
