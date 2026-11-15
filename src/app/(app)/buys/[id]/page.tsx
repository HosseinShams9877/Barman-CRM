import { BuyDetail } from "@modules/purchasing";

/**
 * /buys/[id] — جزئیات خرید با ماشین حالت req → ok → fin → recv
 * (PHASE_06 §۶/§۱۰).
 *
 * صفحه فقط لایه نمایش است؛ همه داده از طریق TanStack Query خوانده
 * می‌شود (CD-09) و مجوزها در هر مسیر API سمت سرور بررسی می‌شوند (R-02).
 */
type BuyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BuyDetailPage({ params }: BuyDetailPageProps) {
  const { id } = await params;
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <BuyDetail id={id} />
    </div>
  );
}
