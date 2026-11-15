/**
 * hookهای ماژول مدیریت — CD-09 (TanStack React Query v5).
 *
 * fetch مستقیم در useEffect ممنوع است (CLAUDE.md §۶) — همه چیز از طریق
 * این hookها و `apiFetch` انجام می‌شود. کلیدهای متمرکز در `core/query`.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { ProductAdminRow, MaterialAdminRow } from "../services/catalog.service";
import type { BomResult } from "../services/bom.service";
import type { AdminUserRow } from "../services/user.service";
import type { ListRow } from "../services/lists.service";
import type { SupplierAdminRow } from "../services/supplier.service";
import type { SettingsUpdateResult } from "../services/settings.service";
import type { Settings } from "@modules/settings/services/settings.service";
import type { z } from "zod";
import type {
  productSaveSchema,
  materialSaveSchema,
  bomSaveSchema,
} from "../schemas/catalog.schema";
import type {
  userCreateSchema,
  userUpdateSchema,
  listsSaveSchema,
  settingsSaveSchema,
  supplierSaveSchema,
} from "../schemas/admin.schema";

/**
 * نوع ورودی فرم — `z.input` چون برخی اسکماها transform دارند
 * (مثلاً colors: string → string[]). سرور تبدیل را انجام می‌دهد.
 */
type ProductSave = z.input<typeof productSaveSchema>;
type MaterialSave = z.input<typeof materialSaveSchema>;
type BomSave = z.input<typeof bomSaveSchema>;
type UserCreate = z.input<typeof userCreateSchema>;
type UserUpdate = z.input<typeof userUpdateSchema>;
type ListsSave = z.input<typeof listsSaveSchema>;
type SettingsSave = z.input<typeof settingsSaveSchema>;
type SupplierSave = z.input<typeof supplierSaveSchema>;

// --- محصولات ---

/** GET /api/admin/products — فهرست محصولات مدیریت. */
export function useAdminProductsQuery() {
  return useQuery<{ items: ProductAdminRow[] }, ApiError>({
    queryKey: queryKeys.admin.products(),
    queryFn: () => apiFetch<{ items: ProductAdminRow[] }>("/api/admin/products"),
  });
}

/** POST /api/admin/products — ایجاد محصول. */
export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<ProductAdminRow, ApiError, ProductSave>({
    mutationFn: (input) =>
      apiFetch<ProductAdminRow>("/api/admin/products", { method: "POST", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.products() });
    },
  });
}

/** PATCH /api/admin/products/[id] — ویرایش محصول. */
export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<ProductAdminRow, ApiError, { id: string; data: ProductSave }>({
    mutationFn: ({ id, data }) =>
      apiFetch<ProductAdminRow>(`/api/admin/products/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.products() });
    },
  });
}

// --- مواد ---

/** GET /api/admin/materials — فهرست مواد مدیریت. */
export function useAdminMaterialsQuery() {
  return useQuery<{ items: MaterialAdminRow[] }, ApiError>({
    queryKey: queryKeys.admin.materials(),
    queryFn: () => apiFetch<{ items: MaterialAdminRow[] }>("/api/admin/materials"),
  });
}

/** POST /api/admin/materials — ایجاد ماده. */
export function useCreateMaterialMutation() {
  const queryClient = useQueryClient();
  return useMutation<MaterialAdminRow, ApiError, MaterialSave>({
    mutationFn: (input) =>
      apiFetch<MaterialAdminRow>("/api/admin/materials", { method: "POST", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.materials() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.materials() });
    },
  });
}

/** PATCH /api/admin/materials/[id] — ویرایش ماده. */
export function useUpdateMaterialMutation() {
  const queryClient = useQueryClient();
  return useMutation<MaterialAdminRow, ApiError, { id: string; data: MaterialSave }>({
    mutationFn: ({ id, data }) =>
      apiFetch<MaterialAdminRow>(`/api/admin/materials/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.materials() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.materials() });
    },
  });
}

// --- فرمول تولید (BOM) ---

/** GET /api/admin/products/[id]/bom — فرمول یک محصول. */
export function useBomQuery(productId: string | null) {
  return useQuery<BomResult, ApiError>({
    queryKey: queryKeys.admin.bom(productId ?? ""),
    queryFn: () => apiFetch<BomResult>(`/api/admin/products/${productId}/bom`),
    enabled: productId !== null,
  });
}

/** PUT /api/admin/products/[id]/bom — ذخیره کامل فرمول. */
export function useSaveBomMutation() {
  const queryClient = useQueryClient();
  return useMutation<BomResult, ApiError, { productId: string; data: BomSave }>({
    mutationFn: ({ productId, data }) =>
      apiFetch<BomResult>(`/api/admin/products/${productId}/bom`, {
        method: "PUT",
        json: data,
      }),
    onSuccess: (bom) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.bom(bom.productId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.products() });
    },
  });
}

// --- تأمین‌کنندگان ---

/** GET /api/admin/suppliers — همه تأمین‌کنندگان. */
export function useAdminSuppliersQuery() {
  return useQuery<{ items: SupplierAdminRow[] }, ApiError>({
    queryKey: queryKeys.admin.suppliers(),
    queryFn: () => apiFetch<{ items: SupplierAdminRow[] }>("/api/admin/suppliers"),
  });
}

/** POST /api/admin/suppliers — ایجاد تأمین‌کننده. */
export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();
  return useMutation<SupplierAdminRow, ApiError, SupplierSave>({
    mutationFn: (input) =>
      apiFetch<SupplierAdminRow>("/api/admin/suppliers", { method: "POST", json: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.suppliers() }),
  });
}

/** PATCH /api/admin/suppliers/[id] — ویرایش تأمین‌کننده. */
export function useUpdateSupplierMutation() {
  const queryClient = useQueryClient();
  return useMutation<SupplierAdminRow, ApiError, { id: string; data: SupplierSave }>({
    mutationFn: ({ id, data }) =>
      apiFetch<SupplierAdminRow>(`/api/admin/suppliers/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.suppliers() }),
  });
}

// --- کاربران ---

/** GET /api/admin/users — فهرست کاربران. */
export function useAdminUsersQuery() {
  return useQuery<{ items: AdminUserRow[] }, ApiError>({
    queryKey: queryKeys.admin.users(),
    queryFn: () => apiFetch<{ items: AdminUserRow[] }>("/api/admin/users"),
  });
}

/** POST /api/admin/users — ایجاد کاربر. */
export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation<AdminUserRow, ApiError, UserCreate>({
    mutationFn: (input) =>
      apiFetch<AdminUserRow>("/api/admin/users", { method: "POST", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
  });
}

/** PATCH /api/admin/users/[id] — ویرایش/غیرفعال‌سازی کاربر. */
export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation<AdminUserRow, ApiError, { id: string; data: UserUpdate }>({
    mutationFn: ({ id, data }) =>
      apiFetch<AdminUserRow>(`/api/admin/users/${id}`, { method: "PATCH", json: data }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      // اگر کاربر خودش را غیرفعال کرد، نشست او در سرور باطل شده است.
      if (user.off) void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

// --- ۷ فهرست ---

/** GET /api/admin/lists — ۷ فهرست ثابت. */
export function useListsQuery() {
  return useQuery<{ items: ListRow[] }, ApiError>({
    queryKey: queryKeys.admin.lists(),
    queryFn: () => apiFetch<{ items: ListRow[] }>("/api/admin/lists"),
  });
}

/** PUT /api/admin/lists — ذخیره فهرست‌ها. */
export function useSaveListsMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ items: ListRow[] }, ApiError, ListsSave>({
    mutationFn: (input) =>
      apiFetch<{ items: ListRow[] }>("/api/admin/lists", { method: "PUT", json: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.lists() }),
  });
}

// --- تنظیمات ---

/** GET /api/admin/settings — تنظیمات فعلی. */
export function useSettingsQuery() {
  return useQuery<Settings, ApiError>({
    queryKey: queryKeys.admin.settings(),
    queryFn: () => apiFetch<Settings>("/api/admin/settings"),
  });
}

/** PATCH /api/admin/settings — ذخیره تنظیمات. */
export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation<SettingsUpdateResult, ApiError, SettingsSave>({
    mutationFn: (input) =>
      apiFetch<SettingsUpdateResult>("/api/admin/settings", { method: "PATCH", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings() });
    },
  });
}
