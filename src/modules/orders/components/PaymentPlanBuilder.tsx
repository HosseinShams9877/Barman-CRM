/**
 * PaymentPlanBuilder — مولد برنامه پرداخت (PHASE_04 §۱۰).
 *
 * پیش‌تنظیم (PAYMENT_PRESETS — order.js:109-114) یا پارامترهای دلخواه
 * (planBuilder: pre/preMode/preAmt/rest/n/gap/first — order.js:118-132).
 * محاسبه‌ی برنامه سمت سرور است (PHASE_04 §۳.۵) و چیزی ذخیره نمی‌کند —
 * تبدیل به پرداخت/چک در زمان finalize انجام می‌شود.
 *
 * جمع‌بندی زنده و هشدار اختلاف بیش از ۱ ریال (PAYMENT_TOLERANCE —
 * order.js:147 ok4): برنامه فقط وقتی قابل قطعی‌سازی است که با مبلغ
 * نهایی تسویه شود.
 *
 * مبالغ فقط برای نقش‌های دارای money.view معنی دارد (R-32) — سرور
 * مسیر /plan را برای نقش‌های فاقد این مجوز رد می‌کند.
 */
"use client";

import { useState } from "react";
import { Button, Card } from "@components/ui";
import { formatMoney } from "@core/formatting";
import { faErrorMap } from "@core/validation";
import { PAYMENT_KIND_LABELS, PLAN_FIRST, PLAN_GAPS, PAYMENT_PRESETS } from "../constants";
import {
  generatePlanSchema,
  PAYMENT_TOLERANCE,
  type GeneratePlanInput,
} from "../schemas/order.schema";
import { useGeneratePlanMutation } from "../hooks/useOrderMutations";
import type { OrderDetail } from "../types/order.types";
import type { PlanRow } from "../types/order.types";

export type PaymentPlanBuilderProps = {
  order: OrderDetail;
};

type Mode = "preset" | "custom";

type BuilderForm = {
  pre: string;
  preMode: "pct" | "amt";
  preAmt: string;
  rest: "cash" | "cheque" | "credit";
  n: string;
  gap: "15d" | "1m" | "2m" | "3m";
  first: "1m" | "2m" | "3m";
};

const DEFAULT_BUILDER: BuilderForm = {
  pre: "30",
  preMode: "pct",
  preAmt: "0",
  rest: "cheque",
  n: "3",
  gap: "1m",
  first: "1m",
};

/** نمایش تاریخ سررسید `YYYY/MM/DD` ASCII به فارسی. */
function dueFa(due: string | null): string {
  return due === null ? "—" : due;
}

/**
 * مولد برنامه پرداخت — در مرحله‌ی مالی (۵) برای قطعی‌سازی استفاده
 * می‌شود، اما در هر مرحله قابل مشاهد است تا کارشناس شرایط را توضیح دهد.
 */
export function PaymentPlanBuilder({ order }: PaymentPlanBuilderProps) {
  const [mode, setMode] = useState<Mode>("preset");
  const [preset, setPreset] = useState(
    order.preset?.length ? order.preset : (PAYMENT_PRESETS[0]?.key ?? ""),
  );
  const [builder, setBuilder] = useState<BuilderForm>(DEFAULT_BUILDER);
  const [fields, setFields] = useState<Record<string, string>>({});

  const generate = useGeneratePlanMutation();
  const total = order.calc.total;
  const plan = generate.data;
  const sum = plan?.sum ?? 0;
  const diff = total - sum;
  const balanced = Math.abs(diff) < PAYMENT_TOLERANCE;

  const buildInput = (): GeneratePlanInput | null => {
    setFields({});
    if (mode === "preset") {
      const parsed = generatePlanSchema.safeParse({ preset }, { error: faErrorMap as never });
      return parsed.success ? parsed.data : null;
    }
    const payload: GeneratePlanInput = {
      builder: {
        pre: Number(builder.pre),
        preMode: builder.preMode,
        preAmt: Number(builder.preAmt),
        rest: builder.rest,
        n: Number(builder.n),
        gap: builder.gap,
        first: builder.first,
      },
    };
    const parsed = generatePlanSchema.safeParse(payload, { error: faErrorMap as never });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_";
        if (!out[key]) out[key] = issue.message || "مقدار نامعتبر است.";
      }
      setFields(out);
      return null;
    }
    return parsed.data;
  };

  const handleGenerate = (e: React.FormEvent): void => {
    e.preventDefault();
    const input = buildInput();
    if (input === null) return;
    generate.mutate({ id: order.id, data: input });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="h3">برنامه پرداخت</h2>
          <p className="field-hint">
            مبلغ نهایی: <span dir="ltr">{formatMoney(total)} ریال</span>
          </p>
        </div>

        <form className="stack gap-3" onSubmit={handleGenerate} noValidate>
          <div className="flex flex-wrap gap-4">
            <label className="flex gap-2 items-center">
              <input
                type="radio"
                name="plan-mode"
                checked={mode === "preset"}
                onChange={() => setMode("preset")}
              />
              <span>پیش‌تنظیم</span>
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="radio"
                name="plan-mode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
              />
              <span>دلخواه</span>
            </label>
          </div>

          {mode === "preset" ? (
            <div className="field">
              <label className="field-label" htmlFor="plan-preset">
                پیش‌تنظیم برنامه پرداخت
              </label>
              <select
                id="plan-preset"
                className="select"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                {PAYMENT_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="field">
                <label className="field-label" htmlFor="plan-premode">
                  پیش‌پرداخت
                </label>
                <select
                  id="plan-premode"
                  className="select"
                  value={builder.preMode}
                  onChange={(e) =>
                    setBuilder((b) => ({ ...b, preMode: e.target.value as "pct" | "amt" }))
                  }
                >
                  <option value="pct">درصدی</option>
                  <option value="amt">مبلغ ثابت</option>
                </select>
              </div>
              {builder.preMode === "pct" ? (
                <div className="field">
                  <label className="field-label" htmlFor="plan-pre">
                    درصد پیش‌پرداخت
                  </label>
                  <input
                    id="plan-pre"
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={builder.pre}
                    onChange={(e) => setBuilder((b) => ({ ...b, pre: e.target.value }))}
                    dir="ltr"
                  />
                  {fields["builder.pre"] ? (
                    <p className="field-error" role="alert">
                      {fields["builder.pre"]}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="field">
                  <label className="field-label" htmlFor="plan-preamt">
                    مبلغ پیش‌پرداخت (ریال)
                  </label>
                  <input
                    id="plan-preamt"
                    className="input"
                    type="number"
                    min={1}
                    step={100000}
                    value={builder.preAmt}
                    onChange={(e) => setBuilder((b) => ({ ...b, preAmt: e.target.value }))}
                    dir="ltr"
                  />
                  {fields["builder.preAmt"] ? (
                    <p className="field-error" role="alert">
                      {fields["builder.preAmt"]}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="field">
                <label className="field-label" htmlFor="plan-rest">
                  تسویه باقی‌مانده
                </label>
                <select
                  id="plan-rest"
                  className="select"
                  value={builder.rest}
                  onChange={(e) =>
                    setBuilder((b) => ({ ...b, rest: e.target.value as BuilderForm["rest"] }))
                  }
                >
                  <option value="cash">نقد</option>
                  <option value="cheque">چک صیادی</option>
                  <option value="credit">اعتباری (بعداً)</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="plan-n">
                  تعداد چک
                </label>
                <input
                  id="plan-n"
                  className="input"
                  type="number"
                  min={1}
                  max={12}
                  value={builder.n}
                  onChange={(e) => setBuilder((b) => ({ ...b, n: e.target.value }))}
                  dir="ltr"
                />
                {fields["builder.n"] ? (
                  <p className="field-error" role="alert">
                    {fields["builder.n"]}
                  </p>
                ) : null}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="plan-gap">
                  فاصله سررسیدها
                </label>
                <select
                  id="plan-gap"
                  className="select"
                  value={builder.gap}
                  onChange={(e) =>
                    setBuilder((b) => ({ ...b, gap: e.target.value as BuilderForm["gap"] }))
                  }
                >
                  {PLAN_GAPS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="plan-first">
                  شروع سررسید
                </label>
                <select
                  id="plan-first"
                  className="select"
                  value={builder.first}
                  onChange={(e) =>
                    setBuilder((b) => ({ ...b, first: e.target.value as BuilderForm["first"] }))
                  }
                >
                  {PLAN_FIRST.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <Button type="submit" variant="ghost" isLoading={generate.isPending}>
              محاسبه برنامه
            </Button>
            {generate.error ? (
              <p className="field-error" role="alert">
                {generate.error.message}
              </p>
            ) : null}
          </div>
        </form>

        {plan ? (
          <div className="flex flex-col gap-3">
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>ردیف‌های برنامه پرداخت پیشنهادی</caption>
                <thead>
                  <tr>
                    <th scope="col">ردیف</th>
                    <th scope="col">نوع</th>
                    <th scope="col">مبلغ</th>
                    <th scope="col">سررسید</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((row: PlanRow, i: number) => (
                    <tr key={`${row.kind}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{PAYMENT_KIND_LABELS[row.kind]}</td>
                      <td>
                        <span dir="ltr">{formatMoney(row.amount)} ریال</span>
                      </td>
                      <td>
                        <span dir="ltr">{dueFa(row.due)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2}>
                      جمع برنامه
                    </th>
                    <td>
                      <span dir="ltr">{formatMoney(sum)} ریال</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <p
              className="tag-chip"
              data-tone={balanced ? "success" : "warning"}
              role="status"
              aria-live="polite"
            >
              {balanced
                ? `برنامه با مبلغ نهایی تسویه است (اختلاف کمتر از ${formatMoney(PAYMENT_TOLERANCE)} ریال).`
                : `اختلاف برنامه با مبلغ نهایی: ${formatMoney(Math.abs(diff))} ریال — قطعی‌سازی ممکن نیست.`}
            </p>
            <p className="field-hint">
              این برنامه پیشنهادی است و ذخیره نمی‌شود؛ هنگام قطعی‌سازی دوباره با
              پارامترهای همان لحظه تولید و به پرداخت/چک تبدیل می‌شود.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
