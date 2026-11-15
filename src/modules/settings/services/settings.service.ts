/**
 * سرویس تنظیمات — دسترسی فقط‌خواندنی به ردیف Singleton تنظیمات (PHASE_02 §۶).
 *
 * Demo: `settings()` با پیش‌فرض‌های `{ vat: 10, validDays: 3, rate: 3,
 * discountCap: { sales: 3, salesManager: 8, management: 100, finance: 0 },
 * company: {...} }` (app/core.js:194).
 *
 * `rate` (Q-01) عمداً بی‌استفاده باقی می‌ماند — معوق است و نباید منطقی
 * روی آن ساخته شود.
 */
import { prisma } from "@core/database/client";
import type { Role } from "@core/permissions";

/** اطلاعات شرکت برای چاپ پیش‌فاکتور (Demo: settings.company). */
export type CompanyInfo = {
  name: string;
  en: string;
  tagline: string;
  phone: string;
  address: string;
  bale: string;
};

/**
 * سقف تخفیف به تفکیک نقش (CD-25 — سه حالت):
 *  - کل ستون `null` (JSON null) → **نامحدود** برای همه نقش‌ها.
 *  - کلید نقش با مقدار `null` → نامحدود برای آن نقش.
 *  - کلید نقش با مقدار `۰` → **بدون تخفیف** (هر درصد > ۰ رد می‌شود).
 *  - کلید نقش با مقدار `n > 0` → سقف درصد تخفیف.
 *  - نبود کلید نقش → معادل ۰ (Demo: `(S.discountCap||{})[R] != null ? … : 0`
 *    در app/order.js:143).
 *
 * مقادیر منفی نامعتبرند و در سرویس سفارش رد می‌شوند.
 */
export type DiscountCapMap = Partial<Record<Role, number | null>>;

export type Settings = {
  /** درصد مالیات بر ارزش افزوده (core.js:194). */
  vat: number;
  /** اعتبار پیش‌فاکتور به روز (core.js:194). */
  validDays: number;
  /** ضریب دستمزد — Q-01 معوق؛ خوانده می‌شود ولی استفاده نمی‌شود. */
  rate: number;
  discountCap: DiscountCapMap | null;
  company: CompanyInfo;
};

/** پیش‌فرض‌های Demo در صورت نبود ردیف تنظیمات (app/core.js:194). */
export const DEFAULT_SETTINGS: Settings = {
  vat: 10,
  validDays: 3,
  rate: 3,
  // admin هم‌سطح management است (PERMISSION_MATRIX فاز ۲: admin = ALL).
  discountCap: { admin: 100, sales: 3, salesManager: 8, management: 100, finance: 0 },
  company: {
    name: "بارمان",
    en: "BARMAN 3D WORKS",
    tagline: "تولیدکننده انواع دیوارپوش سه‌بعدی",
    phone: "۰۲۱-۴۴۰۰۰۰۰۰",
    address: "تهران، شهرک صنعتی",
    bale: "ble.ir/Barman3Dworks",
  },
};

/** خواندن ردیف تنظیمات — در صورت نبود، پیش‌فرض‌های Demo برمی‌گردد. */
export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { id: 0 } });
  if (!row) return DEFAULT_SETTINGS;
  return {
    vat: row.vat,
    validDays: row.validDays,
    rate: row.rate,
    discountCap: normalizeCap(row.discountCap),
    company: normalizeCompany(row.company),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeCap(raw: unknown): DiscountCapMap | null {
  // JSON null در ستون → سقف نامحدود (CD-25 حالت اول).
  if (raw === null) return null;
  if (!isRecord(raw)) return DEFAULT_SETTINGS.discountCap;
  const out: DiscountCapMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null) {
      out[key as Role] = null;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key as Role] = value;
    }
  }
  return out;
}

function normalizeCompany(raw: unknown): CompanyInfo {
  if (!isRecord(raw)) return DEFAULT_SETTINGS.company;
  return {
    name: typeof raw["name"] === "string" ? raw["name"] : DEFAULT_SETTINGS.company.name,
    en: typeof raw["en"] === "string" ? raw["en"] : DEFAULT_SETTINGS.company.en,
    tagline: typeof raw["tagline"] === "string" ? raw["tagline"] : DEFAULT_SETTINGS.company.tagline,
    phone: typeof raw["phone"] === "string" ? raw["phone"] : DEFAULT_SETTINGS.company.phone,
    address: typeof raw["address"] === "string" ? raw["address"] : DEFAULT_SETTINGS.company.address,
    bale: typeof raw["bale"] === "string" ? raw["bale"] : DEFAULT_SETTINGS.company.bale,
  };
}
