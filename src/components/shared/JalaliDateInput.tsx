"use client";

import { useId, useState } from "react";
import { cn } from "@core/utils";
import { formatJalaliFa, parseJalali, parseJalaliIso } from "@core/calendar";

export type JalaliDateInputProps = {
  label?: string;
  /** مقدار کنترلی — تاریخ خالص `YYYY/MM/DD` ارقام ASCII یا رشته خالی. */
  value: string;
  /** با هر تغییر فراخوانی می‌شود؛ ورودی نامعتبر همان‌طور که هست پاس داده می‌شود. */
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

/**
 * ورودی تاریخ شمسی — CD-06 / CLAUDE.md §۸.
 *
 * کاربر تاریخ را با ارقام فارسی یا انگلیسی و جداکننده‌های `/ - .` می‌نویسد؛
 * مقدار کنترلی همیشه قرارداد خالص `YYYY/MM/DD` ارقام ASCII است (به‌محض
 * اینکه ورودی معتبر باشد). نمایش با `formatJalaliFa` استاندارد می‌شود.
 *
 * این یک ورودی متنی ساده‌سازی‌شده است — تقویم بازشو جزو دامنه فاز ۳ نیست
 * (ساده‌سازی مستند در گزارش فاز ۳). اعتبارسنجی نهایی در سرور با Zod
 * انجام می‌شود (R-13).
 */
export function JalaliDateInput({
  label,
  value,
  onChange,
  id,
  name,
  hint,
  error,
  placeholder = "مثلاً ۱۴۰۳/۰۹/۰۱",
  required = false,
  disabled = false,
}: JalaliDateInputProps) {
  const autoId = useId();
  const inputId = id ?? name ?? autoId;
  const [draft, setDraft] = useState<{ sent: string; text: string } | null>(null);
  const text = draft?.sent === value ? draft.text : displayOf(value);

  const handle_change = (raw: string): void => {
    const iso = parseJalaliIso(raw);
    setDraft({ sent: iso ?? raw, text: raw });
    onChange(iso ?? raw);
  };

  const handle_blur = (): void => {
    setDraft(null);
  };

  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="field">
      {label ? (
        <label className="field-label" htmlFor={inputId}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      <input
        id={inputId}
        name={name}
        className={cn("input", error ? "input-error" : "")}
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={text}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        onChange={(e) => handle_change(e.target.value)}
        onBlur={handle_blur}
      />
      {error ? (
        <p className="field-error" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${inputId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * نمایش استاندارد یک ورودی: اگر تاریخ معتبر باشد با ارقام فارسی
 * (`formatJalaliFa`)، در غیر این صورت متن خام.
 */
function displayOf(value: string): string {
  if (value.length === 0) return "";
  const parsed = parseJalali(value);
  return parsed ? formatJalaliFa(parsed) : value;
}
