import { JobDetail } from "@modules/production";

/**
 * /production/[id] — جزئیات کار تولید (PHASE_05 §۱۰).
 *
 * صفحه فقط لایه نمایش است؛ همه‌ی داده از طریق TanStack Query خوانده
 * می‌شود (CD-09) و مجوزها در هر مسیر API سمت سرور بررسی می‌شوند.
 */
type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <JobDetail id={id} />
    </div>
  );
}
