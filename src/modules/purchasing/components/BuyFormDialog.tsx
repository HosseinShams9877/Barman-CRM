/**
 * BuyFormDialog — فرم ثبت/ویرایش درخواست خرید (PHASE_06 §۶/§۷).
 *
 * ویرایش فقط در وضعیت `req` مجاز است (در سرویس بررسی می‌شود — ۴۰۰).
 * اقلام: ماده خام از کاتالوگ + مقدار + قیمت واحد. قیمت فقط برای نقش‌های
 * دارای `money.view` قابل ورود است (R-32 — فیلتر سمت سرور، پنهان‌سازی
 * ورودی فقط UX). حداقل یک قلم لازم است (app/buy.js:۱۳۸).
 */
"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { ErrorState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { useCatalogMaterialsQuery } from "@modules/inventory/hooks/useCatalog";
import { formatMoney, toFaDigits } from "@core/formatting";
import { useSuppliersQuery } from "../hooks/useSuppliers";
import { useCreateBuyMutation, useUpdateBuyMutation } from "../hooks/useBuyMutations";
import type { BuyDetail, BuyDetailNoMoney } from "../types/buy.types";
import type { CreateBuyInput } from "../schemas/buy.schema";

/** شکل محلی یک قلم در حالت ویرایش. */
type ItemDraft = {
  key: string;
  materialId: string;
  qty: string;
  price: string;
};

export type BuyFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** خرید موجود برای ویرایش — فقط در وضعیت `req`؛ `null` برای ثبت جدید. */
  buy?: BuyDetail | BuyDetailNoMoney | null;
};

/** تبدیل اقلام خرید موجود به پیش‌نویس فرم. */
function itemsToDraft(buy: BuyDetail | BuyDetailNoMoney): ItemDraft[] {
  return buy.items.map((it) => ({
    key: it.id,
    materialId: it.materialId,
    qty: String(it.qty),
    price: "price" in it ? String(it.price) : "",
  }));
}

let draftSeq = 0;
/** شناسه یکتا برای هر ردیف پیش‌نویس (کلیوا کلید لیست). */
function nextKey(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

export function BuyFormDialog({ open, onClose, buy = null }: BuyFormDialogProps) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canSeeMoney = permissions.has("money.view");

  const suppliers = useSuppliersQuery();
  const catalog = useCatalogMaterialsQuery();
  const createMutation = useCreateBuyMutation();
  const updateMutation = useUpdateBuyMutation();

  const isEdit = buy !== null;

  // والد دیالوگ را فقط هنگام باز بودن mount می‌کند، پس مقداردهی اولیه
  // state از `buy` همان reset در هر بار open است (جای useEffect).
  const [supplierId, setSupplierId] = useState<string>(() => buy?.supplierId ?? "");
  const [note, setNote] = useState<string>(() => buy?.note ?? "");
  const [items, setItems] = useState<ItemDraft[]>(() =>
    isEdit ? itemsToDraft(buy!) : [{ key: nextKey(), materialId: "", qty: "", price: "" }],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = isEdit ? updateMutation : createMutation;
  const isSubmitting = mutation.isPending;

  const addRow = (): void => {
    setItems((prev) => [...prev, { key: nextKey(), materialId: "", qty: "", price: "" }]);
  };

  const removeRow = (key: string): void => {
    setItems((prev) => prev.filter((row) => row.key !== key));
  };

  const updateRow = (key: string, patch: Partial<ItemDraft>): void => {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  /** جمع اقلام — فقط نمایش؛ اعتبارسنجی نهایی در سرویس/Zod. */
  const total = items.reduce((sum, row) => {
    const qty = Number(row.qty);
    const price = Number(row.price);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + Math.round(qty * price);
  }, 0);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFormError(null);

    const payload: CreateBuyInput = {
      items: items
        .map((row) => ({
          materialId: row.materialId,
          qty: Number(row.qty),
          price: Number(row.price),
        }))
        .filter((it) => it.materialId.length > 0),
      note: note.trim().length > 0 ? note.trim() : undefined,
    };
    if (supplierId.length > 0) payload.supplierId = supplierId;

    if (isEdit && buy) {
      updateMutation.mutate(
        { id: buy.id, data: { ...payload, rev: buy.rev } },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError(err.message),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => onClose(),
        onError: (err) => setFormError(err.message),
      });
    }
  };

  const materialLabel = (id: string): string => {
    const m = catalog.data?.items.find((x) => x.id === id);
    return m ? `${m.name} (${m.code})` : "";
  };

  const materialOptions = catalog.data?.items ?? [];

  return (
    <Dialog
      open={open}
      size="lg"
      title={isEdit ? `ویرایش خرید ${toFaDigits(buy?.id ?? "")}` : "درخواست خرید جدید"}
      description="حداقل یک قلم لازم است. ویرایش فقط قبل از تأیید مدیریت ممکن است."
      onClose={onClose}
    >
      <form className="stack gap-4" onSubmit={handleSubmit}>
        {suppliers.isError ? (
          <ErrorState
            title="بارگذاری تأمین‌کنندگان ناموفق"
            message={suppliers.error?.message ?? "خطا در دریافت فهرست تأمین‌کنندگان."}
          />
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="buy-supplier">
            تأمین‌کننده
          </label>
          <select
            id="buy-supplier"
            className="select"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={suppliers.isLoading}
          >
            <option value="">— بدون تأمین‌کننده —</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="page-head">
            <h2 className="h3">اقلام خرید</h2>
            <Button type="button" size="sm" variant="ghost" onClick={addRow}>
              افزودن قلم
            </Button>
          </div>

          <div className="stack gap-2">
            {items.map((row) => (
              <div key={row.key} className="flex flex-wrap gap-2 items-end" data-buy-item>
                <div className="field grow-2">
                  <label className="sr-only" htmlFor={`mat-${row.key}`}>
                    ماده خام
                  </label>
                  <select
                    id={`mat-${row.key}`}
                    className="select"
                    value={row.materialId}
                    onChange={(e) => updateRow(row.key, { materialId: e.target.value })}
                    aria-label="ماده خام"
                  >
                    <option value="">انتخاب ماده…</option>
                    {materialOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field grow">
                  <label className="sr-only" htmlFor={`qty-${row.key}`}>
                    مقدار
                  </label>
                  <input
                    id={`qty-${row.key}`}
                    className="input"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    value={row.qty}
                    onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                    aria-label="مقدار"
                    placeholder="مقدار"
                  />
                </div>
                {canSeeMoney ? (
                  <div className="field grow">
                    <label className="sr-only" htmlFor={`price-${row.key}`}>
                      قیمت واحد (ریال)
                    </label>
                    <input
                      id={`price-${row.key}`}
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={row.price}
                      onChange={(e) => updateRow(row.key, { price: e.target.value })}
                      aria-label="قیمت واحد به ریال"
                      placeholder="قیمت واحد"
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => removeRow(row.key)}
                  aria-label="حذف قلم"
                >
                  حذف
                </Button>
              </div>
            ))}
          </div>
          {items.length === 0 ? (
            <p className="text-muted">حداقل یک قلم اضافه کنید.</p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="buy-note">
            یادداشت
          </label>
          <textarea
            id="buy-note"
            className="input"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {canSeeMoney ? (
          <p className="text-muted" dir="ltr">
            مبلغ کل: {formatMoney(total)} ریال
          </p>
        ) : null}

        {formError ? <p className="field-error" role="alert">{formError}</p> : null}
        {mutation.isError && !formError ? (
          <p className="field-error" role="alert">{mutation.error?.message}</p>
        ) : null}

        <div className="toolbar" aria-label="عملیات فرم">
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? "ذخیره تغییرات" : "ثبت درخواست خرید"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            انصراف
          </Button>
        </div>
        {!isEdit && materialOptions.length === 0 && !catalog.isLoading ? (
          <p className="text-muted">ابتدا در کاتالوگ مواد اولیه ثبت کنید.</p>
        ) : null}
        {isEdit && materialOptions.length > 0 && items.some((r) => r.materialId) ? (
          <p className="sr-only">{materialLabel(items.find((r) => r.materialId)?.materialId ?? "")}</p>
        ) : null}
      </form>
    </Dialog>
  );
}
