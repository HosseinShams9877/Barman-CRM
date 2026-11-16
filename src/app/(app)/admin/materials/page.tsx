import { AdminPage } from "@modules/admin";

/**
 * /admin/materials — تب «مواد اولیه» (آیتم سایدبار Demo — admin.html#materials).
 *
 * همان صفحه /admin با تب اولیه materials. مجوز واقعی در مسیر API است
 * (CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminMaterialsRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="materials" />
    </div>
  );
}
