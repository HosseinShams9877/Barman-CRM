import { OrdersList } from "@modules/orders";

/**
 * /orders — لیست سفارش‌ها/پیش‌فاکتورها (PHASE_04 §۱۰).
 *
 * تمام state از سمت سرور از طریق TanStack Query خوانده می‌شود (CD-09) —
 * بدون fetch مستقیم در useEffect. صفحه تنها لایه نمایش است.
 */
export default function OrdersPage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <OrdersList />
    </div>
  );
}
