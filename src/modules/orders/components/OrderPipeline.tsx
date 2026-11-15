/**
 * OrderPipeline — خط لوله ۱۱ مرحله‌ای سفارش (PHASE_04 §۱۰).
 *
 * مراحل originates از Demo `app/core.js` STAGES هستند. مرحله‌ی فعلی
 * برجسته می‌شود، مراحل طی‌شده نشانگر ✓ می‌گیرند و مراحل پرش‌شده
 * (۶/۷/۸ هنگام قطعی‌سازی از موجودی — order.js:470-471) خط‌خورده نشان
 * داده می‌شوند. زیر md خط لوله به لیست عمودی تبدیل می‌شود (CD-12).
 */
"use client";

import { ORDER_STAGES, STAGE_GROUP_LABELS } from "../constants/orderStage";
import type { OrderStageKey } from "../constants/orderStage";
import type { OrderStatus } from "../constants/orderMeta";
import { ORDER_STATUS_LABELS } from "../constants/orderMeta";
import { toFaDigits } from "@core/formatting";

export type OrderPipelineProps = {
  /** شماره مرحله‌ی فعلی (۱..۱۱). */
  stage: number;
  stageKey: OrderStageKey;
  status: OrderStatus;
  /** مراحل پرش‌شده — معمولاً ۶/۷/۸. */
  skipped: number[];
};

type StepState = "done" | "current" | "todo" | "skipped";

/**
 * وضعیت نمایشی هر مرحله:
 *  - سفارش بسته‌شده → همه‌ی مراحل انجام‌شده.
 *  - مرحله‌ی پرش‌شده → خط‌خورده (حتی اگر از آن عبور کرده‌ایم).
 *  - مراحل قبل از مرحله‌ی فعلی → انجام‌شده.
 */
function stepState(step: number, stage: number, status: OrderStatus, skipped: number[]): StepState {
  if (skipped.includes(step)) return "skipped";
  if (status === "done") return "done";
  if (step < stage) return "done";
  if (step === stage && status === "open") return "current";
  return "todo";
}

/** برچسب نقش مسئول مرحله (core.js:156-168). */
const WHO_LABELS: Readonly<Record<string, string>> = {
  sales: "کارشناس فروش",
  salesManager: "مدیر فروش",
  management: "مدیر",
  finance: "مالی",
  production: "تولید",
  depot: "انبار",
};

/**
 * نمایش خط لوله — روی md نوار افقی با ۱۱ نقطه، زیر md لیست عمودی.
 * رنگ هر مرحله از توکن گروه معنایی آن می‌آید (Q-09 — بدون رنگ hardcoded).
 */
export function OrderPipeline({ stage, stageKey, status, skipped }: OrderPipelineProps) {
  const current = ORDER_STAGES.find((s) => s.key === stageKey);

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="stage-chip" data-stage-group={current?.group}>
          {toFaDigits(stage)} — {current?.label}
        </span>
        <span
          className="tag-chip"
          data-tone={status === "done" ? "success" : status === "cancelled" ? "danger" : "info"}
        >
          {ORDER_STATUS_LABELS[status]}
        </span>
        {skipped.length > 0 ? (
          <span className="tag-chip" data-tone="warning">
            مراحل پرش‌شده: {skipped.map((s) => toFaDigits(s)).join("، ")}
          </span>
        ) : null}
      </div>

      <div className="pipeline-row">
        {ORDER_STAGES.map((s) => {
          const state = stepState(s.step, stage, status, skipped);
          return (
            <div
              key={s.key}
              className="pipeline-step"
              data-step={toFaDigits(s.step)}
              data-state={state}
              data-stage-group={s.group}
              title={`${s.label} — ${STAGE_GROUP_LABELS[s.group]} (${WHO_LABELS[s.who]})`}
            >
              <span className="pipeline-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      <ul className="pipeline-list">
        {ORDER_STAGES.map((s) => {
          const state = stepState(s.step, stage, status, skipped);
          return (
            <li
              key={s.key}
              className="pipeline-row-item"
              data-state={state}
              data-stage-group={s.group}
            >
              <span className="pipeline-marker">{state === "done" ? "✓" : toFaDigits(s.step)}</span>
              <span className="flex flex-col">
                <span className="pipeline-label">{s.label}</span>
                <span className="pipeline-who">{WHO_LABELS[s.who]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
