/**
 * رندر HTML صفحه چاپ سفارش — PHASE_08 Part A (Secure print HTTP status).
 *
 * این ماژول خروجی HTML مستقل برای Route Handler `/print/orders/[id]` می‌سازد.
 * صفحه چاپ **بدون کوکی نشست** و فقط بر اساس توکن چاپ (R-01) اجرا می‌شود،
 * بنابراین نباید وابسته به لایه کلاینت/کامپوننت‌های React باشد.
 *
 * CSS: فقط قواعد ساختاری (چیدمان/جدول/فاصله) — بدون رنگ خام (D-05).
 * رنگ‌ها از پیش‌فرض‌های چاپ (مشکی روی سفید) ارث می‌رسند.
 *
 * قانون noMoney (R-32): نسخه بدون مبالغ ستون‌های پولی را حذف می‌کند.
 */
import { formatJalaliFa, instantToJalali } from "@core/calendar";
import { formatMoney, toFaDigits } from "@core/formatting";
import { getStage } from "@modules/orders/constants";
import type { PrintableOrder, PrintableOrderNoMoney } from "./print.service";

/** تبدیل ارقام به فارسی برای نمایش (CD-06). */
function fa(v: string | number): string {
  return toFaDigits(String(v));
}

function money(v: number): string {
  return formatMoney(v);
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chequeStatusLabel(status: string): string {
  switch (status) {
    case "hand":
      return "نزد ما";
    case "bank":
      return "نزد بانک";
    case "clear":
      return "وصول‌شده";
    case "bounce":
      return "برگشت‌خورده";
    default:
      return "—";
  }
}

/** تاریخ چاپ به فارسی (CD-06/CD-07) — بدون Intl. */
function printToday(): string {
  return fa(formatJalaliFa(instantToJalali(Date.now())));
}

/** اسکلت HTML کامل با استایل ساختاری مستقل (RTL، فارسی، قابل چاپ). */
function document(title: string, body: string): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Tahoma, sans-serif; line-height: 1.6; margin: 0; padding: 16px; }
  .print-page { max-width: 900px; margin: 0 auto; }
  .print-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
  .print-toolbar strong { font-size: 1.05rem; }
  .print-toolbar .spacer { flex: 1; }
  .print-toolbar a, .print-toolbar button { font: inherit; cursor: pointer; }
  .print-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; border-bottom: 2px solid currentColor; padding-bottom: 12px; margin-bottom: 16px; }
  .print-title { font-size: 1.2rem; font-weight: 700; }
  .print-note { font-size: 0.85rem; }
  .print-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 8px 16px; }
  .print-meta-key { font-size: 0.78rem; opacity: 0.75; }
  h2 { font-size: 1rem; margin: 20px 0 8px; }
  .print-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .print-table th, .print-table td { padding: 8px; border-bottom: 1px solid currentColor; text-align: start; }
  .print-table th { font-weight: 700; }
  .print-total { display: flex; flex-direction: column; gap: 8px; margin-inline-start: auto; min-width: 16rem; margin-top: 12px; }
  .print-total-row { display: flex; justify-content: space-between; gap: 16px; }
  .print-total-row[data-bold="true"] { font-weight: 800; border-top: 2px solid currentColor; padding-top: 8px; }
  .text-muted { font-size: 0.85rem; }
  footer.print-note { margin-top: 24px; border-top: 1px solid currentColor; padding-top: 8px; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** نوار ابزار چاپ — بدون hydration (دکمه window.print ساده). */
function toolbar(orderId: string, title: string): string {
  return `<div class="print-toolbar no-print">
  <strong>${esc(title)}</strong>
  <span class="spacer"></span>
  <button type="button" onclick="window.print()">چاپ پیش‌فاکتور</button>
  <a href="/orders/${esc(orderId)}">بازگشت به سفارش</a>
</div>`;
}

/**
 * HTML خطای توکن — با پیام کاربرپسند اما **بدون نشت داده**.
 * عرض می‌شود همراه با کد وضعیت HTTP صحیح در Route Handler.
 */
export function renderPrintError(orderId: string, message: string): string {
  return document(
    "چاپ سفارش",
    `<div class="print-page">
  ${toolbar(orderId, "چاپ سفارش")}
  <p class="text-muted">${esc(message)}</p>
</div>`,
  );
}

/**
 * HTML فاکتور کامل — معادل صفحه چاپ قبلی (PHASE_04 §۹) با همان فیلدها.
 */
export function renderPrintOrder(order: PrintableOrder | PrintableOrderNoMoney): string {
  const noMoney = !("calc" in order);
  const calc = noMoney ? null : order.calc;

  const itemRows = order.items
    .map((item) => {
      let moneyCells = "";
      if (!noMoney && "price" in item) {
        const amount = item.discount > 0
          ? money(Math.round(item.qty * item.price * (1 - item.discount / 100)))
          : money(item.qty * item.price);
        moneyCells = `<td>${money(item.price)}</td><td>${fa(item.discount)}٪</td><td>${amount}</td>`;
      }
      return `<tr>
  <td>${esc(item.productName)}</td>
  <td>${esc(item.color || "—")}</td>
  <td>${fa(item.qty)}</td>
  ${moneyCells}
</tr>`;
    })
    .join("\n");

  const paymentRows = noMoney
    ? ""
    : order.payments
        .map(
          (payment) => `<tr>
  <td>${payment.kind === "cash" ? "نقدی" : "کارتی"}</td>
  <td>${fa(payment.date)}</td>
  <td>${money(payment.amount)}</td>
  <td>${payment.void ? "باطل‌شده" : "ثبت‌شده"}</td>
</tr>`,
        )
        .join("\n");

  const chequeRows = noMoney
    ? ""
    : order.cheques
        .map(
          (cheque) => `<tr>
  <td>چک</td>
  <td>${fa(cheque.due)}</td>
  <td>${money(cheque.amount)}</td>
  <td>${chequeStatusLabel(cheque.status)}</td>
</tr>`,
        )
        .join("\n");

  return document(
    `پیش‌فاکتور ${order.id}`,
    `<div class="print-page">
  ${toolbar(order.id, `پیش‌فاکتور / سفارش ${order.id}`)}

  <header class="print-head">
    <div>
      <div class="print-title">${esc(order.company.name)}</div>
      <div class="print-note">${esc(order.company.tagline)}</div>
      <div class="print-note">${esc(order.company.phone)} — ${esc(order.company.address)}</div>
    </div>
    <div class="print-meta">
      <div class="print-meta-item"><span class="print-meta-key">شماره سفارش</span><span>${esc(order.id)}</span></div>
      <div class="print-meta-item"><span class="print-meta-key">مشتری</span><span>${esc(order.accountName ?? "—")}</span></div>
      <div class="print-meta-item"><span class="print-meta-key">مرحله</span><span>${esc(getStage(order.stageKey).label)}</span></div>
      <div class="print-meta-item"><span class="print-meta-key">تاریخ چاپ</span><span>${printToday()}</span></div>
    </div>
  </header>

  <section>
    <h2>اقلام سفارش</h2>
    <table class="print-table">
      <thead>
        <tr>
          <th>محصول</th><th>رنگ</th><th>مقدار</th>
          ${noMoney ? "" : "<th>قیمت واحد</th><th>تخفیف قلم</th><th>مبلغ</th>"}
        </tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="6">موردی ثبت نشده است.</td></tr>'}</tbody>
    </table>
  </section>

  ${
    noMoney
      ? ""
      : `<section class="print-total">
  <div class="print-total-row"><span>جمع اقلام</span><span>${money(calc?.sub ?? 0)}</span></div>
  <div class="print-total-row"><span>تخفیف</span><span>${money(calc?.disc ?? 0)}</span></div>
  <div class="print-total-row"><span>حمل و نصب</span><span>${money(calc?.extra ?? 0)}</span></div>
  <div class="print-total-row"><span>مالیات بر ارزش افزوده</span><span>${money(calc?.vat ?? 0)}</span></div>
  <div class="print-total-row" data-bold="true"><span>مبلغ نهایی</span><span>${money(calc?.total ?? 0)}</span></div>
</section>`
  }

  <section>
    <h2>پرداخت‌ها</h2>
    ${
      noMoney
        ? '<p class="print-note">برای نقش شما مبالغ نمایش داده نمی‌شود.</p>'
        : `<table class="print-table">
      <thead><tr><th>نوع</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th></tr></thead>
      <tbody>${
        paymentRows + chequeRows ||
        '<tr><td colspan="4">پرداختی ثبت نشده است.</td></tr>'
      }</tbody>
    </table>`
    }
  </section>

  ${order.note ? `<section><h2>یادداشت</h2><p class="print-note">${esc(order.note)}</p></section>` : ""}

  <footer class="print-note">
    اعتبار پیش‌فاکتور: ${fa(order.validDays)} روز — این مدرک توسط سامانه CRM بارمان صادر شده است.
  </footer>
</div>`,
  );
}
