import { AdminPage } from "@modules/admin";

/**
 * /admin/products — تب «محصولات» (آیتم سایدبار Demo — admin.html#products).
 *
 * همان صفحه /admin با تب اولیه products. مجوز واقعی در مسیر API است
 * (CD-05/R-02)؛ این مسیر فقط لایه نمایش است.
 */
export default function AdminProductsRoute() {
  return (
    <div className="container-app py-8">
      <AdminPage initialTab="products" />
    </div>
  );
}
