import { AdminPage } from "@modules/admin";

/**
 * /admin/suppliers — تب «تأمین‌کننده‌ها و نمایندگی‌ها»
 * (آیتم سایدبار Demo — admin.html#suppliers).
 *
 * همان صفحه /admin با تب اولیه suppliers. مجوز واقعی در مسیر API است
 * (CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminSuppliersRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="suppliers" />
    </div>
  );
}
