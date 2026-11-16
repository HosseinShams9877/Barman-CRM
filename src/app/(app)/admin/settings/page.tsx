import { AdminPage } from "@modules/admin";

/**
 * /admin/settings — تب «تنظیمات عمومی» (آیتم سایدبار Demo).
 *
 * همان صفحه /admin با تب اولیه settings. مجوز واقعی در مسیر API است
 * (admin.settings — CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminSettingsRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="settings" />
    </div>
  );
}
