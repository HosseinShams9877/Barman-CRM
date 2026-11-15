/**
 * BuyFinanceDialog — تأیید مالی خرید `ok → fin` با ثبت چک‌های صادره
 * (PHASE_06 §۷ / app/buy.js:231).
 *
 * چک‌ها با وضعیت `issued` ثبت می‌شوند. بردن بدون چک مجاز است (خرید
 * نقدی/پرداخت در محل). جمع مبالغ چک‌ها نباید از مبلغ کل خرید بیشتر
 * باشد (PHASE_06 §۱۲ — بررسی در سرویس).
 */
"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { useFinanceBuyMutation } from "../hooks/useBuyMutations";
import type { BuyDetail, BuyDetailNoMoney } from "../types/buy.types";

/** پیش‌نویس یک چک صادره. */
type ChequeDraft = {
  key: string;
  amount: string;
  due: string;
  sayad: string;
};

let chequeSeq = 0;
function nextKey(): string {
  chequeSeq += 1;
  return `chq-${chequeSeq}`;
}

export type BuyFinanceDialogProps = {
  open: boolean;
  onClose: () => void;
  buy: BuyDetail | BuyDetailNoMoney;
};

export function BuyFinanceDialog({ open, onClose, buy }: BuyFinanceDialogProps) {
  const me = useMeQuery();
  const canSeeMoney = new Set(me.data?.permissions ?? []).has("money.view");
  const financeMutation = useFinanceBuyMutation();

  // والد دیالوگ را فقط هنگام باز بودن mount می‌کند، پس مقداردهی اولیه
  // state همان reset در هر بار open است (جای useEffect — React Docs).
  const [cheques, setCheques] = useState<ChequeDraft[]>(() => [
    { key: nextKey(), amount: "", due: "", sayad: "" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const addRow = (): void => {
    setCheques((prev) => [...prev, { key: nextKey(), amount: "", due: "", sayad: "" }]);
  };

  const removeRow = (key: string): void => {
    setCheques((prev) => prev.filter((row) => row.key !== key));
  };

  const updateRow = (key: string, patch: Partial<ChequeDraft>): void => {
    setCheques((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFormError(null);

    const valid = cheques.filter(
      (row) => row.amount.trim().length > 0 && row.due.trim().length > 0,
    );
    const payload = {
      rev: buy.rev,
      cheques:
        valid.length > 0
          ? valid.map((row) => ({
              amount: Number(row.amount),
              due: row.due.trim(),
              sayad: row.sayad.trim().length > 0 ? row.sayad.trim() : undefined,
            }))
          : undefined,
    };

    financeMutation.mutate(
      { id: buy.id, data: payload },
      {
        onSuccess: () => onClose(),
        onError: (err) => setFormError(err.message),
      },
    );
  };

  const total = "calc" in buy ? buy.calc.total : 0;

  return (
    <Dialog
      open={open}
      size="lg"
      title={`تأیید مالی خرید ${toFaDigits(buy.id)}`}
      description="چک‌های صادره با وضعیت «صادر شده» ثبت می‌شوند. بدون چک هم قابل تأیید است."
      onClose={onClose}
    >
      <form className="stack gap-4" onSubmit={handleSubmit}>
        {canSeeMoney ? (
          <p className="text-muted" dir="ltr">
            مبلغ کل خرید: {formatMoney(total)} ریال
          </p>
        ) : null}

        <div>
          <div className="page-head">
            <h2 className="h3">چک‌های صادره</h2>
            <Button type="button" size="sm" variant="ghost" onClick={addRow}>
              افزودن چک
            </Button>
          </div>

          <div className="stack gap-2">
            {cheques.map((row) => (
              <div key={row.key} className="flex flex-wrap gap-2 items-end" data-cheque-row>
                {canSeeMoney ? (
                  <div className="field grow">
                    <label className="sr-only" htmlFor={`chq-amt-${row.key}`}>
                      مبلغ چک (ریال)
                    </label>
                    <input
                      id={`chq-amt-${row.key}`}
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={row.amount}
                      onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                      aria-label="مبلغ چک به ریال"
                      placeholder="مبلغ"
                    />
                  </div>
                ) : null}
                <div className="field grow">
                  <label className="sr-only" htmlFor={`chq-due-${row.key}`}>
                    سررسید
                  </label>
                  <input
                    id={`chq-due-${row.key}`}
                    className="input"
                    type="text"
                    dir="ltr"
                    value={row.due}
                    onChange={(e) => updateRow(row.key, { due: e.target.value })}
                    aria-label="سررسید به فرمت YYYY/MM/DD"
                    placeholder="YYYY/MM/DD"
                  />
                </div>
                <div className="field grow">
                  <label className="sr-only" htmlFor={`chq-sayad-${row.key}`}>
                    شماره صیادی
                  </label>
                  <input
                    id={`chq-sayad-${row.key}`}
                    className="input"
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    value={row.sayad}
                    onChange={(e) => updateRow(row.key, { sayad: e.target.value })}
                    aria-label="شماره صیادی"
                    placeholder="صیادی"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => removeRow(row.key)}
                  aria-label="حذف چک"
                >
                  حذف
                </Button>
              </div>
            ))}
          </div>
        </div>

        {formError ? <p className="field-error" role="alert">{formError}</p> : null}

        <div className="toolbar" aria-label="عملیات تأیید مالی">
          <Button type="submit" isLoading={financeMutation.isPending}>
            تأیید مالی
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={financeMutation.isPending}
          >
            انصراف
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
