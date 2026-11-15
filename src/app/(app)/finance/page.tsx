import { FinancePage } from "@modules/finance";

/**
 * /finance — مرکز مالی: تراکنش‌ها، طلب‌ها، بدهی‌ها و جریان نقدی
 * (PHASE_06 §۶/§۱۲).
 *
 * صفحه فقط لایه نمایش است؛ همه داده از طریق TanStack Query خوانده
 * می‌شود (CD-09) و مجوزها در هر مسیر API سمت سرور بررسی می‌شوند (R-02).
 */
export default function FinanceRoutePage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <FinancePage />
    </div>
  );
}
