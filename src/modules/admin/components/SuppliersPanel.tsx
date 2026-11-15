"use client";

import { useState } from "react";
import { Button, DataTable, Dialog, Input } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { formatPhoneFa } from "@core/formatting";
import type { SupplierAdminRow } from "../services/supplier.service";
import {
  useAdminSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
} from "../hooks/useAdmin";

type Props = {
  /** مجوز ویرایش (catalog.suppliers.edit) — admin/management/finance. */
  canEdit: boolean;
};

type FormState = {
  name: string;
  kind: "raw" | "agency";
  phone: string;
  terms: string;
};

function emptyForm(): FormState {
  return { name: "", kind: "raw", phone: "", terms: "" };
}

function toForm(s: SupplierAdminRow): FormState {
  return { name: s.name, kind: s.kind === "agency" ? "agency" : "raw", phone: s.phone, terms: s.terms };
}

const KIND_LABELS: Readonly<Record<"raw" | "agency", string>> = {
  raw: "مواد اولیه",
  agency: "نمایندگی",
};

/**
 * مدیریت تأمین‌کنندگان — فهرست + ایجاد/ویرایش (PHASE_07 §۱۰).
 *
 * فیلدهای دیالوگ مطابق admin.js:107-113. نوع `raw` فروشنده مواد اولیه
 * و `agency` نمایندگی کالای آماده است.
 */
export function SuppliersPanel({ canEdit }: Props) {
  const query = useAdminSuppliersQuery();
  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierAdminRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  };

  const openEdit = (s: SupplierAdminRow): void => {
    setEditing(s);
    setForm(toForm(s));
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors((s) => ({ ...s, name: "نام تأمین‌کننده را وارد کنید." }));
      return;
    }

    const onOk = (): void => {
      toast.push(editing ? "تأمین‌کننده ذخیره شد." : "تأمین‌کننده ساخته شد.", "success");
      setOpen(false);
    };
    const onErr = (err: unknown): void => {
      const message = err instanceof ApiError ? err.message : "خطای غیرمنتظره.";
      toast.push(message, "danger");
    };
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      phone: form.phone.trim(),
      terms: form.terms.trim(),
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
      title={editing ? "ویرایش تأمین‌کننده" : "تأمین‌کننده جدید"}
      onClose={() => setOpen(false)}
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            انصراف
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="supplier-form"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <form id="supplier-form" className="grid2" onSubmit={submit} noValidate>
        <Input
          label="نام"
          name="sname"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          error={errors["name"]}
          required
        />
        <div className="field">
          <label className="field-label" htmlFor="s-kind">
            نوع
          </label>
          <select
            id="s-kind"
            className="select"
            value={form.kind}
            onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as "raw" | "agency" }))}
          >
            <option value="raw">فروشنده مواد اولیه</option>
            <option value="agency">نمایندگی (کالای آماده)</option>
          </select>
        </div>
        <Input
          label="تلفن"
          name="sphone"
          value={form.phone}
          onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          className="ltr"
        />
        <Input
          label="شرایط معمول پرداخت"
          name="sterms"
          value={form.terms}
          onChange={(e) => setForm((s) => ({ ...s, terms: e.target.value }))}
          hint="مثلاً: چک ۳۰ روزه"
        />
      </form>
    </Dialog>
  );

  if (query.isLoading) return <LoadingState label="در حال بارگذاری تأمین‌کنندگان…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <>
        <EmptyState
          title="تأمین‌کننده‌ای ثبت نشده"
          description={canEdit ? "اولین تأمین‌کننده را ایجاد کنید." : "هنوز تأمین‌کننده‌ای وجود ندارد."}
          action={canEdit ? <Button variant="primary" onClick={openCreate}>تأمین‌کننده جدید</Button> : undefined}
        />
        {canEdit ? dialog : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={openCreate}>
            تأمین‌کننده جدید
          </Button>
        </div>
      ) : null}
      <DataTable<SupplierAdminRow>
        caption="فهرست تأمین‌کنندگان"
        rows={items}
        rowKey={(s) => s.id}
        columns={[
          { key: "name", header: "نام", render: (s) => <b>{s.name}</b> },
          { key: "kind", header: "نوع", render: (s) => KIND_LABELS[s.kind] ?? s.kind },
          {
            key: "phone",
            header: "تلفن",
            render: (s) => <span className="ltr">{formatPhoneFa(s.phone)}</span>,
          },
          { key: "terms", header: "شرایط معمول پرداخت", render: (s) => s.terms || "—" },
          {
            key: "items",
            header: "اقلام",
            render: (s) => <small>{s.items.join("، ") || "—"}</small>,
          },
          {
            key: "actions",
            header: "",
            render: (s) =>
              canEdit ? (
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
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
