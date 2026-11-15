"use client";

import { useState } from "react";
import { Button, DataTable, Dialog, Input } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { formatMoney, parseFaNumber } from "@core/formatting";
import type { MaterialAdminRow } from "../services/catalog.service";
import {
  useAdminMaterialsQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
} from "../hooks/useAdmin";
import { MATERIAL_UNITS } from "../constants/units";

type Props = {
  /** مجوز ویرایش (catalog.materials.edit). */
  canEdit: boolean;
};

type FormState = {
  code: string;
  name: string;
  unit: string;
  price: string;
  min: string;
};

function emptyForm(): FormState {
  return { code: "", name: "", unit: MATERIAL_UNITS[0], price: "", min: "۰" };
}

function toForm(m: MaterialAdminRow): FormState {
  return {
    code: m.code,
    name: m.name,
    unit: m.unit,
    price: String(m.price ?? 0),
    min: String(m.min),
  };
}

/**
 * کاتالوگ مواد اولیه — فهرست + ایجاد/ویرایش (PHASE_07 §۱۰).
 *
 * فیلدهای دیالوگ مطابق admin.js:58-65: کد و نام اجباری، قیمت می‌تواند
 * صفر باشد. قیمت/موجودی برای نقش‌های فاقد money.view فیلتر شده‌اند.
 */
export function MaterialCatalog({ canEdit }: Props) {
  const query = useAdminMaterialsQuery();
  const createMutation = useCreateMaterialMutation();
  const updateMutation = useUpdateMaterialMutation();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialAdminRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  };

  const openEdit = (m: MaterialAdminRow): void => {
    setEditing(m);
    setForm(toForm(m));
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.unit as (typeof MATERIAL_UNITS)[number],
      price: parseFaNumber(form.price),
      min: parseFaNumber(form.min),
    };

    if (!payload.code) setErrors((s) => ({ ...s, code: "کد ماده را وارد کنید." }));
    if (!payload.name) setErrors((s) => ({ ...s, name: "نام ماده را وارد کنید." }));
    if (!payload.code || !payload.name) return;

    const onOk = (): void => {
      toast.push(editing ? "ماده ذخیره شد." : "ماده اولیه ساخته شد.", "success");
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
      title={editing ? "ویرایش ماده اولیه" : "ماده اولیه جدید"}
      onClose={() => setOpen(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            انصراف
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="material-form"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <form id="material-form" className="grid2" onSubmit={submit} noValidate>
        <Input
          label="کد"
          name="mcode"
          value={form.code}
          onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
          error={errors["code"]}
          placeholder="RM-117"
          className="ltr"
          required
        />
        <Input
          label="نام"
          name="mname"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          error={errors["name"]}
          required
        />
        <div className="field">
          <label className="field-label" htmlFor="m-unit">
            واحد
          </label>
          <select
            id="m-unit"
            className="select"
            value={form.unit}
            onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
          >
            {MATERIAL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="قیمت خرید هر واحد"
          name="mprice"
          inputMode="numeric"
          value={form.price}
          onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
          hint="قیمت صفر مجاز است"
        />
        <Input
          label="حداقل موجودی (هشدار)"
          name="mmin"
          inputMode="numeric"
          value={form.min}
          onChange={(e) => setForm((s) => ({ ...s, min: e.target.value }))}
        />
      </form>
    </Dialog>
  );

  if (query.isLoading) return <LoadingState label="در حال بارگذاری مواد…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <>
        <EmptyState
          title="ماده اولیه‌ای ثبت نشده"
          description={canEdit ? "اولین ماده اولیه را ایجاد کنید." : "هنوز ماده‌ای وجود ندارد."}
          action={canEdit ? <Button variant="primary" onClick={openCreate}>ماده جدید</Button> : undefined}
        />
        {canEdit ? dialog : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="hint">
        مواد کیلویی/لیتری خریده می‌شوند؛ فرمول هر محصول می‌گوید هر واحد فروش چقدر از هر ماده
        مصرف می‌کند (admin.js:52).
      </p>
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={openCreate}>
            ماده اولیه جدید
          </Button>
        </div>
      ) : null}
      <DataTable<MaterialAdminRow>
        caption="فهرست مواد اولیه"
        rows={items}
        rowKey={(m) => m.id}
        columns={[
          { key: "code", header: "کد", render: (m) => <b className="ltr">{m.code}</b> },
          { key: "name", header: "ماده", render: (m) => <b>{m.name}</b> },
          { key: "unit", header: "واحد", render: (m) => m.unit },
          {
            key: "price",
            header: "آخرین قیمت خرید",
            render: (m) => (m.price !== undefined ? formatMoney(m.price) : "—"),
          },
          { key: "min", header: "حداقل موجودی", render: (m) => m.min },
          {
            key: "actions",
            header: "",
            render: (m) =>
              canEdit ? (
                <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
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
