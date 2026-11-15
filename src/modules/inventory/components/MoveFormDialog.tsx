/**
 * MoveFormDialog — فرم ثبت حرکت دستی انبار (PHASE_05 §۱۰).
 *
 * repr: فرم‌های دستی Demo (app/stock.js:۵۳/۸۶-۸۸) — ثبت `out`/`adj`/
 * `waste` با علت اجباری. kinds سیستمی (buy/prod/sale/use/job) در این
 * فرم نیستند — آنها فقط از عملیات کسب‌کار ساخته می‌شوند.
 *
 * علامت qty بر اساس kind در **سرور** اعمال می‌شود (PHASE_05 §۱۲)؛
 * کلاینت مقدار مثبت می‌فرستد، مگر `adj` که جهت (افزایش/کاهش) را هم
 * انتخاب می‌کند (adj−/adj+ در دمو — app/stock.js:۵۳).
 */
"use client";

import { useMemo, useState } from "react";
import { Button, Dialog, Input } from "@components/ui";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { toFaDigits } from "@core/formatting";
import { useCreateMoveMutation } from "../hooks/useMoveMutations";
import {
  useCatalogMaterialsQuery,
  useCatalogProductsQuery,
} from "../hooks/useCatalog";
import { MOVE_KIND_LABELS, WAREHOUSE_LABELS } from "../constants";
import type { ManualEntryKind, Warehouse } from "../constants";

export type MoveFormDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** گزینه kind قابل نمایش — adj به دو جهت مجزا تجزیه می‌شود (دمو). */
type KindOption = {
  /** مقدار kind نهایی که به API فرستاده می‌شود. */
  value: ManualEntryKind;
  /** جهت adj: مثبت برای افزایش، منفی برای کاهش — برای سایر kinds همیشه ۱. */
  dir: 1 | -1;
  label: string;
};

/** kinds دستی هر انبار — repr: outView/useView در Demo (app/stock.js:۵۳/۸۶). */
const KIND_OPTIONS: Readonly<Record<Warehouse, readonly KindOption[]>> = {
  depot: [
    { value: "out", dir: 1, label: MOVE_KIND_LABELS.out },
    { value: "adj", dir: 1, label: "اصلاح شمارش (افزایش)" },
    { value: "adj", dir: -1, label: "اصلاح شمارش (کاهش)" },
    { value: "waste", dir: 1, label: MOVE_KIND_LABELS.waste },
  ],
  raw: [
    { value: "open", dir: 1, label: MOVE_KIND_LABELS.open },
    { value: "out", dir: 1, label: MOVE_KIND_LABELS.out },
    { value: "adj", dir: 1, label: "اصلاح شمارش (افزایش)" },
    { value: "adj", dir: -1, label: "اصلاح شمارش (کاهش)" },
    { value: "waste", dir: 1, label: MOVE_KIND_LABELS.waste },
  ],
};

/**
 * فرم حرکت دستی — انتخاب انبار تعیین می‌کند کدام اقلام و kinds
 * قابل انتخاب‌اند (دمو: view جدا برای مواد و دپو).
 */
export function MoveFormDialog({ open, onClose }: MoveFormDialogProps) {
  const toast = useToast();
  const createMove = useCreateMoveMutation();
  const materials = useCatalogMaterialsQuery();
  const products = useCatalogProductsQuery();

  const [wh, setWh] = useState<Warehouse>("raw");
  const [kindIdx, setKindIdx] = useState(0);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** اقلام قابل انتخاب بر اساس انبار — مواد در raw، محصولات در depot. */
  const items = useMemo(() => {
    if (wh === "raw") return materials.data?.items ?? [];
    return products.data?.items ?? [];
  }, [wh, materials.data, products.data]);

  const kindOptions = KIND_OPTIONS[wh];
  const kindOption = kindOptions[Math.min(kindIdx, kindOptions.length - 1)];
  if (!kindOption) return null;

  const onWhChange = (value: Warehouse): void => {
    setWh(value);
    setKindIdx(0);
    setItemId("");
    setErrors({});
  };

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!itemId) next.itemId = "قلم حرکت را انتخاب کنید.";
    const qtyNum = Number(qty.replace(/,/g, ""));
    if (!qty || Number.isNaN(qtyNum) || qtyNum <= 0) next.qty = "مقدار باید بیشتر از صفر باشد.";
    if (!note.trim()) next.note = "علت حرکت الزامی است.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // برای adj جهت از گزینه انتخابی می‌آید — مقدار علامت‌دار فرستاده
    // می‌شود چون adj دوطرفه است (app/stock.js:۵۳).
    createMove.mutate(
      {
        wh,
        itemId,
        qty: kindOption.value === "adj" ? kindOption.dir * qtyNum : qtyNum,
        kind: kindOption.value,
        note: note.trim(),
      },
      {
        onSuccess: () => {
          toast.push("حرکت انبار ثبت شد.", "success");
          onClose();
        },
        onError: (error: ApiError) => {
          // خطای ۴۰۰ با فیلدها روی فرم نشان داده می‌شود، بقیه بهست.
          if (error.status === 400 && error.fields) {
            const server: Record<string, string> = {};
            for (const [k, v] of Object.entries(error.fields)) server[k] = v;
            setErrors(server);
          } else {
            toast.push(error.message, "danger");
          }
        },
      },
    );
  };

  const unit = items.find((i) => i.id === itemId)?.unit ?? "";

  return (
    <Dialog
      open={open}
      title="ثبت حرکت انبار"
      description="ثبت دستی موجودی — حرکت‌های سیستمی (خرید/تولید/فروش) از عملیات مربوطه ثبت می‌شوند."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" form="move-form" isLoading={createMove.isPending}>
            ثبت حرکت
          </Button>
        </>
      }
    >
      <form id="move-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="move-wh">
            انبار
          </label>
          <select
            id="move-wh"
            className="select"
            value={wh}
            onChange={(e) => onWhChange(e.target.value as Warehouse)}
          >
            {(Object.keys(WAREHOUSE_LABELS) as Warehouse[]).map((k) => (
              <option key={k} value={k}>
                {WAREHOUSE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="move-kind">
            نوع حرکت
          </label>
          <select
            id="move-kind"
            className="select"
            value={String(Math.min(kindIdx, kindOptions.length - 1))}
            onChange={(e) => setKindIdx(Number(e.target.value))}
          >
            {kindOptions.map((opt, i) => (
              <option key={`${opt.value}-${opt.dir}-${i}`} value={String(i)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="move-item">
            قلم
          </label>
          <select
            id="move-item"
            className="select"
            value={itemId}
            aria-invalid={errors.itemId ? "true" : undefined}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">— انتخاب قلم —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.code})
              </option>
            ))}
          </select>
          {errors.itemId ? (
            <p className="field-error" role="alert">
              {errors.itemId}
            </p>
          ) : null}
        </div>

        <Input
          id="move-qty"
          name="qty"
          label="مقدار"
          type="number"
          min="0"
          step="0.001"
          value={qty}
          error={errors.qty}
          hint={unit ? `واحد: ${unit}` : undefined}
          onChange={(e) => setQty(e.target.value)}
          required
        />

        <div className="field">
          <label className="field-label" htmlFor="move-note">
            علت
          </label>
          <textarea
            id="move-note"
            className="textarea"
            rows={2}
            value={note}
            maxLength={200}
            aria-invalid={errors.note ? "true" : undefined}
            onChange={(e) => setNote(e.target.value)}
          />
          {errors.note ? (
            <p className="field-error" role="alert">
              {errors.note}
            </p>
          ) : (
            <p className="field-hint">{toFaDigits(200 - note.length)} نویسه باقی‌مانده.</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
