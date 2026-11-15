/**
 * اعتبارسنجی مجدد کوئری‌های ماژول انبار (CD-09).
 *
 * `moves` تنها منبع حقیقت موجودی است (CD-08)، بنابراین هر تغییر در
 * حرکت‌ها هم لیست حرکت‌ها و هم موجودی/هشدارها را بی‌اعتبار می‌کند.
 * صفحه‌بندی/فیلترها داخل `moves.all` invalidate می‌شوند.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";

/** بعد از ثبت/ویرایش/حذف حرکت یا هر عملیاتی که حرکت می‌سازد. */
export function invalidateInventory(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.moves.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
}
