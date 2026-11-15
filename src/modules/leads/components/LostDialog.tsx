"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { useMoveLeadStageMutation } from "../hooks/useLeadMutations";
import { moveStageSchema } from "../schemas/lead.schema";
import { LOST_REASONS } from "../constants/lists";

export type LostDialogProps = {
  open: boolean;
  leadId: string;
  onClose: () => void;
};

/**
 * دیالوگ دلیل از دست رفتن سرنخ — law: app/leads.js:474-475.
 *
 * ورود به مرحله lost بدون دلیل ممنوع است (اعتبارسنجی در Zod سمت سرور).
 */
export function LostDialog({ open, leadId, onClose }: LostDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const moveStage = useMoveLeadStageMutation();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const parsed = moveStageSchema.safeParse({ to: "lost", lostReason: reason.trim() });
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join(".") === "lostReason");
      setFieldError(issue?.message ?? "دلیل از دست رفتن را انتخاب کنید.");
      return;
    }
    moveStage.mutate(
      { id: leadId, data: parsed.data },
      {
        onSuccess: () => onClose(),
        onError: () => {
          /* خطای سرور در footer نشان داده می‌شود */
        },
      },
    );
  };

  const serverError = moveStage.error?.message ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="از دست رفتن سرنخ"
      description="دلیل از دست رفتن در گزارش‌ها ثبت می‌شود و اجباری است."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={moveStage.isPending}>
            انصراف
          </Button>
          <Button type="submit" form="lost-form" variant="danger" isLoading={moveStage.isPending}>
            ثبت از دست رفتن
          </Button>
        </>
      }
    >
      <form id="lost-form" className="stack gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="lost-reason">
            دلیل از دست رفتن <span aria-hidden="true">*</span>
          </label>
          <select
            id="lost-reason"
            className="select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={moveStage.isPending}
            aria-invalid={fieldError ? "true" : undefined}
          >
            <option value="">— انتخاب دلیل —</option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {fieldError ? (
            <p className="field-error" role="alert">
              {fieldError}
            </p>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
