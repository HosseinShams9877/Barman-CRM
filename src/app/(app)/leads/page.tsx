import { LeadBoard } from "@modules/leads";

/**
 * /leads — بورد سرنخ‌ها (PHASE_03 §۵ / §۱۰).
 *
 * تمام state از سمت سرور از طریق TanStack Query خوانده می‌شود (CD-09) —
 * بدون fetch مستقیم در useEffect. صفحه تنها لایه نمایش است.
 */
export default function LeadsPage() {
  return (
    <div className="container-app py-8 flex flex-col gap-6">
      <LeadBoard />
    </div>
  );
}
