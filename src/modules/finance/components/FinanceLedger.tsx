"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, DataTable } from "@components/ui";
import { JalaliDateInput, EmptyState } from "@components/shared";
import { LoadingState, ErrorState, useToast } from "@components/feedback";
import { instantToJalaliIso } from "@core/calendar";
import { formatMoney, toFaDigits } from "@core/formatting";
import { useReceivablesQuery, usePayablesQuery, useFinanceChequesQuery } from "../hooks/useFinanceReports";
import { useSummaryQuery } from "@modules/home/hooks/useSummary";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { useUpdateChequeMutation } from "@modules/orders/hooks/useOrderMutations";
import { usePayBuyChequeMutation } from "@modules/purchasing/hooks/useBuyMutations";
import { isIncompleteCheque } from "@modules/orders/lib/cheque";

type Row = { key: string; partyId: string; name: string; documentId: string | null; kind: string; due: string | null; amount?: number; chequeId?: string; sayad?: string; bank?: string; owner?: string; status?: string };
const STATUS: Record<string, string> = { hand: "نزد ما", bank: "در بانک", clear: "وصول شد", bounce: "برگشتی", issued: "صادر شده", paid: "پاس شد" };

/** Demo fin.js: future dues, overdue groups and complete cheque history. */
export function FinanceLedger({ direction, chequesOnly = false, pastDue = false }: { direction: "rec" | "pay"; chequesOnly?: boolean; pastDue?: boolean }) {
  const rec = useReceivablesQuery();
  const pay = usePayablesQuery();
  const cheques = useFinanceChequesQuery(direction, chequesOnly);
  const summary = useSummaryQuery();
  const me = useMeQuery();
  const canEdit = me.data?.permissions.includes("finance.edit") ?? false;
  const updateCheque = useUpdateChequeMutation();
  const payCheque = usePayBuyChequeMutation();
  const toast = useToast();
  const now = summary.data?.workspace?.now ?? 0;
  const today = instantToJalaliIso(now);
  const [range, setRange] = useState("30");
  const [fromDraft, setFrom] = useState<string | null>(null);
  const [toDraft, setTo] = useState<string | null>(null);
  const from = fromDraft ?? today;
  const to = toDraft ?? instantToJalaliIso(now + 30 * 86400000);
  const query = chequesOnly ? cheques : direction === "rec" ? rec : pay;
  const label = direction === "rec" ? "دریافتنی" : "پرداختنی";
  const until = range === "custom" ? to : instantToJalaliIso(now + Number(range) * 86400000);
  const all: Row[] = chequesOnly ? (cheques.data?.items ?? []).map((c) => ({ key: c.id, partyId: c.documentId, name: c.party, documentId: c.documentId, kind: "cheque", due: c.due, chequeId: c.id, sayad: c.sayad, bank: c.bank, owner: c.owner, status: c.status, amount: c.amount })) : direction === "rec"
    ? (rec.data?.groups ?? []).flatMap((g) => g.rows.map((r, index) => ({ ...r, key: r.chequeId ?? `${g.accountId}-${r.orderId}-${index}`, partyId: g.accountId, name: g.accountName, documentId: r.orderId, amount: "amount" in r && typeof r.amount === "number" ? r.amount : undefined })))
    : (pay.data?.groups ?? []).flatMap((g) => g.rows.map((r, index) => ({ ...r, key: r.chequeId ?? `${g.supplierId}-${r.buyId}-${index}`, partyId: g.supplierId, name: g.supplierName, documentId: r.buyId, amount: "amount" in r && typeof r.amount === "number" ? r.amount : undefined })));
  const eligible = all.filter((r) => chequesOnly || (pastDue ? !r.due || r.due < today : r.due && r.due >= today));
  const rows = eligible.filter((r) => pastDue || range === "all" || (r.due && r.due >= (range === "custom" ? from : today) && r.due <= until)).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const sum = (list: Row[]) => list.reduce((s, r) => s + (r.amount ?? 0), 0);
  const money = all.some((r) => r.amount !== undefined);
  const groups = [...new Set(rows.map((r) => r.partyId))].map((id) => ({ id, name: rows.find((r) => r.partyId === id)!.name, rows: rows.filter((r) => r.partyId === id) })).sort((a, b) => sum(b.rows) - sum(a.rows));
  const href = (r: Row) => `/${direction === "rec" ? "orders" : "buys"}/${r.documentId}`;
  const changeStatus = (r: Row, status: "bank" | "clear" | "bounce") => {
    if (!r.documentId || !r.chequeId) return;
    updateCheque.mutate({ id: r.documentId, cid: r.chequeId, data: { status } }, { onError: (e) => toast.push(e.message, "danger") });
  };
  if (query.isLoading || summary.isLoading) return <LoadingState label="بارگذاری سررسیدها…" />;
  if (summary.isError) return <ErrorState message={summary.error?.message ?? "تاریخ گزارش دریافت نشد."} onRetry={() => void summary.refetch()} />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "سررسیدها دریافت نشد."} onRetry={() => void query.refetch()} />;
  const columns = [
    ...(chequesOnly ? [] : [{ key: "due", header: "سررسید", render: (r: Row) => <b className="ltr">{toFaDigits(r.due ?? "بدون سررسید")}</b> }]),
    { key: "name", header: direction === "rec" ? "مشتری" : "فروشنده", render: (r: Row) => <b>{r.name}</b> },
    ...(chequesOnly ? [{ key: "document", header: "سند", render: (r: Row) => <Link className="link ltr" href={href(r)}>{r.documentId}</Link> }] : [{ key: "kind", header: "نوع", render: (r: Row) => r.kind === "cheque" ? "چک" : "مانده (نسیه)" }]),
    ...(money ? [{ key: "amount", header: "مبلغ", render: (r: Row) => <b>{formatMoney(r.amount ?? 0)} ریال</b> }] : []),
    ...(chequesOnly ? [
      { key: "sayad", header: "صیادی", render: (r: Row) => <span className="ltr">{toFaDigits(r.sayad || "ناقص")}</span> },
      { key: "bank", header: "بانک", render: (r: Row) => r.bank || "—" },
      { key: "due", header: "سررسید", render: (r: Row) => <span className="ltr">{toFaDigits(r.due ?? "—")}</span> },
    ] : []),
    { key: "status", header: "وضعیت", render: (r: Row) => <span className="tag-chip" data-tone={r.status === "bounce" ? "danger" : r.status === "clear" || r.status === "paid" ? "success" : "info"}>{STATUS[r.status ?? ""] ?? "در انتظار"}</span> },
    { key: "actions", header: "", render: (r: Row) => <div className="flex flex-wrap gap-2">
      {r.documentId ? <Link className="btn btn-sm" href={href(r)}>پرونده</Link> : null}
      {canEdit && r.chequeId && r.documentId ? direction === "rec" ? <>
        {r.status !== "bank" && r.status !== "clear" ? <Button size="sm" variant="ghost" disabled={updateCheque.isPending} onClick={() => changeStatus(r, "bank")}>به حساب</Button> : null}
        {r.status !== "clear" ? <Button size="sm" variant="ghost" disabled={updateCheque.isPending || isIncompleteCheque({ sayad: r.sayad ?? "", bank: r.bank ?? "", owner: r.owner ?? "", due: r.due ?? "" })} onClick={() => changeStatus(r, "clear")}>وصول شد</Button> : null}
        {r.status !== "bounce" && r.status !== "clear" ? <Button size="sm" variant="ghost" disabled={updateCheque.isPending} onClick={() => changeStatus(r, "bounce")}>برگشت</Button> : null}
      </> : r.status === "issued" ? <Button size="sm" variant="ghost" disabled={payCheque.isPending} onClick={() => payCheque.mutate({ id: r.documentId!, cid: r.chequeId! }, { onError: (e) => toast.push(e.message, "danger") })}>پاس شد</Button> : null : null}
    </div> },
  ];
  return <div className="stack gap-4">
    {!chequesOnly ? <section className="card panel-stats">
      <div><b>{money ? formatMoney(sum(rows)) : toFaDigits(rows.length)}</b><span>{pastDue ? "کل بدهی سررسیدگذشته" : `${label} در بازه`} · {toFaDigits(rows.length)} مورد</span></div>
      <div><b>{pastDue ? toFaDigits(groups.length) : money ? formatMoney(sum(eligible.filter((r) => r.due && r.due >= today && r.due <= instantToJalaliIso(now + 7 * 86400000)))) : "—"}</b><span>{pastDue ? direction === "rec" ? "مشتری بدهکار" : "فروشنده طلبکار" : "۷ روز آینده"}</span></div>
      <div><b>{pastDue ? toFaDigits(rows.find((r) => r.due)?.due ?? "—") : money ? formatMoney(sum(eligible)) : toFaDigits(eligible.length)}</b><span>{pastDue ? "قدیمی‌ترین سررسید" : "کل سررسیدهای آینده"}</span></div>
    </section> : null}
    {!pastDue ? <section className="card"><div className="toolbar"><span>بازه:</span>{[["7", "۷ روز آینده"], ["30", "۳۰ روز آینده"], ["90", "۳ ماه آینده"], ["all", "همه"], ["custom", "بازه دلخواه"]].map(([value, text]) => <Button key={value} variant={range === value ? "primary" : "ghost"} size="sm" aria-pressed={range === value} onClick={() => setRange(value!)}>{text}</Button>)}{range === "custom" ? <><JalaliDateInput label="از" value={from} onChange={setFrom} /><JalaliDateInput label="تا" value={to} onChange={setTo} /></> : null}</div>
      {rows.length ? <DataTable caption={label} rows={rows} rowKey={(r) => r.key} columns={columns} /> : <EmptyState title="در این بازه سررسیدی نیست." />}
    </section> : rows.length ? groups.map((g) => <section className="card" key={g.id}><div className="pv-h"><h3>{g.name}</h3><b className="text-danger">{money ? formatMoney(sum(g.rows)) + " ریال" : toFaDigits(g.rows.length) + " مورد"}</b></div><DataTable caption={`بدهی ${g.name}`} rows={g.rows} rowKey={(r) => r.key} columns={columns} /></section>) : <EmptyState title="بدهی سررسیدگذشته‌ای وجود ندارد." />}
  </div>;
}
