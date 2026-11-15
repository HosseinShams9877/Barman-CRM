/**
 * تست‌های واحد مولد برنامه پرداخت (PHASE_04 §۱۲).
 *
 * پوشش:
 *  - پیش‌تنظیم‌ها (PAYMENT_PRESETS — order.js:109-114)
 *  - گام‌های سررسید (GAPS — 15d=15، 1m=30، 2m=60، 3m=90 روز)
 *  - گردکردن مبالغ به ۱۰۰٬۰۰۰ (rnd — order.js:116)
 *  - ردیف آخر جبرانی (جمع ردیف‌ها = مبلغ باقی‌مانده)
 *  - جمع کل برنامه = مبلغ نهایی (تلورانس ۱ ریال — order.js:147)
 *  - حالت‌های credit/cash/cheque باقی‌مانده
 *  - `now` تزریق‌شده برای قابل‌تکرار بودن سررسیدها
 */
import { describe, expect, it } from "vitest";
import {
  generatePlan,
  generatePlanFromPreset,
  presetToParams,
  type PlanParams,
} from "./planGenerator";
import { PAYMENT_PRESETS } from "../constants";
import { diffDays, parseJalali, addMonths, instantToJalali, startOfToday } from "@core/calendar";

/** مبلغ نامتناسب با ۱۰۰٬۰۰۰ برای بررسی گردکردن. */
const TOTAL = 9_876_543;
/** تاریخ مرجع ثابت برای تست‌ها — ۱۴۰۵/۰۸/۱۲ (UTC+۳:۳۰). */
const NOW = 1_758_000_000_000;

const params = (patch: Partial<PlanParams>): PlanParams => ({
  pre: 0,
  preMode: "pct",
  preAmt: 0,
  rest: "cheque",
  n: 1,
  gap: "1m",
  first: "1m",
  ...patch,
});

/** اختلاف دو تاریخ `YYYY/MM/DD` به روز — با JDN مستقل از مولد. */
function dueDiffDays(a: string, b: string): number {
  const pa = parseJalali(a);
  const pb = parseJalali(b);
  if (pa === null || pb === null) throw new Error(`تاریخ نامعتبر در تست: ${a} / ${b}`);
  return diffDays(pa, pb);
}

describe("generatePlan — پیش‌تنظیم‌ها (PRESETS)", () => {
  it("full: کل مبلغ به‌صورت یک ردیف نقد (پیش‌پرداخت ۱۰۰٪)", () => {
    const plan = generatePlanFromPreset("full", 10_000_000, NOW);
    expect(plan.preset).toBe("full");
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.kind).toBe("cash");
    expect(plan.rows[0]?.amount).toBe(10_000_000);
    expect(plan.sum).toBe(10_000_000);
  });

  it("half: نصف نقد + نصف چک با جمع برابر کل", () => {
    const plan = generatePlanFromPreset("half", 10_000_000, NOW);
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]?.kind).toBe("cash");
    expect(plan.rows[0]?.amount).toBe(5_000_000);
    expect(plan.rows[1]?.kind).toBe("cheque");
    expect(plan.rows[1]?.amount).toBe(5_000_000);
    expect(plan.sum).toBe(10_000_000);
  });

  it("3chx: پیش‌پرداخت ۳۰٪ + ۳ چک با جمع برابر کل", () => {
    const plan = generatePlanFromPreset("3chq", 10_000_000, NOW);
    expect(plan.rows).toHaveLength(4);
    expect(plan.rows[0]?.kind).toBe("cash");
    expect(plan.rows[0]?.amount).toBe(3_000_000);
    const cheques = plan.rows.slice(1);
    expect(cheques.every((r) => r.kind === "cheque")).toBe(true);
    expect(plan.sum).toBe(10_000_000);
    expect(plan.sum - 3_000_000).toBe(7_000_000);
  });

  it("deliv: نصف الان + نصف اعتباری با سررسید null", () => {
    const plan = generatePlanFromPreset("deliv", 10_000_000, NOW);
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]?.kind).toBe("cash");
    expect(plan.rows[1]?.kind).toBe("credit");
    expect(plan.rows[1]?.due).toBeNull();
    expect(plan.sum).toBe(10_000_000);
  });

  it("هر preset معادل پارامترهای خودش عمل می‌کند (presetToParams)", () => {
    for (const preset of PAYMENT_PRESETS) {
      const fromPreset = generatePlanFromPreset(preset.key, TOTAL, NOW);
      const fromParams = generatePlan(presetToParams(preset), TOTAL, NOW);
      expect(fromParams.rows).toEqual(fromPreset.rows);
      expect(fromParams.sum).toBe(fromPreset.sum);
    }
  });

  it("کلید پیش‌تنظیم ناشناخته → برنامه خالی", () => {
    const plan = generatePlanFromPreset("nope", 10_000_000, NOW);
    expect(plan.preset).toBe("nope");
    expect(plan.rows).toEqual([]);
    expect(plan.sum).toBe(0);
  });
});

describe("generatePlan — گردکردن به ۱۰۰٬۰۰۰ (rnd — order.js:116)", () => {
  it("پیش‌پرداخت درصدی گرد می‌شود", () => {
    const plan = generatePlan(params({ pre: 30 }), TOTAL, NOW);
    // ۳۰٪ از ۹٬۸۷۶٬۵۴۳ = ۲٬۹۶۲٬۹۶۲٫۹ → گرد به ۳٬۰۰۰٬۰۰۰
    expect(plan.rows[0]?.amount).toBe(3_000_000);
  });

  it("پیش‌پرداخت مبلغ ثابت گرد می‌شود و از کل بیشتر نمی‌شود", () => {
    const plan = generatePlan(params({ preMode: "amt", preAmt: 2_123_456 }), TOTAL, NOW);
    expect(plan.rows[0]?.amount).toBe(2_100_000);
    const capped = generatePlan(params({ preMode: "amt", preAmt: 99_000_000 }), TOTAL, NOW);
    expect(capped.rows[0]?.amount).toBe(TOTAL);
  });

  it("هر چک (به‌جز آخر) گرد می‌شود و ردیف آخر اختلاف را جبران می‌کند", () => {
    const plan = generatePlan(
      params({ pre: 0, rest: "cheque", n: 3, gap: "1m", first: "1m" }),
      10_000_001,
      NOW,
    );
    const cheques = plan.rows.filter((r) => r.kind === "cheque");
    expect(cheques).toHaveLength(3);
    // per = roundToStep(10_000_001 / 3) = roundToStep(3_333_333٫۶۷) = 3_300_000
    expect(cheques[0]?.amount).toBe(3_300_000);
    expect(cheques[1]?.amount).toBe(3_300_000);
    // ردیف آخر = remaining − assigned → جمع دقیقاً باقی‌مانده
    expect(cheques[2]?.amount).toBe(10_000_001 - 3_300_000 - 3_300_000);
    expect(cheques[2]?.amount).not.toBe(3_300_000);
  });

  it("جمع برنامه با مبلغ نهایی تلورانس ≤۱ ریال دارد", () => {
    for (const total of [1, 999, 123_456, 9_876_543, 10_000_001]) {
      for (const preset of PAYMENT_PRESETS) {
        const plan = generatePlanFromPreset(preset.key, total, NOW);
        expect(Math.abs(plan.sum - total)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("generatePlan — سررسیدها (GAPS / FIRST)", () => {
  it("gap=15d: فاصله سررسیدها ۱۵ روز است", () => {
    const plan = generatePlan(
      params({ pre: 0, rest: "cheque", n: 3, gap: "15d", first: "1m" }),
      9_000_000,
      NOW,
    );
    const dues = plan.rows.map((r) => r.due);
    expect(dues[1]).not.toBeNull();
    expect(Math.abs(dueDiffDays(dues[1] as string, dues[0] as string))).toBe(15);
    expect(Math.abs(dueDiffDays(dues[2] as string, dues[0] as string))).toBe(30);
  });

  it("gap=1m (۳۰ روز): فاصله سررسیدها ۳۰ روز است", () => {
    const plan = generatePlan(
      params({ pre: 0, rest: "cheque", n: 3, gap: "1m", first: "1m" }),
      9_000_000,
      NOW,
    );
    const dues = plan.rows.map((r) => r.due);
    expect(Math.abs(dueDiffDays(dues[1] as string, dues[0] as string))).toBe(30);
    expect(Math.abs(dueDiffDays(dues[2] as string, dues[0] as string))).toBe(60);
  });

  it("gap=2m (۶۰ روز) و gap=3m (۹۰ روز)", () => {
    const g2 = generatePlan(params({ pre: 0, rest: "cheque", n: 2, gap: "2m" }), 6_000_000, NOW);
    const d2 = g2.rows.map((r) => r.due);
    expect(Math.abs(dueDiffDays(d2[1] as string, d2[0] as string))).toBe(60);

    const g3 = generatePlan(params({ pre: 0, rest: "cheque", n: 2, gap: "3m" }), 6_000_000, NOW);
    const d3 = g3.rows.map((r) => r.due);
    expect(Math.abs(dueDiffDays(d3[1] as string, d3[0] as string))).toBe(90);
  });

  it("first: سررسید چک اول از ماه N شروع می‌شود (نسبت به امروز)", () => {
    const base = instantToJalali(startOfToday(NOW));
    const plan = generatePlan(
      params({ pre: 0, rest: "cheque", n: 1, gap: "1m", first: "2m" }),
      5_000_000,
      NOW,
    );
    // first=2m → addMonths(base, 2)؛ مستقل با parseJalali بررسی می‌شود
    const expected = `${addMonths(base, 2).jy}/${String(addMonths(base, 2).jm).padStart(2, "0")}/${String(addMonths(base, 2).jd).padStart(2, "0")}`;
    expect(plan.rows[0]?.due).toBe(expected);
  });

  it("pre=0: هیچ ردیف پیش‌پرداختی تولید نمی‌شود", () => {
    const plan = generatePlan(params({ pre: 0, rest: "cash" }), 5_000_000, NOW);
    expect(plan.rows.every((r) => r.label !== "پیش‌پرداخت")).toBe(true);
    expect(plan.rows).toHaveLength(1);
  });
});

describe("generatePlan — حالت‌های باقی‌مانده", () => {
  it("rest=cash: یک ردیف نقد با سررسید فاصله gap از امروز", () => {
    const plan = generatePlan(params({ pre: 0, rest: "cash", gap: "1m" }), 5_000_000, NOW);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.kind).toBe("cash");
    expect(plan.rows[0]?.amount).toBe(5_000_000);
    expect(plan.rows[0]?.due).not.toBeNull();
  });

  it("rest=credit: یک ردیف اعتباری با سررسید null", () => {
    const plan = generatePlan(params({ pre: 50, rest: "credit" }), 10_000_000, NOW);
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[1]?.kind).toBe("credit");
    expect(plan.rows[1]?.due).toBeNull();
    expect(plan.rows[1]?.amount).toBe(5_000_000);
  });

  it("pre=100: باقی‌مانده صفر → هیچ ردیف cheques/credit اضافه نمی‌شود", () => {
    const plan = generatePlan(params({ pre: 100, rest: "cheque", n: 5 }), 4_000_000, NOW);
    expect(plan.rows).toHaveLength(1);
    expect(plan.sum).toBe(4_000_000);
  });

  it("n کوچک‌تر از ۱ حداقل ۱ چک تولید می‌کند", () => {
    const plan = generatePlan(params({ pre: 0, rest: "cheque", n: 0 }), 3_000_000, NOW);
    const cheques = plan.rows.filter((r) => r.kind === "cheque");
    expect(cheques).toHaveLength(1);
    expect(cheques[0]?.amount).toBe(3_000_000);
  });

  it("ردیف‌های چک برچسب ترتیبی فارسی دارند", () => {
    const plan = generatePlanFromPreset("3chq", 10_000_000, NOW);
    const cheques = plan.rows.filter((r) => r.kind === "cheque");
    expect(cheques.map((r) => r.label)).toEqual(["چک ۱ از ۳", "چک ۲ از ۳", "چک ۳ از ۳"]);
  });
});
