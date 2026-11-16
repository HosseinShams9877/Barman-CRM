/**
 * MovesTable — لیست حرکت‌های انبار (PHASE_05 §۱۰).
 *
 * repr: outView/useView در Demo (app/stock.js:۵۳/۸۶) — یک فهرست از
 * حرکت‌ها با فیلتر انبار/نوع و جستجو. جستجو روی نام/کد/شناسه قلم
 * در سرور اعمال می‌شود (move.service: listMoves).
 *
 * ویرایش/حذف فقط برای حرکت‌های دستی `open`/`out`/`adj` (PHASE_05 §۸)؛
 * مجوز دکمه‌ها کلاینت فیلتر می‌شود ولی سرور منبع حقیقت است (CD-05).
 */
"use client";

import { useState } from "react";
import { Button, Card, DataTable, Dialog } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatJalaliFa, parseJalali } from "@core/calendar";
import { toFaDigits } from "@core/formatting";
import { useMovesQuery } from "../hooks/useMoves";
import { useDeleteMoveMutation } from "../hooks/useMoveMutations";
import { MoveFormDialog } from "./MoveFormDialog";
import { EditMoveDialog } from "./EditMoveDialog";
import { MOVE_KIND_LABELS, MOVE_KINDS, WAREHOUSE_LABELS } from "../constants";
import type { MoveKind, Warehouse } from "../constants";
import type { MoveListParams, MoveRow } from "../types/move.types";

const PAGE_SIZE = 20;

/** تاریخ خالص `YYYY/MM/DD` به نمایش فارسی — اگر نامعتبر بود خود رشته. */
function isoToFa(iso: string): string {
  const parsed = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

/** آیا این حرکت قابل ویرایش/حذف است؟ — فقط kinds دستی open/out/adj. */
function isEditable(row: MoveRow): boolean {
  return (["open", "out", "adj"] as readonly string[]).includes(row.kind);
}

/**
 * فهرست حرکت‌ها — فیلترها در کلید query می‌نشینند (CD-09).
 */
export function MovesTable({ defaultWarehouse = "" }: { defaultWarehouse?: Warehouse | "" }) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canMove = permissions.has("inventory.moves");

  const [wh, setWh] = useState<Warehouse | "">(defaultWarehouse);
  const [kind, setKind] = useState<MoveKind | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<MoveRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<MoveRow | null>(null);

  const params: MoveListParams = {
    wh: wh === "" ? null : (wh as Warehouse),
    kind: kind === "" ? null : (kind as MoveKind),
    q,
    page,
    pageSize: PAGE_SIZE,
  };
  const query = useMovesQuery(params);
  const deleteMove = useDeleteMoveMutation();
  const toast = useToast();

  const onSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    setPage(1);
    void query.refetch();
  };

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  const onDelete = (): void => {
    if (!deleteRow) return;
    deleteMove.mutate(deleteRow.id, {
      onSuccess: () => {
        toast.push("حرکت حذف شد.", "success");
        setDeleteRow(null);
      },
      onError: (error) => toast.push(error.message, "danger"),
    });
  };

  return (
    <>
      <div className="page-head">
        <h1 className="h1">حرکت‌های انبار</h1>
        {canMove ? (
          <Button onClick={() => setCreateOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
            ثبت حرکت
          </Button>
        ) : null}
      </div>

      <Card>
        <form className="toolbar" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="moves-q">
              جستجو
            </label>
            <input
              id="moves-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="نام یا کد قلم"
            />
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="moves-wh">
              انبار
            </label>
            <select
              id="moves-wh"
              className="select"
              value={wh}
              onChange={(e) => {
                setWh(e.target.value as Warehouse | "");
                setPage(1);
              }}
            >
              <option value="">هر دو انبار</option>
              {(Object.keys(WAREHOUSE_LABELS) as Warehouse[]).map((k) => (
                <option key={k} value={k}>
                  {WAREHOUSE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="moves-kind">
              نوع حرکت
            </label>
            <select
              id="moves-kind"
              className="select"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as MoveKind | "");
                setPage(1);
              }}
            >
              <option value="">همه نوع‌ها</option>
              {MOVE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MOVE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="ghost" isLoading={query.isFetching}>
            جستجو
          </Button>
        </form>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال بارگذاری حرکت‌ها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت حرکت‌ها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          title="حرکتی وجود ندارد"
          description={
            q.length > 0 || wh !== "" || kind !== ""
              ? "نتیجه‌ای برای فیلترهای شما پیدا نشد."
              : "هنوز حرکت انباری ثبت نشده است."
          }
          action={
            canMove ? (
              <Button onClick={() => setCreateOpen(true)}>ثبت اولین حرکت</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            caption="فهرست حرکت‌های انبار"
            rowKey={(row) => row.id}
            rows={query.data?.items ?? []}
            columns={[
              {
                key: "day",
                header: "تاریخ",
                render: (row: MoveRow) => <span dir="ltr">{isoToFa(row.day)}</span>,
              },
              {
                key: "wh",
                header: "انبار",
                render: (row: MoveRow) => <span>{WAREHOUSE_LABELS[row.wh]}</span>,
              },
              {
                key: "item",
                header: "قلم",
                render: (row: MoveRow) => (
                  <span>
                    {row.itemName} <span className="text-muted" dir="ltr">({row.itemCode})</span>
                  </span>
                ),
              },
              {
                key: "qty",
                header: "مقدار",
                render: (row: MoveRow) => (
                  <span dir="ltr">
                    {row.qty > 0 ? "+" : ""}
                    {toFaDigits(formatQty(row.qty))} {row.unit}
                  </span>
                ),
              },
              {
                key: "kind",
                header: "نوع",
                render: (row: MoveRow) => (
                  <span className="tag-chip" data-tone={row.qty >= 0 ? "info" : "danger"}>
                    {row.kindLabel}
                  </span>
                ),
              },
              {
                key: "ref",
                header: "سند",
                render: (row: MoveRow) =>
                  row.ref ? <span dir="ltr">{row.ref}</span> : <span className="text-muted">—</span>,
              },
              {
                key: "note",
                header: "علت",
                render: (row: MoveRow) =>
                  row.note ? <span>{row.note}</span> : <span className="text-muted">—</span>,
              },
              ...(canMove
                ? [
                    {
                      key: "actions" as const,
                      header: "عملیات",
                      render: (row: MoveRow) =>
                        isEditable(row) ? (
                          <span className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditRow(row)}>
                              ویرایش
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteRow(row)}
                            >
                              حذف
                            </Button>
                          </span>
                        ) : (
                          <span className="text-muted">سیستمی</span>
                        ),
                    },
                  ]
                : []),
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
              {toFaDigits(query.data?.total ?? 0)} حرکت
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

      {createOpen ? <MoveFormDialog open={createOpen} onClose={() => setCreateOpen(false)} /> : null}
      {editRow ? (
        <EditMoveDialog move={editRow} onClose={() => setEditRow(null)} />
      ) : null}

      {deleteRow ? (
        <Dialog
          open
          title="حذف حرکت"
          description="این عمل قابل بازگشت است — موجودی دوباره از حرکت‌های باقی‌مانده محاسبه می‌شود."
          onClose={() => setDeleteRow(null)}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteRow(null)}>
                انصراف
              </Button>
              <Button variant="danger" isLoading={deleteMove.isPending} onClick={onDelete}>
                حذف
              </Button>
            </>
          }
        >
          <p>
            آیا از حذف حرکت <span dir="ltr">{deleteRow.kindLabel}</span> برای قلم{" "}
            <strong>{deleteRow.itemName}</strong> به مقدار{" "}
            <span dir="ltr">
              {toFaDigits(formatQty(deleteRow.qty))} {deleteRow.unit}
            </span>{" "}
            مطمئن هستید؟
          </p>
        </Dialog>
      ) : null}
    </>
  );
}

/** گردسازی ۳ رقم برای نمایش مقدار (همان round3 در Demo — app/core.js:۱۲). */
function formatQty(qty: number): string {
  return String(Math.round(qty * 1000) / 1000);
}
