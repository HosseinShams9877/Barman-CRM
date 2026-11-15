/**
 * سرویس برنامه پرداخت — genPlan در Demo (order.js:118-132).
 *
 * برنامه پرداخت **محاسبه خالص سمت سرور** است و چیزی ذخیره نمی‌کند
 * (PHASE_04 §۳.۵). نتیجه در زمان تأیید نهایی (finalize) به پرداخت/چک
 * تبدیل می‌شود (doFinalize در order.service).
 *
 * منبع مبلغ کل: محاسبه از اقلام با تنظیمات جاری (CD-29) — هیچ فیلد
 * total ذخیره‌شده‌ای وجود ندارد.
 *
 * بررسی مجوز در Route Handler انجام می‌شود (CD-04 گام ۲) — این سرویس
 * فرض می‌کند فراخوانی مجاز است. مبالغ فقط برای نقش‌های دارای مجوز
 * مشاهده پول معنی دارد (R-32) — تضمین در Route Handler.
 */
import { prisma } from "@core/database/client";
import { notFound } from "@core/errors";
import { getSettings } from "@modules/settings";
import { calcOrder } from "./order.service";
import { generatePlan, generatePlanFromPreset, type PlanParams } from "./planGenerator";
import { PAYMENT_PRESETS, presetLabel } from "../constants";
import { planBuilderSchema, type GeneratePlanInput } from "../schemas/order.schema";
import type { PlanResult } from "../types/order.types";

export type { GeneratePlanInput };

/**
 * تولید برنامه پرداخت پیشنهادی برای یک سفارش.
 *
 *   const plan = await generateOrderPlan("PF-1200", { preset: "full50" });
 *   const plan = await generateOrderPlan("PF-1200", { builder: {...} });
 *
 * اگر نه preset و نه builder داده شود، پیش‌تنظیم پیش‌فرض (اولین گزینه)
 * به‌کار می‌رود — همان رفتار Demo هنگام باز کردن دیالوگ برنامه پرداخت.
 *
 * @throws notFound اگر سفارش وجود نکند.
 */
export async function generateOrderPlan(orderId: string, input: GeneratePlanInput): Promise<PlanResult> {
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!row) throw notFound("سفارش مورد نظر پیدا نشد.");

  const settings = await getSettings();
  const total = calcOrder(row.items, {
    discPct: row.discPct,
    discAmt: row.discAmt,
    ship: row.ship,
    install: row.install,
    noVat: row.noVat,
    vat: settings.vat,
  }).total;

  if (input.preset) {
    return generatePlanFromPreset(input.preset, total);
  }
  if (input.builder) {
    return generatePlan(input.builder satisfies PlanParams, total);
  }
  const fallback = planBuilderSchema.parse({});
  return generatePlan(fallback, total);
}

/** پیش‌تنظیم‌های در دسترس — برای نمایش انتخابگر در UI. */
export function availablePresets() {
  return PAYMENT_PRESETS.map((p) => ({ key: p.key, label: presetLabel(p.key) }));
}
