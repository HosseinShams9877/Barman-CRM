import { AdminPage } from "@modules/admin";

/**
 * /admin/lists — تب «فهرست‌ها» (آیتم سایدبار Demo — admin.html#lists).
 *
 * همان صفحه /admin با تب اولیه lists. مجوز واقعی در مسیر API است
 * (CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminListsRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="lists" />
    </div>
  );
}
