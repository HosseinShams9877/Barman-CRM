/**
 * JobFormDialog — ایجاد کار تولید (PHASE_05 §۳/§۱۰).
 *
 * repr: فرم `jnew` در Demo (app/prod.js:75) — محصول، مقدار، رنگ و
 * تاریخ پایان با پیش‌فرض امروز + ۳ روز (app/prod.js:75). پیش‌نمایش
 * زنده BOM زیر فرم (app/prod.js:111).
 *
 * فقط محصولات خط تولید (app/prod.js:74: `X.products("prod")`).
 * اعتبارسنجی نهایی در سرور با Zod صورت می‌گیرد (CD-04 گام ۳).
 */
"use client";

import { useMemo, useState } from "react";
import { Button, Dialog, Input } from "@components/ui";
import { JalaliDateInput } from "@components/shared/JalaliDateInput";
import { useToast } from "@components/feedback";
import { useCatalogProductsQuery } from "@modules/inventory/hooks/useCatalog";
import { ApiError } from "@core/errors";
import { instantToJalaliIso, jalaliToInstant, parseJalali } from "@core/calendar";
import { useCreateJobMutation } from "../hooks/useJobMutations";
import { JOB_END_DEFAULT_DAYS, JOB_MESSAGES } from "../constants";
import { DEFAULT_END_MS } from "../schemas/job.schema";
import { BomPreview } from "./BomPreview";

export type JobFormDialogProps = {
  onClose: () => void;
  onCreated?: (jobId: string) => void;
};

/** تبدیل لحظه (UTC ms) به `YYYY/MM/DD` ASCII برای ورودی تاریخ شمسی. */
function defaultEndIso(): string {
  return instantToJalaliIso(DEFAULT_END_MS());
}

/** فرم ایجاد کار تولید — اعتبارسنجی ساده کلاینت + Zod در سرور. */
export function JobFormDialog({ onClose, onCreated }: JobFormDialogProps) {
  const toast = useToast();
  const createJob = useCreateJobMutation();
  const productsQuery = useCatalogProductsQuery();

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [color, setColor] = useState("");
  const [endIso, setEndIso] = useState<string>(defaultEndIso);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const products = useMemo(
    () => (productsQuery.data?.items ?? []).filter((p) => p.line === "prod"),
    [productsQuery.data],
  );

  const product = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const colors = useMemo<string[]>(
    () => (Array.isArray(product?.colors) ? (product!.colors as string[]) : []),
    [product],
  );

  const qtyNum = Number(qty.replace(/,/g, ""));

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!productId) next.productId = "محصول الزامی است.";
    if (qty === "" || Number.isNaN(qtyNum) || !(qtyNum > 0)) next.qty = "مقدار باید بیشتر از صفر باشد.";
    const parsedEnd = endIso ? parseJalali(endIso) : null;
    if (endIso && !parsedEnd) next.end = "تاریخ پایان معتبر نیست (مثال: 1403/09/01).";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    createJob.mutate(
      {
        productId,
        qty: qtyNum,
        color: color || null,
        end: parsedEnd ? jalaliToInstant(parsedEnd) : null,
      },
      {
        onSuccess: (job) => {
          toast.push(`کار ${job.id} ایجاد شد.`, "success");
          onCreated?.(job.id);
          onClose();
        },
        onError: (error: ApiError) => {
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

  return (
    <Dialog
      open
      title="کار تولید جدید"
      description="برای ساخت محصول، یکی از محصولات خط تولید را انتخاب کنید."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" form="job-new-form" isLoading={createJob.isPending}>
            ایجاد کار
          </Button>
        </>
      }
    >
      <form id="job-new-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="job-product">
            محصول
          </label>
          <select
            id="job-product"
            className="select"
            value={productId}
            aria-invalid={errors.productId ? "true" : undefined}
            onChange={(e) => {
              setProductId(e.target.value);
              setColor("");
              setErrors({});
            }}
            required
          >
            <option value="">انتخاب محصول…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (<span dir="ltr">{p.code}</span>)
              </option>
            ))}
          </select>
          {errors.productId ? (
            <p className="field-error" role="alert">
              {errors.productId}
            </p>
          ) : (
            <p className="field-hint">فقط محصولات خط تولید (app/prod.js:74).</p>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="field flex-1">
            <Input
              id="job-qty"
              name="qty"
              label="مقدار تولید"
              type="number"
              step="0.001"
              min="0.001"
              value={qty}
              error={errors.qty}
              hint={product ? `واحد: ${product.unit}` : undefined}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
          <div className="field flex-1">
            <label className="field-label" htmlFor="job-color">
              رنگ
            </label>
            <select
              id="job-color"
              className="select"
              value={color}
              disabled={colors.length === 0}
              onChange={(e) => setColor(e.target.value)}
            >
              <option value="">بدون رنگ</option>
              {colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="field-hint">
              {colors.length > 0
                ? "رنگ‌های تعریف‌شده برای این محصول."
                : "برای این محصول رنگی تعریف نشده است."}
            </p>
          </div>
        </div>

        <JalaliDateInput
          id="job-end"
          name="end"
          label="تاریخ پایان برنامه‌ریزی‌شده"
          value={endIso}
          error={errors.end}
          hint={`پیش‌فرض: امروز + ${JOB_END_DEFAULT_DAYS} روز (app/prod.js:75)`}
          onChange={setEndIso}
        />

        <div>
          <h3 className="h3">پیش‌نمایش مواد لازم</h3>
          <BomPreview product={product} qty={Number.isNaN(qtyNum) ? 0 : qtyNum} />
        </div>

        <p className="text-muted text-sm" aria-live="polite">
          {JOB_MESSAGES.missingProductQty} — در صورت کسری مواد، شروع کار در سرور مسدود می‌شود.
        </p>
      </form>
    </Dialog>
  );
}
