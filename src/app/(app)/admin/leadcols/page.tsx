import { AdminPage } from "@modules/admin";

/**
 * /admin/leadcols — تب «ستون‌های بورد سرنخ»
 * (آیتم سایدبار Demo — admin.html#leadcols).
 *
 * همان صفحه /admin با تب اولیه leadcols. مجوز واقعی در مسیر API است
 * (CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminLeadcolsRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="leadcols" />
    </div>
  );
}
