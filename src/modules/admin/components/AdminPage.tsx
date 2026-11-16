"use client";

import { useState } from "react";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { AccountList } from "@modules/customers/components/AccountList";
import { ADMIN_TABS, type AdminTabKey } from "../constants/tabs";
import { ProductCatalog } from "./ProductCatalog";
import { MaterialCatalog } from "./MaterialCatalog";
import { BomEditor } from "./BomEditor";
import { SuppliersPanel } from "./SuppliersPanel";
import { UserManager } from "./UserManager";
import { ListsEditor } from "./ListsEditor";
import { SettingsPanel } from "./SettingsPanel";
import { LeadColsPanel } from "./LeadColsPanel";

/**
 * صفحه مدیریت — تعریف و تنظیمات (PHASE_07 §۱۰ / فاز ۸: ۹ تب Demo).
 *
 * ساختار برگرفته از app/admin.js — ۹ تب (products، materials، bom،
 * customers، suppliers، users، lists، leadcols، settings). customers تب
 * مشتریان Demo را در پوسته مدیریت نشان می‌دهد (از AccountList ماژول
 * مشتریان استفاده می‌کند) و leadcols ستون‌های بورد سرنخ را.
 *
 * `initialTab` تب آغازین است (مسیرهای /admin/users و /admin/settings).
 * تب‌های قابل دیدن بر اساس مجوز نشست فیلتر می‌شوند (SEE در
 * admin.js:11) — سرور همچنان منبع حقیقت هر مسیر API است (R-02).
 */
export function AdminPage({ initialTab = "products" }: { initialTab?: AdminTabKey }) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const [active, setActive] = useState<AdminTabKey>(initialTab);

  const visibleTabs = ADMIN_TABS.filter((t) => permissions.has(t.read));
  const current = ADMIN_TABS.find((t) => t.key === active) ?? visibleTabs[0];

  if (!current) {
    return <p className="hint">شما به بخش مدیریت دسترسی ندارید.</p>;
  }

  const canEdit = permissions.has(current.write);

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <h1 className="h1">تعاریف و تنظیمات</h1>
        <p className="hint">
          {canEdit
            ? "این بخش را می‌توانید تغییر دهید؛ تغییرات همان لحظه در همه پنل‌ها اعمال می‌شود."
            : "فقط مشاهده"}
        </p>
      </div>

      <div className="seg-tabs" role="tablist" aria-label="بخش‌های مدیریت">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current.key}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="card" role="tabpanel" aria-label={current.label}>
        {current.key === "products" ? <ProductCatalog canEdit={canEdit} /> : null}
        {current.key === "materials" ? <MaterialCatalog canEdit={canEdit} /> : null}
        {current.key === "bom" ? <BomEditor canEdit={canEdit} /> : null}
        {current.key === "suppliers" ? <SuppliersPanel canEdit={canEdit} /> : null}
        {current.key === "customers" ? <AccountList /> : null}
        {current.key === "users" ? <UserManager canEdit={canEdit} /> : null}
        {current.key === "lists" ? <ListsEditor canEdit={canEdit} /> : null}
        {current.key === "leadcols" ? <LeadColsPanel canEdit={canEdit} /> : null}
        {current.key === "settings" ? <SettingsPanel canEdit={canEdit} /> : null}
      </section>
    </div>
  );
}
