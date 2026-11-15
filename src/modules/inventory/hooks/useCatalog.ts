/**
 * hookهای کاتالوگ محصولات/مواد — فقط‌خواندن، برای فرم‌ها (PHASE_05 §۱۰).
 *
 * داده‌های BOM و موجودی مواد از سرور می‌آیند تا کلاینت پیش‌نمایش زنده
 * کسری را همانند Demo محاسبه کند (app/prod.js:111 — bomNeed در کلاینت).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";

/** یک خط BOM محصول — مطابق `bom` در پاسخ /api/catalog/products. */
export type CatalogBomItem = {
  materialId: string;
  qty: number;
};

/** محصول کاتالوگ — قیمت فقط برای نقش‌های دارای money.view (R-32). */
export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  line: string;
  category: string;
  unit: string;
  days: number;
  colors: unknown;
  bom: CatalogBomItem[];
  price?: number;
};

/** ماده اولیه کاتالوگ — قیمت فقط برای نقش‌های دارای money.view (R-32). */
export type CatalogMaterial = {
  id: string;
  code: string;
  name: string;
  unit: string;
  min: number;
  onHand: number;
  price?: number;
};

/** GET /api/catalog/products — محصولات فعال با BOM. */
export function useCatalogProductsQuery() {
  return useQuery<{ items: CatalogProduct[] }, ApiError>({
    queryKey: queryKeys.catalog.products(),
    queryFn: () => apiFetch<{ items: CatalogProduct[] }>("/api/catalog/products"),
  });
}

/** GET /api/catalog/materials — مواد با موجودی انبار raw. */
export function useCatalogMaterialsQuery() {
  return useQuery<{ items: CatalogMaterial[] }, ApiError>({
    queryKey: queryKeys.catalog.materials(),
    queryFn: () => apiFetch<{ items: CatalogMaterial[] }>("/api/catalog/materials"),
  });
}
