/**
 * سرویس کاتالوگ محصول/ماده — مدیریت کاتالوگ (PHASE_07 §۵).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - کد محصول/ماده یکتاست؛ تکرار رد می‌شود (admin.js:43/62).
 *  - ویرایش محصول همه فیلدها را بازنویسی می‌کند (admin.js:45-46).
 *  - `rev` در هر به‌روزرسانی یک واحد افزایش می‌یابد (R-06).
 *  - قیمت برای نقش‌های فاقد money.view فیلتر می‌شود (R-32 / CD-05).
 *  - nonMoney: نقش‌های production/depot قیمت می‌بینند؟ خیر — قانون Demo:
 *    `OPS = X.noMoney(R)` در admin.js برای محصولات قیمت را فیلتر نمی‌کرد
 *    (admin.js:28 money(p.price) بدون شرط)، ولی ماتریس هدف (CD-05/R-32)
 *    در سرور اجرا می‌شود و قیمت را برای نقش‌های فاقد money.view حذف می‌کند.
 */
import { prisma } from "@core/database/client";
import { conflict, notFound } from "@core/errors";
import type { ProductSaveInput, MaterialSaveInput } from "../schemas/catalog.schema";

/** محصول ذخیره‌شده — شکل امنِ JSON (BigInt → number — CD-07). */
export type ProductSaved = {
  id: string;
  code: string;
  name: string;
  line: string;
  category: string;
  unit: string;
  price: number;
  days: number;
  active: boolean;
  supplierId: string | null;
  colors: string[];
};

/** ماده ذخیره‌شده — شکل امنِ JSON. */
export type MaterialSaved = {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  min: number;
};

function toProductSaved(p: {
  id: string;
  code: string;
  name: string;
  line: string;
  category: string;
  unit: string;
  price: number;
  days: number;
  active: boolean;
  supplierId: string | null;
  colors: unknown;
}): ProductSaved {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    line: p.line,
    category: p.category,
    unit: p.unit,
    price: p.price,
    days: p.days,
    active: p.active,
    supplierId: p.supplierId,
    colors: Array.isArray(p.colors) ? (p.colors as string[]) : [],
  };
}

/** ردیف محصول برای فهرست مدیریت — با هزینه مواد هر واحد. */
export type ProductAdminRow = {
  id: string;
  code: string;
  name: string;
  line: string;
  category: string;
  unit: string;
  days: number;
  active: boolean;
  supplierId: string | null;
  colors: string[];
  bom: { materialId: string; qty: number }[];
  /** هزینه مواد هر واحد — فقط برای نقش‌های دارای money.view. */
  bomCost?: number;
  price?: number;
};

/** ردیف ماده برای فهرست مدیریت. */
export type MaterialAdminRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  min: number;
  price?: number;
};

const now = () => Date.now();

/** همه محصولات (فعال و غیرفعال) برای مدیریت — admin.js:24 (بدون فیلتر active). */
export async function listProducts(hideMoney: boolean): Promise<ProductAdminRow[]> {
  const rows = await prisma.product.findMany({
    orderBy: [{ name: "asc" }],
    include: { bom: { select: { materialId: true, qty: true } } },
  });
  const prices = await prisma.material.findMany({ select: { id: true, price: true } });
  const priceMap = new Map(prices.map((m) => [m.id, m.price]));

  return rows.map((p) => {
    const bomCost = p.bom.reduce((sum, b) => sum + (priceMap.get(b.materialId) ?? 0) * b.qty, 0);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      line: p.line,
      category: p.category,
      unit: p.unit,
      days: p.days,
      active: p.active,
      supplierId: p.supplierId,
      colors: Array.isArray(p.colors) ? (p.colors as string[]) : [],
      bom: p.bom.map((b) => ({ materialId: b.materialId, qty: b.qty })),
      ...(hideMoney ? {} : { price: p.price, bomCost: Math.round(bomCost) }),
    };
  });
}

/** همه مواد برای مدیریت. */
export async function listMaterials(hideMoney: boolean): Promise<MaterialAdminRow[]> {
  const rows = await prisma.material.findMany({ orderBy: [{ name: "asc" }] });
  return rows.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    unit: m.unit,
    min: m.min,
    ...(hideMoney ? {} : { price: m.price }),
  }));
}

/** ایجاد محصول — کد یکتا (admin.js:43). */
export async function createProduct(input: ProductSaveInput): Promise<ProductSaved> {
  const dup = await prisma.product.findUnique({ where: { code: input.code } });
  if (dup) throw conflict("این کد برای محصول دیگری است.");

  const created = await prisma.product.create({
    data: {
      code: input.code,
      name: input.name,
      line: input.line,
      category: input.category,
      unit: input.unit,
      price: input.price,
      colors: input.colors,
      days: input.days,
      supplierId: input.supplierId ?? null,
      active: input.active,
      createdAt: now(),
      updatedAt: now(),
    },
  });
  return toProductSaved(created);
}

/** ویرایش محصول — بازنویسی همه فیلدها (admin.js:45-46). */
export async function updateProduct(id: string, input: ProductSaveInput): Promise<ProductSaved> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw notFound("محصول پیدا نشد.");

  if (input.code !== existing.code) {
    const dup = await prisma.product.findUnique({ where: { code: input.code } });
    if (dup) throw conflict("این کد برای محصول دیگری است.");
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      line: input.line,
      category: input.category,
      unit: input.unit,
      price: input.price,
      colors: input.colors,
      days: input.days,
      supplierId: input.supplierId ?? null,
      active: input.active,
      updatedAt: now(),
      rev: { increment: 1 },
    },
  });
  return toProductSaved(updated);
}

/** ایجاد ماده — کد یکتا (admin.js:62). */
export async function createMaterial(input: MaterialSaveInput): Promise<MaterialSaved> {
  const dup = await prisma.material.findUnique({ where: { code: input.code } });
  if (dup) throw conflict("این کد تکراری است.");

  const created = await prisma.material.create({
    data: {
      code: input.code,
      name: input.name,
      unit: input.unit,
      price: input.price,
      min: input.min,
      createdAt: now(),
      updatedAt: now(),
    },
  });
  return {
    id: created.id,
    code: created.code,
    name: created.name,
    unit: created.unit,
    price: created.price,
    min: created.min,
  };
}

/** ویرایش ماده. */
export async function updateMaterial(id: string, input: MaterialSaveInput): Promise<MaterialSaved> {
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) throw notFound("ماده اولیه پیدا نشد.");

  if (input.code !== existing.code) {
    const dup = await prisma.material.findUnique({ where: { code: input.code } });
    if (dup) throw conflict("این کد تکراری است.");
  }

  const updated = await prisma.material.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      unit: input.unit,
      price: input.price,
      min: input.min,
      updatedAt: now(),
      rev: { increment: 1 },
    },
  });
  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    unit: updated.unit,
    price: updated.price,
    min: updated.min,
  };
}
