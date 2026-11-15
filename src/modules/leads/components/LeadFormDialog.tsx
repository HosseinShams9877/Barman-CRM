"use client";

import { useState } from "react";
import { Button, Dialog, Input } from "@components/ui";
import { useCreateLeadMutation } from "../hooks/useLeadMutations";
import { createLeadSchema } from "../schemas/lead.schema";
import { LEAD_SOURCES } from "../constants/lists";
import { LEAD_LINES } from "../constants/LINE";
import type { LeadLineKey } from "../constants/LINE";

export type LeadFormDialogProps = {
  open: boolean;
  onClose: () => void;
};

type FormState = {
  phone: string;
  source: string;
  line: LeadLineKey;
  title: string;
  amount: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  phone: "",
  source: "",
  line: "prod",
  title: "",
  amount: "",
  note: "",
};

/**
 * فرم ایجاد سرنخ جدید — PHASE_03 §۳.۱ / §۱۰.
 *
 * فیلدهای اجباری: شماره تلفن و منبع ورود (app/lead-core.js:52-65).
 * اعتبارسنجی کلاینت با همان Zod سمت سرور (R-13) — خطاهای هر فیلد
 * به کاربر نمایش داده می‌شوند. مبلغ به ۱۰۰٬۰۰۰ گرد می‌شود (R-08).
 *
 * سرنخ جدید همیشه به کارشناس جاری تخصیص می‌یابد؛ `ownerId` فقط با
 * مجوز `leads.assign` و از طریق API قابل تغییر است (CD-23).
 */
export function LeadFormDialog({ open, onClose }: LeadFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const createLead = useCreateLeadMutation();

  const buildPayload = () => {
    const trimmed = form.amount.trim();
    return {
      phone: form.phone.trim(),
      source: form.source,
      line: form.line,
      title: form.title.trim(),
      amount: trimmed.length > 0 ? Number(trimmed) : null,
      note: form.note.trim(),
    };
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const payload = buildPayload();
    const parsed = createLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = issue.message;
      }
      setFieldErrors(fields);
      return;
    }
    createLead.mutate(parsed.data, {
      onSuccess: () => onClose(),
      onError: () => {
        /* خطای سرور (مثلاً ۴۰۹ شماره تکراری) در فرم نشان داده می‌شود */
      },
    });
  };

  const serverError = createLead.error?.message ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="سرنخ جدید"
      description="شماره و منبع ورود اجباری است؛ سرنخ در مرحله «سرنخ اولیه» ساخته می‌شود."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={createLead.isPending}>
            انصراف
          </Button>
          <Button type="submit" form="lead-form" isLoading={createLead.isPending}>
            ایجاد سرنخ
          </Button>
        </>
      }
    >
      <form id="lead-form" className="stack gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}

        <Input
          id="lead-phone"
          name="phone"
          label="شماره تلفن"
          required
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          error={fieldErrors.phone}
          disabled={createLead.isPending}
          placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
          dir="ltr"
        />

        <div className="field">
          <label className="field-label" htmlFor="lead-source">
            منبع ورود <span aria-hidden="true">*</span>
          </label>
          <select
            id="lead-source"
            className="select"
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            disabled={createLead.isPending}
            aria-invalid={fieldErrors.source ? "true" : undefined}
          >
            <option value="">— انتخاب منبع —</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {fieldErrors.source ? (
            <p className="field-error" role="alert">
              {fieldErrors.source}
            </p>
          ) : null}
        </div>

        <fieldset className="stack gap-2">
          <legend className="field-label">خط محصول</legend>
          {LEAD_LINES.map((l) => (
            <label key={l.key} className="flex gap-2 items-center">
              <input
                type="radio"
                name="lead-line"
                value={l.key}
                checked={form.line === l.key}
                onChange={() => setForm((f) => ({ ...f, line: l.key }))}
                disabled={createLead.isPending}
              />
              <span>{l.label}</span>
            </label>
          ))}
        </fieldset>

        <Input
          id="lead-title"
          name="title"
          label="نام شخص یا شرکت"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          error={fieldErrors.title}
          disabled={createLead.isPending}
          placeholder="اختیاری"
        />

        <Input
          id="lead-amount"
          name="amount"
          label="مبلغ تخمینی (ریال)"
          type="number"
          min={0}
          step={100000}
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          error={fieldErrors.amount}
          disabled={createLead.isPending}
          placeholder="اختیاری — به ۱۰۰٬۰۰۰ گرد می‌شود"
          dir="ltr"
        />

        <div className="field">
          <label className="field-label" htmlFor="lead-note">
            یادداشت
          </label>
          <textarea
            id="lead-note"
            className="textarea"
            rows={3}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            disabled={createLead.isPending}
          />
        </div>
      </form>
    </Dialog>
  );
}
