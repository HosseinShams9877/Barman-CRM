"use client";

import { Button, Input } from "@components/ui";

export type ContactDraft = {
  /** شناسه موقت سمت کلاینت — برای key کردن ردیف‌ها. */
  key: string;
  name: string;
  role: string;
  phone: string;
};

export type ContactEditorProps = {
  contacts: ContactDraft[];
  onChange: (contacts: ContactDraft[]) => void;
  /** خطای هر ردیف: کلید ردیف → پیام. */
  errors?: Readonly<Record<string, ContactFieldErrors>>;
  disabled?: boolean;
};

export type ContactFieldErrors = {
  name?: string;
  phone?: string;
};

/** ساخت یک ردیف مخاطب خالی. */
export function emptyContact(): ContactDraft {
  return { key: `ct-${Math.random().toString(36).slice(2, 9)}`, name: "", role: "", phone: "" };
}

/**
 * ویرایشگر مخاطبین چندگانه حساب (PHASE_03 §۳.۱): نام اجباری، سمت و
 * تلفن اختیاری. افزودن/حذف داینامیک.
 */
export function ContactEditor({ contacts, onChange, errors, disabled }: ContactEditorProps) {
  const update = (key: string, patch: Partial<ContactDraft>): void => {
    onChange(contacts.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };
  const remove = (key: string): void => {
    onChange(contacts.filter((c) => c.key !== key));
  };
  const add = (): void => {
    onChange([...contacts, emptyContact()]);
  };

  return (
    <div className="repeat-list">
      {contacts.length === 0 ? (
        <p className="field-hint">هیچ مخاطبی ثبت نشده است.</p>
      ) : null}
      {contacts.map((c) => {
        const fieldErrors = errors?.[c.key];
        return (
          <div className="repeat-row repeat-row-4" key={c.key}>
            <Input
              id={`contact-name-${c.key}`}
              name={`contact-name-${c.key}`}
              label="نام مخاطب"
              value={c.name}
              onChange={(e) => update(c.key, { name: e.target.value })}
              error={fieldErrors?.name}
              disabled={disabled}
            />
            <Input
              id={`contact-role-${c.key}`}
              name={`contact-role-${c.key}`}
              label="سمت"
              value={c.role}
              onChange={(e) => update(c.key, { role: e.target.value })}
              disabled={disabled}
            />
            <Input
              id={`contact-phone-${c.key}`}
              name={`contact-phone-${c.key}`}
              label="تلفن"
              value={c.phone}
              onChange={(e) => update(c.key, { phone: e.target.value })}
              error={fieldErrors?.phone}
              disabled={disabled}
              inputMode="tel"
              dir="ltr"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(c.key)}
              disabled={disabled}
              aria-label="حذف این مخاطب"
              className="repeat-remove"
            >
              حذف
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={add} disabled={disabled}>
        + افزودن مخاطب
      </Button>
    </div>
  );
}
