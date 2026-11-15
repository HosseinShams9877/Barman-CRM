/**
 * اعتبارسنجی مجدد کوئری‌های ماژول سرنخ‌ها (CD-09).
 *
 * بعد از هر mutation: کل خانواده leads.invalidate می‌شود (لیست + جزئیات
 * + تاریخچه) چون جابه‌جایی مرحله و ثبت پیگیری هم لیست و هم جزئیات را
 * تغییر می‌دهد. جزئیات به‌روزرسانی چسبی نمی‌شود چون شمارش‌ها/تاریخچه
 * ممکن است تغییر کرده باشند.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";

/** بعد از ایجاد/ویرایش/جابه‌جایی مرحله/ثبت پیگیری یک سرنخ. */
export function invalidateLeads(queryClient: QueryClient, leadId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
  if (leadId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
  }
}
