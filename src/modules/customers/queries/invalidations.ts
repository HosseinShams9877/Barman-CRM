/**
 * اعتبارسنجی مجدد کوئری‌های ماژول مشتریان (CD-09).
 *
 * بعد از هر mutation: لیست حساب‌ها.invalidate + جزئیات همان حساب.
 * جزئیات در cache به‌روزرسانی نمی‌چسبد چون شمارش‌ها (leadCount) ممکن است
 * در سرویس‌های دیگر تغییر کند — invalidate ساده‌ترین روش صحیح است.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";

/** بعد از ایجاد/ویرایش/غیرفعال‌سازی یک حساب. */
export function invalidateAccounts(queryClient: QueryClient, accountId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
  if (accountId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(accountId) });
  }
}
