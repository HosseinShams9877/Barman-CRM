"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button, DataTable } from "@components/ui";
import { Icon } from "@components/ui/Icon";
import { formatPhoneFa, formatMoney, toFaDigits } from "@core/formatting";
import { ErrorState, LoadingState } from "@components/feedback";
import type { LeadListItem } from "../types/lead.types";
import type { LeadStageKey } from "../constants/STAGE";
import { useLeadBoardQuery, useLeadColumnMutation } from "../hooks/useLeadBoard";
import { useToast } from "@components/feedback";

export function LeadStageView({ stage, rows, table, canMove, money, onOpen, onFollowup }: { stage: LeadStageKey; rows: LeadListItem[]; table: boolean; canMove: boolean; money: boolean; onOpen: (id:string)=>void; onFollowup: (id:string)=>void }) {
  const board = useLeadBoardQuery();
  const move = useLeadColumnMutation();
  const toast = useToast();
  const records = new Map(board.data?.records.map((r)=>[r.id,r]) ?? []);
  const columns = board.data?.columns.filter((c)=>c.stage === stage) ?? [];
  const setColumn = (id:string,column:string) => move.mutate({id,stage,column},{onError:(e)=>toast.push(e.message,"danger")});
  if (board.isLoading) return <LoadingState label="بارگذاری ستون‌های بورد…" />;
  if (board.isError) return <ErrorState message={board.error.message} onRetry={()=>void board.refetch()} />;
  if (table || stage === "won" || stage === "lost") return <DataTable caption="فهرست سرنخ‌ها" rows={rows} rowKey={(r)=>r.id} columns={[
    {key:"account",header:stage === "raw" ? "شماره" : "اکانت",render:(r)=><button className="btn btn-ghost btn-sm" onClick={()=>onOpen(r.id)}>{r.account?.name || formatPhoneFa(r.account?.phones[0] ?? "") || r.title}</button>},
    {key:"source",header:"منبع ورود",render:(r)=>r.source},
    ...(stage === "raw" ? [{key:"tries",header:"تلاش تماس",render:(r:LeadListItem)=>toFaDigits(records.get(r.id)?.tries ?? 0)}, {key:"result",header:"آخرین نتیجه",render:(r:LeadListItem)=>records.get(r.id)?.lastResult || "هنوز تماسی نگرفته‌اید"}] : [{key:"products",header:"محصول موردنظر",render:(r:LeadListItem)=>records.get(r.id)?.products.join("، ") || "—"}]),
    ...(stage === "pf" || stage === "won" ? [{key:"order",header:"پیش‌فاکتور",render:(r:LeadListItem)=>records.get(r.id)?.orderId ? <Link className="ltr link" href={`/orders/${records.get(r.id)?.orderId}`}>{records.get(r.id)?.orderId}</Link> : "—"}] : []),
    ...(money && stage !== "raw" ? [{key:"amount",header:"ارزش تخمینی",render:(r:LeadListItem)=>formatMoney(r.amount)}] : []),
    {key:"next",header:"پیگیری بعدی",render:(r)=><span className="ltr">{toFaDigits(r.nextAt ?? "—")}</span>},
    {key:"owner",header:"کارشناس",render:(r)=>r.ownerName ?? "—"},
    ...(stage === "lost" ? [{key:"reason",header:"دلیل",render:(r:LeadListItem)=>r.lostReason}] : []),
    {key:"actions",header:"",render:(r)=><Button size="sm" variant="ghost" onClick={()=>onFollowup(r.id)}>چی شد؟</Button>}
  ]} />;
  return <div className="kb" style={{gridTemplateColumns:`repeat(${Math.max(1,columns.length)},minmax(240px,1fr))`}}>{columns.map((c)=><section className="kb-col" key={c.key} style={{"--column-color":c.color} as CSSProperties} onDragOver={(e)=>{ if(canMove)e.preventDefault(); }} onDrop={(e)=>{e.preventDefault(); if(canMove)setColumn(e.dataTransfer.getData("text/plain"),c.key); }}><header className="kb-h"><span className="kb-dot" /><h3>{c.label}</h3><b>{toFaDigits(rows.filter((r)=>records.get(r.id)?.column === c.key).length)}</b></header><div className="kb-list">{rows.filter((r)=>records.get(r.id)?.column === c.key).map((r)=>{const meta=records.get(r.id);return <article className="kc" key={r.id} draggable={canMove} onDragStart={(e)=>e.dataTransfer.setData("text/plain",r.id)}><div className="kc-top"><button className="kc-title" onClick={()=>onOpen(r.id)}>{r.account?.name || r.title || formatPhoneFa(r.account?.phones[0] ?? "")}</button>{money && r.amount ? <small>{formatMoney(r.amount)}</small> : null}</div><p className="kc-meta">{meta?.products.join("، ")}{meta?.products.length ? " · " : ""}{r.source || "منبع نامشخص"}</p><div className="kc-talk">{meta?.lastAt ? <><b>پیگیری</b><p>{meta.lastNote || meta.lastResult}</p></> : "هنوز هیچ تماسی گرفته نشده"}</div><div className="kc-foot"><span className="avatar">{r.ownerName?.[0] ?? "؟"}</span><span>{r.ownerName}</span><small className="ltr">{toFaDigits(r.nextAt ?? "بدون پیگیری")}</small></div><div className="kc-act"><Button size="sm" variant="ghost" onClick={()=>onFollowup(r.id)}><Icon name="phone" size="icon-sm" />{stage === "raw" ? "ثبت تماس" : "ثبت پیگیری"}</Button>{stage === "opp" ? <Link className="btn btn-sm" href={`/orders?new=1&lead=${r.id}`}>پیش‌فاکتور</Link> : meta?.orderId ? <Link className="btn btn-sm" href={`/orders/${meta.orderId}`}>دیدن پیش‌فاکتور</Link> : null}</div>{canMove ? <select className="select kb-mobile-move" aria-label="انتقال ستون" value={meta?.column ?? ""} onChange={(e)=>setColumn(r.id,e.target.value)}>{columns.map((col)=><option key={col.key} value={col.key}>{col.label}</option>)}</select> : null}</article>;})}{!rows.some((r)=>records.get(r.id)?.column===c.key) ? <p className="kb-empty">موردی نیست</p> : null}</div>{stage === "raw" && c === columns[0] ? <p className="kb-empty">سرنخ جدید را از بالای صفحه وارد کنید.</p> : null}</section>)}</div>;
}
