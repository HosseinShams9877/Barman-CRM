import { ReportsPage } from "@modules/reports";

/**
 * /reports — گزارش‌های تجمیعی (PHASE_07 §۱۰).
 *
 * صفحه فقط لایه نمایش است (CD-09) — محدوده دید و فیلتر مبلغ در سرور
 * اجرا می‌شود (PHASE_07 §۸ / R-32).
 */
export default function ReportsRoute() {
  return (
    <div className="container-app py-8">
      <ReportsPage />
    </div>
  );
}
