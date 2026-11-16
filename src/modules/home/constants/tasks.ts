import type { Role } from "@core/permissions";
import type { IconName } from "@components/ui/Icon";

export type TaskOrder = { id: string; stage: number; ownerId: string | null; customer: string; due: number; total?: number; incompleteCheques: number };
export type TaskDefinition = { key: string; name: string; icon: IconName; desc: string; stage?: number; info?: boolean; own?: boolean };
/** Exact queue names/order and predicates from Demo app/core.js:253–289. */
export const ROLE_TASKS: Readonly<Record<Role, readonly TaskDefinition[]>> = {
  admin: [],
  sales: [
    { key: "draft", name: "پیش‌فاکتورهای من", icon: "filePlus", desc: "پیش‌فاکتورهایی که باید تکمیل و برای مدیر فروش بفرستید", stage: 1 },
    { key: "send", name: "ارسال برای مشتری", icon: "send", desc: "مدیر تأیید کرده؛ پیش‌فاکتور را برای مشتری بفرستید", stage: 4 },
    { key: "wait", name: "منتظر تأیید مشتری", icon: "clock", desc: "پیش‌فاکتور رفته؛ مشتری را پیگیری کنید", stage: 5, info: true },
  ],
  salesManager: [
    { key: "review", name: "بررسی پیش‌فاکتور", icon: "userSearch", desc: "پیش‌فاکتورهای کارشناس‌ها؛ تأیید کنید تا برای مدیر برود", stage: 2 },
    { key: "draft", name: "پیش‌فاکتورهای من", icon: "filePlus", desc: "پیش‌فاکتورهایی که خودتان ساخته‌اید", stage: 1, own: true },
    { key: "send", name: "ارسال برای مشتری", icon: "send", desc: "تأیید شده؛ آماده ارسال برای مشتری", stage: 4 },
    { key: "late", name: "کارهای عقب‌افتاده", icon: "clock", desc: "سفارش‌هایی که از مهلت مرحله گذشته‌اند", info: true },
  ],
  management: [
    { key: "approve", name: "تأیید پیش‌فاکتور", icon: "shield", desc: "پیش‌فاکتورهایی که مدیر فروش تأیید کرده؛ تأیید نهایی شما لازم است", stage: 3 },
    { key: "pay", name: "تأیید مشتری و پرداخت", icon: "card", desc: "پیش‌فاکتور برای مشتری رفته؛ واریز، چک یا تأیید تلفنی را ثبت و قطعی کنید", stage: 5 },
    { key: "nochq", name: "چک‌های ناقص", icon: "alert", desc: "چک‌هایی که اطلاعاتشان کامل وارد نشده" },
  ],
  finance: [
    { key: "pay", name: "تأیید مشتری و پرداخت", icon: "card", desc: "واریزها و چک‌های مشتری را با شرایط توافق‌شده تطبیق دهید و سفارش را قطعی کنید", stage: 5 },
    { key: "nochq", name: "چک‌های ناقص", icon: "alert", desc: "سفارش قطعی شده ولی اطلاعات چک کامل نیست؛ تکمیل کنید" },
  ],
  production: [
    { key: "paccept", name: "سفارش‌های نیازمند تولید", icon: "inbox", desc: "قبول کنید و زمان تولید را تعیین کنید", stage: 6 },
    { key: "make", name: "در حال تولید", icon: "factory", desc: "شروع تولید و ثبت «تولید شد»", stage: 7 },
    { key: "qc", name: "کنترل کیفیت", icon: "fileCheck", desc: "ثبت مقدار سالم و ضایعات و ارسال به انبار دپو", stage: 8 },
  ],
  depot: [
    { key: "daccept", name: "قبول سفارش / تحویل از تولید", icon: "clipboard", desc: "محصول تولیدشده را با سند تطبیق دهید یا سفارش از موجودی را قبول کنید", stage: 9 },
    { key: "prep", name: "آماده‌سازی بار", icon: "box", desc: "بار را آماده و «آماده شد» بزنید", stage: 10 },
    { key: "deliver", name: "تحویل به مشتری", icon: "truck", desc: "خروج بار و تأیید تحویل", stage: 11 },
  ],
};

export function matchesTask(order: TaskOrder, task: TaskDefinition, userId: string, now: number): boolean {
  if (task.own && order.ownerId !== userId) return false;
  if (task.key === "late") return order.due < now;
  if (task.key === "nochq") return order.stage >= 6 && order.incompleteCheques > 0;
  return order.stage === task.stage;
}
