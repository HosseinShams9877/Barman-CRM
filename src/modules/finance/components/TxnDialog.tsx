/**
 * TxnDialog — ثبت هزینه/دریافت متفرقه (PHASE_06 §۶ / app/fin.js:145).
 *
 * نوع تراکنش یکی از ۸ گزینه ثابت فهرست Demo است و جهت از آن استنتاج
 * می‌شود — کاربر جهت را انتخاب نمی‌کند (app/fin.js:147).
 *
 * مبالغ فقط برای نقش‌های دارای `money.view` نمایش داده می‌شوند؛ فیلد
 * مبلغ برای نقش noMoney پنهان می‌شود (R-32). در عمل چنین نقشی
 * `finance.edit` ندارد (ماتریس مجوزها — docs/knowledge/
 * USER_ROLES_AND_PERMISSIONS.md) و دکمه ثبت را نمی‌بیند؛ این شاخه
 * صرفاً تدافعی است.
 */
"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { JalaliDateInput } from "@components/shared";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { EXPENSE_KIND_LABELS } from "../constants";
import { useCreateTxnMutation } from "../hooks/useTxnMutations";
import type { CreateTxnInput } from "../schemas/txn.schema";

export type TxnDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function TxnDialog({ open, onClose }: TxnDialogProps) {
  const me = useMeQuery();
  const canSeeMoney = new Set(me.data?.permissions ?? []).has("money.view");
  const createMutation = useCreateTxnMutation();

  // والد دیالوگ را فقط هنگام باز بودن mount می‌کند، پس مقداردهی اولیه
  // state همان reset در هر بار	open است (جای useEffect — React Docs).
  const [kind, setKind] = useState<string>(() => EXPENSE_KIND_LABELS[0]);
  const [amount, setAmount] = useState<string>("");
  const [at, setAt] = useState<string>("");
  const [who, setWho] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFormError(null);

    const input: CreateTxnInput = {
      kind: kind as (typeof EXPENSE_KIND_LABELS)[number],
      amount: Number(amount),
      at,
      who: who.trim().length > 0 ? who.trim() : undefined,
      note: note.trim().length > 0 ? note.trim() : undefined,
    };

    createMutation.mutate(input, {
      onSuccess: () => onClose(),
      onError: (err) => setFormError(err.message),
    });
  };

  return (
    <Dialog
      open={open}
      title="ثبت هزینه / دریافت متفرقه"
      description="نوع تراکنش جهت را تعیین می‌کند — دریافت‌ها درآمد و هزینه‌ها پرداخت هستند."
      onClose={onClose}
    >
      <form className="stack gap-4" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="txn-kind">
            نوع تراکنش
          </label>
          <select
            id="txn-kind"
            className="select"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            required
          >
            {EXPENSE_KIND_LABELS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {canSeeMoney ? (
          <div className="field">
            <label className="field-label" htmlFor="txn-amount">
              مبلغ (ریال)
            </label>
            <input
              id="txn-amount"
              className="input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              dir="ltr"
            />
          </div>
        ) : null}

        <JalaliDateInput
          id="txn-at"
          label="تاریخ تراکنش"
          value={at}
          onChange={setAt}
          required
          placeholder="مثلاً ۱۴۰۵/۰۸/۱۳"
        />

        <div className="field">
          <label className="field-label" htmlFor="txn-who">
            طرف مقابل
          </label>
          <input
            id="txn-who"
            className="input"
            type="text"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            maxLength={100}
            placeholder="اختیاری"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="txn-note">
            یادداشت
          </label>
          <textarea
            id="txn-note"
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="اختیاری"
          />
        </div>

        {formError ? (
          <p className="field-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="toolbar" aria-label="عملیات ثبت تراکنش">
          <Button type="submit" isLoading={createMutation.isPending}>
            ثبت تراکنش
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            انصراف
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
