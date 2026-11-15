/**
 * lib/kinds.ts — منطق علامت‌گذاری حرکت‌ها (PHASE_05 §۵ lib).
 *
 * Demo موجودی را با جمع جبری qty محاسبه می‌کند:
 *   `onHand(wh, item)` — app/core.js:۲۰۶:
 *     moves().reduce((s, m) => (m.wh === wh && m.item === item && !m.pending
 *                                ? s + m.qty : s), 0)
 * یعنی علامت qty خود حرکت معنای ورود/خروج را مشخص می‌کند و کلاینت Demo
 * علامت را هنگام ثبت می‌سازد: `addMove({qty: k === "adj+" ? q : -q, …})`
 * (app/stock.js:۶۹ و ۸۸).
 *
 * در این پلتفرم، API مقدار **مثبت** qty را از کلاینت می‌گیرد و علامت را
 * بر اساس kind در سرور اعمال می‌کند (PHASE_05 §۱۲: «اعتبارسنجی علامت
 * بر اساس kind») — مگر `adj` که مقدار علامت‌دار مستقیم ارسال می‌شود.
 */
import { SIGN_BY_KIND, type MoveKind } from "../constants";

/**
 * علامت‌دهی qty بر اساس kind.
 *
 * @param kind نوع حرکت.
 * @param qty  مقدار واردشده توسط کاربر (مثبت) — برای `adj` علامت‌دار.
 * @returns مقدار نهایی که در `moves.qty` ذخیره می‌شود.
 *
 * `adj` از همین مقدار استفاده می‌کند چون دوطرفه است (adj−/adj+ در دمو).
 */
export function signedQty(kind: MoveKind, qty: number): number {
  const dir = SIGN_BY_KIND[kind];
  if (dir === 0) return qty;
  return dir * Math.abs(qty);
}

/**
 * آیا kind سیستمی است (فقط از عملیات کسب‌کار ساخته می‌شود)؟
 * برعکس MANUAL_ENTRY_KINDS.
 */
export function isSystemKind(kind: MoveKind): boolean {
  return !(["open", "out", "adj", "waste"] as readonly string[]).includes(kind);
}
