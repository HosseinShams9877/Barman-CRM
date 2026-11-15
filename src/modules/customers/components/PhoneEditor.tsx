"use client";

import { Button } from "@components/ui";
import { Input } from "@components/ui";
import { PHONE_KINDS } from "../constants/phone-kinds";

export type PhoneDraft = {
  /** شناسه موقت سمت کلاینت — برای key کردن ردیف‌ها. */
  key: string;
  kind: string;
  number: string;
};

export type PhoneEditorProps = {
  phones: PhoneDraft[];
  onChange: (phones: PhoneDraft[]) => void;
  /** خطای هر ردیف: کلید ردیف → پیام. */
  errors?: Readonly<Record<string, string>>;
  disabled?: boolean;
};

/** ساخت یک ردیف تلفن خالی. */
export function emptyPhone(): PhoneDraft {
  return { key: `ph-${Math.random().toString(36).slice(2, 9)}`, kind: "mobile", number: "" };
}

/**
 * ویرایشگر تلفن‌های چندگانه حساب (PHASE_03 §۳.۱ / Q-05: تلفن قابل ویرایش).
 *
 * نوع از فهرست ثابت `PHONE_KINDS` انتخاب می‌شود؛ شماره به‌صورت خام ورودی
 * می‌شود و نرمال‌سازی در Zod سمت کلاینت/سرور انجام می‌شود (R-13).
 */
export function PhoneEditor({ phones, onChange, errors, disabled }: PhoneEditorProps) {
  const update = (key: string, patch: Partial<PhoneDraft>): void => {
    onChange(phones.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };
  const remove = (key: string): void => {
    onChange(phones.filter((p) => p.key !== key));
  };
  const add = (): void => {
    onChange([...phones, emptyPhone()]);
  };

  return (
    <div className="repeat-list">
      {phones.length === 0 ? (
        <p className="field-hint">هیچ تلفنی ثبت نشده است.</p>
      ) : null}
      {phones.map((p) => (
        <div className="repeat-row" key={p.key}>
          <div className="field">
            <label className="field-label" htmlFor={`phone-kind-${p.key}`}>
              نوع تلفن
            </label>
            <select
              id={`phone-kind-${p.key}`}
              className="select"
              value={p.kind}
              onChange={(e) => update(p.key, { kind: e.target.value })}
              disabled={disabled}
            >
              {PHONE_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
              <option value="">— بدون نوع —</option>
            </select>
          </div>
          <Input
            id={`phone-number-${p.key}`}
            name={`phone-number-${p.key}`}
            label="شماره تلفن"
            placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"
            value={p.number}
            onChange={(e) => update(p.key, { number: e.target.value })}
            error={errors?.[p.key]}
            disabled={disabled}
            inputMode="tel"
            dir="ltr"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(p.key)}
            disabled={disabled}
            aria-label="حذف این تلفن"
            className="repeat-remove"
          >
            حذف
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={add} disabled={disabled}>
        + افزودن تلفن
      </Button>
    </div>
  );
}
