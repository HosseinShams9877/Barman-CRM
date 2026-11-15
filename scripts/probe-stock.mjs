// بازتولید مستقیم منطق getStock برای یافتن علت ۵۰۰ (بدون سرور)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function round3(n) { return Math.round(n * 1000) / 1000; }

async function main() {
  console.log("1) material.findMany...");
  const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
  console.log("   ok n=", materials.length, "price type:", typeof materials[0]?.price, JSON.stringify(materials[0]?.price));

  console.log("2) product.findMany...");
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  console.log("   ok n=", products.length);

  console.log("3) move.groupBy by wh,item...");
  const groups = await prisma.move.groupBy({ by: ["wh", "item"], _sum: { qty: true } });
  console.log("   ok n=", groups.length, "sample:", JSON.stringify(groups[0]));

  console.log("4) move.groupBy used30...");
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const u30 = await prisma.move.groupBy({ by: ["item"], where: { wh: "raw", qty: { lt: 0 }, at: { gt: since } }, _sum: { qty: true } });
  console.log("   ok n=", u30.length);

  console.log("5) build rows + JSON.stringify...");
  const rows = [];
  for (const m of materials) rows.push({ itemId: m.id, name: m.name, code: m.code, unit: m.unit, wh: "raw", onHand: 0, price: m.price ?? 0, value: Math.round(0 * (m.price ?? 0)) });
  for (const p of products) rows.push({ itemId: p.id, name: p.name, code: p.code, unit: p.unit, wh: "depot", onHand: 0, price: p.price ?? 0, value: 0 });
  const out = JSON.stringify({ items: rows });
  console.log("   ok bytes=", out.length);
}

try {
  await main();
  console.log("ALL STEPS OK — getStock logic does not throw");
} catch (err) {
  console.log("THREW:", err && err.name);
  console.log("STACK:", err && err.stack ? err.stack.split("\n").slice(0, 8).join("\n") : String(err));
}
await prisma.$disconnect();
