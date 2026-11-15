/**
 * واحدهای شمارش کاتالوگ — منبع: app/admin.js:37 (محصولات) و admin.js:60 (مواد).
 *
 * فهرست ثابت گزینه‌های select در Demo — هیچ واحد جدیدی اضافه نمی‌شود.
 */
export const PRODUCT_UNITS = [
  "مترمربع",
  "مترطول",
  "عدد",
  "شاخه",
  "بسته",
  "کیلو",
] as const;

export const MATERIAL_UNITS = [
  "کیلو",
  "گرم",
  "لیتر",
  "مترمربع",
  "عدد",
  "کیسه",
] as const;

/** خط محصول — منبع: app/admin.js:36 («تولید خودمان» / «نمایندگی»). */
export const PRODUCT_LINES = ["prod", "agency"] as const;

export type ProductLine = (typeof PRODUCT_LINES)[number];

export const PRODUCT_LINE_LABELS: Readonly<Record<ProductLine, string>> = {
  prod: "تولید خودمان",
  agency: "نمایندگی",
};
