"use client";

import { useMemo, useState } from "react";
import { Button } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { formatMoney, parseFaNumber, toFaDigits } from "@core/formatting";
import {
  useAdminProductsQuery,
  useAdminMaterialsQuery,
  useBomQuery,
  useSaveBomMutation,
} from "../hooks/useAdmin";

type Props = {
  /** مجوز ویرایش (catalog.bom.edit). */
  canEdit: boolean;
};

type Draft = { key: string; materialId: string; qty: string };

/**
 * ویرایشگر فرمول تولید (BOM) — PHASE_07 §۱۰ / دروازه خروج ۲.
 *
 * بازسازی admin.js:68-79: انتخاب محصول، ویرایش سطری مقدار مصرف، محاسبه
 * زنده هزینه مواد و ذخیره کامل فرمول. در Demo هر ۱ واحد محصول این
 * مقدارها از انبار مواد اولیه کم می‌شود.
 *
 * ردیف‌های ویرایش‌شده روی نقشه `edits` (به ازای محصول) نگه داشته
 * می‌شوند؛ مقدار پیش‌فرض از سرور خوانده می‌شود (بدون effect همگان‌سازی).
 */
export function BomEditor({ canEdit }: Props) {
  const productsQuery = useAdminProductsQuery();
  const materialsQuery = useAdminMaterialsQuery();
  const [productId, setProductId] = useState<string | null>(null);
  const resolvedProductId = productId ?? productsQuery.data?.items.find((p) => p.line === "prod")?.id ?? null;
  const bomQuery = useBomQuery(resolvedProductId);
  const saveMutation = useSaveBomMutation();
  const toast = useToast();

  /** ویرایش‌های محلی به ازای محصول — کلید غایب یعنی فرمول دست‌نخورده. */
  const [edits, setEdits] = useState<Record<string, Draft[]>>({});

  // فقط محصول‌های تولید داخل فرمول دارند (admin.js:71 — products("prod")).
  const prodProducts = useMemo(
    () => (productsQuery.data?.items ?? []).filter((p) => p.line === "prod"),
    [productsQuery.data],
  );

  const materials = useMemo(
    () => materialsQuery.data?.items ?? [],
    [materialsQuery.data],
  );

  const prices = useMemo(() => {
    const m = new Map<string, number>();
    for (const mat of materials) if (mat.price !== undefined) m.set(mat.id, mat.price);
    return m;
  }, [materials]);

  if (productsQuery.isLoading || materialsQuery.isLoading) {
    return <LoadingState label="در حال بارگذاری…" />;
  }
  if (productsQuery.isError || materialsQuery.isError) {
    return <ErrorState message={productsQuery.error?.message ?? materialsQuery.error?.message ?? "خطا"} />;
  }
  if (prodProducts.length === 0) {
    return <EmptyState title="محصول تولیدی وجود ندارد" description="ابتدا یک محصول با نوع «تولید خودمان» ایجاد کنید." />;
  }

  const current = productId ?? prodProducts[0]!.id;
  const product = prodProducts.find((p) => p.id === current) ?? prodProducts[0]!;

  // ردیف‌های نمایشی: ویرایش محلی، در غیر این صورت داده سرور.
  const serverRows: Draft[] = (bomQuery.data?.items ?? []).map((i) => ({
    key: i.materialId,
    materialId: i.materialId,
    qty: toFaDigits(String(i.qty)),
  }));
  const rows = edits[current] ?? serverRows;
  const bomCost = rows.reduce(
    (sum, d) => sum + (prices.get(d.materialId) ?? 0) * parseFaNumber(d.qty),
    0,
  );

  const setRows = (next: Draft[]): void => {
    setEdits((prev) => ({ ...prev, [current]: next }));
  };

  const addRow = (): void => {
    if (materials.length === 0) return;
    setRows([...rows, { key: crypto.randomUUID(), materialId: materials[0]!.id, qty: "۰" }]);
  };

  const removeRow = (index: number): void => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const save = (): void => {
    const items = rows
      .map((d) => ({ materialId: d.materialId, qty: parseFaNumber(d.qty) }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) {
      toast.push("حداقل یک ماده با مقدار مثبت لازم است.", "danger");
      return;
    }
    saveMutation.mutate(
      { productId: current, data: { items } },
      {
        onSuccess: (bom) => {
          setEdits((prev) => {
            const next = { ...prev };
            delete next[bom.productId];
            return next;
          });
          toast.push(`فرمول «${bom.productName}» ذخیره شد.`, "success");
        },
        onError: (err) => toast.push(err instanceof ApiError ? err.message : "خطای غیرمنتظره.", "danger"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="field" style={{ flex: "1 1 320px" }}>
        <label className="field-label" htmlFor="bom-product">
          محصول
        </label>
        <select
          id="bom-product"
          className="select"
          value={current}
          onChange={(e) => setProductId(e.target.value)}
        >
          {prodProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="alert alert-info" role="note">
        هر ۱ {product.unit} «{product.name}» این مقدارها از انبار مواد اولیه مصرف می‌کند —
        مثلاً ۱۰۰ {product.unit} = ۱۰۰ برابر هر ردیف.
      </div>

      {bomQuery.isLoading ? (
        <LoadingState label="در حال بارگذاری فرمول…" />
      ) : bomQuery.isError ? (
        <ErrorState message={bomQuery.error?.message ?? "خطا"} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="فرمول خالی است"
          description={canEdit ? "مواد اولیه مصرفی این محصول را اضافه کنید." : "این محصول هنوز فرمول ندارد."}
        />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <caption className="sr-only">فرمول تولید {product.name}</caption>
            <thead>
              <tr>
                <th scope="col">ماده اولیه</th>
                <th scope="col">مقدار برای ۱ {product.unit}</th>
                <th scope="col">واحد</th>
                <th scope="col">بهای مواد</th>
                <th scope="col">برای ۱۰۰ {product.unit}</th>
                {canEdit ? <th scope="col">{""}</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => {
                const mat = materials.find((m) => m.id === d.materialId);
                const qty = parseFaNumber(d.qty);
                return (
                  <tr key={d.key}>
                    <td>
                      {canEdit ? (
                        <select
                          className="select"
                          aria-label="ماده اولیه"
                          value={d.materialId}
                          onChange={(e) =>
                            setRows(rows.map((r, j) => (j === i ? { ...r, materialId: e.target.value } : r)))
                          }
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} — {m.code}
                            </option>
                          ))}
                        </select>
                      ) : (
                        mat?.name ?? "—"
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          className="input os-num"
                          inputMode="decimal"
                          aria-label="مقدار مصرف"
                          value={d.qty}
                          onChange={(e) =>
                            setRows(rows.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                          }
                        />
                      ) : (
                        toFaDigits(qty)
                      )}
                    </td>
                    <td>{mat?.unit ?? "—"}</td>
                    <td>{formatMoney(Math.round((prices.get(d.materialId) ?? 0) * qty))}</td>
                    <td>
                      {toFaDigits(qty * 100)} {mat?.unit ?? ""}
                    </td>
                    {canEdit ? (
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(i)} aria-label="حذف ردیف">
                          ×
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={addRow}>
            افزودن ماده
          </Button>
          <Button
            variant="primary"
            onClick={save}
            isLoading={saveMutation.isPending}
            disabled={edits[current] === undefined}
          >
            ذخیره فرمول
          </Button>
        </div>
      ) : null}

      <dl className="bom-totals">
        <div>
          <dt>بهای مواد هر {product.unit}</dt>
          <dd>{formatMoney(Math.round(bomCost))}</dd>
        </div>
        <div>
          <dt>قیمت فروش</dt>
          <dd>{product.price !== undefined ? formatMoney(product.price) : "—"}</dd>
        </div>
        <div>
          <dt>سهم مواد از قیمت</dt>
          <dd>
            {product.price ? toFaDigits(Math.round((bomCost / product.price) * 100)) : "—"}%
          </dd>
        </div>
      </dl>
    </div>
  );
}
