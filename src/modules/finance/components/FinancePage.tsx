/**
 * FinancePage — صفحه مالی (PHASE_06 §۶/§۱۲).
 *
 * ترکیب‌کننده صفحه: سرصفحه + دکمه ثبت تراکنش، لیست تراکنش‌ها،
 * طلب‌ها (بر اساس حساب)، بدهی‌ها (بر اساس تأمین‌کننده) و گزارش
 * جریان نقدی ماهانه. این کامپوننت حالت دیالوگ ثبت تراکنش را نگه
 * می‌دارد و باز کردن آن را از بخش‌های طلب/بدهی هم ممکن می‌کند.
 *
 * مجوز دکمه‌ها کلاینت است؛ منبع حقیقت سرور است (R-02/CD-05).
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useUrlHash } from "@core/utils/useUrlHash";
import { PageHeader } from "@components/shared/PageHeader";
import { Icon } from "@components/ui/Icon";
import { FinanceLedger } from "./FinanceLedger";
import { Button } from "@components/ui";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { TxnDialog } from "./TxnDialog";
import { TxnsView } from "./TxnsView";
import { CashflowReport } from "./CashflowReport";

export function FinancePage() {
  const me = useMeQuery();
  const canCreate = new Set(me.data?.permissions ?? []).has("finance.edit");

  const [dialogOpen, setDialogOpen] = useState(false);
  const hash = useUrlHash().slice(1);
  const tab = hash.startsWith("pay") ? "pay" : "rec";
  const sub = hash.endsWith("-d") ? "d" : hash.endsWith("-c") ? "c" : "";
  const openDialog = (): void => setDialogOpen(true);

  return (
    <>
      <PageHeader icon="coins" title="سررسیدها و بدهکاری‌ها" description="دریافتنی‌ها، پرداختنی‌ها و چک‌ها؛ سررسیدها را در بازه دلخواه بررسی کنید.">
        {canCreate ? (
          <Button onClick={openDialog} leadingIcon={<span aria-hidden="true">+</span>}>
            ثبت هزینه / دریافت
          </Button>
        ) : null}
      </PageHeader>

      <div className="seg-tabs panel-tabs card" role="tablist" aria-label="مالی"><Link role="tab" aria-selected={tab === "rec" && hash !== "txns" && hash !== "cashflow"} href="#rec"><Icon name="download" size="icon-sm" />دریافتنی‌ها</Link><Link role="tab" aria-selected={tab === "pay" && hash !== "txns" && hash !== "cashflow"} href="#pay"><Icon name="upload" size="icon-sm" />پرداختنی‌ها</Link><Link role="tab" aria-selected={hash === "txns"} href="#txns">دریافت و پرداخت‌ها</Link><Link role="tab" aria-selected={hash === "cashflow"} href="#cashflow">جریان نقدی</Link></div>
      {hash !== "txns" && hash !== "cashflow" ? <nav className="fn-tabs" aria-label="زیربخش مالی">{[["", "سررسیدها"],["d",tab === "rec" ? "بدهکاران" : "بدهکاری‌های ما"],["c",tab === "rec" ? "چک‌های دریافتی" : "چک‌های صادره"]].map(([key,label]) => <Link key={key} href={`#${tab}${key ? "-"+key : ""}`} aria-current={sub === key ? "page" : undefined}>{label}</Link>)}</nav> : null}

      <div className="stack gap-8">
        {hash === "txns" ? <section className="stack gap-4" aria-labelledby="finance-txns-head">
          <h2 className="h3" id="finance-txns-head">
            تراکنش‌ها
          </h2>
          <TxnsView />
        </section> : null}

        {tab === "rec" && sub === "d" ? <section className="stack gap-4" aria-labelledby="finance-receivables-head">
          <h2 className="h3" id="finance-receivables-head">
            طلب‌های دریافتی
          </h2>
          <FinanceLedger direction="rec" pastDue />
        </section> : null}

        {tab === "pay" && sub === "d" ? <section className="stack gap-4" aria-labelledby="finance-payables-head">
          <h2 className="h3" id="finance-payables-head">
            بدهی‌های پرداختی
          </h2>
          <FinanceLedger direction="pay" pastDue />
        </section> : null}

        {hash === "cashflow" ? <section className="stack gap-4" aria-labelledby="finance-cashflow-head">
          <h2 className="h3" id="finance-cashflow-head">
            جریان نقدی
          </h2>
          <CashflowReport />
        </section> : null}
        {hash !== "txns" && hash !== "cashflow" && sub !== "d" ? <FinanceLedger direction={tab} chequesOnly={sub === "c"} /> : null}
      </div>

      {canCreate && dialogOpen ? (
        <TxnDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      ) : null}
    </>
  );
}
