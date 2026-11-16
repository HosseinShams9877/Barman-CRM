import { AdminPage } from "@modules/admin";

/**
 * /admin/bom — تب «فرمول تولید» (آیتم سایدبار Demo — admin.html#bom).
 *
 * همان صفحه /admin با تب اولیه bom. مجوز واقعی در مسیر API است
 * (CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminBomRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="bom" />
    </div>
  );
}
