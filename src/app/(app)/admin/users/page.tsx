import { AdminPage } from "@modules/admin";

/**
 * /admin/users — تب «کاربران و دسترسی‌ها» (آیتم سایدبار Demo).
 *
 * همان صفحه /admin با تب اولیه users. مجوز واقعی در مسیر API است
 * (admin.users — CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminUsersRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="users" />
    </div>
  );
}
