"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@components/ui";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { parseFaNumber, toFaDigits } from "@core/formatting";
import { ROLE_LABELS, type Role } from "@core/permissions";
import { useSettingsQuery, useSaveSettingsMutation } from "../hooks/useAdmin";

type Props = {
  /** مجوز ویرایش (admin.settings) — فقط admin/management (FULL). */
  canEdit: boolean;
};

/**
 * فیلدهای ویرایش‌شده — مقادیر غایب از سمت سرور خوانده می‌شوند
 * (بدون effect همگان‌سازی — react-hooks lint).
 */
type Edits = {
  company?: Partial<{ name: string; en: string; tagline: string; phone: string; address: string; bale: string }>;
  vat?: string;
  validDays?: string;
  caps?: Partial<Record<Role, string>>;
};

/** نقش‌های فرم سقف تخفیف — admin.js:145 (فقط این سه نقش). */
const CAP_ROLES: readonly Role[] = ["sales", "salesManager", "management"];

function toDisplay(v: number | undefined | null): string {
  return v === undefined || v === null ? "" : toFaDigits(String(v));
}

/**
 * تنظیمات شرکت — PHASE_07 §۱۰ / دروازه خروج ۴.
 *
 * فیلدهای فرم مطابق admin.js:141-146: اطلاعات شرکت، مالیات، اعتبار
 * پیش‌فاکتور و سقف تخفیف سه نقش. ذخیره در یک ردیف singleton.
 */
export function SettingsPanel({ canEdit }: Props) {
  const query = useSettingsQuery();
  const saveMutation = useSaveSettingsMutation();
  const toast = useToast();
  const [edits, setEdits] = useState<Edits>({});
  const [vatError, setVatError] = useState<string | null>(null);

  const s = query.data;
  const company = useMemo(() => ({ ...(s?.company ?? {}), ...edits.company }), [s, edits.company]);

  const setCompany = (key: keyof NonNullable<Edits["company"]>, value: string): void => {
    setEdits((e) => ({ ...e, company: { ...e.company, [key]: value } }));
  };
  const setCap = (role: Role, value: string): void => {
    setEdits((e) => ({ ...e, caps: { ...e.caps, [role]: value } }));
  };

  const vat = edits.vat ?? toDisplay(s?.vat);
  const validDays = edits.validDays ?? toDisplay(s?.validDays);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!s) return;

    const vatNum = parseFaNumber(vat);
    if (!(vatNum >= 0 && vatNum <= 100)) {
      setVatError("مالیات بین ۰ و ۱۰۰ درصد است.");
      return;
    }
    setVatError(null);

    const caps: Partial<Record<Role, number>> = {};
    for (const r of CAP_ROLES) {
      const edited = edits.caps?.[r];
      if (edited !== undefined) {
        caps[r] = parseFaNumber(edited);
      } else if (s.discountCap?.[r] !== undefined && s.discountCap[r] !== null) {
        caps[r] = s.discountCap[r] as number;
      }
    }

    saveMutation.mutate(
      {
        vat: vatNum,
        validDays: parseFaNumber(validDays),
        company: {
          name: company.name ?? "",
          en: company.en ?? "",
          tagline: company.tagline ?? "",
          phone: company.phone ?? "",
          address: company.address ?? "",
          bale: company.bale ?? "",
        },
        discountCap: caps,
      },
      {
        onSuccess: () => {
          setEdits({});
          toast.push("تنظیمات ذخیره شد.", "success");
        },
        onError: (err) => toast.push(err instanceof ApiError ? err.message : "خطای غیرمنتظره.", "danger"),
      },
    );
  };

  if (query.isLoading) return <LoadingState label="در حال بارگذاری تنظیمات…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;
  if (!s) return null;

  return (
    <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
      <fieldset className="grid3" disabled={!canEdit}>
        <legend className="sr-only">اطلاعات شرکت</legend>
        <Input label="نام شرکت" name="c-name" value={company.name ?? ""} onChange={(e) => setCompany("name", e.target.value)} />
        <Input label="نام انگلیسی" name="c-en" value={company.en ?? ""} onChange={(e) => setCompany("en", e.target.value)} className="ltr" />
        <Input label="شعار / توضیح" name="c-tagline" value={company.tagline ?? ""} onChange={(e) => setCompany("tagline", e.target.value)} />
        <Input label="تلفن" name="c-phone" value={company.phone ?? ""} onChange={(e) => setCompany("phone", e.target.value)} className="ltr" />
        <Input label="آدرس" name="c-address" value={company.address ?? ""} onChange={(e) => setCompany("address", e.target.value)} />
        <Input label="کانال بله / سایت" name="c-bale" value={company.bale ?? ""} onChange={(e) => setCompany("bale", e.target.value)} className="ltr" />
        <Input
          label="مالیات بر ارزش افزوده (٪)"
          name="c-vat"
          inputMode="numeric"
          value={vat}
          onChange={(e) => setEdits((x) => ({ ...x, vat: e.target.value }))}
          error={vatError ?? undefined}
        />
        <Input
          label="اعتبار پیش‌فرض پیش‌فاکتور (روز)"
          name="c-valid-days"
          inputMode="numeric"
          value={validDays}
          onChange={(e) => setEdits((x) => ({ ...x, validDays: e.target.value }))}
        />
      </fieldset>

      <fieldset className="grid3" disabled={!canEdit}>
        <legend className="text-base font-semibold">سقف تخفیف هر نقش (٪)</legend>
        {CAP_ROLES.map((r) => {
          const edited = edits.caps?.[r];
          const value = edited !== undefined ? edited : toDisplay(s.discountCap?.[r] ?? 0);
          return (
            <Input
              key={r}
              label={ROLE_LABELS[r]}
              name={`cap-${r}`}
              inputMode="numeric"
              value={value}
              onChange={(e) => setCap(r, e.target.value)}
            />
          );
        })}
      </fieldset>

      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="primary" type="submit" isLoading={saveMutation.isPending} disabled={Object.keys(edits).length === 0}>
            ذخیره تنظیمات
          </Button>
        </div>
      ) : null}
    </form>
  );
}
