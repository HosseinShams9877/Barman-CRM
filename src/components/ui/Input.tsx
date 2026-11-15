import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@core/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  /** وقتی مقدار دارد، صفت aria-invalid روی ورودی تنظیم می‌شود. */
};

/**
 * فیلد ورودی با برچسب، راهنما و خطای فارسی.
 * کلاس‌های .field/.field-label/.input/.field-error در utilities.css.
 */
export function Input({
  label,
  hint,
  error,
  id,
  className,
  required,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name;
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
        className={cn("input", className)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
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
