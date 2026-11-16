"use client";
import { useState } from "react";
import { Card, DataTable } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, toFaDigits } from "@core/formatting";
import { useStockQuery, useStockAlertsQuery } from "../hooks/useMoves";
import { useCatalogProductsQuery } from "../hooks/useCatalog";
import type { Warehouse } from "../constants";
import type { StockRow, StockRowNoMoney } from "../types/move.types";

type Row = StockRow | StockRowNoMoney;
export function StockView({ warehouse = "depot" }: { warehouse?: Warehouse }) {
  const me = useMeQuery();
  const money = me.data?.permissions.includes("money.view");
  const query = useStockQuery(warehouse);
  const alerts = useStockAlertsQuery();
  const catalog = useCatalogProductsQuery();
  const [q, setQ] = useState("");
  const [line, setLine] = useState("");
  const products = new Map(catalog.data?.items.map((p) => [p.id,p]) ?? []);
  const rows = (query.data ?? []).filter((r) => (!q || `${r.name} ${r.code}`.includes(q)) && (!line || products.get(r.itemId)?.line === line));
  const qty = (n: number) => toFaDigits(Math.round(n*1000)/1000);
  return <>
    {warehouse === "raw" && alerts.data?.items.length ? <Card><h3 className="h3">هشدار کسری مواد</h3><p className="text-danger">{alerts.data.items.map((a) => a.name).join("، ")}</p></Card> : null}
    <Card><div className="toolbar"><input className="input" type="search" aria-label="جستجوی موجودی" placeholder="جستجو: نام یا کد" value={q} onChange={(e) => setQ(e.target.value)} />{warehouse === "depot" ? <select className="select" aria-label="نوع محصول" value={line} onChange={(e) => setLine(e.target.value)}><option value="">همه محصولات</option><option value="prod">تولیدی</option><option value="agency">نمایندگی</option></select> : null}</div></Card>
    {query.isLoading ? <LoadingState label="محاسبه موجودی…" /> : query.isError ? <ErrorState message={query.error?.message ?? "موجودی دریافت نشد."} onRetry={() => void query.refetch()} /> : !rows.length ? <EmptyState title="موردی در این انبار وجود ندارد" /> : <DataTable<Row> caption={warehouse === "raw" ? "مواد اولیه کارگاه" : "موجودی انبار دپو"} rows={rows} rowKey={(r) => r.itemId} columns={[
      {key:"name",header:warehouse === "raw" ? "ماده اولیه" : "محصول",render:(r)=><><b>{r.name}</b><small className="ltr">{r.code}</small></>},
      ...(warehouse === "depot" ? [{key:"line",header:"نوع",render:(r:Row)=>products.get(r.itemId)?.line === "agency" ? "نمایندگی" : "تولیدی"}] : []),
      {key:"onHand",header:"موجودی",render:(r)=><b className="ltr">{qty(r.onHand)} {r.unit}</b>},
      ...(warehouse === "depot" ? [
        {key:"reserved",header:"رزرو سفارش‌ها",render:(r:Row)=>qty(r.reserved)},
        {key:"free",header:"آزاد برای فروش",render:(r:Row)=><b>{qty(r.free)}</b>},
        {key:"transit",header:"در راه از تولید",render:(r:Row)=>qty(r.inTransit ?? 0)},
      ] : [
        {key:"used30",header:"مصرف ۳۰ روز",render:(r:Row)=>qty(r.used30)},
        {key:"min",header:"حداقل",render:(r:Row)=>qty(r.min)},
        {key:"status",header:"وضعیت",render:(r:Row)=><span className="tag-chip" data-tone={r.onHand < r.min ? "danger" : "success"}>{r.onHand < r.min ? "زیر حداقل" : "کافی"}</span>},
      ]),
      ...(money ? [{key:"price",header:warehouse === "raw" ? "آخرین قیمت خرید" : "قیمت فروش",render:(r:Row)=>"price" in r ? formatMoney(r.price) : "—"}] : [])
    ]} />}
  </>;
}
