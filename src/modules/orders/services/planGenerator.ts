/**
 * مولد برنامه پرداخت — پیاده‌سازی pure از genPlan در Demo (order.js:118-132).
 *
 * قانون Demo:
 *  - پیش‌پرداخت درصدی از کل، گردشده به ۱۰۰٬۰۰۰ (rnd — order.js:116).
 *  - باقی‌مانده به چند چک با سررسیدهای متوالی (step = addJMonths) تقسیم
 *    می‌شود؛ هر قیمتی گردشده به ۱۰۰٬۰۰۰.
 *  - `first` سررسید چک اول و `gap` فاصله بین چک‌ها را تعیین می‌کند.
 *  - اگر باقی‌مانده صفر باشد، هیچ چکی تولید نمی‌شود.
 *
 * این تابع **stateless** است: چیزی ذخیره نمی‌کند و فقط بر اساس پارامترها
 * و `total` محاسبه می‌شود (PHASE_04 §۳.۵). نتیجه در زمان finalize به
 * payments/cheques تبدیل (materialize) می‌شود.
 */
import { addDays, addMonths, formatJalaliIso, instantToJalali, startOfToday } from "@core/calendar";
import { roundToStep } from "@core/formatting";
import { PAYMENT_PRESETS, type PaymentPreset } from "../constants";
import type { PlanRow, PlanResult } from "../types/order.types";

/** پارامترهای مولد — ساختار planBuilder ذخیره‌شده روی سفارش. */
export type PlanParams = {
  /** درصد پیش‌پرداخت ۰..۱۰۰. */
  pre: number;
  preMode: "pct" | "amt";
  /** مبلغ ثابت پیش‌پرداخت — فقط وقتی preMode = "amt". */
  preAmt: number;
  rest: "cash" | "cheque" | "credit";
  n: number;
  gap: "15d" | "1m" | "2m" | "3m";
  first: "1m" | "2m" | "3m";
};

/** تبدیل یک preset ثابت به پارامترهای مولد (PRESETS — order.js:109-114). */
export function presetToParams(preset: PaymentPreset): PlanParams {
  return {
    pre: preset.pre,
    preMode: "pct",
    preAmt: 0,
    rest: preset.rest,
    n: preset.n,
    gap: preset.gap,
    first: preset.first,
  };
}

/** گام افزایش سررسید به روز — GAP keys (order.js:115). */
function gapDays(gap: PlanParams["gap"]): number {
  switch (gap) {
    case "15d":
      return 15;
    case "1m":
      return 30;
    case "2m":
      return 60;
    case "3m":
      return 90;
  }
}

/** شروع سررسید چک اول به ماه — FIRST keys (order.js:115). */
function firstMonths(first: PlanParams["first"]): number {
  switch (first) {
    case "1m":
      return 1;
    case "2m":
      return 2;
    case "3m":
      return 3;
  }
}

/**
 * تولید برنامه پرداخت.
 *
 *   const plan = generatePlan(presetToParams(PAYMENT_PRESETS[0]), 1_000_000);
 *
 * `now` برای تست‌پذیری تزریق می‌شود (پیش‌فرض: الان).
 */
export function generatePlan(params: PlanParams, total: number, now: number = Date.now()): PlanResult {
  const rows: PlanRow[] = [];
  const base = instantToJalali(startOfToday(now));
  let remaining = total;

  // ۱) پیش‌پرداخت — درصدی یا مبلغ ثابت، گردشده به ۱۰۰٬۰۰۰ (rnd — order.js:116).
  // pre ≥ ۱۰۰ یعنی کل مبلغ بی‌درنگ (order.js:121: pb.pre >= 100 ? T : rnd(...)).
  const preAmount =
    params.preMode === "amt"
      ? Math.min(roundToStep(params.preAmt), total)
      : params.pre >= 100
        ? total
        : roundToStep((total * clampPct(params.pre)) / 100);

  if (preAmount > 0) {
    rows.push({
      kind: "cash",
      amount: preAmount,
      due: formatJalaliIso(addDays(base, 0)),
      label: "پیش‌پرداخت",
    });
    remaining = total - preAmount;
  }

  // ۲) باقی‌مانده — چک، اعتبار یا نقد.
  if (remaining > 0) {
    if (params.rest === "credit") {
      rows.push({
        kind: "credit",
        amount: remaining,
        due: null,
        label: "اعتباری (بعداً)",
      });
    } else if (params.rest === "cash") {
      rows.push({
        kind: "cash",
        amount: remaining,
        due: formatJalaliIso(addDays(base, gapDays(params.gap))),
        label: "تسویه نقدی",
      });
    } else {
      const n = Math.max(1, params.n);
      const start = addMonths(base, firstMonths(params.first));
      const step = gapDays(params.gap);
      // تقسیم مساوی (هر چک ceil می‌شود تا روی مرز ۱۰۰٬۰۰۰ گرد شود).
      // ردیف آخر اختلاف گردکردن را جبران می‌کند — دقیقاً مثل Demo
      // (order.js:126: amount = i === n-1 ? rest - each*(n-1) : each)؛
      // بنابراین جمع برنامه همیشه با باقی‌مانده برابر است، حتی اگر مبالغ
      // چک‌ها با گردکردن به صفر برسند.
      const per = roundToStep(remaining / n);
      let assigned = 0;
      for (let i = 0; i < n; i++) {
        const isLast = i === n - 1;
        const amount = isLast ? remaining - assigned : per;
        rows.push({
          kind: "cheque",
          amount,
          due: formatJalaliIso(addDays(start, i * step)),
          label: `چک ${toFa(i + 1)} از ${toFa(n)}`,
        });
        assigned += amount;
      }
    }
  }

  return {
    preset: "",
    rows,
    sum: rows.reduce((acc, r) => acc + r.amount, 0),
  };
}

/** تولید برنامه با پیش‌تنظیم ثابت — برچسب preset در نتیجه قرار می‌گیرد. */
export function generatePlanFromPreset(key: string, total: number, now: number = Date.now()): PlanResult {
  const preset = PAYMENT_PRESETS.find((p) => p.key === key);
  if (!preset) {
    return { preset: key, rows: [], sum: 0 };
  }
  const result = generatePlan(presetToParams(preset), total, now);
  return { ...result, preset: key };
}

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

function toFa(n: number): string {
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  return String(n).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
