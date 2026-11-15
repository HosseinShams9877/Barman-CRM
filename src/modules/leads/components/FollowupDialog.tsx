"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { JalaliDateInput } from "@components/shared";
import { useAddFollowupMutation } from "../hooks/useLeadMutations";
import { createFollowupSchema } from "../schemas/lead.schema";
import { FOLLOWUP_RESULTS } from "../constants/lists";

export type FollowupDialogProps = {
  open: boolean;
  leadId: string;
  onClose: () => void;
};

/**
 * دیالوگ «چی شد؟» — ثبت پیگیری سرنخ (PHASE_03 §۹ / §۱۰).
 *
 * نتیجه تماس (اختیاری)، یادداشت و تاریخ پیگیری بعدی با date-picker فارسی.
 * اعتبارسنجی کلاینت با همان Zod سمت سرور (R-13): حداقل یکی از نتیجه یا
 * یادداشت باید پر باشد (app/leads.js:393-399).
 */
export function FollowupDialog({ open, leadId, onClose }: FollowupDialogProps) {
  const [result, setResult] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [nextAt, setNextAt] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const addFollowup = useAddFollowupMutation();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const parsed = createFollowupSchema.safeParse({
      result: result.trim(),
      note: note.trim(),
      ...(nextAt.length > 0 ? { nextAt } : {}),
    });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = issue.message;
      }
      setFieldErrors(fields);
      return;
    }
    addFollowup.mutate(
      { id: leadId, data: parsed.data },
      {
        onSuccess: () => onClose(),
        onError: () => {
          /* خطای سرور در footer نشان داده می‌شود */
        },
      },
    );
  };

  const serverError = addFollowup.error?.message ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="چی شد؟"
      description="ثبت نتیجه تماس و یادداشت در تاریخچه سرنخ."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={addFollowup.isPending}>
            انصراف
          </Button>
          <Button type="submit" form="followup-form" isLoading={addFollowup.isPending}>
            ثبت پیگیری
          </Button>
        </>
      }
    >
      <form id="followup-form" className="stack gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="followup-result">
            نتیجه تماس
          </label>
          <select
            id="followup-result"
            className="select"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            disabled={addFollowup.isPending}
          >
            <option value="">— انتخاب نتیجه —</option>
            {FOLLOWUP_RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="followup-note">
            یادداشت
          </label>
          <textarea
            id="followup-note"
            className="textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={addFollowup.isPending}
            aria-invalid={fieldErrors.note ? "true" : undefined}
          />
          {fieldErrors.note ? (
            <p className="field-error" role="alert">
              {fieldErrors.note}
            </p>
          ) : null}
        </div>

        <JalaliDateInput
          id="followup-next"
          name="nextAt"
          label="تاریخ پیگیری بعدی"
          value={nextAt}
          onChange={setNextAt}
          hint="اختیاری — با ارقام فارسی یا انگلیسی، مثلاً ۱۴۰۳/۰۹/۰۱"
          error={fieldErrors.nextAt}
          disabled={addFollowup.isPending}
        />
      </form>
    </Dialog>
  );
}
