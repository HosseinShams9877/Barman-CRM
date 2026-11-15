"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { toFaDigits } from "@core/formatting";
import { useImportLeadsMutation } from "../hooks/useLeadMutations";
import { importLeadsSchema } from "../schemas/import.schema";
import { LEAD_LINES } from "../constants/LINE";
import type { LeadLineKey } from "../constants/LINE";
import type { ImportResult } from "../schemas/import.schema";

export type ImportDialogProps = {
  open: boolean;
  onClose: () => void;
};

const CSV_HINT = "phone,source,line,title,note";

/**
 * دیالوگ ورود گروهی سرنخ‌ها از CSV — PHASE_03 §۳.۷ / §۱۰.
 *
 * سرتیتر با ستون `phone` اجباری است؛ ستون‌های دیگر اختیاری. پاسخ
 * سرور همیشه ۲۰۰ با گزارش ردیف‌به‌ردیف است (A-3.x درگاه خروج ۴) و
 * هر ردیف با `.import-row-result` نمایش داده می‌شود.
 */
export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [csv, setCsv] = useState<string>("");
  const [line, setLine] = useState<LeadLineKey>("prod");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  const importLeads = useImportLeadsMutation();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const parsed = importLeadsSchema.safeParse({ csv, line });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = issue.message;
      }
      setFieldErrors(fields);
      return;
    }
    importLeads.mutate(parsed.data, {
      onSuccess: (res) => setResult(res),
      onError: () => {
        /* خطای سرور در فرم نشان داده می‌شود */
      },
    });
  };

  const serverError = importLeads.error?.message ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="ورود گروهی سرنخ‌ها"
      description={
        <span>
          سرتیتر اول اجباری است و باید ستون <code dir="ltr">{CSV_HINT}</code> را داشته باشد.
          ردیف‌های نامعتبر رد می‌شوند اما در گزارش می‌آیند.
        </span>
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={importLeads.isPending}>
            انصراف
          </Button>
          <Button type="submit" form="import-form" isLoading={importLeads.isPending}>
            وارد کردن
          </Button>
        </>
      }
    >
      <form id="import-form" className="stack gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="import-csv">
            متن CSV
          </label>
          <textarea
            id="import-csv"
            className="textarea"
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            disabled={importLeads.isPending}
            dir="ltr"
            placeholder={`${CSV_HINT}\n09121234567,اینستاگرام,prod,علی رضایی,تماس اول`}
            aria-invalid={fieldErrors.csv ? "true" : undefined}
          />
          {fieldErrors.csv ? (
            <p className="field-error" role="alert">
              {fieldErrors.csv}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="import-line">
            خط پیش‌فرض ردیف‌ها
          </label>
          <select
            id="import-line"
            className="select"
            value={line}
            onChange={(e) => setLine(e.target.value as LeadLineKey)}
            disabled={importLeads.isPending}
          >
            {LEAD_LINES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {result ? (
          <div className="import-report" aria-live="polite">
            <p className="text-muted">
              ساخته‌شد: {toFaDigits(result.created)} — رد‌شده: {toFaDigits(result.failed)}
            </p>
            {result.rows.map((r) => (
              <div key={`${r.row}-${r.phone}`} className="import-row-result" data-ok={r.ok}>
                <span className="text-muted">خط {toFaDigits(r.row)}</span>
                <span dir="ltr">{r.phone}</span>
                <span>{r.ok ? "ساخته شد" : r.error}</span>
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
