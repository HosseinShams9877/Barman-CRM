/**
 * ChequeEditor — مدیریت چک‌های صیادی سفارش (PHASE_04 §۱۰).
 *
 * - فرم ثبت چک: شماره صیادی دقیقاً ۱۶ رقم یا خالی (Q-06 — چک ناقص با
 *   نشان هشدار)، مبلغ، سررسید جلالی، بانک، دارنده و یادداشت.
 * - چرخه‌ی وضعیت hand → bank → clear / bounce (Demo fin) با
 *   tag-chip و رنگ معنایی (success/warning/danger/info — CD-16).
 *
 * سرور منبع حقیقت است: شماره ۱۵ رقمی در API رد می‌شود حتی اگر کلاینت
 * خطا را نشان ندهد (R-13 — اعتبارسنجی دوگانه با همان اسکیما).
 *
 * مبالغ فقط برای نقش‌های دارای money.view قابل مشاهده است (R-32).
 */
"use client";

import { useState } from "react";
import { Button, Card, Input } from "@components/ui";
import { JalaliDateInput } from "@components/shared";
import { faErrorMap } from "@core/validation";
import { formatMoney } from "@core/formatting";
import {
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUSES,
  SAYAD_LENGTH,
} from "../constants";
import { createChequeSchema } from "../schemas/order.schema";
import {
  useCreateChequeMutation,
  useUpdateChequeMutation,
} from "../hooks/useOrderMutations";
import type { ChequeStatus } from "../constants";
import type { ChequeRow, OrderDetail } from "../types/order.types";

export type ChequeEditorProps = {
  order: OrderDetail;
};

type ChequeForm = {
  sayad: string;
  amount: string;
  due: string;
  bank: string;
  owner: string;
  note: string;
};

const EMPTY_FORM: ChequeForm = {
  sayad: "",
  amount: "",
  due: "",
  bank: "",
  owner: "",
  note: "",
};

/** رنگ معنایی وضعیت چک (CD-16 — بدون رنگ hardcoded). */
const STATUS_TONE: Readonly<Record<ChequeStatus, "info" | "warning" | "success" | "danger">> = {
  hand: "info",
  bank: "warning",
  clear: "success",
  bounce: "danger",
};

export function ChequeEditor({ order }: ChequeEditorProps) {
  const [form, setForm] = useState<ChequeForm>(EMPTY_FORM);
  const [fields, setFields] = useState<Record<string, string>>({});
  const createCheque = useCreateChequeMutation();
  const updateCheque = useUpdateChequeMutation();
  const pending = createCheque.isPending || updateCheque.isPending;

  const set = (key: keyof ChequeForm, value: string): void => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload = {
      sayad: form.sayad.trim(),
      amount: form.amount.trim().length === 0 ? Number.NaN : Number(form.amount),
      due: form.due,
      bank: form.bank.trim(),
      owner: form.owner.trim(),
      note: form.note.trim(),
    };
    const parsed = createChequeSchema.safeParse(payload, { error: faErrorMap as never });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_";
        if (!out[key]) out[key] = issue.message || "مقدار نامعتبر است.";
      }
      setFields(out);
      return;
    }
    createCheque.mutate(
      { id: order.id, data: parsed.data },
      { onSuccess: () => setForm(EMPTY_FORM) },
    );
  };

  /** تغییر وضعیت یک چک موجود — چرخه hand → bank → clear / bounce. */
  const changeStatus = (cheque: ChequeRow, status: ChequeStatus): void => {
    setFields({});
    updateCheque.mutate({ id: order.id, cid: cheque.id, data: { status } });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="h3">چک‌های صیادی</h2>
          <p className="field-hint">
            شماره صیادی باید دقیقاً {SAYAD_LENGTH} رقم باشد — خالی مجاز است (چک ناقص).
          </p>
        </div>

        {order.cheques.length > 0 ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <caption>چک‌های ثبت‌شده</caption>
              <thead>
                <tr>
                  <th scope="col">شماره صیادی</th>
                  <th scope="col">مبلغ</th>
                  <th scope="col">سررسید</th>
                  <th scope="col">بانک</th>
                  <th scope="col">دارنده</th>
                  <th scope="col">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {order.cheques.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span dir="ltr">{c.sayad.length > 0 ? c.sayad : "—"}</span>
                    </td>
                    <td>
                      <span dir="ltr">{formatMoney(c.amount)} ریال</span>
                    </td>
                    <td>
                      <span dir="ltr">{c.due}</span>
                    </td>
                    <td>{c.bank.length > 0 ? c.bank : "—"}</td>
                    <td>{c.owner.length > 0 ? c.owner : "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="tag-chip" data-tone={STATUS_TONE[c.status]}>
                          {CHEQUE_STATUS_LABELS[c.status]}
                        </span>
                        <select
                          aria-label={`تغییر وضعیت چک ${c.sayad.length > 0 ? c.sayad : c.id}`}
                          className="select"
                          value={c.status}
                          onChange={(e) => changeStatus(c, e.target.value as ChequeStatus)}
                          disabled={pending}
                        >
                          {CHEQUE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {CHEQUE_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">هنوز چکی ثبت نشده است.</p>
        )}

        <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="cheque-sayad"
              name="sayad"
              label="شماره صیادی"
              value={form.sayad}
              onChange={(e) => set("sayad", e.target.value)}
              error={fields.sayad}
              disabled={pending}
              dir="ltr"
            />
            <Input
              id="cheque-amount"
              name="amount"
              label="مبلغ (ریال)"
              type="number"
              min={1}
              step={100000}
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              error={fields.amount}
              disabled={pending}
              dir="ltr"
            />
            <JalaliDateInput
              id="cheque-due"
              label="سررسید"
              value={form.due}
              onChange={(v) => set("due", v)}
              error={fields.due}
              disabled={pending}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="cheque-bank"
              name="bank"
              label="بانک"
              value={form.bank}
              onChange={(e) => set("bank", e.target.value)}
              disabled={pending}
            />
            <Input
              id="cheque-owner"
              name="owner"
              label="دارنده چک"
              value={form.owner}
              onChange={(e) => set("owner", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cheque-note">
              یادداشت
            </label>
            <textarea
              id="cheque-note"
              className="textarea"
              rows={2}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              disabled={pending}
            />
          </div>
          {createCheque.error ? (
            <p className="field-error" role="alert">
              {createCheque.error.message}
            </p>
          ) : null}
          <Button type="submit" isLoading={pending}>
            ثبت چک
          </Button>
        </form>

        {fields["_"] ? (
          <p className="field-error" role="alert">
            {fields["_"]}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
