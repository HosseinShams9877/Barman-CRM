/**
 * سرویس پرداخت‌ها و چک‌های سفارش — منطق کسب‌وکار (CD-04 گام ۴).
 *
 * قوانین کسب‌کار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - پرداخت‌ها و چک‌ها فقط روی سفارش لغو‌نشده ثبت می‌شوند.
 *  - جمع پرداخت‌های باطل‌نشده + چک‌های تأییدشده (clear) نباید از مبلغ کل
 *    سفارش بیشتر شود (PHASE_04 §۶ — تلورانس ۱ ریال، order.js:147 ok4).
 *  - چک جدید با وضعیت «hand» ثبت می‌شود (Demo: order_cheques) و فقط وقتی
 *    وضعیت به «clear» تغییر می‌کند به عنوان پرداخت تلقی می‌شود
 *    (core.js:245-250).
 *  - باطل‌کردن پرداخت (p.void — Demo) حذف نرم است و جمع را کم می‌کند.
 *  - تاریخ پرداخت/سررسید چک خالص `YYYY/MM/DD` با ارقام ASCII ذخیره
 *    می‌شود (CD-06).
 *  - noMoney (R-32): خروجی از طریق getOrder(hideMoney) فیلتر می‌شود.
 *
 * بررسی مجوز در Route Handler انجام می‌شود (CD-04 گام ۲) — این سرویس
 * فرض می‌کند فراخوانی مجاز است.
 */
import { z } from "zod";
import { prisma } from "@core/database/client";
import { badRequest, notFound } from "@core/errors";
import { getSettings } from "@modules/settings";
import type { Prisma } from "@prisma/client";
import { getOrder, calcOrder } from "./order.service";
import {
  PAYMENT_TOLERANCE,
  createChequeSchema,
  createPaymentSchema,
  updateChequeSchema,
  updatePaymentSchema,
} from "../schemas/order.schema";

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type CreateChequeInput = z.infer<typeof createChequeSchema>;
export type UpdateChequeInput = z.infer<typeof updateChequeSchema>;

type Actor = { userId: string; roles: string[] };

/** رکورد order با اقلام/پرداخت‌ها/چک‌ها برای محاسبه جمع. */
type MoneyRow = Prisma.OrderGetPayload<{
  include: { items: true; payments: true; cheques: true };
}>;

async function loadMoneyRow(id: string): Promise<MoneyRow> {
  const row = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: true, cheques: true },
  });
  if (!row) throw notFound("سفارش مورد نظر پیدا نشد.");
  if (row.status === "cancelled") throw badRequest("سفارش لغو شده است.");
  return row;
}

/** جمع فعلی دریافتی‌ها — پرداخت‌های باطل‌نشده + چک‌های تأییدشده (core.js:245-250). */
export function paidOf(row: { payments: { void: boolean; amount: number }[]; cheques: { status: string; amount: number }[] }): number {
  const paySum = row.payments.filter((p) => !p.void).reduce((a, p) => a + p.amount, 0);
  const chqSum = row.cheques.filter((c) => c.status === "clear").reduce((a, c) => a + c.amount, 0);
  return paySum + chqSum;
}

/** مبلغ کل سفارش — محاسبه‌شده، نه ذخیره‌شده (CD-29). */
function totalOf(row: MoneyRow, vat: number): number {
  return calcOrder(row.items, {
    discPct: row.discPct,
    discAmt: row.discAmt,
    ship: row.ship,
    install: row.install,
    noVat: row.noVat,
    vat,
  }).total;
}

/**
 * بررسی عدم تجاوز جمع دریافتی‌ها از مبلغ کل (PHASE_04 §۶).
 *
 * @param addition مبلغ جدیدی که به دریافتی‌ها اضافه می‌شود.
 * @throws badRequest اگر جمع از کل بیشتر شود.
 */
function assertWithinTotal(row: MoneyRow, addition: number, vat: number): void {
  const total = totalOf(row, vat);
  const sum = paidOf(row) + addition;
  if (sum > total + PAYMENT_TOLERANCE) {
    throw badRequest("مبلغ پرداختی از مبلغ کل سفارش بیشتر است.");
  }
}

/** ثبت پرداخت دریافتی — نقد یا کارتی (KIND — core.js:242). */
export async function createPayment(
  orderId: string,
  input: CreatePaymentInput,
  actor: Actor,
  hideMoney: boolean,
) {
  const row = await loadMoneyRow(orderId);
  const settings = await getSettings();
  assertWithinTotal(row, input.amount, settings.vat);

  await prisma.orderPayment.create({
    data: {
      orderId,
      kind: input.kind,
      amount: input.amount,
      date: input.date,
      note: input.note,
      byUserId: actor.userId,
      createdAt: Date.now(),
    },
  });
  await logPayment(orderId, actor, `پرداخت ${input.kind === "cash" ? "نقدی" : "کارتی"} ثبت شد.`);
  return getOrder(orderId, hideMoney);
}

/** باطل‌کردن یا یادداشت پرداخت (p.void — Demo). */
export async function updatePayment(
  orderId: string,
  paymentId: string,
  input: UpdatePaymentInput,
  actor: Actor,
  hideMoney: boolean,
) {
  const row = await loadMoneyRow(orderId);
  const payment = row.payments.find((p) => p.id === paymentId);
  if (!payment) throw notFound("پرداخت مورد نظر پیدا نشد.");

  if (input.void !== undefined) {
    // باطل‌کردن جمع را کم می‌کند — نیازی به بررسی سقف نیست.
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { void: input.void },
    });
    await logPayment(orderId, actor, input.void ? "پرداخت باطل شد." : "باطل‌کردن پرداخت لغو شد.");
  }
  if (input.note !== undefined) {
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { note: input.note },
    });
  }
  return getOrder(orderId, hideMoney);
}

/** ثبت چک دریافتی — وضعیت اولیه «hand» (نزد ما — Demo). */
export async function createCheque(
  orderId: string,
  input: CreateChequeInput,
  actor: Actor,
  hideMoney: boolean,
) {
  const row = await loadMoneyRow(orderId);
  // چک «hand» جزو دریافتی‌ها حساب نمی‌شود — فقط چک «clear» (core.js:245-250).

  await prisma.orderCheque.create({
    data: {
      orderId,
      sayad: input.sayad,
      amount: input.amount,
      due: input.due,
      status: "hand",
      bank: input.bank,
      owner: input.owner,
      note: input.note,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
  await logPayment(orderId, actor, "چک دریافتی ثبت شد.");
  return getOrder(orderId, hideMoney);
}

/** ویرایش چک — وضعیت بانکی و اطلاعات (fin). */
export async function updateCheque(
  orderId: string,
  chequeId: string,
  input: UpdateChequeInput,
  actor: Actor,
  hideMoney: boolean,
) {
  const row = await loadMoneyRow(orderId);
  const cheque = row.cheques.find((c) => c.id === chequeId);
  if (!cheque) throw notFound("چک مورد نظر پیدا نشد.");

  const becomesClear = input.status === "clear" && cheque.status !== "clear";
  if (becomesClear) {
    const settings = await getSettings();
    assertWithinTotal(row, cheque.amount, settings.vat);
  }

  await prisma.orderCheque.update({
    where: { id: chequeId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.bank !== undefined ? { bank: input.bank } : {}),
      ...(input.owner !== undefined ? { owner: input.owner } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      updatedAt: Date.now(),
    },
  });
  if (becomesClear) {
    await logPayment(orderId, actor, "چک وصول شد.");
  }
  return getOrder(orderId, hideMoney);
}

/** ورودی تاریخچه پرداخت — یادداشت بدون تغییر مرحله (kind "stage"). */
async function logPayment(orderId: string, actor: Actor, note: string): Promise<void> {
  await prisma.orderStageLog.create({
    data: {
      orderId,
      fromStage: null,
      toStage: 0,
      at: Date.now(),
      byUserId: actor.userId,
      note,
      kind: "stage",
    },
  });
}
