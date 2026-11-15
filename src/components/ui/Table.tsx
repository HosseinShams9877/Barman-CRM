import type { ReactNode } from "react";
import { cn } from "@core/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  columns: readonly Column<T>[];
  rows: readonly T[];
  /** کلید منحصربه‌فرد هر ردیف. */
  rowKey: (row: T) => string;
  caption?: string;
  empty?: ReactNode;
  className?: string;
};

/**
 * جدول داده — ساختار .tbl-wrap/.tbl را پیچ می‌کند تا روی نمایشگرهای باریک
 * به جای سرریز افقی، اسکرول عمودی/خلاصه‌سازی داشته باشیم (CD-12).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("tbl-wrap", className)}>
      <table className="tbl">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty ?? "موردی وجود ندارد."}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(row) : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
