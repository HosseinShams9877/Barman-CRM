/**
 * اعتبارسنجی مجدد کوئری‌های ماژول مالی (CD-09).
 *
 * هر تغییر در تراکنش‌ها، چک‌های خرید یا پرداخت‌های سفارش روی گزارش‌های
 * مالی (receivables/payables/cashflow) و دفتر تراکنش‌ها اثر می‌گذارد.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";

/** بعد از هر mutation مالی: خانواده txns + finance. */
export function invalidateFinance(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.txns.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
}
