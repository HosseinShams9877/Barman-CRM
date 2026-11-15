"use client";

import { useState } from "react";
import { Button, Card, DataTable, Dialog } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { ApiError } from "@core/errors";
import { formatPhoneFa, toFaDigits } from "@core/formatting";
import type { AccountListItem } from "../types/account.types";
import {
  useAccountsQuery,
  useDeactivateAccountMutation,
} from "../hooks/useAccounts";
import { accountKindLabel } from "../constants/account-kinds";
import { phoneKindLabel } from "../constants/phone-kinds";
import { useAccountQuery } from "../hooks/useAccount";
import { AccountForm } from "./AccountForm";

const PAGE_SIZE = 20;

/**
 * لیست حساب‌های مشتری — PHASE_03 §۳.۱.
 *
 * شامل: جستجو، نمایش حساب‌های غیرفعال، صفحه‌بندی، ایجاد/ویرایش/
 * غیرفعال‌سازی. همه حالت‌های query (loading/error/empty) پوشش داده
 * شده‌اند (CD-09). دکمه‌ها بر اساس مجوز کلاینت پنهان می‌شوند —
 * سرور همچنان منبع حقیقت است (R-02).
 */
export function AccountList() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canCreate = permissions.has("customers.create");
  const canEdit = permissions.has("customers.edit");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountListItem | null>(null);
  const toast = useToast();

  const query = useAccountsQuery({ q, page, pageSize: PAGE_SIZE, includeInactive });
  const deactivate = useDeactivateAccountMutation();

  const openCreate = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (item: AccountListItem): void => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDeactivate = (item: AccountListItem): void => {
    deactivate.mutate(item.id, {
      onSuccess: () => toast.push(`حساب «${item.name || item.id}» غیرفعال شد.`, "success"),
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : "خطای غیرمنتظره.";
        toast.push(message, "danger");
      },
    });
  };

  const onSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    setPage(1);
    void query.refetch();
  };

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <div className="page-head">
        <h1 className="h1">مشتریان</h1>
        {canCreate ? (
          <Button onClick={openCreate} leadingIcon={<span aria-hidden="true">+</span>}>
            حساب جدید
          </Button>
        ) : null}
      </div>

      <Card>
        <form className="toolbar" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="account-q">
              جستجو
            </label>
            <input
              id="account-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="نام، شماره تلفن یا نشانی"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="account-inactive">
              نمایش حساب‌های غیرفعال
            </label>
            <select
              id="account-inactive"
              className="select"
              value={includeInactive ? "1" : "0"}
              onChange={(e) => {
                setIncludeInactive(e.target.value === "1");
                setPage(1);
              }}
            >
              <option value="0">خیر</option>
              <option value="1">بله</option>
            </select>
          </div>
          <Button type="submit" variant="ghost" isLoading={query.isFetching}>
            جستجو
          </Button>
        </form>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال بارگذاری حساب‌ها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت حساب‌ها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          title="حسابی وجود ندارد"
          description={
            q.length > 0
              ? "نتیجه‌ای برای جستجوی شما پیدا نشد. عبارت دیگری را امتحان کنید."
              : "هنوز حساب مشتری ثبت نشده است."
          }
          action={canCreate ? <Button onClick={openCreate}>ایجاد اولین حساب</Button> : undefined}
        />
      ) : (
        <>
          <DataTable
            caption="فهرست حساب‌های مشتری"
            rowKey={(row) => row.id}
            rows={query.data?.items ?? []}
            columns={[
              {
                key: "id",
                header: "شناسه",
                render: (row) => <span dir="ltr">{row.id}</span>,
              },
              {
                key: "name",
                header: "نام",
                render: (row) => <strong>{row.name || "— بدون نام —"}</strong>,
              },
              {
                key: "kind",
                header: "نوع",
                render: (row) => accountKindLabel(row.kind),
              },
              {
                key: "phones",
                header: "تلفن‌ها",
                render: (row) =>
                  row.phones.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <div className="stack gap-1">
                      {row.phones.map((p) => (
                        <span key={p.id} dir="ltr">
                          {phoneKindLabel(p.kind) ? `${phoneKindLabel(p.kind)}: ` : ""}
                          {formatPhoneFa(p.number)}
                        </span>
                      ))}
                    </div>
                  ),
              },
              {
                key: "contactCount",
                header: "مخاطبین",
                render: (row) => toFaDigits(row.contactCount),
              },
              {
                key: "leadCount",
                header: "سرنخ‌ها",
                render: (row) => toFaDigits(row.leadCount),
              },
              {
                key: "active",
                header: "وضعیت",
                render: (row) =>
                  row.active ? (
                    <span className="tag-chip" data-tone="success">
                      فعال
                    </span>
                  ) : (
                    <span className="tag-chip" data-tone="danger">
                      غیرفعال
                    </span>
                  ),
              },
              {
                key: "actions",
                header: "عملیات",
                render: (row) => (
                  <div className="flex gap-2">
                    {canEdit ? (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        ویرایش
                      </Button>
                    ) : null}
                    {canEdit && row.active ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeactivate(row)}
                        isLoading={deactivate.isPending}
                      >
                        غیرفعال‌سازی
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />

          <div className="toolbar" aria-label="صفحه‌بندی">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              صفحه قبل
            </Button>
            <span className="text-muted">
              صفحه {toFaDigits(page)} از {toFaDigits(totalPages)} —{" "}
              {toFaDigits(query.data?.total ?? 0)} حساب
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || query.isFetching}
            >
              صفحه بعد
            </Button>
          </div>
        </>
      )}

      {dialogOpen ? (
        editing === null ? (
          <AccountForm open={dialogOpen} onClose={() => setDialogOpen(false)} account={null} />
        ) : (
          <AccountDetailDialog
            id={editing.id}
            onClose={() => setDialogOpen(false)}
          />
        )
      ) : null}
    </>
  );
}

/**
 * دیالوگ ویرایش — ابتدا جزئیات کامل حساب (با مخاطبین) از سرور خوانده
 * می‌شود، گزینه‌ای که آیتم لیست در دسترس ندارد. حالت بارگذاری داخل
 * دیالوگ نشان داده می‌شود (CD-09).
 */
function AccountDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useAccountQuery(id);
  if (detail.isLoading) {
    return (
      <Dialog open={true} onClose={onClose} size="lg" title="ویرایش حساب">
        <LoadingState label="در حال بارگذاری جزئیات حساب…" />
      </Dialog>
    );
  }
  if (detail.isError) {
    return (
      <Dialog open={true} onClose={onClose} size="lg" title="ویرایش حساب">
        <ErrorState
          title="بارگذاری ناموفق"
          message={detail.error?.message ?? "خطا در دریافت جزئیات حساب."}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      </Dialog>
    );
  }
  return detail.data ? <AccountForm open={true} onClose={onClose} account={detail.data} /> : null;
}
