/**
 * PaymentsPanel — پرداخت‌های دریافتی سفارش (PHASE_04 §۱۰).
 *
 * ثبت رسید نقدی/کارتی (kind: cash|card — core.js:242) با تاریخ جلالی،
 * فهرست پرداخت‌ها و باطل‌کردن (p.void). مبالغ فقط برای نقش‌های دارای
 * money.view قابل مشاهده است (R-32) — سرور مسیر را فیلتر می‌کند.
 */
"use client";

import { useState } from "react";
import { Button, Card, Input } from "@components/ui";
import { JalaliDateInput } from "@components/shared";
import { faErrorMap } from "@core/validation";
import { formatMoney } from "@core/formatting";
import { PAYMENT_KIND_LABELS, RECEIPT_KINDS } from "../constants";
import { createPaymentSchema } from "../schemas/order.schema";
import {
  useCreatePaymentMutation,
  useUpdatePaymentMutation,
} from "../hooks/useOrderMutations";
import type { OrderDetail } from "../types/order.types";
import type { ReceiptKind } from "../constants";

export type PaymentsPanelProps = {
  order: OrderDetail;
};

export function PaymentsPanel({ order }: PaymentsPanelProps) {
  const [kind, setKind] = useState<ReceiptKind>("cash");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const createPayment = useCreatePaymentMutation();
  const updatePayment = useUpdatePaymentMutation();
  const pending = createPayment.isPending || updatePayment.isPending;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload = {
      kind,
      amount: amount.trim().length === 0 ? Number.NaN : Number(amount),
      date,
      note: note.trim(),
    };
    const parsed = createPaymentSchema.safeParse(payload, { error: faErrorMap as never });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_";
        if (!out[key]) out[key] = issue.message || "مقدار نامعتبر است.";
      }
      setFields(out);
      return;
    }
    createPayment.mutate(
      { id: order.id, data: parsed.data },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
        },
      },
    );
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="h3">پرداخت‌های دریافتی</h2>
          <p className="field-hint">
            جمع پر شده:{" "}
            <span dir="ltr">
              {formatMoney(order.payments.filter((p) => !p.void).reduce((s, p) => s + p.amount, 0))}{" "}
              ریال
            </span>
          </p>
        </div>

        {order.payments.length > 0 ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <caption>رسیدهای ثبت‌شده</caption>
              <thead>
                <tr>
                  <th scope="col">نوع</th>
                  <th scope="col">مبلغ</th>
                  <th scope="col">تاریخ</th>
                  <th scope="col">ثبت‌کننده</th>
                  <th scope="col">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{PAYMENT_KIND_LABELS[p.kind]}</td>
                    <td>
                      <span dir="ltr">{formatMoney(p.amount)} ریال</span>
                    </td>
                    <td>
                      <span dir="ltr">{p.date}</span>
                    </td>
                    <td>{p.byName ?? "—"}</td>
                    <td>
                      {p.void ? (
                        <span className="tag-chip" data-tone="danger">
                          باطل‌شده
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updatePayment.mutate({ id: order.id, pid: p.id, data: { void: true } })
                          }
                          disabled={pending}
                        >
                          باطل کردن
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">هنوز پرداختی ثبت نشده است.</p>
        )}

        <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="field">
              <label className="field-label" htmlFor="pay-kind">
                نوع رسید
              </label>
              <select
                id="pay-kind"
                className="select"
                value={kind}
                onChange={(e) => setKind(e.target.value as ReceiptKind)}
                disabled={pending}
              >
                {RECEIPT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <Input
              id="pay-amount"
              name="amount"
              label="مبلغ (ریال)"
              type="number"
              min={1}
              step={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={fields.amount}
              disabled={pending}
              dir="ltr"
            />
            <JalaliDateInput
              id="pay-date"
              label="تاریخ پرداخت"
              value={date}
              onChange={setDate}
              error={fields.date}
              disabled={pending}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pay-note">
              یادداشت
            </label>
            <textarea
              id="pay-note"
              className="textarea"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
            />
          </div>
          {createPayment.error ? (
            <p className="field-error" role="alert">
              {createPayment.error.message}
            </p>
          ) : null}
          <Button type="submit" isLoading={pending}>
            ثبت پرداخت
          </Button>
        </form>
      </div>
    </Card>
  );
}
