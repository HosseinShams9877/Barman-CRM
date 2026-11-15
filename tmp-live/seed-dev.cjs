// درج داده نمونه فاز ۵ در dev.db — مطابق Demo app/data.js (فقط خواندنی).
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const MATS = [
  ["RM-101","گچ ممتاز قالب‌گیری","کیلو",9000,2500],
  ["RM-102","سیمان سفید","کیلو",14000,1500],
  ["RM-103","سیمان خاکستری تیپ ۲","کیلو",6500,1500],
  ["RM-104","پودر سنگ میکرونیزه","کیلو",4500,2000],
  ["RM-105","رزین اکریلیک","کیلو",185000,120],
  ["RM-106","رزین پلی‌استر","کیلو",210000,80],
  ["RM-107","فوق روان‌کننده بتن","کیلو",95000,60],
  ["RM-108","الیاف شیشه خردشده","کیلو",120000,50],
  ["RM-109","توری فایبرگلاس","مترمربع",38000,400],
  ["RM-110","پیگمنت سفید (تیتان)","کیلو",260000,25],
  ["RM-111","پیگمنت اکسید آهن (قهوه‌ای/قرمز)","کیلو",150000,20],
  ["RM-112","پیگمنت مشکی","کیلو",140000,15],
  ["RM-113","رنگ پایه آب اکریلیک","لیتر",98000,100],
  ["RM-114","روغن قالب","لیتر",70000,40],
  ["RM-115","پرلیت سبک","کیلو",22000,300],
  ["RM-116","سیلر محافظ نانو","لیتر",240000,40]
];

const PRODUCT_ID = "cmwbymjva0000nzqwinswwja8"; // BR-101
// FAM.gypsum با ضریب محصول i=0 → 0.9 (data.js:56)
const BOM = [
  ["RM-101", 8.1], ["RM-108", 0.054], ["RM-109", 0.945],
  ["RM-114", 0.045], ["RM-113", 0.315]
];

(async () => {
  const t0 = BigInt(Date.now() - 40 * 24 * 3600 * 1000);
  let created = 0;
  for (let i = 0; i < MATS.length; i++) {
    const [code, name, unit, price, min] = MATS[i];
    const m = await p.material.upsert({
      where: { code },
      update: {},
      create: { code, name, unit, price, min, createdAt: t0, updatedAt: t0 }
    });
    created++;
    // موجودی اول دوره (data.js:97)
    const qty = Math.round(min * (1.4 + (i % 5) * 0.35));
    await p.move.create({
      data: {
        id: "mv-seed-" + code.toLowerCase(),
        wh: "raw", item: m.id, qty, kind: "open", ref: null,
        at: t0, byUserId: null, note: "موجودی اول دوره"
      }
    });
  }
  for (const [code, q] of BOM) {
    const m = await p.material.findUniqueOrThrow({ where: { code } });
    await p.bomItem.upsert({
      where: { productId_materialId: { productId: PRODUCT_ID, materialId: m.id } },
      update: {},
      create: { productId: PRODUCT_ID, materialId: m.id, qty: q }
    });
  }
  console.log("materials:", created, "bom items:", BOM.length);
})().finally(() => p.$disconnect());
