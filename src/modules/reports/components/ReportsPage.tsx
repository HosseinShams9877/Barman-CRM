"use client";

import { useState } from "react";
import Link from "next/link";
import { useUrlHash } from "@core/utils/useUrlHash";
import { PageHeader } from "@components/shared/PageHeader";
import { Icon } from "@components/ui/Icon";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { ErrorState, LoadingState } from "@components/feedback";
import { toFaDigits, formatMoney } from "@core/formatting";
import {
  REPORT_DAYS,
  REPORT_KINDS,
  REPORT_KIND_LABELS,
  type ReportKind,
} from "../schemas/report-query.schema";
import { useReportQuery } from "../hooks/useReports";
import type { LeadsReport } from "../services/leads.report";
import type { SalesReport } from "../services/sales.report";
import type { ProdReport } from "../services/prod.report";
import type { FinReport } from "../services/fin.report";

/**
 * صفحه گزارش‌ها — PHASE_07 §۱۰ (بازسازی reports.js).
 *
 * ساختار: فیلتر بازه/خط + ۴ تب (سرنخ، فروش، تولید، مالی). نقش sales
 * داده‌های محدود می‌بیند — فیلتر در سرور اجرا می‌شود (PHASE_07 §۸).
 */
export function ReportsPage() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);

  // reports.js:6 — salesManager فقط سرنخ و فروش را می‌بیند.
  const tabs: readonly ReportKind[] = me.data?.roles.includes("salesManager")
    ? REPORT_KINDS.filter((k) => k === "leads" || k === "sales")
    : permissions.has("leads.view")
      ? REPORT_KINDS
      : REPORT_KINDS.filter((k) => k !== "leads");
  const hash = useUrlHash().slice(1) as ReportKind;
  const kind = tabs.includes(hash) ? hash : (tabs[0] ?? "sales");
  const [days, setDays] = useState<number>(90);
  const [line, setLine] = useState<"prod" | "agency" | null>(null);

  const query = useReportQuery({ kind, days, line });

  return (
    <div className="reports-workspace">
      <PageHeader
        icon="chart"
        title="گزارش‌ها"
        description="همه اعداد از خود سرنخ‌ها، سفارش‌ها، تولید و خریدها حساب می‌شود."
      />

      <div className="card report-filters" role="group" aria-label="فیلتر گزارش">
        <div className="field">
          <label className="field-label" htmlFor="r-days">
            بازه
          </label>
          <select
            id="r-days"
            className="select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {REPORT_DAYS.map((d) => (
              <option key={d} value={d}>
                {(
                  {
                    30: "۳۰ روز اخیر",
                    90: "۳ ماه اخیر",
                    180: "۶ ماه اخیر",
                    365: "یک سال",
                  } as Record<number, string>
                )[d] ?? `${toFaDigits(d)} روز اخیر`}
              </option>
            ))}
          </select>
        </div>
        {kind === "leads" || kind === "sales" ? (
          <div className="field">
            <label className="field-label" htmlFor="r-line">
              نوع محصول
            </label>
            <select
              id="r-line"
              className="select"
              value={line ?? ""}
              onChange={(e) => setLine((e.target.value || null) as "prod" | "agency" | null)}
            >
              <option value="">همه</option>
              <option value="prod">تولیدی</option>
              <option value="agency">نمایندگی</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="seg-tabs card" role="tablist" aria-label="نوع گزارش">
        {tabs.map((k) => (
          <Link key={k} href={`#${k}`} role="tab" aria-selected={k === kind}>
            {REPORT_KIND_LABELS[k]}
          </Link>
        ))}
      </div>

      <section className="report-content" role="tabpanel" aria-label={REPORT_KIND_LABELS[kind]}>
        {query.isLoading ? (
          <LoadingState label="در حال محاسبه گزارش…" />
        ) : query.isError ? (
          <ErrorState message={query.error?.message ?? "خطا در بارگذاری گزارش."} />
        ) : kind === "leads" ? (
          <LeadsView report={query.data as LeadsReport} />
        ) : kind === "sales" ? (
          <SalesView report={query.data as SalesReport} />
        ) : kind === "prod" ? (
          <ProdView report={query.data as ProdReport} />
        ) : (
          <FinView report={query.data as FinReport} />
        )}
      </section>
    </div>
  );
}

/** سرنخ‌ها به تفکیک منبع ورود + عملکرد کارشناس‌ها + دلایل از دست رفتن. */
function LeadsView({ report }: { report: LeadsReport }) {
  if (report.bySource.length === 0 && report.byOwner.length === 0) {
    return <p className="hint">در این بازه سرنخی ثبت نشده است.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <section className="card">
        <h3 className="report-section-title">
          <Icon name="globe" size="icon-sm" />
          سرنخ‌ها به تفکیک منبع ورود
        </h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <caption className="sr-only">سرنخ‌ها به تفکیک منبع ورود</caption>
            <thead>
              <tr>
                <th scope="col">منبع</th>
                <th scope="col">تعداد ورود</th>
                <th scope="col">
                  <span className="sr-only">مقایسه تعداد ورود</span>
                </th>
                <th scope="col">شناسایی شد (فرصت)</th>
                <th scope="col">پیش‌فاکتور</th>
                <th scope="col">خرید قطعی</th>
                <th scope="col">نرخ تبدیل</th>
                <th scope="col">از دست رفته</th>
                {report.bySource[0]?.rev !== undefined ? <th scope="col">فروش (ریال)</th> : null}
              </tr>
            </thead>
            <tbody>
              {report.bySource.map((row) => (
                <tr key={row.source}>
                  <td>
                    <b>{row.source}</b>
                  </td>
                  <td>{toFaDigits(row.n)}</td>
                  <td>
                    <ReportBar
                      value={row.n}
                      max={Math.max(1, ...report.bySource.map((source) => source.n))}
                    />
                  </td>
                  <td>
                    {toFaDigits(row.opp)}
                    <small>
                      {row.n ? toFaDigits(Math.round((row.opp / row.n) * 100)) + "٪" : "—"}
                    </small>
                  </td>
                  <td>{toFaDigits(row.pf)}</td>
                  <td>
                    <b>{toFaDigits(row.won)}</b>
                  </td>
                  <td>{row.n > 0 ? toFaDigits(Math.round((row.won / row.n) * 100)) : "—"}%</td>
                  <td>{toFaDigits(row.lost)}</td>
                  {row.rev !== undefined ? <td>{formatMoney(row.rev)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="report-columns">
        <section className="card">
          <h3 className="report-section-title">
            <Icon name="users" size="icon-sm" />
            عملکرد کارشناس‌ها
          </h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">عملکرد کارشناس‌ها</caption>
              <thead>
                <tr>
                  <th scope="col">کارشناس</th>
                  <th scope="col">سرنخ</th>
                  <th scope="col">فرصت</th>
                  <th scope="col">قطعی</th>
                  {report.byOwner[0]?.rev !== undefined ? <th scope="col">فروش</th> : null}
                  <th scope="col">پیگیری معوق</th>
                </tr>
              </thead>
              <tbody>
                {report.byOwner.map((row) => (
                  <tr key={row.ownerId}>
                    <td>
                      <b>{row.ownerName}</b>
                    </td>
                    <td>{toFaDigits(row.n)}</td>
                    <td>{toFaDigits(row.opp)}</td>
                    <td>{toFaDigits(row.won)}</td>
                    {row.rev !== undefined ? <td>{formatMoney(row.rev)}</td> : null}
                    <td>
                      {row.due > 0 ? (
                        <span className="tag-chip" data-tone="warning">
                          {toFaDigits(row.due)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h3 className="report-section-title">
            <Icon name="x" size="icon-sm" />
            دلیل از دست رفتن
          </h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">دلیل از دست رفتن</caption>
              <tbody>
                {report.lostReasons.length > 0 ? (
                  report.lostReasons.map((row) => (
                    <tr key={row.reason}>
                      <td>{row.reason}</td>
                      <td>
                        <b>{toFaDigits(row.n)}</b>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>در این بازه موردی نیست.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="report-bar" aria-hidden="true">
      <i style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }} />
    </span>
  );
}

/** فروش: کاشی‌های خلاصه + فروش به تفکیک محصول + فروش ماهانه. */
function SalesView({ report }: { report: SalesReport }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="dash-grid">
        <div className="card dash-tile">
          <b>{toFaDigits(report.tiles.orders)}</b>
          <span>سفارش قطعی</span>
        </div>
        {report.tiles.total !== undefined ? (
          <div className="card dash-tile">
            <b>{formatMoney(report.tiles.total)}</b>
            <span>جمع فروش (ریال)</span>
          </div>
        ) : null}
        <div className="card dash-tile">
          <b>{toFaDigits(report.tiles.conversion)}%</b>
          <span>تبدیل پیش‌فاکتور به خرید</span>
        </div>
      </div>

      <section className="card">
        <h3 className="report-section-title">
          <Icon name="box" size="icon-sm" />
          فروش به تفکیک محصول
        </h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <caption className="sr-only">فروش به تفکیک محصول</caption>
            <thead>
              <tr>
                <th scope="col">محصول</th>
                <th scope="col">مقدار</th>
                {report.byProduct[0]?.amount !== undefined ? <th scope="col">مبلغ</th> : null}
              </tr>
            </thead>
            <tbody>
              {report.byProduct.length > 0 ? (
                report.byProduct.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <b>{row.name}</b> <small className="ltr">{row.code}</small>
                    </td>
                    <td>
                      {toFaDigits(row.qty)} {row.unit}
                    </td>
                    {row.amount !== undefined ? (
                      <td>
                        <b>{formatMoney(row.amount)}</b>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td>در این بازه فروشی ثبت نشده است.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {report.byMonth.length > 0 ? (
        <section className="card">
          <h3 className="report-section-title">
            <Icon name="chart" size="icon-sm" />
            فروش ماهانه
          </h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">فروش ماهانه</caption>
              <thead>
                <tr>
                  <th scope="col">ماه</th>
                  <th scope="col">فروش (ریال)</th>
                </tr>
              </thead>
              <tbody>
                {report.byMonth.map((row) => (
                  <tr key={row.month}>
                    <td>{toFaDigits(row.month)}</td>
                    <td>
                      <b>{formatMoney(row.total)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** تولید و مواد: کاشی‌های خلاصه + سفارش‌های عقب. */
function ProdView({ report }: { report: ProdReport }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="dash-grid">
        <div className="card dash-tile">
          <b>{toFaDigits(Math.round(report.tiles.good))}</b>
          <span>تولید سالم</span>
        </div>
        <div className="card dash-tile">
          <b>{toFaDigits(report.tiles.wastePct)}%</b>
          <span>نرخ ضایعات</span>
        </div>
        {report.tiles.rawValue !== undefined ? (
          <div className="card dash-tile">
            <b>{formatMoney(report.tiles.rawValue)}</b>
            <span>ارزش مواد اولیه</span>
          </div>
        ) : null}
        {report.tiles.depotValue !== undefined ? (
          <div className="card dash-tile">
            <b>{formatMoney(report.tiles.depotValue)}</b>
            <span>ارزش موجودی دپو</span>
          </div>
        ) : null}
      </div>

      {report.late.length > 0 ? (
        <div className="alert alert-warning" role="alert">
          <b>{toFaDigits(report.late.length)} سفارش از زمان‌بندی تولید عقب است:</b>{" "}
          {report.late.map((o) => o.id).join("، ")}
        </div>
      ) : null}
    </div>
  );
}

/** مالی: دریافتنی/پرداختنی + جریان پول بازه + خروجی به تفکیک نوع. */
function FinView({ report }: { report: FinReport }) {
  const t = report.tiles;
  if (t.receivable === undefined) {
    return <p className="hint">گزارش مالی برای نقش شما بدون مبالغ است (R-32).</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="dash-grid">
        <div className="card dash-tile">
          <b>{formatMoney(t.receivable ?? 0)}</b>
          <span>دریافتنی باز</span>
        </div>
        <div className="card dash-tile">
          <b>{formatMoney(t.payable ?? 0)}</b>
          <span>پرداختنی باز</span>
        </div>
        <div className="card dash-tile">
          <b>{formatMoney(t.income ?? 0)}</b>
          <span>ورودی پول در بازه</span>
        </div>
        <div className="card dash-tile">
          <b>{formatMoney(t.expense ?? 0)}</b>
          <span>خروجی پول در بازه</span>
        </div>
      </div>

      <section className="card">
        <h3 className="report-section-title">
          <Icon name="chart" size="icon-sm" />
          خروجی پول به تفکیک نوع
        </h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <caption className="sr-only">خروجی پول به تفکیک نوع</caption>
            <tbody>
              {report.expensesByKind.length > 0 ? (
                report.expensesByKind.map((row) => (
                  <tr key={row.kind}>
                    <td>{row.kind}</td>
                    <td>
                      <b>{formatMoney(row.amount)}</b>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>در این بازه خروجی پولی ثبت نشده است.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
