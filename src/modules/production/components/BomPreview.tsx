/**
 * BomPreview — پیش‌نمایش زنده انفجار مواد (PHASE_05 §۶/§۱۰).
 *
 * repr: پیش‌نمایش زنده در دیالوگ ایجاد کار — app/prod.js:111.
 * محاسبه `need[k] = bom[k] * qty` و مقایسه با موجودی انبار مواد،
 * همان `bomNeed`/`bomShort` در Demo (app/core.js:216–227) — ولی
 * سمت کلاینت از داده‌های /api/catalog/materials استفاده می‌کند.
 *
 * guard کسری در سرور هنگام شروع کار اجرا می‌شود (prod.js:121)؛ این
 * کامپوننت فقط نمایش است و دکمه‌ها را غیرفعال نمی‌کند (CD-05: مجوز و
 * منع واقعی در سرور است).
 */
"use client";

import { DataTable } from "@components/ui";
import { useCatalogMaterialsQuery } from "@modules/inventory/hooks/useCatalog";
import { toFaDigits } from "@core/formatting";
import type { CatalogProduct } from "@modules/inventory/hooks/useCatalog";

export type BomPreviewProps = {
  product: CatalogProduct | null;
  qty: number;
};

/** گردسازی سه‌رقم اعشار — Math.round(n*1000)/1000 در Demo (app/core.js:12). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * محاسبه خطوط BOM برای `qty` عدد محصول — bomNeed (core.js:216).
 * خروجی بر اساس ترتیب BOM محصول است.
 */
export function computeBomLines(
  product: CatalogProduct | null,
  qty: number,
  materials: Map<string, { code: string; name: string; unit: string; onHand: number }>,
): { materialId: string; code: string; name: string; unit: string; perUnit: number; total: number; onHand: number; short: number }[] {
  if (!product || !(qty > 0)) return [];
  const lines: { materialId: string; code: string; name: string; unit: string; perUnit: number; total: number; onHand: number; short: number }[] = [];
  for (const b of product.bom) {
    const m = materials.get(b.materialId);
    const total = round3(b.qty * qty);
    const onHand = m ? round3(m.onHand) : 0;
    const short = round3(Math.max(0, total - onHand));
    lines.push({
      materialId: b.materialId,
      code: m?.code ?? "—",
      name: m?.name ?? b.materialId,
      unit: m?.unit ?? "",
      perUnit: round3(b.qty),
      total,
      onHand,
      short,
    });
  }
  return lines;
}

/** پیش‌نمایش BOM — جدول مواد لازم و کسری نسبت به انبار مواد. */
export function BomPreview({ product, qty }: BomPreviewProps) {
  const materialsQuery = useCatalogMaterialsQuery();

  const materials = new Map<
    string,
    { code: string; name: string; unit: string; onHand: number }
  >();
  for (const m of materialsQuery.data?.items ?? []) {
    materials.set(m.id, { code: m.code, name: m.name, unit: m.unit, onHand: m.onHand });
  }

  const lines = computeBomLines(product, qty, materials);
  const shortages = lines.filter((l) => l.short > 0);

  if (!product) {
    return <p className="text-muted text-sm">برای دیدن مواد لازم، محصولی انتخاب کنید.</p>;
  }

  if (lines.length === 0) {
    return (
      <p className="text-muted text-sm">
        این محصول BOM ثبت‌شده ندارد — ابتدا مواد اولیه را در کاتالوگ محصول تعریف کنید.
      </p>
    );
  }

  return (
    <div className="stack gap-2">
      <DataTable
        caption={`مواد لازم برای ساخت ${toFaDigits(round3(qty))} عدد ${product.name}`}
        rowKey={(row) => row.materialId}
        rows={lines}
        columns={[
          {
            key: "name",
            header: "ماده اولیه",
            render: (row) => (
              <span>
                {row.name} <span className="text-muted" dir="ltr">({row.code})</span>
              </span>
            ),
          },
          {
            key: "perUnit",
            header: "مصرف هر واحد",
            render: (row) => (
              <span dir="ltr">
                {toFaDigits(row.perUnit)} {row.unit}
              </span>
            ),
          },
          {
            key: "total",
            header: "کل لازم",
            render: (row) => (
              <span dir="ltr">
                {toFaDigits(row.total)} {row.unit}
              </span>
            ),
          },
          {
            key: "onHand",
            header: "موجودی انبار مواد",
            render: (row) => (
              <span dir="ltr">
                {toFaDigits(row.onHand)} {row.unit}
              </span>
            ),
          },
          {
            key: "short",
            header: "کسری",
            render: (row) =>
              row.short > 0 ? (
                <span className="tag-chip" data-tone="danger">
                  {toFaDigits(row.short)} {row.unit}
                </span>
              ) : (
                <span className="tag-chip" data-tone="success">کافی</span>
              ),
          },
        ]}
      />
      {shortages.length > 0 ? (
        <p className="text-sm" role="status">
          <strong>هشدار:</strong> {shortages.length} قلم کسری وجود دارد — شروع تولید در سرور
          مسدود می‌شود (app/prod.js:121).
        </p>
      ) : (
        <p className="text-sm text-muted" role="status">
          مواد اولیه کافی است.
        </p>
      )}
    </div>
  );
}
