/**
 * انواع غذای قرارداد تأمین‌کننده — فقط‌خواندن در فاز ۶ (PHASE_06 §۵:
 * «کاتالوگ تأمین‌کنندگان (فاز ۷) — این فاز `suppliers` را فقط می‌خواند»).
 */
import type { Role } from "@core/permissions";

/** نوع تأمین‌کننده — مطابق فاز ۲ (مواد خام / نمایندگی). */
export type SupplierKind = "raw" | "agency";

/** ردیف تأمین‌کننده — بدون هیچ فیلد پولی (کاتالوگ نام/نوع). */
export type SupplierRow = {
  id: string;
  name: string;
  kind: SupplierKind;
};
