"use client";

import { useState } from "react";
import { Button, DataTable, Dialog, Input } from "@components/ui";
import { Icon } from "@components/ui/Icon";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { ROLES, ROLE_LABELS, type Role } from "@core/permissions";
import { ROLE_DESCRIPTIONS } from "../constants/roleDescriptions";
import type { AdminUserRow } from "../services/user.service";
import {
  useAdminUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
} from "../hooks/useAdmin";

/** نقش‌های قابل تخصیص در فرم — admin.js:124 (select تک‌انتخابی). */
const ASSIGNABLE_ROLES: readonly Role[] = ROLES;

type Props = {
  /** مجوز ویرایش (admin.users) — فقط admin/management (FULL). */
  canEdit: boolean;
};

type FormState = {
  name: string;
  role: Role;
  title: string;
  off: boolean;
  password: string;
};

function emptyForm(): FormState {
  return { name: "", role: "sales", title: "", off: false, password: "" };
}

function toForm(u: AdminUserRow): FormState {
  return { name: u.name, role: u.roles[0] ?? "sales", title: u.title, off: u.off, password: "" };
}

/**
 * مدیریت کاربران — فهرست + ایجاد/ویرایش/غیرفعال‌سازی (PHASE_07 §۱۰).
 *
 * هر کاربر دقیقاً یک نقش دارد (admin.js:124). غیرفعال‌سازی کاربر را حذف
 * نمی‌کند — نشست او در سرور باطل می‌شود (دروازه خروج ۱).
 */
export function UserManager({ canEdit }: Props) {
  const query = useAdminUsersQuery();
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  };

  const openEdit = (u: AdminUserRow): void => {
    setEditing(u);
    setForm(toForm(u));
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors((s) => ({ ...s, name: "نام کاربر را وارد کنید." }));
      return;
    }
    if (!editing && form.password.length < 6) {
      setErrors((s) => ({ ...s, password: "رمز حداقل ۶ نویسه است." }));
      return;
    }

    const onOk = (): void => {
      toast.push(editing ? "کاربر ذخیره شد." : "کاربر ساخته شد.", "success");
      setOpen(false);
    };
    const onErr = (err: unknown): void => {
      const message = err instanceof ApiError ? err.message : "خطای غیرمنتظره.";
      if (message.includes("نام")) setErrors((st) => ({ ...st, name: message }));
      else toast.push(message, "danger");
    };
    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          data: {
            name: form.name.trim(),
            role: form.role,
            title: form.title.trim(),
            off: form.off,
            ...(form.password ? { password: form.password } : {}),
          },
        },
        { onSuccess: onOk, onError: onErr },
      );
    } else {
      createMutation.mutate(
        {
          name: form.name.trim(),
          role: form.role,
          title: form.title.trim(),
          off: form.off,
          password: form.password,
        },
        { onSuccess: onOk, onError: onErr },
      );
    }
  };

  const dialog = (
    <Dialog
      open={open}
      title={editing ? "ویرایش کاربر" : "کاربر جدید"}
      onClose={() => setOpen(false)}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            انصراف
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="user-form"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <form id="user-form" className="grid2" onSubmit={submit} noValidate>
        <Input
          label="نام"
          name="uname"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          error={errors["name"]}
          required
        />
        <div className="field">
          <label className="field-label" htmlFor="u-role">
            نقش
          </label>
          <select
            id="u-role"
            className="select"
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as Role }))}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="سمت"
          name="utitle"
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
        />
        <Input
          label={editing ? "رمز جدید (خالی یعنی بدون تغییر)" : "رمز اولیه"}
          name="upassword"
          type="password"
          value={form.password}
          onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          error={errors["password"]}
          required={!editing}
          hint={editing ? undefined : "رمز حداقل ۶ نویسه است"}
        />
        <div className="field">
          <label className="field-label" htmlFor="u-off">
            وضعیت
          </label>
          <select
            id="u-off"
            className="select"
            value={form.off ? "1" : "0"}
            onChange={(e) => setForm((s) => ({ ...s, off: e.target.value === "1" }))}
          >
            <option value="0">فعال</option>
            <option value="1">غیرفعال</option>
          </select>
        </div>
      </form>
    </Dialog>
  );

  if (query.isLoading) return <LoadingState label="در حال بارگذاری کاربران…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <>
        <EmptyState
          title="کاربری ثبت نشده"
          description="اولین کاربر سیستم را ایجاد کنید."
          action={
            canEdit ? (
              <Button variant="primary" onClick={openCreate}>
                کاربر جدید
              </Button>
            ) : undefined
          }
        />
        {canEdit ? dialog : null}
      </>
    );
  }

  return (
    <div className="admin-users-table">
      <div className="admin-toolbar">
        <p className="hint">
          هر کاربر یک نقش دارد؛ نقش تعیین می‌کند چه صفحه‌ها و کارهایی را ببیند.
        </p>
        {canEdit ? (
          <Button
            variant="primary"
            leadingIcon={<Icon name="plus" size="icon-sm" />}
            onClick={openCreate}
          >
            کاربر جدید
          </Button>
        ) : null}
      </div>
      <DataTable<AdminUserRow>
        caption="فهرست کاربران"
        rows={items}
        rowKey={(u) => u.id}
        columns={[
          {
            key: "name",
            header: "کاربر",
            render: (u) => (
              <span className="user-cell">
                <span className="avatar" data-role={u.roles[0]}>
                  {u.name[0]}
                </span>
                <b>{u.name}</b>
              </span>
            ),
          },
          {
            key: "role",
            header: "نقش",
            render: (u) => ROLE_LABELS[u.roles[0] ?? "sales"] ?? u.roles[0],
          },
          { key: "title", header: "سمت", render: (u) => u.title || "—" },
          {
            key: "access",
            header: "دسترسی",
            render: (u) => <small>{u.roles.map((r) => ROLE_DESCRIPTIONS[r]).join("، ")}</small>,
          },
          {
            key: "off",
            header: "وضعیت",
            render: (u) =>
              u.off ? (
                <span className="tag-chip">غیرفعال</span>
              ) : (
                <span className="tag-chip" data-tone="success">
                  فعال
                </span>
              ),
          },
          {
            key: "actions",
            header: "",
            render: (u) =>
              canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Icon name="edit" size="icon-sm" />}
                  onClick={() => openEdit(u)}
                >
                  ویرایش
                </Button>
              ) : null,
          },
        ]}
      />
      {canEdit ? dialog : null}
    </div>
  );
}
