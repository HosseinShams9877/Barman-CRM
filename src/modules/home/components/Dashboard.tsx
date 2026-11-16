"use client";

import Link from "next/link";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { ErrorState, LoadingState } from "@components/feedback";
import { Icon } from "@components/ui/Icon";
import { toFaDigits, formatMoney } from "@core/formatting";
import { ORDER_STAGES } from "@modules/orders/constants";
import { ROLE_LABELS } from "@core/permissions";
import type { TaskOrder, TaskDefinition } from "../constants/tasks";
import { useSummaryQuery } from "../hooks/useSummary";

const PHASES = [
  { name: "پیش‌فاکتور", stages: [1, 2, 3, 4], color: "var(--color-stage-sales)" },
  { name: "مشتری و پرداخت", stages: [5], color: "var(--color-stage-approval)" },
  { name: "تولید", stages: [6, 7, 8], color: "var(--color-stage-production)" },
  { name: "انبار و تحویل", stages: [9, 10, 11], color: "var(--color-stage-fulfillment)" },
];
function dueText(due: number, now: number): string {
  if (!due) return "بدون مهلت";
  const days = Math.floor((due + 12600000) / 86400000) - Math.floor((now + 12600000) / 86400000);
  return days < 0 ? toFaDigits(-days) + " روز دیر" : days === 0 ? "امروز" : toFaDigits(days) + " روز مانده";
}
function queueHref(task: TaskDefinition): string {
  return task.key === "nochq" ? "/orders?incomplete=1" : task.key === "late" ? "/orders?overdue=1" : "/orders?stage=" + task.stage + "&status=open";
}
function Due({ order, now }: { order: TaskOrder; now: number }) {
  return <small className={order.due && order.due < now ? "text-danger" : ""}>{dueText(order.due, now)}</small>;
}

/** Demo home.js hero, next task, queues, role widgets and complete 11-stage map. */
export function Dashboard() {
  const me = useMeQuery();
  const query = useSummaryQuery(Boolean(me.data));
  if (query.isLoading || !me.data) return <LoadingState label="در حال بارگذاری داشبورد…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} onRetry={() => void query.refetch()} />;
  const w = query.data?.workspace;
  if (!w) return <LoadingState label="در حال بارگذاری میز کار…" />;
  const role = me.data.roles[0] ?? "sales";
  const actionable = w.queues.filter((q) => !q.task.info);
  const waiting = actionable.flatMap((q) => q.items.map((order) => ({ order, task: q.task }))).sort((a, b) => a.order.due - b.order.due);
  const next = waiting[0];
  const late = waiting.filter((x) => x.order.due < w.now).length;
  const hasSide = ["sales", "salesManager", "management", "finance", "depot"].includes(role);
  return <div className="home-workspace">
    <section className="pv-hi card">
      <div><h2>سلام {me.data.name.split(" ")[0]}</h2><p>{waiting.length ? <>امروز <b>{toFaDigits(waiting.length)} کار</b> منتظر شماست{late ? <> — <span className="hero-danger">{toFaDigits(late)} کار از مهلت گذشته</span></> : null}. از «کار بعدی» شروع کنید.</> : "کاری منتظر شما نیست؛ همه‌چیز طبق برنامه است."}</p></div>
      <div className="hm-hr">
        {["sales", "salesManager", "management"].includes(role) ? <Link className="btn hm-cta" href="/orders?new=1"><Icon name="plus" size="icon-sm" />پیش‌فاکتور جدید</Link> : null}
        {role === "management" ? <Link className="btn hm-cta" href="/buys?new=1"><Icon name="cart" size="icon-sm" />خرید مواد اولیه</Link> : null}
        <span className="pv-date"><Icon name="calendar" size="icon-sm" />{toFaDigits(w.today)}</span>
      </div>
    </section>
    <div className={hasSide ? "hm-grid" : "hm-grid one"}>
      <div className="hm-col">
        {next ? <section className="card hm-next">
          <span className="hm-lbl">کار بعدی شما</span><div className="hm-nb"><i><Icon name={next.task.icon} /></i><div>
            <b>{next.task.name} — <span className="ltr">{next.order.id}</span></b>
            <p>{next.order.customer}{next.order.total !== undefined ? " · " + formatMoney(next.order.total) + " ریال" : ""} · {dueText(next.order.due, w.now)}</p>
            <small>{next.task.desc}</small>
          </div><Link className="btn btn-primary hm-go" href={"/orders/" + next.order.id}>شروع کار ←</Link></div>
          {waiting.length > 1 ? <p className="hm-more">و {toFaDigits(waiting.length - 1)} کار دیگر در صف‌های پایین</p> : null}
        </section> : <section className="card hm-next ok"><i><Icon name="checkCircle" /></i><div><b>کاری منتظر شما نیست</b><p>هر وقت سفارشی به مرحله شما برسد، در صف کارهای شما نشان داده می‌شود.</p></div></section>}
        <h3 className="hm-cap">صف کارهای شما <small>به ترتیب مسیر کار</small></h3>
        <section className="hm-qs">{w.queues.filter((q) => !q.task.info || q.items.length).map(({ task, items }, index) => <article key={task.key} className={items.length ? "card hm-q" : "card hm-q empty"}>
          <header><em>{toFaDigits(index + 1)}</em><i><Icon name={task.icon} size="icon-sm" /></i><div><b>{task.name}</b><small>{task.desc}</small></div><span className="hm-qn">{toFaDigits(items.length)}</span></header>
          {items.length ? <ul>{items.slice(0, 3).map((o) => <li key={o.id}><Link href={"/orders/" + o.id}><b className="ltr">{o.id}</b><span>{o.customer}</span><Due order={o} now={w.now} /></Link></li>)}</ul> : <p className="hm-none"><Icon name="checkCircle" size="icon-sm" />خالی است</p>}
          {items.length ? <Link className="hm-all" href={queueHref(task)}>{items.length > 3 ? "دیدن همه " + toFaDigits(items.length) + " مورد" : "رفتن به صف"} ←</Link> : null}
        </article>)}</section>
      </div>
      {hasSide ? <aside className="hm-col hm-side">
        {role === "sales" || role === "salesManager" ? <section className="card hm-w"><div className="pv-h"><h3><Icon name="phone" size="icon-sm" />پیگیری‌های امروز</h3><Link className="link" href="/leads">سرنخ‌ها</Link></div>
          {w.followups.length ? <ul>{w.followups.map((l) => <li key={l.id}><Link href={"/leads?q=" + encodeURIComponent(l.customer)}><b>{l.customer}</b><small>{l.note || "تماس"} · {toFaDigits(l.due)}</small></Link></li>)}</ul> : <p className="hm-none"><Icon name="checkCircle" size="icon-sm" />پیگیری امروز ندارید</p>}
        </section> : null}
        {w.finance ? <section className="card hm-w"><div className="pv-h"><h3><Icon name="coins" size="icon-sm" />سررسیدهای ۷ روز آینده</h3></div><ul className="hm-kv">
          <li><Link href="/finance#rec"><span>دریافتنی</span><b>{formatMoney(w.finance.receivable)}</b></Link></li>
          <li><Link href="/finance#rec-d"><span>طلب سررسیدگذشته</span><b className={w.finance.overdue ? "text-danger" : ""}>{formatMoney(w.finance.overdue)}</b></Link></li>
          <li><Link href="/finance#pay"><span>پرداختنی</span><b>{formatMoney(w.finance.payable)}</b></Link></li>
        </ul></section> : null}
        {w.buyWaiting ? <Link className="card hm-alert" href={role === "depot" ? "/buys#in" : "/buys?status=" + (role === "management" ? "req" : "ok")}><Icon name="cart" size="icon-sm" /><span><b>{toFaDigits(w.buyWaiting)} خرید</b> منتظر {role === "management" ? "تأیید شماست" : role === "depot" ? "ورود به انبار" : "پرداخت شماست"}</span>←</Link> : null}
        {role === "management" ? <section className="card hm-w"><div className="pv-h"><h3><Icon name="clock" size="icon-sm" />سفارش‌های عقب از مهلت</h3><Link className="link" href="/orders">همه سفارش‌ها</Link></div>
          <ul>{w.orders.filter((o) => o.due < w.now).slice(0, 5).map((o) => <li key={o.id}><Link href={"/orders/" + o.id}><b className="ltr">{o.id}</b><small>{ORDER_STAGES.find((s) => s.step === o.stage)?.label}</small></Link></li>)}</ul>
          {w.orders.every((o) => o.due >= w.now) ? <p className="hm-none"><Icon name="checkCircle" size="icon-sm" />همه طبق برنامه</p> : null}
        </section> : null}
        {role === "depot" ? <section className="card hm-w"><div className="pv-h"><h3><Icon name="warehouse" size="icon-sm" />انبار دپو</h3></div><ul className="hm-links">
          <li><Link href="/stock#depot">موجودی دپو ←</Link></li><li><Link href="/stock#out">خروج دستی کالا ←</Link></li><li><Link href="/stock#moves">گردش انبار ←</Link></li>
        </ul></section> : null}
      </aside> : null}
    </div>
    <section className="card hm-flow"><div className="pv-h"><h3><Icon name="layers" size="icon-sm" />مسیر هر سفارش در شرکت</h3><small className="text-muted">مرحله‌هایی که با «نوبت شما» مشخص شده، کار شماست</small></div>
      <div className="hm-ph">{PHASES.map((phase, index) => <div key={phase.name} className="hm-p" style={{ "--phase-color": phase.color } as React.CSSProperties}>
        <div className="hm-pt"><em>{toFaDigits(index + 1)}</em><b>{phase.name}</b></div><ol>{phase.stages.map((step) => {
          const stage = ORDER_STAGES.find((s) => s.step === step)!;
          const task = actionable.find((q) => q.task.stage === step)?.task;
          const count = query.data?.stageCounts[step] ?? 0;
          const content = <><span className="hm-sn">{toFaDigits(step)}</span><span className="hm-st"><b>{stage.label}</b><small>{task ? "نوبت شما" : ROLE_LABELS[stage.who]}</small></span>{count ? <span className="hm-c">{toFaDigits(count)}</span> : null}</>;
          return <li key={step} className={task ? "me" : ""}>{task ? <Link href={queueHref(task)}>{content}</Link> : <div>{content}</div>}</li>;
        })}</ol>
      </div>)}</div>
    </section>
  </div>;
}
