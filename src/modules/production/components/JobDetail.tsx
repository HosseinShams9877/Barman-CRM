/**
 * JobDetail — جزئیات کار تولید و گذارهای وضعیت (PHASE_05 §۳/§۱۰).
 *
 * repr: درصدی از جریان Demo (app/prod.js:117–124 + app/stock.js:73):
 *  - plan → run: دکمه «شروع تولید» — کسر مواد در سرور (guard کسری).
 *  - run → qc: دکمه «تولید شد» (data-jmade — app/prod.js:123).
 *  - qc → sent: فرم QC با سالم/ضایعات (data-jqc — app/prod.js:124).
 *  - sent → done: دکته «دریافت در دپو» (jrecv — app/stock.js:73) با
 *    هشدار غیرمساوی بودن مقدار دریافت و سالم (app/stock.js:78).
 *
 * گذارها با mutationهای اختصاصی فراخوانی می‌شوند — هر کدام در سرور
 * همراه با حرکت انبار اجرا می‌شوند (PHASE_05 §۸: بدون حرکت یتیم).
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, DataTable, Dialog, Input } from "@components/ui";
import { ErrorState, LoadingState, useToast } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatJalaliFa, instantToJalaliIso, parseJalali } from "@core/calendar";
import { toFaDigits } from "@core/formatting";
import { ApiError } from "@core/errors";
import {
  useJobDetailQuery,
} from "../hooks/useJobs";
import {
  useStartJobMutation,
  useUpdateJobMutation,
  useQcJobMutation,
  useReceiveJobMutation,
} from "../hooks/useJobMutations";
import { JOB_MESSAGES, JOB_STATUS_LABELS } from "../constants";
import type { JobStatus } from "../constants";

export type JobDetailProps = {
  id: string;
};

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string | null): string {
  if (!iso) return "—";
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** milliseconds (UTC) → نمایش تاریخ و ساعت فارسی. */
function instantToFa(ms: number | null): string {
  if (ms === null) return "—";
  return isoToFa(instantToJalaliIso(ms));
}

/** صفحه جزئیات کار — bOM ذخیره‌شده + اقدامات بر اساس وضعیت فعلی. */
export function JobDetail({ id }: JobDetailProps) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canEdit = permissions.has("production.edit");
  const canReceive = permissions.has("inventory.moves");

  const query = useJobDetailQuery(id);
  const toast = useToast();

  const startJob = useStartJobMutation();
  const updateJob = useUpdateJobMutation();
  const qcJob = useQcJobMutation();
  const receiveJob = useReceiveJobMutation();

  const [qcOpen, setQcOpen] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);

  const onMessage = (message: string): void => toast.push(message, "danger");

  if (query.isLoading) return <LoadingState label="در حال بارگذاری کار…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="بارگذاری ناموفق"
        message={query.error?.message ?? "خطا در دریافت کار."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const job = query.data;
  if (!job) return null;

  const status = job.status as JobStatus;

  const onStart = (): void => {
    startJob.mutate(id, {
      onSuccess: (updated) => {
        toast.push(`${JOB_MESSAGES.started} — ${updated.id}`, "success");
      },
      onError: (error: ApiError) => onMessage(error.message),
    });
  };

  const onMade = (): void => {
    updateJob.mutate(
      { id, data: { status: "qc" } },
      {
        onSuccess: () => toast.push(JOB_MESSAGES.made, "success"),
        onError: (error: ApiError) => onMessage(error.message),
      },
    );
  };

  const onReceive = (qty: number | null): void => {
    receiveJob.mutate(
      { id, data: qty === null ? undefined : { qty } },
      {
        onSuccess: (updated) => {
          toast.push(
            updated.warning ? `${updated.id} دریافت شد — ${updated.warning}` : `${updated.id} وارد دپو شد.`,
            updated.warning ? "info" : "success",
          );
          setRecvOpen(false);
        },
        onError: (error: ApiError) => onMessage(error.message),
      },
    );
  };

  return (
    <>
      <div className="page-head">
        <h1 className="h1">
          <span dir="ltr">{job.id}</span>
        </h1>
        <Link className="btn btn-ghost" href="/production">
          بازگشت به فهرست
        </Link>
      </div>

      <Card>
        <div className="stack gap-2">
          <h2 className="h2">
            {job.productName} <span className="text-muted" dir="ltr">({job.productCode})</span>
          </h2>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-muted">مقدار برنامه‌ریزی‌شده</dt>
              <dd dir="ltr">
                {toFaDigits(round3(job.qty))} {job.unit}
              </dd>
            </div>
            <div>
              <dt className="text-muted">رنگ</dt>
              <dd>{job.color ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">تاریخ پایان</dt>
              <dd dir="ltr">{isoToFa(job.endDay)}</dd>
            </div>
            <div>
              <dt className="text-muted">وضعیت</dt>
              <dd>
                <span className="tag-chip" data-tone="info">
                  {JOB_STATUS_LABELS[status]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">سالم / ضایعات</dt>
              <dd dir="ltr">
                {job.good !== null
                  ? `${toFaDigits(round3(job.good ?? 0))} / ${toFaDigits(round3(job.waste ?? 0))}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">دریافت در دپو</dt>
              <dd dir="ltr">
                {job.recvQty !== null
                  ? `${toFaDigits(round3(job.recvQty ?? 0))} ${job.unit}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">شروع تولید</dt>
              <dd dir="ltr">{instantToFa(job.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">ثبت کیفیت</dt>
              <dd dir="ltr">{instantToFa(job.qcAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">ایجاد توسط</dt>
              <dd>{job.createdByName || "—"}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="card">
        <div className="stack gap-2">
          <h2 className="h3">اقدامات</h2>
          {!canEdit ? (
            <p className="text-muted text-sm">شما مجوز تغییر کار تولید را ندارید.</p>
          ) : status === "plan" ? (
            <>
              <p className="text-sm">
                با شروع تولید، مواد اولیه طبق BOM از انبار مواد کسر می‌شوند. در صورت کسری،
                سرور راه را مسدود می‌کند.
              </p>
              <Button onClick={onStart} isLoading={startJob.isPending}>
                شروع تولید
              </Button>
            </>
          ) : status === "run" ? (
            <Button onClick={onMade} isLoading={updateJob.isPending}>
              تولید شد
            </Button>
          ) : status === "qc" ? (
            <Button onClick={() => setQcOpen(true)}>ثبت کنترل کیفیت</Button>
          ) : status === "sent" ? (
            canReceive ? (
              <Button onClick={() => setRecvOpen(true)} isLoading={receiveJob.isPending}>
                دریافت در دپو
              </Button>
            ) : (
              <p className="text-muted text-sm">دریافت در دپو نیاز به مجوز حرکت‌های انبار دارد.</p>
            )
          ) : (
            <p className="text-muted text-sm">این کار به پایان رسیده است.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="stack gap-2">
          <h2 className="h3">مواد مصرفی (BOM ذخیره‌شده)</h2>
          {job.bomSnapshot.length === 0 ? (
            <p className="text-muted text-sm">BOM برای این کار ذخیره نشده است.</p>
          ) : (
            <DataTable
              caption="مواد لازم برای این کار"
              rowKey={(row) => row.materialId}
              rows={job.bomSnapshot}
              columns={[
                {
                  key: "name",
                  header: "ماده اولیه",
                  render: (row) => (
                    <span>
                      {row.name} <span className="text-muted" dir="ltr">({row.code})</span>
                    </span>
                  ),
                },
                {
                  key: "perUnit",
                  header: "مصرف هر واحد",
                  render: (row) => (
                    <span dir="ltr">
                      {toFaDigits(round3(row.perUnit))} {row.unit}
                    </span>
                  ),
                },
                {
                  key: "total",
                  header: "کل لازم",
                  render: (row) => (
                    <span dir="ltr">
                      {toFaDigits(round3(row.total))} {row.unit}
                    </span>
                  ),
                },
                {
                  key: "onHand",
                  header: "موجودی زمان ایجاد",
                  render: (row) => (
                    <span dir="ltr">
                      {toFaDigits(round3(row.onHand))} {row.unit}
                    </span>
                  ),
                },
                {
                  key: "short",
                  header: "کسری",
                  render: (row) =>
                    row.short > 0 ? (
                      <span className="tag-chip" data-tone="danger">
                        {toFaDigits(round3(row.short))} {row.unit}
                      </span>
                    ) : (
                      <span className="tag-chip" data-tone="success">کافی</span>
                    ),
                },
              ]}
            />
          )}
        </div>
      </div>

      {qcOpen ? (
        <QcDialog
          jobId={job.id}
          qty={job.qty}
          unit={job.unit}
          onClose={() => setQcOpen(false)}
          onSubmit={(good, waste) => {
            qcJob.mutate(
              { id, data: { good, waste } },
              {
                onSuccess: () => {
                  toast.push(JOB_MESSAGES.sentToDepot, "success");
                  setQcOpen(false);
                },
                onError: (error: ApiError) => onMessage(error.message),
              },
            );
          }}
          isPending={qcJob.isPending}
        />
      ) : null}

      {recvOpen ? (
        <ReceiveDialog
          jobId={job.id}
          good={job.good ?? 0}
          unit={job.unit}
          onClose={() => setRecvOpen(false)}
          onSubmit={onReceive}
          isPending={receiveJob.isPending}
        />
      ) : null}
    </>
  );
}

/** فرم QC — ثبت سالم و ضایعات (app/prod.js:124). */
function QcDialog(props: {
  jobId: string;
  qty: number;
  unit: string;
  onClose: () => void;
  onSubmit: (good: number, waste: number) => void;
  isPending: boolean;
}) {
  const { jobId, qty, unit, onClose, onSubmit, isPending } = props;
  const [good, setGood] = useState("");
  const [waste, setWaste] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const goodNum = Number(good.replace(/,/g, ""));
    const wasteNum = Number(waste.replace(/,/g, ""));
    if (good === "" || Number.isNaN(goodNum) || !(goodNum > 0)) {
      setError("مقدار سالم باید بیشتر از صفر باشد.");
      return;
    }
    if (Number.isNaN(wasteNum) || wasteNum < 0) {
      setError("مقدار ضایعات نمی‌تواند منفی باشد.");
      return;
    }
    if (goodNum + wasteNum > qty) {
      setError(`مجموع سالم و ضایعات نمی‌تواند بیشتر از مقدار تولید (${toFaDigits(round3(qty))} ${unit}) باشد.`);
      return;
    }
    setError(null);
    onSubmit(goodNum, wasteNum);
  };

  return (
    <Dialog
      open
      title="ثبت کنترل کیفیت"
      description={`کار ${jobId} — مقدار تولید ${toFaDigits(round3(qty))} ${unit}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" form="job-qc-form" isLoading={isPending}>
            ثبت کیفیت
          </Button>
        </>
      }
    >
      <form id="job-qc-form" className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          id="job-qc-good"
          name="good"
          label="مقدار سالم"
          type="number"
          step="0.001"
          min="0.001"
          value={good}
          hint={`واحد: ${unit}`}
          error={error ?? undefined}
          onChange={(e) => setGood(e.target.value)}
          required
        />
        <Input
          id="job-qc-waste"
          name="waste"
          label="مقدار ضایعات"
          type="number"
          step="0.001"
          min="0"
          value={waste}
          hint={`واحد: ${unit}`}
          onChange={(e) => setWaste(e.target.value)}
          required
        />
      </form>
    </Dialog>
  );
}

/** فرم دریافت در دپو — مقدار دریافت با پیش‌فرض سالم (app/stock.js:73). */
function ReceiveDialog(props: {
  jobId: string;
  good: number;
  unit: string;
  onClose: () => void;
  onSubmit: (qty: number | null) => void;
  isPending: boolean;
}) {
  const { jobId, good, unit, onClose, onSubmit, isPending } = props;
  const [qty, setQty] = useState(String(good));

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (qty.trim() === "") {
      onSubmit(null);
      return;
    }
    const qtyNum = Number(qty.replace(/,/g, ""));
    if (Number.isNaN(qtyNum) || !(qtyNum > 0)) return;
    onSubmit(qtyNum);
  };

  return (
    <Dialog
      open
      title="دریافت در دپو"
      description={`کار ${jobId} — پیش‌فرض مقدار سالم: ${toFaDigits(round3(good))} ${unit}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" form="job-recv-form" isLoading={isPending}>
            دریافت
          </Button>
        </>
      }
    >
      <form id="job-recv-form" className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          id="job-recv-qty"
          name="qty"
          label="مقدار دریافت"
          type="number"
          step="0.001"
          min="0.001"
          value={qty}
          hint={`خالی گذاشتن این فیلد یعنی پیش‌فرض مقدار سالم (${toFaDigits(round3(good))} ${unit}).`}
          onChange={(e) => setQty(e.target.value)}
        />
        <p className="text-muted text-sm">
          {JOB_MESSAGES.recvMismatch} — این هشدار غیرمسدودکننده است (app/stock.js:78).
        </p>
      </form>
    </Dialog>
  );
}
