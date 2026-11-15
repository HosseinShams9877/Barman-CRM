/**
 * آزمون سرویس حساب‌های مشتری — PHASE_3 درگاه خروج ۳.
 *
 * سهام کلیدی:
 *  - شناسه‌های متوالی AC- از SEQ0.AC = ۱۰۰ (app/core.js:364).
 *  - شماره تلفن نرمال‌شده یکتا بین همه حساب‌ها → ۴۰۹ با پیام Demo
 *    (app/order.js:288).
 *  - حساب ناموجود → ۴۰۴.
 *  - phones/contacts ارسالی در ویرایش جایگزین کامل می‌شوند.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => {
  const tx = {
    account: { update: vi.fn() },
    accountPhone: { deleteMany: vi.fn() },
    accountContact: { deleteMany: vi.fn() },
  };
  return {
    prisma: {
      account: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
      accountPhone: { findFirst: vi.fn(), findMany: vi.fn() },
      lead: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
      leadFollowup: { findMany: vi.fn(), create: vi.fn() },
      // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
      role: { upsert: vi.fn() },
      user: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
      setting: { upsert: vi.fn() },
      rev: { upsert: vi.fn() },
      list: { upsert: vi.fn() },
      product: { count: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
      $disconnect: vi.fn(),
      __tx: tx,
    },
  };
});

import { prisma } from "@core/database/client";
import {
  createAccount,
  deactivateAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from "./account.service";

const mocked = vi.mocked(prisma) as unknown as {
  account: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  accountPhone: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    account: { update: ReturnType<typeof vi.fn> };
    accountPhone: { deleteMany: ReturnType<typeof vi.fn> };
    accountContact: { deleteMany: ReturnType<typeof vi.fn> };
  };
};

/** پارامترهای لیست — معادل z.infer<typeof listAccountsQuerySchema>. */
type ListQuery = { q: string; includeInactive: boolean; page: number; pageSize: number };

const LIST_QUERY: ListQuery = { q: "", includeInactive: false, page: 1, pageSize: 50 };

/** یک رکورد حساب کامل برای findUnique/create شامل includeهای سرویس. */
function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "AC-101",
    name: "شرکت نمونه",
    kind: "customer",
    active: true,
    address: "تهران",
    note: "",
    createdAt: 1000,
    updatedAt: 1000,
    phones: [{ id: "p1", kind: "همراه", number: "09121234567" }],
    contacts: [{ id: "c1", name: "رضا", role: "مدیر خرید", phone: "09131112233" }],
    leads: [{ id: "LD-1001" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAccounts — فیلترها", () => {
  it("حساب‌های غیرفعال به‌صورت پیش‌فرض پنهان می‌شوند", async () => {
    mocked.account.count.mockResolvedValue(0);
    mocked.account.findMany.mockResolvedValue([]);
    await listAccounts(LIST_QUERY);
    const args = mocked.account.findMany.mock.calls[0]?.[0] as { where: { active?: boolean } };
    expect(args.where.active).toBe(true);
  });

  it("includeInactive=true فیلتر active را برمی‌دارد", async () => {
    mocked.account.count.mockResolvedValue(0);
    mocked.account.findMany.mockResolvedValue([]);
    await listAccounts({ ...LIST_QUERY, includeInactive: true });
    const args = mocked.account.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where.active).toBeUndefined();
  });

  it("جستجو روی نام، شماره و آدرس (OR)", async () => {
    mocked.account.count.mockResolvedValue(0);
    mocked.account.findMany.mockResolvedValue([]);
    await listAccounts({ ...LIST_QUERY, q: "0912" });
    const args = mocked.account.findMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(Array.isArray(args.where.OR)).toBe(true);
    expect(args.where.OR.length).toBe(3);
  });

  it("آیتم لیست ساخته می‌شود: شمارش مخاطب/سرنخ + صفحه‌بندی", async () => {
    mocked.account.count.mockResolvedValue(1);
    mocked.account.findMany.mockResolvedValue([accountRow()]);
    const out = await listAccounts({ ...LIST_QUERY, page: 2, pageSize: 10 });
    expect(out.total).toBe(1);
    expect(out.items[0]?.id).toBe("AC-101");
    expect(out.items[0]?.contactCount).toBe(1);
    expect(out.items[0]?.leadCount).toBe(1);
    const args = mocked.account.findMany.mock.calls[0]?.[0] as { skip: number; take: number };
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });
});

describe("getAccount", () => {
  it("حساب پیدا نشد → ۴۰۴", async () => {
    mocked.account.findUnique.mockResolvedValue(null);
    await expect(getAccount("AC-999")).rejects.toMatchObject({ status: 404 });
  });

  it("جزئیات با مخاطبین مرتب‌شده فارسی برمی‌گردد", async () => {
    mocked.account.findUnique.mockResolvedValue(
      accountRow({
        contacts: [
          { id: "c2", name: "یاسمن", role: "", phone: "" },
          { id: "c1", name: "رضا", role: "مدیر خرید", phone: "09131112233" },
        ],
      }),
    );
    const out = await getAccount("AC-101");
    expect(out.contacts[0]?.name).toBe("رضا");
    expect(out.contacts[1]?.name).toBe("یاسمن");
  });
});

describe("createAccount — مسیر خوش", () => {
  it("شناسه AC- بعدی از SEQ0 ساخته می‌شود (core.js:364)", async () => {
    mocked.accountPhone.findFirst.mockResolvedValue(null);
    mocked.account.findMany.mockResolvedValue([{ id: "AC-101" }]);
    mocked.account.create.mockResolvedValue(accountRow());

    const out = await createAccount({
      name: "شرکت نمونه",
      kind: "customer",
      active: true,
      address: "تهران",
      note: "",
      phones: [{ kind: "همراه", number: "09121234567" }],
      contacts: [],
    });

    expect(out.id).toBe("AC-101");
    const args = mocked.account.create.mock.calls[0]?.[0] as { data: { id: string; createdAt: number } };
    expect(args.data.id).toBe("AC-102");
    expect(typeof args.data.createdAt).toBe("number");
  });
});

describe("createAccount — نقض قانون کسب‌وکار", () => {
  it("شماره تکراری روی حساب دیگر → ۴۰۹ با پیام Demo (order.js:288)", async () => {
    mocked.accountPhone.findFirst.mockResolvedValue({
      number: "09121234567",
      account: { name: "شرکت رقیب" },
    });

    await expect(
      createAccount({
        name: "x",
        kind: "customer",
        active: true,
        address: "",
        note: "",
        phones: [{ kind: "", number: "09121234567" }],
        contacts: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'این شماره برای «شرکت رقیب» ثبت شده؛ از فهرست انتخابش کنید.',
    });
    expect(mocked.account.create).not.toHaveBeenCalled();
  });

  it("برنامه خالی → بدون فراخوانی بررسی تکرار", async () => {
    mocked.account.findMany.mockResolvedValue([]);
    mocked.account.create.mockResolvedValue(accountRow({ phones: [] }));
    await createAccount({
      name: "x",
      kind: "unknown",
      active: true,
      address: "",
      note: "",
      phones: [],
      contacts: [],
    });
    expect(mocked.accountPhone.findFirst).not.toHaveBeenCalled();
  });
});

describe("updateAccount", () => {
  it("حساب پیدا نشد → ۴۰۴", async () => {
    mocked.account.findUnique.mockResolvedValue(null);
    await expect(updateAccount("AC-999", { name: "y" })).rejects.toMatchObject({ status: 404 });
  });

  it("phones ارسالی جایگزین کامل می‌شوند: حذف کامل سپس ایجاد", async () => {
    mocked.account.findUnique.mockResolvedValue(accountRow());
    mocked.accountPhone.findFirst.mockResolvedValue(null);
    mocked.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mocked.__tx));
    // خروجی تراکنش همان account.update است
    const updated = accountRow({
      phones: [{ id: "p2", kind: "دفتری", number: "02122334455" }],
    });
    mocked.__tx.account.update.mockResolvedValue(updated);

    await updateAccount("AC-101", {
      phones: [{ kind: "دفتری", number: "02122334455" }],
    });

    const delPhones = mocked.__tx.accountPhone.deleteMany.mock.calls[0]?.[0] as { where: { accountId: string } };
    expect(delPhones.where.accountId).toBe("AC-101");
    const update = mocked.__tx.account.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { phones: { create: unknown[] }; updatedAt: number };
    };
    expect(update.where.id).toBe("AC-101");
    expect(update.data.phones.create).toEqual([{ kind: "دفتری", number: "02122334455" }]);
    expect(typeof update.data.updatedAt).toBe("number");
  });

  it("بدون phones → deleteMany صدا زده نمی‌شود", async () => {
    mocked.account.findUnique.mockResolvedValue(accountRow());
    mocked.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mocked.__tx));
    mocked.__tx.account.update.mockResolvedValue(accountRow());

    await updateAccount("AC-101", { name: "نام جدید" });
    expect(mocked.__tx.accountPhone.deleteMany).not.toHaveBeenCalled();
    expect(mocked.accountPhone.findFirst).not.toHaveBeenCalled();
  });

  it("شماره تکراری در حساب دیگر → ۴۰۹ (حساب فعلی مستثنی می‌شود)", async () => {
    mocked.account.findUnique.mockResolvedValue(accountRow());
    mocked.accountPhone.findFirst.mockResolvedValue({
      number: "02122334455",
      account: { name: "اکانت دیگر" },
    });

    await expect(
      updateAccount("AC-101", { phones: [{ kind: "دفتری", number: "02122334455" }] }),
    ).rejects.toMatchObject({ status: 409 });
    const args = mocked.accountPhone.findFirst.mock.calls[0]?.[0] as {
      where: { accountId?: { not: string } };
    };
    expect(args.where.accountId).toEqual({ not: "AC-101" });
  });
});

describe("deactivateAccount", () => {
  it("حساب پیدا نشد → ۴۰۴", async () => {
    mocked.account.findUnique.mockResolvedValue(null);
    await expect(deactivateAccount("AC-999")).rejects.toMatchObject({ status: 404 });
    expect(mocked.account.update).not.toHaveBeenCalled();
  });

  it("حذف نرم: active=false با مهر زمان", async () => {
    mocked.account.findUnique.mockResolvedValue(accountRow());
    mocked.account.update.mockResolvedValue(accountRow({ active: false }));
    await deactivateAccount("AC-101");
    const args = mocked.account.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { active: boolean; updatedAt: number };
    };
    expect(args.where.id).toBe("AC-101");
    expect(args.data.active).toBe(false);
    expect(typeof args.data.updatedAt).toBe("number");
  });
});
