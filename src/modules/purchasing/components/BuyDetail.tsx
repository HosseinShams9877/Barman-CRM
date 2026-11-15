/**
 * BuyDetail — جزئیات خرید با اقلام، چک‌های صادره، تاریخچه وضعیت و اقدامات
 * گذار (PHASE_06 §۷).
 *
 * اقدامات بر اساس مجوز کلاینت نمایش داده می‌شوند:
 *  - ویرایش (`purchasing.edit`) — فقط در `req`.
 *  - تأیید مدیریت (`purchasing.approve`) — `req → ok`.
 *  - تأیید مالی + ثبت چک (`finance.approve`) — `ok → fin`.
 *  - رسید انبار (`inventory.moves`) — `fin → recv` + ورود به انبار مواد.
 *  - پاس کردن چک (`finance.edit`) — `issued → paid`.
 * سرور منبع حقیقت است (R-02) — پنهان‌سازی دکمه کافی نیست.
 *
 * مبالغ فقط برای نقش‌های دارای `money.view` (R-32).
 */
"use client";

import { useState } from "react";
import { Button, Card, DataTable } from "@components/ui";
import { ErrorState, LoadingState, useToast } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { ApiError } from "@core/errors";
import { formatJalaliFa, parseJalali, instantToJalaliIso } from "@core/calendar";
import { BUY_STATUS_LABELS, CHEQUE_STATUS_LABELS } from "../constants";
import type { BuyStatus } from "../constants";
import { useBuyDetailQuery } from "../hooks/useBuys";
import {
  useApproveBuyMutation,
  usePayBuyChequeMutation,
  useReceiveBuyMutation,
} from "../hooks/useBuyMutations";
import { BuyFormDialog } from "./BuyFormDialog";
import { BuyFinanceDialog } from "./BuyFinanceDialog";

export type BuyDetailProps = {
  id: string;
};

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی. */
function isoToFa(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

/** تاریخ شمسی یک رویداد بر اساس UTC ms (CD-06 — بدون Intl). */
function isoFromUtc(ms: number): string {
  return instantToJalaliIso(ms);
}

export function BuyDetail({ id }: BuyDetailProps) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canEdit = permissions.has("purchasing.edit");
  const canApprove = permissions.has("purchasing.approve");
  const canFinance = permissions.has("finance.approve");
  const canReceive = permissions.has("inventory.moves");
  const canPayCheque = permissions.has("finance.edit");
  const canSeeMoney = permissions.has("money.view");

  const query = useBuyDetailQuery(id);
  const approveMutation = useApproveBuyMutation();
  const receiveMutation = useReceiveBuyMutation();
  const payChequeMutation = usePayBuyChequeMutation();
  const toast = useToast();

  /** خطای mutation روی دیالوگ باز نمی‌شود — اعلان خطر (الگوی فاز ۵). */
  const onActionError = (error: ApiError): void => toast.push(error.message, "danger");

  const [editOpen, setEditOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);

  if (query.isLoading) return <LoadingState label="در حال بارگذاری خرید…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="بارگذاری ناموفق"
        message={query.error?.message ?? "خطا در دریافت خرید."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const buy = query.data;
  if (!buy) return null;

  const canEditNow = canEdit && buy.status === "req";
  const canApproveNow = canApprove && buy.status === "req";
  const canFinanceNow = canFinance && buy.status === "ok";
  const canReceiveNow = canReceive && buy.status === "fin";

  return (
    <>
      <div className="page-head">
        <div className="stack gap-1">
          <h1 className="h1">
            خرید <span dir="ltr">{toFaDigits(buy.id)}</span>
          </h1>
          <span className="tag-chip" data-tone={buy.status === "recv" ? "success" : buy.status === "fin" ? "warning" : "info"}>
            {BUY_STATUS_LABELS[buy.status]}
          </span>
        </div>
        <div className="toolbar" aria-label="اقدامات خرید">
          {canEditNow ? (
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              ویرایش
            </Button>
          ) : null}
          {canApproveNow ? (
            <Button
              isLoading={approveMutation.isPending}
              onClick={() =>
                approveMutation.mutate(
                  { id: buy.id, data: { rev: buy.rev } },
                  {
                    onSuccess: () => toast.push("درخواست خرید تأیید شد.", "success"),
                    onError: onActionError,
                  },
                )
              }
            >
              تأیید درخواست
            </Button>
          ) : null}
          {canFinanceNow ? (
            <Button onClick={() => setFinanceOpen(true)}>
              تأیید مالی
            </Button>
          ) : null}
          {canReceiveNow ? (
            <Button
              isLoading={receiveMutation.isPending}
              onClick={() =>
                receiveMutation.mutate(
                  { id: buy.id, data: { rev: buy.rev } },
                  {
                    onSuccess: () => toast.push("کالاهای خرید وارد انبار شد.", "success"),
                    onError: onActionError,
                  },
                )
              }
            >
              رسید انبار
            </Button>
          ) : null}
        </div>
      </div>

      <div className="stack gap-4">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <dt>تأمین‌کننده</dt>
              <dd>{buy.supplierName ?? "— بدون تأمین‌کننده —"}</dd>
            </div>
            <div>
              <dt>ثبت‌کننده</dt>
              <dd>{buy.createdByName ?? "—"}</dd>
            </div>
            <div>
              <dt>تاریخ ثبت</dt>
              <dd dir="ltr">{isoToFa(buy.createdAt) ?? "—"}</dd>
            </div>
            <div>
              <dt>تعداد اقلام</dt>
              <dd>{toFaDigits(buy.items.length)}</dd>
            </div>
            {canSeeMoney && "calc" in buy ? (
          <>
            <div>
              <dt>مبلغ کل</dt>
              <dd dir="ltr">{formatMoney(buy.calc.total)} ریال</dd>
            </div>
            <div>
              <dt>پرداخت‌شده</dt>
              <dd dir="ltr">{formatMoney(buy.calc.paid)} ریال</dd>
            </div>
            <div>
              <dt>بدهی باقی‌مانده</dt>
              <dd dir="ltr">{formatMoney(buy.calc.due)} ریال</dd>
            </div>
          </>
        ) : null}
          </div>
        </Card>

        {buy.note ? (
          <Card>
            <h2 className="h3">یادداشت</h2>
            <p>{buy.note}</p>
          </Card>
        ) : null}

        <Card>
          <h2 className="h3">اقلام</h2>
          <DataTable
            caption="اقلام خرید"
            rowKey={(row) => row.id}
            rows={buy.items}
            columns={[
              {
                key: "material",
                header: "ماده خام",
                render: (row) => (
                  <span>
                    {row.materialName} (<span dir="ltr">{row.materialCode}</span>)
                  </span>
                ),
              },
              {
                key: "qty",
                header: "مقدار",
                render: (row) => (
                  <span dir="ltr">
                    {toFaDigits(row.qty)} {row.unit}
                  </span>
                ),
              },
              ...(canSeeMoney
                ? [
                    {
                      key: "price" as const,
                      header: "قیمت واحد",
                      render: (row: (typeof buy.items)[number]) =>
                        "price" in row ? <span dir="ltr">{formatMoney(row.price)} ریال</span> : null,
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        <Card>
          <h2 className="h3">چک‌های صادره</h2>
          {buy.cheques.length === 0 ? (
            <p className="text-muted">چکی ثبت نشده است.</p>
          ) : (
            <DataTable
              caption="چک‌های صادره"
              rowKey={(row) => row.id}
              rows={buy.cheques}
              columns={[
                ...(canSeeMoney
                  ? [
                      {
                        key: "amount" as const,
                        header: "مبلغ",
                        render: (row: (typeof buy.cheques)[number]) =>
                          "amount" in row ? <span dir="ltr">{formatMoney(row.amount)} ریال</span> : null,
                      },
                    ]
                  : []),
                {
                  key: "due",
                  header: "سررسید",
                  render: (row) => <span dir="ltr">{isoToFa(row.due) ?? row.due}</span>,
                },
                {
                  key: "sayad",
                  header: "صیادی",
                  render: (row) =>
                    row.sayad ? <span dir="ltr">{toFaDigits(row.sayad)}</span> : <span className="text-muted">—</span>,
                },
                {
                  key: "status",
                  header: "وضعیت",
                  render: (row) => (
                    <span className="tag-chip" data-tone={row.status === "paid" ? "success" : "warning"}>
                      {row.status === "paid" ? CHEQUE_STATUS_LABELS.paid : CHEQUE_STATUS_LABELS.issued}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) =>
                    canPayCheque && row.status === "issued" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={payChequeMutation.isPending}
                        onClick={() =>
                          payChequeMutation.mutate(
                            { id: buy.id, cid: row.id },
                            {
                              onSuccess: () => toast.push("چک پاس شد.", "success"),
                              onError: onActionError,
                            },
                          )
                        }
                      >
                        پاس کردن چک
                      </Button>
                    ) : null,
                },
              ]}
            />
          )}
        </Card>

        <Card>
          <h2 className="h3">تاریخچه وضعیت</h2>
          {buy.statusLog.length === 0 ? (
            <p className="text-muted">رویدادی ثبت نشده است.</p>
          ) : (
            <ol className="timeline" aria-label="تاریخچه انتقال وضعیت">
              {buy.statusLog.map((log) => (
                <li key={log.id} className="timeline-item">
                  <span className="timeline-item-head">
                    {log.fromStatus ? BUY_STATUS_LABELS[log.fromStatus as BuyStatus] : "شروع"} ←{" "}
                    {BUY_STATUS_LABELS[log.toStatus]}
                  </span>
                  <span className="text-muted">
                    {log.byName ?? "—"} — <span dir="ltr">{isoToFa(isoFromUtc(log.at)) ?? isoFromUtc(log.at)}</span>
                  </span>
                  {log.note ? <span className="timeline-note">{log.note}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {editOpen ? (
        <BuyFormDialog open={editOpen} onClose={() => setEditOpen(false)} buy={buy} />
      ) : null}
      {financeOpen ? (
        <BuyFinanceDialog open={financeOpen} onClose={() => setFinanceOpen(false)} buy={buy} />
      ) : null}
    </>
  );
}
