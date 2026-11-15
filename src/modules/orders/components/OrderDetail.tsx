/**
 * OrderDetail — جزئیات سفارش/پیش‌فاکتور (PHASE_04 §۱۰).
 *
 * بخش‌ها: خط لوله ۱۱ مرحله‌ای، خلاصه قرارداد، جدول اقلام، اقدامات مرحله،
 * بلوک مالی (برنامه پرداخت، رسیدها، چک‌ها — فقط با مجوز money.view، R-32)،
 * تاریخچه مرحله و سندهای تحویل، و لغو سفارش.
 *
 * سرور منبع حقیقت است (R-02): دکمه‌ها بر اساس مجوز کلاینت پنهان
 * می‌شوند ولی هر مسیر API مجدداً مجوز را بررسی می‌کند. نسخه noMoney
 * با `"calc" in order` در زمان اجرا تشخیص داده می‌شود.
 *
 * تاریخ: ذخیره `YYYY/MM/DD` ASCII، نمایش فارسی (CD-06/CD-07)؛ مهرهای
 * زمانی UTC ms هستند.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { formatJalaliFa, instantToJalali, parseJalali } from "@core/calendar";
import { faErrorMap } from "@core/validation";
import { ORDER_STATUS_LABELS, getStageByStep } from "../constants";
import { cancelOrderSchema } from "../schemas/order.schema";
import { useOrderDetailQuery } from "../hooks/useOrders";
import {
  useCancelOrderMutation,
  usePrintTokenMutation,
} from "../hooks/useOrderMutations";
import type {
  OrderDetail as OrderDetailType,
  OrderDetailNoMoney,
} from "../types/order.types";
import { OrderPipeline } from "./OrderPipeline";
import { StageActions } from "./StageActions";
import { PaymentPlanBuilder } from "./PaymentPlanBuilder";
import { PaymentsPanel } from "./PaymentsPanel";
import { ChequeEditor } from "./ChequeEditor";
import { OrderFormDialog } from "./OrderFormDialog";

export type OrderDetailProps = {
  id: string;
};

/** نوع سفارش — کامل یا noMoney (R-32). */
type AnyOrder = OrderDetailType | OrderDetailNoMoney;

/** برچسب نوع خط محصول (همان مقادیر leads LINE). */
const LINE_LABELS: Readonly<Record<"prod" | "agency", string>> = {
  prod: "محصولات تولیدی",
  agency: "محصولات نمایندگی",
};

/** برچسب نوع رخداد در تاریخچه مرحله. */
const LOG_KIND_LABELS: Readonly<Record<string, string>> = {
  stage: "انتقال مرحله",
  back: "بازگشت به مرحله قبل",
  skip: "پرش مراحل تولید",
  cancel: "لغو سفارش",
  done: "اتمام سفارش",
};

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

/** مهر زمانی UTC ms به نمایش فارسی. */
function atFa(at: number): string {
  return formatJalaliFa(instantToJalali(at));
}

/** برچسب نمایش انتقال مرحله — مثلاً «۲ → ۳» با برچسب مرحله. */
function stageMove(from: number | null, to: number): string {
  const toLabel = getStageByStep(to)?.label ?? `مرحله ${to}`;
  if (from === null) return toLabel;
  const fromLabel = getStageByStep(from)?.label ?? `مرحله ${from}`;
  return `${fromLabel} ← ${toLabel}`;
}

export function OrderDetail({ id }: OrderDetailProps) {
  const router = useRouter();
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canEdit = permissions.has("orders.edit");
  const canChange = permissions.has("orders.status.change");
  const canSeeMoney = permissions.has("money.view");

  const query = useOrderDetailQuery(id);
  const cancel = useCancelOrderMutation();
  const printToken = usePrintTokenMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (query.isLoading || me.isLoading) {
    return <LoadingState label="در حال بارگذاری سفارش…" />;
  }
  if (query.error) {
    return (
      <ErrorState
        title="بارگذاری سفارش ناموفق بود"
        message={query.error.message}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const order = query.data;
  if (!order) {
    return (
      <EmptyState
        title="سفارش پیدا نشد"
        description="ممکن است سفارش حذف شده باشد یا شناسه نامعتبر باشد."
      />
    );
  }

  const hasMoney = "calc" in order;
  const isOpen = order.status === "open";
  /** لغو فقط در stage ≤ ۵ (canCancel — order.js:59). */
  const canCancelHere = canChange && isOpen && order.stage <= 5;
  /** ویرایش فقط در مرحله پیش از تولید. */
  const canEditHere = canEdit && isOpen && order.stage <= 5;

  const handlePrint = (): void => {
    printToken.mutate(
      { id },
      {
        onSuccess: (data) => {
          void router.push(`/print/orders/${id}?t=${data.token}`);
        },
      },
    );
  };

  const handleCancel = (e: React.FormEvent): void => {
    e.preventDefault();
    setCancelError(null);
    const parsed = cancelOrderSchema.safeParse(
      { reason: cancelReason.trim() },
      { error: faErrorMap as never },
    );
    if (!parsed.success) {
      setCancelError(parsed.error.issues[0]?.message ?? "دلیل لغو را وارد کنید.");
      return;
    }
    cancel.mutate(
      { id: order.id, data: parsed.data },
      {
        onSuccess: () => {
          setCancelReason("");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3 items-center">
            <h1 className="h1">پیش‌فاکتور {toFaDigits(order.id)}</h1>
            <span className="tag-chip" data-tone="info">
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span className="tag-chip" data-tone="warning">
              مرحله {toFaDigits(String(order.stage))} —{" "}
              {getStageByStep(order.stage)?.label ?? ""}
            </span>
          </div>
          <p className="field-hint">
            {LINE_LABELS[order.line]}{" "}
            {order.accountName ? `• ${order.accountName}` : ""}
            {order.contactName ? ` • ${order.contactName}` : ""}• مسؤول:{" "}
            {order.ownerName ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={handlePrint}
            isLoading={printToken.isPending}
          >
            چاپ پیش‌فاکتور
          </Button>
          {canEditHere ? (
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              ویرایش
            </Button>
          ) : null}
          <Link className="btn btn-ghost" href="/orders">
            بازگشت به لیست
          </Link>
        </div>
      </div>

      {order.backNote ? (
        <Card>
          <div className="flex flex-col gap-2">
            <h2 className="h3">یادداشت بازگشت</h2>
            <p className="timeline-note">{order.backNote.text}</p>
            <p className="field-hint">
              {order.backNote.by} — {atFa(order.backNote.t)}
            </p>
          </div>
        </Card>
      ) : null}

      <OrderPipeline
        stage={order.stage}
        stageKey={order.stageKey}
        status={order.status}
        skipped={order.skipped}
      />

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="h3">خلاصه سفارش</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="field-label">سررسید نهایی</p>
              <p>{isoToFa(order.dueDate) ?? "—"}</p>
            </div>
            <div>
              <p className="field-label">تاریخ ثبت</p>
              <p>{atFa(order.createdAt)}</p>
            </div>
            <div>
              <p className="field-label">اعتبار پیش‌فاکتور</p>
              <p>{toFaDigits(String(order.validDays))} روز</p>
            </div>
            <div>
              <p className="field-label">تعداد اقلام</p>
              <p>{toFaDigits(String(order.itemCount))}</p>
            </div>
            <div>
              <p className="field-label">پیش‌تنظیم پرداخت</p>
              <p>{order.preset.length > 0 ? order.preset : "—"}</p>
            </div>
            <div>
              <p className="field-label">مالیات</p>
              <p>{order.noVat ? "بدون مالیات" : "مشمول مالیات"}</p>
            </div>
          </div>
          {order.note.length > 0 ? (
            <div>
              <p className="field-label">یادداشت</p>
              <p className="timeline-note">{order.note}</p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="h3">اقلام سفارش</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption>اقلام پیش‌فاکتور</caption>
              <thead>
                <tr>
                  <th scope="col">ردیف</th>
                  <th scope="col">محصول</th>
                  <th scope="col">رنگ</th>
                  <th scope="col">تعداد</th>
                  {hasMoney ? <th scope="col">قیمت واحد</th> : null}
                  {hasMoney ? <th scope="col">تخفیف قلم</th> : null}
                  {hasMoney ? <th scope="col">مبلغ قلم</th> : null}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={item.id}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span>{item.productName.length > 0 ? item.productName : item.productId}</span>
                        {item.productCode.length > 0 ? (
                          <span className="field-hint" dir="ltr">
                            {item.productCode} • {item.unit}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>{item.color.length > 0 ? item.color : "—"}</td>
                    <td>
                      <span dir="ltr">
                        {toFaDigits(String(item.qty))} {item.unit}
                      </span>
                    </td>
                    {hasMoney && "price" in item ? (
                      <>
                        <td>
                          <span dir="ltr">{formatMoney(item.price)} ریال</span>
                        </td>
                        <td>
                          <span dir="ltr">{toFaDigits(String(item.discount))}٪</span>
                        </td>
                        <td>
                          <span dir="ltr">
                            {formatMoney(
                              Math.round(item.qty * item.price * (100 - item.discount)) /
                                100,
                            )}{" "}
                            ریال
                          </span>
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {hasMoney ? (
        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="h3">محاسبه مبالغ</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <caption>خلاصه مالی پیش‌فاکتور</caption>
                <tbody>
                  <SummaryRow label="جمع اقلام" value={order.calc.sub} />
                  <SummaryRow
                    label={`تخفیف کل (${toFaDigits(String(order.discPct))}٪)`}
                    value={-order.calc.disc}
                  />
                  <SummaryRow
                    label="هزینه‌های جانبی (حمل + نصب)"
                    value={order.calc.extra}
                  />
                  <SummaryRow label="مبلغ خالص" value={order.calc.net} />
                  <SummaryRow
                    label="مالیات بر ارزش افزوده"
                    value={order.calc.vat}
                    muted={order.noVat}
                  />
                  <SummaryRow label="مبلغ نهایی" value={order.calc.total} strong />
                  <SummaryRow label="پرداخت‌شده" value={order.paid} />
                  <SummaryRow label="مانده" value={order.balance} strong />
                </tbody>
              </table>
            </div>
            <p className="field-hint">
              مبالغ همیشه محاسبه می‌شوند و ذخیره نمی‌شوند (CD-29) — گردکردن
              مبالغ به ۱۰۰٬۰۰۰ ریال فقط در مولد برنامه پرداخت (R-08).
            </p>
          </div>
        </Card>
      ) : (
        <p className="text-muted">
          نقش شما مجوز مشاهده مبالغ این سفارش را ندارد (R-32).
        </p>
      )}

      <StageActions order={order} />

      {canSeeMoney && hasMoney ? (
        <>
          <PaymentPlanBuilder order={order} />
          <PaymentsPanel order={order} />
          <ChequeEditor order={order} />
        </>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="h3">تاریخچه مرحله</h2>
          {order.stageLog.length > 0 ? (
            <ul className="timeline">
              {[...order.stageLog]
                .sort((a, b) => b.at - a.at)
                .map((entry) => (
                  <li className="timeline-item" key={entry.id}>
                    <div className="timeline-item-head">
                      <span className="tag-chip" data-tone="info">
                        {LOG_KIND_LABELS[entry.kind] ?? "تغییر مرحله"}
                      </span>
                      <span className="field-hint">
                        {entry.byName ?? "—"} — {atFa(entry.at)}
                      </span>
                    </div>
                    <p className="font-medium">
                      {stageMove(entry.fromStage, entry.toStage)}
                    </p>
                    {entry.note.length > 0 ? (
                      <p className="timeline-note">{entry.note}</p>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted">هنوز رخدادی ثبت نشده است.</p>
          )}
        </div>
      </Card>

      {order.handoffs.length > 0 ? (
        <Card>
          <div className="flex flex-col gap-4">
            <h2 className="h3">سندهای تحویل (TR-)</h2>
            <ul className="timeline">
              {order.handoffs.map((handoff) => (
                <li className="timeline-item" key={handoff.id}>
                  <div className="timeline-item-head">
                    <span className="field-hint">
                      {handoff.byName ?? "—"} — {atFa(handoff.at)}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {handoff.lines.map((line, i) => (
                      <li key={`${handoff.id}-${i}`} dir="ltr">
                        {line.productId} • {toFaDigits(String(line.qty))}
                        {line.color.length > 0 ? ` • ${line.color}` : ""}
                      </li>
                    ))}
                  </ul>
                  {handoff.note.length > 0 ? (
                    <p className="timeline-note">{handoff.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      {canCancelHere ? (
        <Card>
          <form className="flex flex-col gap-3" onSubmit={handleCancel} noValidate>
            <div>
              <h2 className="h3">لغو سفارش</h2>
              <p className="field-hint">
                لغو فقط در مراحل قبل از تولید ممکن است (order.js:59) و نیاز به
                یادداشت دلیل دارد.
              </p>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cancel-reason">
                دلیل لغو
              </label>
              <textarea
                id="cancel-reason"
                className="textarea"
                rows={2}
                maxLength={192}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={cancel.isPending}
              />
            </div>
            {cancelError ? (
              <p className="field-error" role="alert">
                {cancelError}
              </p>
            ) : null}
            {cancel.error ? (
              <p className="field-error" role="alert">
                {cancel.error.message}
              </p>
            ) : null}
            <div>
              <Button type="submit" variant="danger" isLoading={cancel.isPending}>
                لغو سفارش
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <OrderFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        order={order}
      />
    </div>
  );
}

/** ردیف جدول خلاصه مبالغ — فقط نمایش، بدون محاسبه‌ی جدید (CD-29). */
function SummaryRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr>
      <th scope="row" className={strong ? "font-bold" : ""}>
        {label}
      </th>
      <td className={strong ? "font-bold" : ""}>
        {muted ? (
          <span className="text-muted">مشمول نیست</span>
        ) : (
          <span dir="ltr">
            {formatMoney(Math.abs(value))} ریال{value < 0 ? " (−)" : ""}
          </span>
        )}
      </td>
    </tr>
  );
}
