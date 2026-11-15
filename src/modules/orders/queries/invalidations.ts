/**
 * اعتبارسنجی مجدد کوئری‌های ماژول سفارش‌ها (CD-09).
 *
 * بعد از هر mutation: کل خانواده orders.invalidate می‌شود (لیست +
 * جزئیات) چون انتقال مرحله، ثبت پرداخت و لغو هم لیست و هم جزئیات را
 * تغییر می‌دهد. جزئیات به‌روزرسانی چسبی نمی‌شود چون شمارش‌ها، مانده و
 * تاریخچه مرحله ممکن است تغییر کرده باشند.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";

/** بعد از ایجاد/ویرایش/انتقال مرحله/لغو/ثبت پرداخت یا چک یک سفارش. */
export function invalidateOrders(queryClient: QueryClient, orderId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  if (orderId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
  }
}
