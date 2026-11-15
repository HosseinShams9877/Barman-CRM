import { JobList } from "@modules/production";

/**
 * /production — لیست کارهای تولید (PHASE_05 §۱۰).
 *
 * تمام state از سمت سرور از طریق TanStack Query خوانده می‌شود (CD-09) —
 * بدون fetch مستقیم در useEffect. صفحه تنها لایه نمایش است.
 */
export default function ProductionPage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <JobList />
    </div>
  );
}
