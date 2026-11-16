"use client";

import { useState } from "react";
import { Button, DataTable, Dialog, Input } from "@components/ui";
import { Icon } from "@components/ui/Icon";
import { ErrorState, LoadingState } from "@components/feedback";
import { EmptyState } from "@components/shared";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { formatMoney, parseFaNumber, toFaDigits } from "@core/formatting";
import type { ProductAdminRow } from "../services/catalog.service";
import {
  useAdminProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
} from "../hooks/useAdmin";
import { PRODUCT_LINES, PRODUCT_LINE_LABELS, PRODUCT_UNITS } from "../constants/units";

type Props = {
  /** مجوز ویرایش (catalog.products.edit) — از AdminPage محاسبه می‌شود. */
  canEdit: boolean;
};

type FormState = {
  code: string;
  name: string;
  line: "prod" | "agency";
  category: string;
  unit: string;
  price: string;
  colors: string;
  days: string;
  active: boolean;
};

function emptyForm(): FormState {
  return {
    code: "",
    name: "",
    line: "prod",
    category: "",
    unit: PRODUCT_UNITS[0],
    price: "",
    colors: "",
    days: "۲",
    active: true,
  };
}

function toForm(p: ProductAdminRow): FormState {
  return {
    code: p.code,
    name: p.name,
    line: (p.line === "agency" ? "agency" : "prod") as "prod" | "agency",
    category: p.category,
    unit: p.unit,
    price: toFaDigits(String(p.price ?? 0)),
    colors: p.colors.join("، "),
    days: toFaDigits(String(p.days)),
    active: p.active,
  };
}

/**
 * کاتالوگ محصولات — فهرست + ایجاد/ویرایش (PHASE_07 §۱۰).
 *
 * فیلدهای دیالوگ دقیقاً مطابق admin.js:31-48 است. اعتبارسنجی نهایی
 * در سرور با Zod (R-13)؛ đây فقط تجربه کاربری است.
 */
export function ProductCatalog({ canEdit }: Props) {
  const query = useAdminProductsQuery();
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductAdminRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [line, setLine] = useState("");

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  };

  const openEdit = (p: ProductAdminRow): void => {
    setEditing(p);
    setForm(toForm(p));
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      line: form.line,
      category: form.category.trim(),
      unit: form.unit as (typeof PRODUCT_UNITS)[number],
      price: parseFaNumber(form.price),
      colors: form.colors,
      days: parseFaNumber(form.days) || 2,
      active: form.active,
    };

    if (!payload.code) setErrors((s) => ({ ...s, code: "کد محصول را وارد کنید." }));
    if (!payload.name) setErrors((s) => ({ ...s, name: "نام محصول را وارد کنید." }));
    if (!(payload.price > 0)) setErrors((s) => ({ ...s, price: "قیمت باید عدد مثبتی باشد." }));
    if (!payload.code || !payload.name || !(payload.price > 0)) return;

    const onOk = (): void => {
      toast.push(editing ? "محصول ذخیره شد." : "محصول ساخته شد.", "success");
      setOpen(false);
    };
    const onErr = (err: unknown): void => {
      const message = err instanceof ApiError ? err.message : "خطای غیرمنتظره.";
      if (message.includes("کد")) setErrors((st) => ({ ...st, code: message }));
      else toast.push(message, "danger");
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, { onSuccess: onOk, onError: onErr });
    } else {
      createMutation.mutate(payload, { onSuccess: onOk, onError: onErr });
    }
  };
  const dialog = (
    <Dialog
      open={open}
      title={editing ? "ویرایش محصول" : "محصول جدید"}
      onClose={() => setOpen(false)}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            انصراف
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="product-form"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <form id="product-form" className="grid2" onSubmit={submit} noValidate>
        <Input
          label="کد محصول"
          name="code"
          value={form.code}
          onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
          error={errors["code"]}
          placeholder="BR-139"
          className="ltr"
          required
        />
        <Input
          label="نام"
          name="name"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          error={errors["name"]}
          required
        />
        <div className="field">
          <label className="field-label" htmlFor="p-line">
            نوع
          </label>
          <select
            id="p-line"
            className="select"
            value={form.line}
            onChange={(e) => setForm((s) => ({ ...s, line: e.target.value as "prod" | "agency" }))}
          >
            {PRODUCT_LINES.map((l) => (
              <option key={l} value={l}>
                {PRODUCT_LINE_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="دسته"
          name="category"
          value={form.category}
          onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
        />
        <div className="field">
          <label className="field-label" htmlFor="p-unit">
            واحد فروش
          </label>
          <select
            id="p-unit"
            className="select"
            value={form.unit}
            onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
          >
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="قیمت فروش هر واحد (ریال)"
          name="price"
          inputMode="numeric"
          value={form.price}
          onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
          error={errors["price"]}
          required
        />
        <Input
          label="رنگ‌ها (با ویرگول جدا کنید)"
          name="colors"
          value={form.colors}
          onChange={(e) => setForm((s) => ({ ...s, colors: e.target.value }))}
          hint="مثال: سفید، کرم، نود"
        />
        <Input
          label="زمان تولید (روز)"
          name="days"
          inputMode="numeric"
          value={form.days}
          onChange={(e) => setForm((s) => ({ ...s, days: e.target.value }))}
        />
        <div className="field">
          <label className="field-label" htmlFor="p-active">
            وضعیت
          </label>
          <select
            id="p-active"
            className="select"
            value={form.active ? "1" : "0"}
            onChange={(e) => setForm((s) => ({ ...s, active: e.target.value === "1" }))}
          >
            <option value="1">فعال (در پیش‌فاکتور می‌آید)</option>
            <option value="0">غیرفعال</option>
          </select>
        </div>
      </form>
    </Dialog>
  );

  if (query.isLoading) return <LoadingState label="در حال بارگذاری محصولات…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <>
        <EmptyState
          title="محصولی ثبت نشده"
          description={canEdit ? "اولین محصول کاتالوگ را ایجاد کنید." : "هنوز محصولی وجود ندارد."}
          action={
            canEdit ? (
              <Button variant="primary" onClick={openCreate}>
                محصول جدید
              </Button>
            ) : undefined
          }
        />
        {canEdit ? dialog : null}
      </>
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <input
          className="input"
          type="search"
          aria-label="جستجوی محصولات"
          placeholder="نام، کد یا دسته"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="select"
          aria-label="نوع محصول"
          value={line}
          onChange={(event) => setLine(event.target.value)}
        >
          <option value="">همه ({toFaDigits(items.length)})</option>
          {PRODUCT_LINES.map((key) => (
            <option key={key} value={key}>
              {PRODUCT_LINE_LABELS[key]} (
              {toFaDigits(items.filter((product) => product.line === key).length)})
            </option>
          ))}
        </select>
        {canEdit ? (
          <Button
            variant="primary"
            leadingIcon={<Icon name="plus" size="icon-sm" />}
            onClick={openCreate}
          >
            محصول جدید
          </Button>
        ) : null}
      </div>
      <DataTable<ProductAdminRow>
        caption="فهرست محصولات"
        rows={items.filter(
          (product) =>
            (!line || product.line === line) &&
            (!search.trim() ||
              (product.name + product.code + product.category).includes(search.trim())),
        )}
        rowKey={(p) => p.id}
        columns={[
          { key: "code", header: "کد", render: (p) => <b className="ltr">{p.code}</b> },
          { key: "name", header: "محصول", render: (p) => <b>{p.name}</b> },
          {
            key: "line",
            header: "نوع",
            render: (p) => PRODUCT_LINE_LABELS[p.line as "prod" | "agency"] ?? p.line,
          },
          { key: "category", header: "دسته", render: (p) => p.category || "—" },
          { key: "unit", header: "واحد فروش", render: (p) => p.unit },
          {
            key: "price",
            header: "قیمت فروش",
            render: (p) => (p.price !== undefined ? <b>{formatMoney(p.price)}</b> : "—"),
          },
          {
            key: "colors",
            header: "رنگ‌ها",
            render: (p) => <small>{p.colors.join("، ") || "—"}</small>,
          },
          {
            key: "bomCost",
            header: "بهای مواد هر واحد",
            render: (p) =>
              p.line === "prod"
                ? p.bom.length > 0 && p.bomCost !== undefined
                  ? formatMoney(p.bomCost)
                  : "فرمول ندارد"
                : "—",
          },
          {
            key: "active",
            header: "وضعیت",
            render: (p) =>
              p.active ? (
                <span className="tag-chip" data-tone="success">
                  فعال
                </span>
              ) : (
                <span className="tag-chip">غیرفعال</span>
              ),
          },
          {
            key: "actions",
            header: "",
            render: (p) =>
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Icon name="edit" size="icon-sm" />}
                  onClick={() => openEdit(p)}
                >
                  ویرایش
                </Button>
              ) : null,
          },
        ]}
      />
      {canEdit ? dialog : null}
    </div>
  );
}
