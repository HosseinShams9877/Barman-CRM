/**
 * اعتبارسنجی مجدد کوئری‌های ماژول تولید (CD-09).
 *
 * انتقال وضعیت کار تولید (شروع/QC/دریست) هم کار و هم موجودی انبار را
 * تغییر می‌دهد (حرکت‌های use/job)، بنابراین علاوه بر `jobs`،
 * `moves`/`stock` هم invalidate می‌شوند — همان invalidateInventory.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@core/query";
import { invalidateInventory } from "@modules/inventory/queries/invalidations";

/** بعد از ایجاد/شروع/QC/دریست یک کار تولید. */
export function invalidateProduction(queryClient: QueryClient, jobId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  if (jobId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
  }
  // شروع و دریافت کار حرکت‌های انبار می‌سازند → موجودی هم تغییر می‌کند.
  invalidateInventory(queryClient);
}
