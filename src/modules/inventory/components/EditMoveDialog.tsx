/**
 * EditMoveDialog — ویرایش حرکت دستی (PHASE_05 §۸/§۱۰).
 *
 * فقط حرکت‌های `open`/`out`/`adj` قابل ویرایش‌اند — حرکت‌های سیستمی
 * به اسناد کسب‌کار گره خورده‌اند. `adj` مقدار علامت‌دار می‌گیرد
 * (adj−/adj+ در دمو — app/stock.js:۵۳) و kinds دیگر فقط مقدار مثبت.
 *
 * علامت نهایی در سرور با `signedQty` اعمال می‌شود (PHASE_05 §۱۲).
 */
"use client";

import { useState } from "react";
import { Button, Dialog, Input } from "@components/ui";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { toFaDigits } from "@core/formatting";
import { useUpdateMoveMutation } from "../hooks/useMoveMutations";
import { MOVE_KIND_LABELS } from "../constants";
import type { MoveRow } from "../types/move.types";

export type EditMoveDialogProps = {
  move: MoveRow;
  onClose: () => void;
};

/** فرم ویرایش — مقدار برای adj علامت‌دار نمایش داده می‌شود. */
export function EditMoveDialog({ move, onClose }: EditMoveDialogProps) {
  const toast = useToast();
  const updateMove = useUpdateMoveMutation();

  // حالت اولیه از روی حرکت پر می‌شود — دیالوگ با هر باز شدن دوباره سوار
  // می‌شود (MovesTable آن را شرطی render می‌کند)، پس نیاز به effect نیست.
  const [qty, setQty] = useState(() => String(move.qty));
  const [note, setNote] = useState(() => move.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const qtyNum = Number(qty.replace(/,/g, ""));
    if (qty === "" || Number.isNaN(qtyNum)) {
      next.qty = "مقدار حرکت الزامی است.";
    } else if (qtyNum === 0) {
      next.qty = "مقدار باید بیشتر از صفر باشد.";
    } else if (move.kind !== "adj" && qtyNum < 0) {
      next.qty = "مقدار باید بیشتر از صفر باشد.";
    }
    if (!note.trim()) next.note = "علت حرکت الزامی است.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    updateMove.mutate(
      {
        id: move.id,
        data: { qty: qtyNum, note: note.trim() },
      },
      {
        onSuccess: () => {
          toast.push("حرکت به‌روزرسانی شد.", "success");
          onClose();
        },
        onError: (error: ApiError) => {
          if (error.status === 400 && error.fields) {
            const server: Record<string, string> = {};
            for (const [k, v] of Object.entries(error.fields)) server[k] = v;
            setErrors(server);
          } else {
            toast.push(error.message, "danger");
          }
        },
      },
    );
  };

  return (
    <Dialog
      open
      title="ویرایش حرکت"
      description={`${MOVE_KIND_LABELS[move.kind]} — ${move.itemName} (${move.itemCode})`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" form="move-edit-form" isLoading={updateMove.isPending}>
            ذخیره
          </Button>
        </>
      }
    >
      <form id="move-edit-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input
          id="move-edit-qty"
          name="qty"
          label="مقدار"
          type="number"
          step="0.001"
          value={qty}
          error={errors.qty}
          hint={
            move.kind === "adj"
              ? "اصلاح شمارش دوطرفه است — مقدار منفی برای کاهش مجاز است."
              : `واحد: ${move.unit}`
          }
          onChange={(e) => setQty(e.target.value)}
          required
        />
        <div className="field">
          <label className="field-label" htmlFor="move-edit-note">
            علت
          </label>
          <textarea
            id="move-edit-note"
            className="textarea"
            rows={2}
            value={note}
            maxLength={200}
            aria-invalid={errors.note ? "true" : undefined}
            onChange={(e) => setNote(e.target.value)}
          />
          {errors.note ? (
            <p className="field-error" role="alert">
              {errors.note}
            </p>
          ) : (
            <p className="field-hint">{toFaDigits(200 - note.length)} نویسه باقی‌مانده.</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
