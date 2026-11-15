import { AccountList } from "@modules/customers";

/**
 * /customers — صفحه حساب‌های مشتری (PHASE_03 §۵).
 *
 * تمام state از سمت سرور از طریق TanStack Query خوانده می‌شود (CD-09) —
 * بدون fetch مستقیم در useEffect. صفحه تنها لایه نمایش است.
 */
export default function CustomersPage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <AccountList />
    </div>
  );
}
