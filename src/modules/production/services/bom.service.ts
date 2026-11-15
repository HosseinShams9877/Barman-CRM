/**
 * سرویس انفجار مواد (BOM) — بازسازی `X.bomNeed`/`X.bomShort` در Demo
 * (app/core.js:216–228) — CLAUDE.md §۱۳.
 *
 *  - bomNeed(lines): فرمول `need[materialId] += b.q * l.qty` (core.js:220).
 *  - bomShort(lines): آیتم‌هایی که `onHand("raw", k) < need[k]` (core.js:226).
 *  - پیش‌نمایش زنده در دیالوگ ایجاد کار — app/prod.js:111.
 *
 * هیچ قانونی فراتر از Demo اضافه نشده است — R-19: منطق از رشته‌های HTML
 * دمو به این ماژول منتقل شده است.
 */
import { prisma } from "@core/database/client";
import { computeOnHand } from "@modules/inventory/services/stock.service";
import type { BomLine, BomPreview } from "../types/job.types";

/** گردسازی سه‌رقم اعشار — Math.round(n*1000)/1000 در Demo (app/core.js:12). */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * محاسبه مواد لازم برای ساخت `qty` عدد از محصول — bomNeed (core.js:216).
 *
 * @returns نقشه materialId → مقدار کل لازم (مثبت).
 */
export async function computeBomNeed(
  productId: string,
  qty: number,
): Promise<Record<string, number>> {
  const bom = await prisma.bomItem.findMany({ where: { productId } });
  const need: Record<string, number> = {};
  for (const b of bom) {
    need[b.materialId] = (need[b.materialId] ?? 0) + b.qty * qty;
  }
  return need;
}

/**
 * پیش‌نمایش BOM — خروجی برای دیالوگ ایجاد کار (app/prod.js:111) و
 * ذخیره به‌عنوان `bomSnapshot` روی کار (PHASE_05 §۶).
 *
 * هر خط شامل مقدار لازم کل و موجودی فعلی و کسری است — همان اطلاعات
 * `bomShort` در Demo (core.js:226) ولی در یک ساختار واحد.
 */
export async function buildBomPreview(
  productId: string,
  qty: number,
): Promise<BomPreview> {
  const [need, materials, onHandMap] = await Promise.all([
    computeBomNeed(productId, qty),
    prisma.material.findMany(),
    computeOnHand(),
  ]);

  const lines: BomLine[] = [];
  const shortages: BomPreview["shortages"] = [];

  for (const m of materials) {
    const total = need[m.id];
    if (total === undefined) continue;
    const onHand = onHandMap[`raw|${m.id}`] ?? 0;
    const short = Math.max(0, total - onHand);
    lines.push({
      materialId: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      perUnit: round3(total / Math.max(1, qty)),
      total: round3(total),
      onHand: round3(onHand),
      short: round3(short),
    });
    if (onHand < total) {
      shortages.push({
        materialId: m.id,
        name: m.name,
        need: round3(total),
        have: round3(onHand),
        short: round3(short),
      });
    }
  }

  return { lines, shortages };
}
