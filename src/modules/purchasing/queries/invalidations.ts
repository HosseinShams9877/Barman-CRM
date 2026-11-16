/**
 * اعتبارسنجی مجدد کوئری‌های ماژول خرید (CD-09).
 *
 * رفتن خرید به انبار (receive) موجودی مواد را تغییر می‌دهد، پس همراه با
 * خانواده buys باید خانواده stock هم invalidate شود (CD-08: موجودی تجمع
 * لحظه‌ای از حرکت‌هاست). پاس کردن چک صادره و تأیید مالی هم گزارش‌های
 * مالی (payables/cashflow) را تغییر می‌دهند.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";

/**
 * بعد از هر mutation خرید: خانواده buys + جزئیات + موجودی (در صورت
 * رسید انبار) + گزارش‌های مالی (در صورت تغییر چک/مالی).
 */
export function invalidateBuys(
  queryClient: QueryClient,
  buyId?: string,
  options?: { stock?: boolean; finance?: boolean },
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.buys.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.home.all });
  if (buyId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.buys.detail(buyId) });
  }
  if (options?.stock) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
  }
  if (options?.finance) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
  }
}
