/**
 * hookهای mutation حرکت‌های انبار — CD-09 (TanStack React Query v5).
 *
 * هر mutation بعد از موفقیت حرکت‌ها و موجودی را invalidate می‌کند
 * (moves تنها منبع حقیقت موجودی است — CD-08). خطاها به‌صورت `ApiError`
 * به کامپوننت می‌رسند.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import type { MoveRow } from "../types/move.types";
import type { CreateMoveInput, UpdateMoveInput } from "../schemas/move.schema";
import { invalidateInventory } from "../queries/invalidations";

/** POST /api/moves — ثبت حرکت دستی (open/out/adj/waste). */
export function useCreateMoveMutation() {
  const queryClient = useQueryClient();
  return useMutation<MoveRow, ApiError, CreateMoveInput>({
    mutationFn: (input) => apiFetch<MoveRow>("/api/moves", { method: "POST", json: input }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

/** PATCH /api/moves/[id] — ویرایش حرکت دستی (فقط open/out/adj). */
export function useUpdateMoveMutation() {
  const queryClient = useQueryClient();
  return useMutation<MoveRow, ApiError, { id: string; data: UpdateMoveInput }>({
    mutationFn: ({ id, data }) =>
      apiFetch<MoveRow>(`/api/moves/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

/** DELETE /api/moves/[id] — حذف حرکت دستی (فقط open/out/adj). */
export function useDeleteMoveMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => apiFetch<void>(`/api/moves/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}
