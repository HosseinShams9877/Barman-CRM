import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const products = await prisma.product.findMany({
  select: { id: true, code: true, name: true, line: true, active: true, unit: true },
});
console.log("products:");
for (const p of products) console.log("  ", JSON.stringify(p));
const order = await prisma.order.findUnique({
  where: { id: "PF-1204" },
  include: { items: { select: { productId: true, qty: true, color: true, price: true } } },
});
console.log("PF-1204:", JSON.stringify(order, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
const o6 = await prisma.order.findUnique({
  where: { id: "PF-1206" },
  include: { items: { select: { productId: true, qty: true, color: true } } },
});
console.log("PF-1206:", JSON.stringify(o6, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
await prisma.$disconnect();
