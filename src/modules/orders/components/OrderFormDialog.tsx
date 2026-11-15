/**
 * OrderFormDialog — ایجاد/ویرایش پیش‌فاکتور (PHASE_04 §۳.۱/§۱۰).
 *
 * اقلام تکرارشونده (محصول، تعداد، قیمت، تخفیف قلم، رنگ)، تخفیف کل
 * (درصد + مبلغ ثابت)، هزینه حمل/نصب، مالیات (noVat)، اعتبار پیش‌فاکتور
 * و پیش‌تنظیم برنامه پرداخت.
 *
 * اعتبارسنجی کلاینت با همان اسکیمای سمت سرور (R-13) و نقشه خطای فارسی
 * (CD-28) — خطاهای هر فیلد زیر همان فیلد نمایش داده می‌شوند.
 *
 * انتخاب محصول: کاتالوگ محصول در فاز ۵ ساخته می‌شود و هنوز API عمومی
 * ندارد؛ بنابراین شناسه محصول به‌صورت متن وارد می‌شود (شناسه باید از
 * قبل در پایگاه داده وجود داشته باشد — سرویس بررسی می‌کند).
 */
"use client";

import { useState } from "react";
import { Button, Dialog, Input } from "@components/ui";
import { toFaDigits } from "@core/formatting";
import { faErrorMap } from "@core/validation";
import { PAYMENT_PRESETS } from "../constants";
import {
  createOrderSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from "../schemas/order.schema";
import { useCreateOrderMutation, useUpdateOrderMutation } from "../hooks/useOrderMutations";
import { useAccountsQuery } from "@modules/customers/hooks/useAccounts";
import type { OrderDetail, OrderDetailNoMoney } from "../types/order.types";

export type OrderFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** سفارش موجود برای ویرایش؛ null برای ایجاد. */
  order?: OrderDetail | OrderDetailNoMoney | null;
  /** تبدیل سرنخ به پیش‌فاکتور — شناسه سرنخ در payload قرار می‌گیرد. */
  leadId?: string | null;
  /** حساب پیش‌فرض (مثلاً از صفحه مشتری). */
  accountId?: string | null;
};

type ItemForm = {
  /** شناسه قلم موجود (ویرایش) — رشته خالی برای قلم جدید. */
  id: string;
  productId: string;
  qty: string;
  price: string;
  discount: string;
  color: string;
};

type FormState = {
  accountId: string;
  line: "prod" | "agency";
  discPct: string;
  discAmt: string;
  ship: string;
  install: string;
  validDays: string;
  note: string;
  preset: string;
  noVat: boolean;
};

const EMPTY_ITEM: ItemForm = {
  id: "",
  productId: "",
  qty: "",
  price: "",
  discount: "0",
  color: "",
};

const EMPTY_FORM: FormState = {
  accountId: "",
  line: "prod",
  discPct: "0",
  discAmt: "0",
  ship: "0",
  install: "0",
  validDays: "3",
  note: "",
  preset: "",
  noVat: false,
};

/** مقدار عددی فیلد متن — رشته خالی/نامعتبر به NaN (خطای اعتبارسنجی). */
function num(v: string): number {
  return v.trim().length === 0 ? Number.NaN : Number(v);
}

/** ویرایش: اقلام سفارش موجود به فرم تبدیل می‌شوند. */
function itemsFromOrder(order: OrderDetail | OrderDetailNoMoney): ItemForm[] {
  return order.items.map((it) => ({
    id: it.id,
    productId: it.productId,
    qty: String(it.qty),
    price: "price" in it ? String(it.price) : "",
    discount: "discount" in it ? String(it.discount) : "0",
    color: it.color,
  }));
}

/**
 * فرم ایجاد/ویرایش پیش‌فاکتور. ویرایش فقط تا مرحله ۵ مجاز است؛
 * سرور این قانون را اجرا می‌کند (این فرم فقط رابط کاربری است).
 */
export function OrderFormDialog({
  open,
  onClose,
  order = null,
  leadId = null,
  accountId = null,
}: OrderFormDialogProps) {
  const editing = order !== null;
  const [items, setItems] = useState<ItemForm[]>(
    order ? itemsFromOrder(order) : [{ ...EMPTY_ITEM }],
  );
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    accountId: order?.accountId ?? accountId ?? "",
    line: order?.line ?? "prod",
    discPct: order && "discPct" in order ? String(order.discPct) : "0",
    discAmt: order && "discAmt" in order ? String(order.discAmt) : "0",
    ship: order && "ship" in order ? String(order.ship) : "0",
    install: order && "install" in order ? String(order.install) : "0",
    validDays: String(order?.validDays ?? 3),
    note: order?.note ?? "",
    preset: order?.preset ?? "",
    noVat: order?.noVat ?? false,
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const createOrder = useCreateOrderMutation();
  const updateOrder = useUpdateOrderMutation();
  const accounts = useAccountsQuery({ page: 1, pageSize: 200, q: "", includeInactive: false });
  const pending = createOrder.isPending || updateOrder.isPending;

  const setItem = (index: number, patch: Partial<ItemForm>): void => {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addItem = (): void => {
    setItems((rows) => [...rows, { ...EMPTY_ITEM }]);
  };

  const removeItem = (index: number): void => {
    setItems((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  };

  const buildItems = () =>
    items.map((it) => ({
      ...(it.id.length > 0 ? { id: it.id } : {}),
      productId: it.productId.trim(),
      qty: num(it.qty),
      price: num(it.price),
      discount: it.discount.trim().length === 0 ? 0 : Number(it.discount),
      color: it.color.trim(),
    }));

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFieldErrors({});

    if (editing && order !== null) {
      const payload: UpdateOrderInput = {
        accountId: form.accountId.length > 0 ? form.accountId : null,
        line: form.line,
        items: buildItems() as UpdateOrderInput["items"],
        discPct: Number(form.discPct),
        discAmt: Number(form.discAmt),
        ship: Number(form.ship),
        install: Number(form.install),
        noVat: form.noVat,
        validDays: Number(form.validDays),
        note: form.note.trim(),
        preset: form.preset,
      };
      const parsed = updateOrderSchema.safeParse(payload, { error: faErrorMap as never });
      if (!parsed.success) {
        setFieldErrors(collectErrors(parsed.error.issues));
        return;
      }
      updateOrder.mutate(
        { id: order.id, data: parsed.data },
        { onSuccess: () => onClose() },
      );
      return;
    }

    const payload: CreateOrderInput = {
      ...(form.accountId.length > 0 ? { accountId: form.accountId } : {}),
      ...(leadId && leadId.length > 0 ? { leadId } : {}),
      line: form.line,
      items: buildItems() as CreateOrderInput["items"],
      discPct: Number(form.discPct),
      discAmt: Number(form.discAmt),
      ship: Number(form.ship),
      install: Number(form.install),
      noVat: form.noVat,
      validDays: Number(form.validDays),
      note: form.note.trim(),
      preset: form.preset,
    };
    const parsed = createOrderSchema.safeParse(payload, { error: faErrorMap as never });
    if (!parsed.success) {
      setFieldErrors(collectErrors(parsed.error.issues));
      return;
    }
    createOrder.mutate(parsed.data, { onSuccess: () => onClose() });
  };

  const serverError = createOrder.error?.message ?? updateOrder.error?.message ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `ویرایش پیش‌فاکتور ${order?.id}` : "پیش‌فاکتور جدید"}
      description={
        editing
          ? "ویرایش فقط در مراحل ۱ تا ۵ مجاز است (سرور بررسی می‌کند)."
          : "پیش‌فاکتور در مرحله ۱ (ثبت) ایجاد می‌شود. حداقل یک قلم لازم است."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" form="order-form" isLoading={pending}>
            {editing ? "ذخیره تغییرات" : "ایجاد پیش‌فاکتور"}
          </Button>
        </>
      }
    >
      <form id="order-form" className="stack gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="field-label" htmlFor="order-account">
              مشتری (حساب)
            </label>
            <select
              id="order-account"
              className="select"
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              disabled={pending}
            >
              <option value="">— بدون مشتری (بعداً) —</option>
              {accounts.data?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name.length > 0 ? a.name : a.id}
                </option>
              ))}
            </select>
            <p className="field-hint">مشتری در زمان «ارسال برای تأیید» اجباری می‌شود.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="order-line">
              خط محصول
            </label>
            <select
              id="order-line"
              className="select"
              value={form.line}
              onChange={(e) => setForm((f) => ({ ...f, line: e.target.value as "prod" | "agency" }))}
              disabled={pending}
            >
              <option value="prod">تولیدی</option>
              <option value="agency">نمایندگی</option>
            </select>
          </div>
        </div>

        <fieldset className="stack gap-2">
          <legend className="field-label">اقلام پیش‌فاکتور</legend>
          {items.map((it, i) => (
            <div key={it.id || i} className="grid grid-cols-2 gap-2 sm:grid-cols-6 items-end">
              <div className="field col-span-2 sm:col-span-2">
                <label className="field-label" htmlFor={`item-product-${i}`}>
                  شناسه محصول
                </label>
                <input
                  id={`item-product-${i}`}
                  className="input"
                  value={it.productId}
                  onChange={(e) => setItem(i, { productId: e.target.value })}
                  disabled={pending}
                  dir="ltr"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`item-qty-${i}`}>
                  تعداد
                </label>
                <input
                  id={`item-qty-${i}`}
                  className="input"
                  type="number"
                  min={1}
                  value={it.qty}
                  onChange={(e) => setItem(i, { qty: e.target.value })}
                  disabled={pending}
                  dir="ltr"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`item-price-${i}`}>
                  قیمت (ریال)
                </label>
                <input
                  id={`item-price-${i}`}
                  className="input"
                  type="number"
                  min={1}
                  value={it.price}
                  onChange={(e) => setItem(i, { price: e.target.value })}
                  disabled={pending}
                  dir="ltr"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`item-discount-${i}`}>
                  تخفیف قلم (٪)
                </label>
                <input
                  id={`item-discount-${i}`}
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={it.discount}
                  onChange={(e) => setItem(i, { discount: e.target.value })}
                  disabled={pending}
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="field flex-1">
                  <label className="field-label" htmlFor={`item-color-${i}`}>
                    رنگ
                  </label>
                  <input
                    id={`item-color-${i}`}
                    className="input"
                    value={it.color}
                    onChange={(e) => setItem(i, { color: e.target.value })}
                    disabled={pending}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => removeItem(i)}
                  disabled={pending || items.length <= 1}
                  aria-label={`حذف قلم ${toFaDigits(i + 1)}`}
                >
                  حذف
                </Button>
              </div>
            </div>
          ))}
          {itemsFieldError(fieldErrors) ? (
            <p className="field-error" role="alert">
              {itemsFieldError(fieldErrors)}
            </p>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={addItem} disabled={pending}>
            + افزودن قلم
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            id="order-discpct"
            name="discPct"
            label="تخفیف کل (٪)"
            type="number"
            min={0}
            max={100}
            value={form.discPct}
            onChange={(e) => setForm((f) => ({ ...f, discPct: e.target.value }))}
            error={fieldErrors.discPct}
            disabled={pending}
            dir="ltr"
          />
          <Input
            id="order-discamt"
            name="discAmt"
            label="مبلغ تخفیف (ریال)"
            type="number"
            min={0}
            step={100000}
            value={form.discAmt}
            onChange={(e) => setForm((f) => ({ ...f, discAmt: e.target.value }))}
            error={fieldErrors.discAmt}
            disabled={pending}
            dir="ltr"
          />
          <Input
            id="order-validdays"
            name="validDays"
            label="اعتبار پیش‌فاکتور (روز)"
            type="number"
            min={1}
            max={365}
            value={form.validDays}
            onChange={(e) => setForm((f) => ({ ...f, validDays: e.target.value }))}
            error={fieldErrors.validDays}
            disabled={pending}
            dir="ltr"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="order-ship"
            name="ship"
            label="هزینه حمل (ریال)"
            type="number"
            min={0}
            step={100000}
            value={form.ship}
            onChange={(e) => setForm((f) => ({ ...f, ship: e.target.value }))}
            error={fieldErrors.ship}
            disabled={pending}
            dir="ltr"
          />
          <Input
            id="order-install"
            name="install"
            label="هزینه نصب (ریال)"
            type="number"
            min={0}
            step={100000}
            value={form.install}
            onChange={(e) => setForm((f) => ({ ...f, install: e.target.value }))}
            error={fieldErrors.install}
            disabled={pending}
            dir="ltr"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="field-label" htmlFor="order-preset">
              پیش‌تنظیم برنامه پرداخت
            </label>
            <select
              id="order-preset"
              className="select"
              value={form.preset}
              onChange={(e) => setForm((f) => ({ ...f, preset: e.target.value }))}
              disabled={pending}
            >
              <option value="">— بدون پیش‌تنظیم —</option>
              {PAYMENT_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="order-novat">
              مالیات بر ارزش افزوده
            </label>
            <select
              id="order-novat"
              className="select"
              value={form.noVat ? "1" : "0"}
              onChange={(e) => setForm((f) => ({ ...f, noVat: e.target.value === "1" }))}
              disabled={pending}
            >
              <option value="0">محاسبه شود</option>
              <option value="1">بدون مالیات</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="order-note">
            یادداشت
          </label>
          <textarea
            id="order-note"
            className="textarea"
            rows={3}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            disabled={pending}
          />
        </div>
      </form>
    </Dialog>
  );
}

/** اولین پیام خطای آرایه اقلام یا یکی از اقلام آن (مثلاً items.0.price). */
function itemsFieldError(errors: Record<string, string>): string | null {
  if (errors["items"]) return errors["items"];
  for (const [key, msg] of Object.entries(errors)) {
    if (key.startsWith("items.")) return msg;
  }
  return null;
}

/** جمع‌آوری اولین پیام هر مسیر (مثل zodErrorToFields — R-13). */
function collectErrors(issues: { path: (string | number | symbol)[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!fields[key]) fields[key] = issue.message || "مقدار نامعتبر است.";
  }
  return fields;
}
