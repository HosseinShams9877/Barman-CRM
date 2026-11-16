import { mkdirSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const root = resolve(import.meta.dirname, "..");
const artifacts = resolve(root, ".cache/ui-parity");
mkdirSync(artifacts, { recursive: true });
mkdirSync(resolve(artifacts, "tmp"), { recursive: true });
const db = resolve(artifacts, "review.db");
if (!existsSync(db)) copyFileSync(resolve(root, "prisma/dev.db"), db);
const prisma = new PrismaClient({ datasources: { db: { url: `file:${db.replaceAll("\\", "/")}` } } });
const roles = ["admin", "management", "finance", "salesManager", "sales", "production", "depot"];
const passwordHash = await bcrypt.hash("Review1405!", 10);
for (const role of roles) {
  await prisma.role.upsert({ where: { key: role }, create: { key: role, name: role }, update: {} });
  await prisma.user.upsert({
    where: { name: `ui-review-${role}` },
    create: { name: `ui-review-${role}`, passwordHash, roles: { create: { roleKey: role } } },
    update: { passwordHash, off: false },
  });
}
console.log(JSON.stringify({ users: await prisma.user.count(), accounts: await prisma.account.count(), orders: await prisma.order.count(), leads: await prisma.lead.count(), jobs: await prisma.job.count(), buys: await prisma.buy.count() }));
await prisma.$disconnect();
const demo = resolve(root, "پلتفرم نهایی تیم بارمان");
function manifest(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return manifest(path);
    const name = relative(demo, path);
    // The protected secret files are only recorded as present; never read.
    if ([".env.local", ".secrets.local.json"].includes(entry.name)) return [{ name, present: true }];
    return [{ name, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") }];
  });
}
const manifestPath = resolve(artifacts, "demo-before.json");
if (!existsSync(manifestPath)) writeFileSync(manifestPath, JSON.stringify(manifest(demo), null, 2));
console.log(`Review database and demo manifest are inside ${artifacts}`);
