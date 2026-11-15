"use client";

import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { ErrorState, LoadingState } from "@components/feedback";
import { toFaDigits, formatMoney } from "@core/formatting";
import { useSummaryQuery } from "../hooks/useSummary";

/**
 * داشبورد خانه — کارت‌های خلاصه عملکرد (PHASE_07 §۱۰ / A-7.3).
 *
 * چهار کارت: سرنخ باز، سفارش جاری، هشدار موجودی، چک سررسید.
 * scoping و فیلتر مبلغ در سرور اجرا می‌شوند (PHASE_07 §۸ / R-32).
 * شبکه: ۴ ستون روی xl، ۲ ستون روی md، ۱ ستون زیر md (PHASE_07 §۱۱).
 */
export function Dashboard() {
  const me = useMeQuery();
  const query = useSummaryQuery();
  const name = me.data?.name?.split(" ")[0] ?? "";

  if (query.isLoading) return <LoadingState label="در حال بارگذاری داشبورد…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;

  const s = query.data;
  if (!s) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1">{name ? `سلام ${name}` : "میز کار"}</h1>
        <p className="hint">خلاصه عملکرد امروز شما.</p>
      </div>

      <div className="dash-grid">
        <article className="card dash-tile">
          <span className="dash-tile-label">سرنخ‌های باز</span>
          <b className="dash-tile-value">{toFaDigits(s.openLeads)}</b>
          <span className="dash-tile-hint">سرنخ‌های در دست پیگیری</span>
        </article>
        <article className="card dash-tile">
          <span className="dash-tile-label">سفارش‌های در جریان</span>
          <b className="dash-tile-value">{toFaDigits(s.activeOrders)}</b>
          <span className="dash-tile-hint">پیش‌فاکتورهای باز</span>
        </article>
        <article className="card dash-tile">
          <span className="dash-tile-label">هشدار موجودی</span>
          <b className="dash-tile-value">{toFaDigits(s.stockAlerts)}</b>
          <span className="dash-tile-hint">مواد زیر حداقل موجودی</span>
        </article>
        <article className="card dash-tile">
          <span className="dash-tile-label">چک‌های نزد سررسید</span>
          <b className="dash-tile-value">{toFaDigits(s.dueCheques)}</b>
          <span className="dash-tile-hint">
            {s.dueChequesAmount !== undefined
              ? `جمع ${formatMoney(s.dueChequesAmount)} تومان — سررسید ۷ روز آینده`
              : "سررسید ۷ روز آینده"}
          </span>
        </article>
      </div>
    </div>
  );
}
