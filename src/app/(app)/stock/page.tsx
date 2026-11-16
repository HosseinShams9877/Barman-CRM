import { StockPanel } from "@modules/inventory/components/StockPanel";

/**
 * /stock — موجودی و حرکت‌های انبار (PHASE_05 §۱۰).
 *
 * موجودی همیشه read-time aggregation از حرکت‌هاست — هیچ فیلد موجودی
 * ذخیره نمی‌گردد (CD-08). صفحه تنها لایه نمایش است (CD-09).
 */
export default function StockPage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <StockPanel />
    </div>
  );
}
