/**
 * انواع حساب مشتری — PHASE_03 §۳.۱ / §۶.
 *
 * این نوع‌ها قرارداد بین Route Handlerها و کامپوننت‌های UI هستند.
 * مبالغ در این ماژول وجود ندارند (حساب مشتری مبلغ ندارد — PHASE_03 §۶).
 */

/** ردیف تلفن حساب — `number` نرمال‌شده ذخیره می‌شود (core/formatting/phone). */
export type AccountPhoneRow = {
  id: string;
  kind: string;
  number: string;
};

/** ردیف مخاطب حساب. */
export type AccountContactRow = {
  id: string;
  name: string;
  role: string;
  phone: string;
};

/** حساب برای نمایش در لیست — شمارش تلفن‌ها/مخاطبین و مالک سرنخ‌ها. */
export type AccountListItem = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  address: string;
  note: string;
  phones: AccountPhoneRow[];
  contactCount: number;
  leadCount: number;
  createdAt: number;
};

/** حساب کامل با مخاطبین. */
export type AccountDetail = AccountListItem & {
  contacts: AccountContactRow[];
};

/** خروجی لیست با صفحه‌بندی. */
export type AccountListResult = {
  items: AccountListItem[];
  total: number;
  page: number;
  pageSize: number;
};
