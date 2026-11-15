import { AdminPage } from "@modules/admin";

/**
 * /admin — تعاریف و تنظیمات (PHASE_07 §۱۰).
 *
 * صفحه فقط لایه نمایش است (CD-09) — هر تب به مسیر API خود با مجوز
 * سرور متصل است (CD-04/R-02).
 */
export default function AdminRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage />
    </div>
  );
}
