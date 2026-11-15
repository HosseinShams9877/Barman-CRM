import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const materials = await prisma.material.findMany({ select: { id: true, code: true, name: true, unit: true, price: true } });
  console.log("materials ok:", materials.length);
  const moves = await prisma.move.findMany({ take: 2 });
  console.log("moves ok:", moves.length);
  const jobs = await prisma.job.findMany({ take: 2 });
  console.log("jobs ok:", jobs.length);
} catch (err) {
  console.log("ERROR:", err && err.message ? err.message.slice(0, 500) : err);
}
await prisma.$disconnect();
