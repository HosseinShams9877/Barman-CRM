/**
 * سرویس ستون‌های بورد سرنخ — فاز ۸ (بازگرداندن تب leadcols در /admin).
 *
 * ذخیره‌سازی حداقلی (طبق دستور مالک): یک ردیف `List` با کلید
 * "leadcols" که items آن آرایه‌ای از اشیاء ستون است
 * ({stage, key, label, color}) — بدون تغییر schema یا migration.
 *
 * ثابت‌ها در ./constants/leadcols قرار دارند (بدون وابستگی سرور) تا
 * کامپوننت کلاینت بتواند آن‌ها را بدون کشیدن این سرویس import کند.
 * مقادیر پیش‌فرض — app/lead-core.js COLS0.
 */
import { prisma } from "@core/database/client";
import type { LeadStageKey } from "@modules/leads/constants/STAGE";
import {
  LEADCOLS_DEFAULT_COLOR,
  LEADCOLS_DEFAULTS,
} from "../constants/leadcols";

/** کلید ردیف List برای ستون‌های بورد. */
export const LEADCOLS_LIST_KEY = "leadcols";

export type LeadColumnDef = {
  stage: LeadStageKey;
  /** کلید یکتای ستون در مرحله. */
  key: string;
  /** عنوان فارسی ستون. */
  label: string;
  /** رنگ ستون (hex — از پالت Demo). */
  color: string;
};

/** پیش‌فرض‌های Demo (app/lead-core.js COLS0) — معادل ثابت‌های مشترک. */
export { LEADCOLS_DEFAULTS, LEADCOLS_DEFAULT_COLOR };


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}



/** نرمال‌سازی ذخیره خام → ستون‌های معتبر. */
function normalize(raw: unknown): LeadColumnDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((r) => {
      const stage = String(r["stage"] ?? "");
      const key = String(r["key"] ?? "");
      const label = String(r["label"] ?? "");
      const color = String(r["color"] ?? LEADCOLS_DEFAULT_COLOR);
      if (!stage || !key || !label) return null;
      return { stage, key, label, color } as LeadColumnDef;
    })
    .filter((x): x is LeadColumnDef => x !== null);
}

/**
 * خواندن ستون‌های بورد — در صورت نبود ردیف، پیش‌فرض‌های Demo.
 * نیازی به نوشتن ندارد (GET خالص).
 */
export async function getLeadCols(): Promise<LeadColumnDef[]> {
  const row = await prisma.list.findUnique({ where: { key: LEADCOLS_LIST_KEY } });
  const stored = normalize(row?.items);
  return stored.length > 0 ? stored : [...LEADCOLS_DEFAULTS] as LeadColumnDef[];
}

/** ذخیره ستون‌های بورد — upsert ردیف List. */
export async function saveLeadCols(input: { columns: LeadColumnDef[] }): Promise<LeadColumnDef[]> {
  const columns = input.columns.filter(
    (c) => c.stage && c.key && c.label.length > 0 && c.label.length <= 48,
  );
  await prisma.list.upsert({
    where: { key: LEADCOLS_LIST_KEY },
    create: {
      key: LEADCOLS_LIST_KEY,
      items: columns as unknown as object,
      updatedAt: Date.now(),
      rev: 0,
    },
    update: {
      items: columns as unknown as object,
      updatedAt: Date.now(),
      rev: { increment: 1 },
    },
  });
  return columns;
}
