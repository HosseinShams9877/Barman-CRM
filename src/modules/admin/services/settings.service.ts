/**
 * سرویس ذخیره تنظیمات شرکت — PHASE_07 §۵.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - یک ردیف singleton با `id = 0` (PHASE_02).
 *  - `validDays` صفر به ۳ تبدیل می‌شود (admin.js:177).
 *  - سقف تخفیف فقط سه نقش sales/salesManager/management در فرم هستند
 *    (admin.js:145) — بقیه نقش‌ها دست‌نخورده باقی می‌مانند.
 *  - `rate` (Q-01) هرگز از این مسیر تغییر نمی‌کند — معوق است.
 *  - `rev` در هر ذخیره یک واحد افزایش می‌یابد (R-06).
 */
import { prisma } from "@core/database/client";
import { notFound } from "@core/errors";
import type { DiscountCapMap } from "@modules/settings/services/settings.service";
import type { SettingsSaveInput } from "../schemas/admin.schema";

/** نتیجه ذخیره — تنظیمات کامل بعد از ذخیره. */
export type SettingsUpdateResult = {
  vat: number;
  validDays: number;
  discountCap: DiscountCapMap | null;
  company: {
    name: string;
    en: string;
    tagline: string;
    phone: string;
    address: string;
    bale: string;
  };
};

/** ذخیره تنظیمات — فقط فیلدهای فرم (admin.js:176-177). */
export async function saveSettings(input: SettingsSaveInput): Promise<SettingsUpdateResult> {
  const row = await prisma.setting.findUnique({ where: { id: 0 } });
  if (!row) throw notFound("ردیف تنظیمات وجود ندارد — ابتدا seed اجرا کنید.");

  // سقف تخفیف: ادغام ورودی روی نقش‌های سه‌گانه فرم.
  const existing = (row.discountCap ?? {}) as Record<string, number | null>;
  const cap: Record<string, number | null> = { ...existing };
  if (input.discountCap) {
    for (const [k, v] of Object.entries(input.discountCap)) {
      if (v !== undefined) cap[k] = v;
    }
  }

  const updated = await prisma.setting.update({
    where: { id: 0 },
    data: {
      vat: input.vat,
      validDays: input.validDays,
      discountCap: cap,
      company: input.company,
      updatedAt: Date.now(),
      rev: { increment: 1 },
    },
  });

  return {
    vat: updated.vat,
    validDays: updated.validDays,
    discountCap: updated.discountCap as DiscountCapMap | null,
    company: updated.company as SettingsUpdateResult["company"],
  };
}
