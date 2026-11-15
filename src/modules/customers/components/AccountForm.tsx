"use client";

import { useMemo, useState } from "react";
import type { z } from "zod";
import { Button, Dialog, Input } from "@components/ui";
import { ApiError } from "@core/errors";
import { formatPhoneFa } from "@core/formatting";
import { useCreateAccountMutation, useUpdateAccountMutation } from "../hooks/useAccounts";
import {
  createAccountSchema,
  updateAccountSchema,
} from "../schemas/account.schema";
import { ACCOUNT_KINDS, kindRequiresName } from "../constants/account-kinds";
import {
  ContactEditor,
  emptyContact,
  type ContactDraft,
} from "./ContactEditor";
import { PhoneEditor, emptyPhone, type PhoneDraft } from "./PhoneEditor";
import type { AccountDetail } from "../types/account.types";

type CreateInput = z.infer<typeof createAccountSchema>;

export type AccountFormProps = {
  open: boolean;
  onClose: () => void;
  /** حساب موجود برای ویرایش — `null` یعنی ایجاد. */
  account: AccountDetail | null;
};

type FormState = {
  name: string;
  kind: string;
  active: boolean;
  address: string;
  note: string;
  phones: PhoneDraft[];
  contacts: ContactDraft[];
};

function toForm(account: AccountDetail | null): FormState {
  if (!account) {
    return {
      name: "",
      kind: "customer",
      active: true,
      address: "",
      note: "",
      phones: [emptyPhone()],
      contacts: [],
    };
  }
  return {
    name: account.name,
    kind: account.kind,
    active: account.active,
    address: account.address,
    note: account.note,
    phones: account.phones.map((p) => ({
      key: p.id,
      kind: p.kind,
      number: formatPhoneFa(p.number),
    })),
    contacts: account.contacts.map((c) => ({
      key: c.id,
      name: c.name,
      role: c.role,
      phone: c.phone,
    })),
  };
}

/**
 * فرم ایجاد/ویرایش حساب با مدیریت تلفن‌ها و مخاطبین (PHASE_03 §۱۰).
 *
 * اعتبارسنجی با همان Zod سمت سرور (R-13) — قبل از ارسال، خطاهای هر فیلد
 * به کاربر نمایش داده می‌شوند. نرمال‌سازی تلفن در همین فرم نمایشی است.
 */
export function AccountForm({ open, onClose, account }: AccountFormProps) {
  const isEdit = account !== null;
  const [form, setForm] = useState<FormState>(() => toForm(account));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});
  const [contactErrors, setContactErrors] = useState<Record<string, { name?: string; phone?: string }>>({});

  const createMutation = useCreateAccountMutation();
  const updateMutation = useUpdateAccountMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  const buildPayload = (): CreateInput => ({
    name: form.name.trim(),
    kind: form.kind as CreateInput["kind"],
    active: form.active,
    address: form.address.trim(),
    note: form.note.trim(),
    phones: form.phones
      .filter((p) => p.number.trim().length > 0)
      .map((p) => ({ kind: p.kind, number: p.number.trim() })),
    contacts: form.contacts
      .filter((c) => c.name.trim().length > 0)
      .map((c) => ({
        name: c.name.trim(),
        role: c.role.trim(),
        phone: c.phone.trim(),
      })),
  });

  /** اجرای Zod سمت کلاینت و تبدیل pathها به خطای فیلد. */
  const validate = (): boolean => {
    const payload = buildPayload();
    const schema = isEdit ? updateAccountSchema : createAccountSchema;
    const parsed = schema.safeParse(payload);
    if (parsed.success) {
      setFieldErrors({});
      setPhoneErrors({});
      setContactErrors({});
      return true;
    }
    const fields: Record<string, string> = {};
    const phones: Record<string, string> = {};
    const contacts: Record<string, { name?: string; phone?: string }> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path.startsWith("phones.") && form.phones.length > 0) {
        const idx = issue.path[1];
        const draft = form.phones[Number(idx)];
        if (draft) phones[draft.key] = issue.message;
      } else if (path.startsWith("contacts.")) {
        const idx = issue.path[1];
        const draft = form.contacts[Number(idx)];
        if (draft) {
          const field = String(issue.path[2] ?? "");
          contacts[draft.key] = {
            ...(contacts[draft.key] ?? {}),
            ...(field === "name" ? { name: issue.message } : {}),
            ...(field === "phone" ? { phone: issue.message } : {}),
          };
        }
      } else {
        fields[path] = issue.message;
      }
    }
    setFieldErrors(fields);
    setPhoneErrors(phones);
    setContactErrors(contacts);
    return false;
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!validate()) return;

    const payload = buildPayload();
    if (isEdit && account) {
      updateMutation.mutate({ id: account.id, data: payload }, { onSuccess: () => onClose() });
    } else {
      createMutation.mutate(payload, { onSuccess: () => onClose() });
    }
  };

  const serverError = useMemo(() => {
    const err = mutation.error;
    if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
      return err.message;
    }
    return null;
  }, [mutation.error]);

  const requiresName = kindRequiresName(form.kind);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `ویرایش حساب ${account?.id}` : "ایجاد حساب مشتری"}
      description="تلفن‌ها و مخاطبین را می‌توانید به‌صورت چندگانه اضافه کنید."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            انصراف
          </Button>
          <Button
            type="submit"
            form="account-form"
            isLoading={mutation.isPending}
          >
            {isEdit ? "ذخیره تغییرات" : "ایجاد حساب"}
          </Button>
        </>
      }
    >
      <form id="account-form" className="stack gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="repeat-row">
          <Input
            id="account-name"
            name="name"
            label="نام حساب"
            required={requiresName}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={fieldErrors.name}
            disabled={mutation.isPending}
            placeholder={requiresName ? "مثلاً شرکت نمونه" : "اختیاری برای نوع ناشناخته"}
          />
          <div className="field">
            <label className="field-label" htmlFor="account-kind">
              نوع حساب
            </label>
            <select
              id="account-kind"
              className="select"
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              disabled={mutation.isPending}
            >
              {ACCOUNT_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="repeat-row">
          <Input
            id="account-address"
            name="address"
            label="نشانی"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            disabled={mutation.isPending}
          />
          <div className="field">
            <label className="field-label" htmlFor="account-active">
              وضعیت حساب
            </label>
            <select
              id="account-active"
              className="select"
              value={form.active ? "1" : "0"}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "1" }))}
              disabled={mutation.isPending}
            >
              <option value="1">فعال</option>
              <option value="0">غیرفعال</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="account-note">
            یادداشت
          </label>
          <textarea
            id="account-note"
            className="textarea"
            rows={3}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            disabled={mutation.isPending}
          />
        </div>

        <fieldset className="stack gap-2" disabled={mutation.isPending}>
          <legend className="field-label">تلفن‌ها</legend>
          <PhoneEditor
            phones={form.phones}
            onChange={(phones) => setForm((f) => ({ ...f, phones }))}
            errors={phoneErrors}
            disabled={mutation.isPending}
          />
        </fieldset>

        <fieldset className="stack gap-2" disabled={mutation.isPending}>
          <legend className="field-label">مخاطبین</legend>
          <ContactEditor
            contacts={form.contacts}
            onChange={(contacts) => setForm((f) => ({ ...f, contacts }))}
            errors={contactErrors}
            disabled={mutation.isPending}
          />
        </fieldset>
      </form>
    </Dialog>
  );
}
