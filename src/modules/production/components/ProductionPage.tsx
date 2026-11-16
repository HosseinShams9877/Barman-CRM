"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@components/shared/PageHeader";
import { Button } from "@components/ui";
import { ErrorState, LoadingState } from "@components/feedback";
import { toFaDigits } from "@core/formatting";
import { useUrlHash } from "@core/utils/useUrlHash";
import { useSummaryQuery } from "@modules/home/hooks/useSummary";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { MoveFormDialog } from "@modules/inventory/components/MoveFormDialog";
import { MovesTable } from "@modules/inventory/components/MovesTable";
import { StockView } from "@modules/inventory/components/StockView";
import { JobList } from "./JobList";
import { JobFormDialog } from "./JobFormDialog";

export function ProductionPage() {
  const hash = useUrlHash().slice(1);
  const tab = ["stock","use","hist"].includes(hash) ? hash : "overview";
  const me = useMeQuery();
  const query = useSummaryQuery(Boolean(me.data));
  const [create, setCreate] = useState(false);
  const canEdit = me.data?.permissions.includes("production.edit");
  const canMove = me.data?.permissions.includes("inventory.moves");
  const orders = query.data?.workspace?.orders ?? [];
  const lanes = [[6,"سفارش‌های نیازمند تولید"],[7,"در حال تولید"],[8,"کنترل کیفیت"],[9,"ارسال به انبار دپو"]] as const;
  return <><PageHeader icon="factory" title="تولید" description="سفارش‌های مشتری، تولید برای انبار و مصرف مواد اولیه.">{canEdit ? <Button onClick={() => setCreate(true)}>تولید برای انبار</Button> : null}</PageHeader>
    <div className="seg-tabs panel-tabs card" role="tablist" aria-label="تولید">{[["overview","نمای کلی"],["stock","تولید برای انبار"],["use","خروج و مصرف مواد"],["hist","سوابق تولید"]].map(([key,label]) => <Link key={key} role="tab" aria-selected={tab === key} href={key === "overview" ? "#overview" : `#${key}`}>{label}</Link>)}</div>
    {tab === "overview" ? <><section className="pv-hi card"><div><h2>میز کار تولید</h2><p>سفارش‌ها را به ترتیب قبول، تولید، کنترل کیفیت و ارسال به انبار پیش ببرید.</p></div><Link className="btn hm-cta" href="#stock">تولید برای انبار ←</Link></section><div className="panel-stats">{lanes.map(([step,title]) => <div className="card" key={step}><b>{toFaDigits(orders.filter((o) => o.stage === step).length)}</b><span>{title}</span></div>)}</div>{query.isLoading ? <LoadingState label="بارگذاری سفارش‌ها…" /> : query.isError ? <ErrorState message={query.error?.message ?? "خطا"} onRetry={() => void query.refetch()} /> : <div className="pv-board">{lanes.map(([step,title]) => <section className="card pv-lane" key={step}><h3>{title}<b>{toFaDigits(orders.filter((o) => o.stage === step).length)}</b></h3>{orders.filter((o) => o.stage === step).map((o) => <article key={o.id}><Link href={`/orders/${o.id}`}><b className="ltr">{o.id}</b><span>{o.customer}</span><small>باز کردن پرونده ←</small></Link></article>)}{!orders.some((o) => o.stage === step) ? <p className="hm-none">موردی نیست</p> : null}</section>)}</div>}<section className="card"><h3 className="h3">وضعیت مواد اولیه</h3><StockView warehouse="raw" /></section></> : tab === "stock" ? <JobList /> : tab === "use" ? <>{canMove ? <MoveFormDialog inline open defaultWarehouse="raw" onClose={() => { window.location.hash = "hist"; }} /> : <p className="hint">ثبت دستی حرکت مواد اولیه به مجوز انبار نیاز دارد.</p>}<MovesTable defaultWarehouse="raw" /></> : <><JobList /><MovesTable defaultWarehouse="raw" /></>}
    {create ? <JobFormDialog onClose={() => setCreate(false)} /> : null}
  </>;
}
