import { OrderDetail } from "@modules/orders";

/**
 * /orders/[id] — جزئیات سفارش/پیش‌فاکتور (PHASE_04 §۱۰).
 *
 * صفحه فقط لایه نمایش است؛ همه‌ی داده از طریق TanStack Query خوانده
 * می‌شود (CD-09) و مجوزها در هر مسیر API سمت سرور بررسی می‌شوند (R-02).
 */
type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <OrderDetail id={id} />
    </div>
  );
}
