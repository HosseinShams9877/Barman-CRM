"use client";
import Link from "next/link";
import { useUrlHash } from "@core/utils/useUrlHash";
import { PageHeader } from "@components/shared/PageHeader";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { StockView } from "./StockView";
import { MovesTable } from "./MovesTable";
import { MoveFormDialog } from "./MoveFormDialog";
import { JobList } from "@modules/production/components/JobList";

export function StockPanel() {
  const hash = useUrlHash().slice(1);
  const tab = ["raw","moves","out","in"].includes(hash) ? hash : "depot";
  const me = useMeQuery();
  const canMove = me.data?.permissions.includes("inventory.moves");
  const canViewJobs = me.data?.permissions.includes("production.view");
  return <><PageHeader icon="warehouse" title="موجودی انبارها" description="انبار دپو: محصول تولیدشده و نمایندگی (متری/عددی) · انبار کارگاه: مواد اولیه (کیلویی). همه ورود و خروج‌ها از سفارش، تولید و خرید ثبت می‌شود." />
    <div className="seg-tabs panel-tabs card" role="tablist" aria-label="انبارها">{[["depot","انبار دپو (محصولات)"],["raw","مواد اولیه کارگاه"],["in","ورود از تولید"],["out","خروج دستی کالا"],["moves","گردش انبار"]].filter(([key]) => key !== "out" || canMove).map(([key,label]) => <Link key={key} role="tab" aria-selected={tab === key} href={`#${key}`}>{label}</Link>)}</div>
    {tab === "raw" || tab === "depot" ? <StockView key={tab} warehouse={tab} /> : tab === "moves" ? <MovesTable /> : tab === "in" ? canViewJobs ? <JobList initialStatus="sent" /> : <StockView warehouse="depot" /> : canMove ? <MoveFormDialog open inline defaultWarehouse="depot" onClose={() => { window.location.hash = "moves"; }} /> : <p className="hint">دسترسی ثبت حرکت ندارید.</p>}
  </>;
}
