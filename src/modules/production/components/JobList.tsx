/**
 * JobList — لیست کارهای تولید (PHASE_05 §۱۰).
 *
 * repr: فهرست کارها در Demo (app/prod.js:78) — فیلتر وضعیت و جستجو،
 * هر ردیف با وضعیت فعلی و مقادیر سالم/ضایعات (بعد از QC).
 *
 * گذار وضعیت در صفحه جزئیات انجام می‌شود؛ این لیست فقط ناوبری است.
 */
"use client";

import { useState } from "react";
import { Button, Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import Link from "next/link";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatJalaliFa, parseJalali } from "@core/calendar";
import { toFaDigits } from "@core/formatting";
import { useJobsQuery } from "../hooks/useJobs";
import { JobFormDialog } from "./JobFormDialog";
import { JOB_STATUS, JOB_STATUS_LABELS } from "../constants";
import type { JobListParams, JobRow } from "../types/job.types";
import type { JobStatus } from "../constants";

const PAGE_SIZE = 20;

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string | null): string {
  if (!iso) return "—";
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

/** نشان وضعیت — برچسب فارسی با tone متناسب. */
function statusTone(status: JobStatus): "info" | "success" | "danger" {
  if (status === "done") return "success";
  if (status === "run") return "info";
  return "info";
}

/** فهرست کارهای تولید — فیلترها در کلید query می‌نشینند (CD-09). */
export function JobList({ initialStatus = "" }: { initialStatus?: JobStatus | "" }) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canEdit = permissions.has("production.edit");

  const [status, setStatus] = useState<JobStatus | "">(initialStatus);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params: JobListParams = {
    status: status === "" ? null : (status as JobStatus),
    q,
    page,
    pageSize: PAGE_SIZE,
  };
  const query = useJobsQuery(params);

  const onSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    setPage(1);
    void query.refetch();
  };

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <div className="page-head">
        <h1 className="h1">کارهای تولید</h1>
        {canEdit ? (
          <Button onClick={() => setCreateOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
            کار جدید
          </Button>
        ) : null}
      </div>

      <Card>
        <form className="toolbar" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="jobs-q">
              جستجو
            </label>
            <input
              id="jobs-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="شناسه یا نام محصول"
            />
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="jobs-status">
              وضعیت
            </label>
            <select
              id="jobs-status"
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as JobStatus | "");
                setPage(1);
              }}
            >
              <option value="">همه وضعیت‌ها</option>
              {JOB_STATUS.map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="ghost" isLoading={query.isFetching}>
            جستجو
          </Button>
        </form>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال بارگذاری کارها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت کارها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          title="کاری وجود ندارد"
          description={
            q.length > 0 || status !== ""
              ? "نتیجه‌ای برای فیلترهای شما پیدا نشد."
              : "هنوز کار تولیدی ثبت نشده است."
          }
          action={
            canEdit ? <Button onClick={() => setCreateOpen(true)}>ثبت اولین کار</Button> : undefined
          }
        />
      ) : (
        <>
          <DataTable
            caption="فهرست کارهای تولید"
            rowKey={(row) => row.id}
            rows={query.data?.items ?? []}
            columns={[
              {
                key: "id",
                header: "شناسه",
                render: (row: JobRow) => <span dir="ltr">{row.id}</span>,
              },
              {
                key: "product",
                header: "محصول",
                render: (row: JobRow) => (
                  <span>
                    {row.productName}{" "}
                    <span className="text-muted" dir="ltr">({row.productCode})</span>
                  </span>
                ),
              },
              {
                key: "qty",
                header: "مقدار",
                render: (row: JobRow) => (
                  <span dir="ltr">
                    {toFaDigits(Math.round(row.qty * 1000) / 1000)} {row.unit}
                  </span>
                ),
              },
              {
                key: "color",
                header: "رنگ",
                render: (row: JobRow) =>
                  row.color ? <span>{row.color}</span> : <span className="text-muted">—</span>,
              },
              {
                key: "end",
                header: "تاریخ پایان",
                render: (row: JobRow) => <span dir="ltr">{isoToFa(row.endDay)}</span>,
              },
              {
                key: "status",
                header: "وضعیت",
                render: (row: JobRow) => (
                  <span className="tag-chip" data-tone={statusTone(row.status)}>
                    {row.statusLabel}
                  </span>
                ),
              },
              {
                key: "qc",
                header: "سالم / ضایعات",
                render: (row: JobRow) =>
                  row.good !== null ? (
                    <span dir="ltr">
                      {toFaDigits(Math.round((row.good ?? 0) * 1000) / 1000)} /{" "}
                      {toFaDigits(Math.round((row.waste ?? 0) * 1000) / 1000)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                key: "actions",
                header: "عملیات",
                render: (row: JobRow) => (
                  <Link href={`/production/${row.id}`} className="link">
                    جزئیات
                  </Link>
                ),
              },
            ]}
          />

          <div className="toolbar" aria-label="صفحه‌بندی">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              صفحه قبل
            </Button>
            <span className="text-muted">
              صفحه {toFaDigits(page)} از {toFaDigits(totalPages)} —{" "}
              {toFaDigits(query.data?.total ?? 0)} کار
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || query.isFetching}
            >
              صفحه بعد
            </Button>
          </div>
        </>
      )}

      {createOpen ? (
        <JobFormDialog onClose={() => setCreateOpen(false)} />
      ) : null}
    </>
  );
}
