/**
 * سرویس فرمول تولید (BOM) — PHASE_07 §۵.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - هر ردیف BOM: یک ماده + مقدار مصرف به ازای یک واحد محصول
 *    (admin.js:73 — `b.m` و `b.q`).
 *  - ذخیره کامل (PUT) — ردیف‌های قبلی حذف و فهرست جدید نوشته می‌شود
 *    (admin.js:173 — `p.bom = [...]`).
 *  - مواد تکراری در یک فرمول مجاز نیستند (unique در طرح داده).
 *  - ویرایش BOM روی محاسبه مصرف فاز ۵ تأثیر مستقیم دارد
 *    (دروازه خروج ۲ PHASE_07).
 */
import { prisma } from "@core/database/client";
import { conflict, notFound } from "@core/errors";
import type { BomSaveInput } from "../schemas/catalog.schema";

/** ردیف BOM با اطلاعات ماده برای نمایش. */
export type BomRow = {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  qty: number;
  /** هزینه این ردیف — فقط برای نقش‌های دارای money.view. */
  cost?: number;
};

/** فرمول یک محصول با خلاصه هزینه. */
export type BomResult = {
  productId: string;
  productName: string;
  productUnit: string;
  items: BomRow[];
  /** جمع هزینه مواد هر واحد — فقط برای نقش‌های دارای money.view. */
  totalCost?: number;
};

/** خواندن فرمول یک محصول با مواد آن. */
export async function getBom(productId: string, hideMoney: boolean): Promise<BomResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { bom: { include: { material: true } } },
  });
  if (!product) throw notFound("محصول پیدا نشد.");

  const items: BomRow[] = product.bom.map((b) => ({
    materialId: b.materialId,
    materialCode: b.material.code,
    materialName: b.material.name,
    unit: b.material.unit,
    qty: b.qty,
    ...(hideMoney ? {} : { cost: Math.round(b.material.price * b.qty) }),
  }));

  return {
    productId: product.id,
    productName: product.name,
    productUnit: product.unit,
    items,
    ...(hideMoney
      ? {}
      : { totalCost: Math.round(items.reduce((s, i) => s + (i.cost ?? 0), 0)) }),
  };
}

/**
 * ذخیره کامل فرمول — جایگزینی همه ردیف‌ها در یک تراکنش.
 *
 * مواد تکراری رد می‌شوند (محدودیت unique در طرح داده).
 */
export async function saveBom(productId: string, input: BomSaveInput): Promise<BomResult> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("محصول پیدا نشد.");

  const ids = input.items.map((i) => i.materialId);
  if (new Set(ids).size !== ids.length) {
    throw conflict("یک ماده نمی‌تواند دو بار در یک فرمول باشد.");
  }

  const materials = await prisma.material.findMany({ where: { id: { in: ids } } });
  if (materials.length !== new Set(ids).size) {
    throw notFound("یکی از مواد انتخاب‌شده وجود ندارد.");
  }

  const now = Date.now();
  await prisma.$transaction([
    prisma.bomItem.deleteMany({ where: { productId } }),
    prisma.bomItem.createMany({
      data: input.items.map((i) => ({ productId, materialId: i.materialId, qty: i.qty })),
    }),
    prisma.product.update({
      where: { id: productId },
      data: { updatedAt: now, rev: { increment: 1 } },
    }),
  ]);

  return getBom(productId, false);
}
