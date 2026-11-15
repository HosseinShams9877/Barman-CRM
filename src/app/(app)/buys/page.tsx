import { BuysList } from "@modules/purchasing";

/**
 * /buys — لیست درخواست‌های خرید (PHASE_06 §۶/§۱۰).
 *
 * صفحه فقط لایه نمایش است؛ همه داده از طریق TanStack Query خوانده
 * می‌شود (CD-09) و مجوزها در هر مسیر API سمت سرور بررسی می‌شوند (R-02).
 */
export default function BuysPage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <BuysList />
    </div>
  );
}
