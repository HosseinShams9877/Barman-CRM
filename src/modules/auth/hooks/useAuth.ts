/**
 * hookهای auth — CD-09 / CD-04.
 *
 * همه fetchها از طریق apiFetch انجام می‌شوند؛ خطاها کد و پیام سرور را
 * حفظ می‌کنند. هیچ fetch مستقیمی در useEffect وجود ندارد (CD-04 ممنوع).
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@core/api";
import { ApiError } from "@core/errors";
import { queryKeys } from "@core/query";
import type { PublicUser } from "@core/auth";

/** GET /api/auth/me — نشست جاری، یا null وقتی نشست‌ای وجود ندارد (۴۰۱). */
export function useMeQuery() {
  return useQuery<PublicUser | null>({
    queryKey: queryKeys.auth.me(),
    retry: false,
    queryFn: async () => {
      try {
        const data = await apiFetch<{ user: PublicUser }>("/api/auth/me");
        return data.user;
      } catch (err) {
        // ۴۰۱ یعنی «بدون نشست» — یک وضعیت است، نه خطای قابل retry (CD-09)
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });
}

/** POST /api/auth/login — ورود؛ کوکی HttpOnly توسط سرور ست می‌شود. */
export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation<PublicUser, ApiError, { name: string; password: string }>({
    mutationFn: async (input) => {
      const data = await apiFetch<{ user: PublicUser }>("/api/auth/login", {
        method: "POST",
        json: input,
      });
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me(), user);
    },
  });
}

/** POST /api/auth/logout — باطل‌کردن نشست در سرور. */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me(), null);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}
