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
import { Button } from "@components/ui";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { TxnDialog } from "./TxnDialog";
import { TxnsView } from "./TxnsView";
import { ReceivablesView } from "./ReceivablesView";
import { PayablesView } from "./PayablesView";
import { CashflowReport } from "./CashflowReport";

export function FinancePage() {
  const me = useMeQuery();
  const canCreate = new Set(me.data?.permissions ?? []).has("finance.edit");

  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = (): void => setDialogOpen(true);

  return (
    <>
      <div className="page-head">
        <h1 className="h1">مالی</h1>
        {canCreate ? (
          <Button onClick={openDialog} leadingIcon={<span aria-hidden="true">+</span>}>
            ثبت هزینه / دریافت
          </Button>
        ) : null}
      </div>

      <div className="stack gap-8">
        <section className="stack gap-4" aria-labelledby="finance-txns-head">
          <h2 className="h3" id="finance-txns-head">
            تراکنش‌ها
          </h2>
          <TxnsView />
        </section>

        <section className="stack gap-4" aria-labelledby="finance-receivables-head">
          <h2 className="h3" id="finance-receivables-head">
            طلب‌های دریافتی
          </h2>
          <ReceivablesView onNewIncome={canCreate ? openDialog : undefined} />
        </section>

        <section className="stack gap-4" aria-labelledby="finance-payables-head">
          <h2 className="h3" id="finance-payables-head">
            بدهی‌های پرداختی
          </h2>
          <PayablesView onNewExpense={canCreate ? openDialog : undefined} />
        </section>

        <section className="stack gap-4" aria-labelledby="finance-cashflow-head">
          <h2 className="h3" id="finance-cashflow-head">
            جریان نقدی
          </h2>
          <CashflowReport />
        </section>
      </div>

      {canCreate && dialogOpen ? (
        <TxnDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      ) : null}
    </>
  );
}
