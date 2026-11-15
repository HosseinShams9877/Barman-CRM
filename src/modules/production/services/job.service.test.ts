/**
 * آزمون‌های سرویس کار تولید — PHASE_05 §۱۲ (دروازه خروج ۲ و ۳).
 *
 * جریان کامل plan → run → qc → receive با اثر جانبی روی حرکت‌ها:
 *  - ایجاد: فقط محصولات خط تولید (app/prod.js:74) + bomSnapshot؛
 *  - شروع: guard کسری BOM (app/prod.js:121) + حرکت‌های use در تراکنش؛
 *  - QC: good + waste ≤ qty (PHASE_05 §۳.۷)؛
 *  - دریافت: حرکت job در دپو + status done.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";

// --- الگوی mock مطابق فاز ۴ ---------------------------------------------

type JobDoc = {
  id: string;
  productId: string;
  qty: number;
  color: string | null;
  end: bigint | null;
  status: string;
  good: number | null;
  waste: number | null;
  startedAt: bigint | null;
  qcAt: bigint | null;
  recvQty: number | null;
  recvAt: bigint | null;
  bomSnapshot: unknown;
  createdAt: bigint;
  updatedAt: bigint;
  createdBy: string;
};

let jobs: JobDoc[] = [];
let moves: { id: string; wh: string; item: string; qty: number; kind: string; ref: string | null; at: bigint; byUserId: string | null; note: string }[] = [];

const PRODUCT = {
  id: "p1",
  name: "پنل سه‌بعدی گچی",
  code: "BR-101",
  unit: "متر مربع",
  line: "prod",
};
const AGENCY_PRODUCT = { ...PRODUCT, id: "p2", code: "AG-201", line: "agency" };

const BOM = [
  { productId: "p1", materialId: "m1", qty: 8.1 },
  { productId: "p1", materialId: "m2", qty: 0.054 },
];
const MATERIALS = [
  { id: "m1", name: "گچ", code: "RM-101", unit: "کیلو" },
  { id: "m2", name: "رزین", code: "RM-105", unit: "کیلو" },
];

let onHand: Record<string, number> = {};

// فکتوری vi.mock بالا برده (hoist) می‌شود، پس tx باید در vi.hoisted ساخته
// شود تا هنگام ساخت شیء prisma در دسترس باشد (الگوی فاز ۴). بدنه‌ی توابع
// آرایه‌های jobs/moves را فقط در زمان اجرا می‌خوانند — یعنی بعد از
// مقداردهی اولیه‌ی متغیرهای ماژول.
const tx = vi.hoisted(() => ({
  move: {
    create: vi.fn(async (args: { data: any }) => {
      moves.push(args.data);
      return args.data;
    }),
  },
  job: {
    update: vi.fn(async (args: { where: { id: string }; data: any }) => {
      const doc = jobs.find((j) => j.id === args.where.id)!;
      Object.assign(doc, args.data);
      return { ...doc, product: PRODUCT, creator: { name: "ali" } };
    }),
  },
}));

vi.mock("@core/database/client", () => ({
  prisma: {
    product: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        if (args.where.id === "p1") return PRODUCT;
        if (args.where.id === "p2") return AGENCY_PRODUCT;
        return null;
      }),
      findMany: vi.fn(async () => [PRODUCT]),
      count: vi.fn(async () => 0),
    },
    bomItem: {
      findMany: vi.fn(async (args?: { where?: { productId?: string } }) => {
        const pid = args?.where?.productId;
        return BOM.filter((b) => pid === undefined || b.productId === pid);
      }),
    },
    material: {
      findMany: vi.fn(async (args?: { select?: unknown }) =>
        args?.select ? MATERIALS.map((m) => ({ id: m.id, name: m.name })) : MATERIALS,
      ),
    },
    move: {
      groupBy: vi.fn(async () =>
        Object.entries(onHand).map(([item, qty]) => ({ wh: "raw", item, _sum: { qty } })),
      ),
    },
    job: {
      findMany: vi.fn(async (args?: { select?: { id?: boolean }; where?: { status?: string } }) => {
        let rows = [...jobs];
        if (args?.where?.status) rows = rows.filter((j) => j.status === args.where!.status);
        if (args?.select?.id) return rows.map((j) => ({ id: j.id }));
        return rows.map((j) => ({ ...j, product: PRODUCT, creator: { name: "ali" } }));
      }),
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        const doc = jobs.find((j) => j.id === args.where.id);
        return doc ? { ...doc, product: PRODUCT, creator: { name: "ali" } } : null;
      }),
      count: vi.fn(async (args?: { where?: { status?: string } }) => {
        if (!args?.where?.status) return jobs.length;
        return jobs.filter((j) => j.status === args.where!.status).length;
      }),
      create: vi.fn(async (args: { data: any }) => {
        const doc: JobDoc = {
          ...args.data,
          good: null,
          waste: null,
          startedAt: null,
          qcAt: null,
          recvQty: null,
          recvAt: null,
        };
        jobs.push(doc);
        return { ...doc, product: PRODUCT, creator: { name: "ali" } };
      }),
      update: tx.job.update,
    },
    user: {
      findMany: vi.fn(async () => [{ id: "u1", name: "ali" }]),
      count: vi.fn(async () => 0),
      upsert: vi.fn(),
    },
    role: { upsert: vi.fn() },
    setting: { upsert: vi.fn() },
    rev: { upsert: vi.fn() },
    list: { upsert: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    $disconnect: vi.fn(),
  },
}));

import { createJob, getJob, listJobs, qcJob, receiveJob, startJob, updateJob } from "./job.service";

const actor = { userId: "u1", roles: ["production"] };

function seedPlanJob(overrides: Partial<JobDoc> = {}): JobDoc {
  const job: JobDoc = {
    id: "PJ-501",
    productId: "p1",
    qty: 10,
    color: null,
    end: 1_800_000_000_000n,
    status: "plan",
    good: null,
    waste: null,
    startedAt: null,
    qcAt: null,
    recvQty: null,
    recvAt: null,
    bomSnapshot: [],
    createdAt: 1_000_000n,
    updatedAt: 1_000_000n,
    createdBy: "u1",
    ...overrides,
  };
  jobs = [job];
  moves = [];
  return job;
}

beforeEach(() => {
  onHand = { m1: 3500, m2: 105 };
  jobs = [];
  moves = [];
  vi.clearAllMocks();
});

describe("createJob — ایجاد کار (app/prod.js:118)", () => {
  it("کار با وضعیت plan و bomSnapshot ساخته می‌شود", async () => {
    const job = await createJob({ productId: "p1", qty: 10 }, actor);
    expect(job.status).toBe("plan");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.bomSnapshot).toHaveLength(2);
    expect((job.bomSnapshot as any[])[0]!.total).toBe(81);
  });

  it("شناسه با پیشوند PJ- ساخته می‌شود (X.nextId(\"PJ\"))", async () => {
    seedPlanJob({ id: "PJ-501" });
    const job = await createJob({ productId: "p1", qty: 5 }, actor);
    expect(job.id).toMatch(/^PJ-\d+$/);
    expect(job.id).not.toBe("PJ-501");
  });

  it("محصول ناموجود رد می‌شود", async () => {
    await expect(
      createJob({ productId: "ghost", qty: 5 }, actor),
    ).rejects.toThrow(/وجود ندارد/);
  });

  it("فقط محصولات خط تولید مجازند (app/prod.js:74)", async () => {
    await expect(
      createJob({ productId: "p2", qty: 5 }, actor),
    ).rejects.toThrow(/خط تولید/);
  });

  it("تاریخ پایان پیش‌فرض ۳ روز بعد است (app/prod.js:75)", async () => {
    const before = Date.now();
    const job = await createJob({ productId: "p1", qty: 5 }, actor);
    const end = job.end ?? 0;
    const diffDays = (end - before) / (24 * 3600 * 1000);
    expect(diffDays).toBeGreaterThanOrEqual(2.9);
    expect(diffDays).toBeLessThanOrEqual(3.1);
  });

  it("رنگ خالی به null تبدیل می‌شود", async () => {
    const job = await createJob({ productId: "p1", qty: 5, color: "  " }, actor);
    expect(job.color).toBeNull();
  });
});

describe("startJob — شروع تولید با guard کسری (app/prod.js:121)", () => {
  it("شروع مجاز: حرکت‌های use منفی در raw با ref کار ساخته می‌شود", async () => {
    seedPlanJob();
    const job = await startJob("PJ-501", actor);
    expect(job.status).toBe("run");
    expect(job.startedAt).not.toBeNull();
    expect(moves).toHaveLength(2);
    const useMoves = moves.filter((m) => m.kind === "use");
    expect(useMoves).toHaveLength(2);
    // 8.1 × 10 = 81
    expect(useMoves.find((m) => m.item === "m1")?.qty).toBe(-81);
    expect(useMoves.find((m) => m.item === "m1")?.wh).toBe("raw");
    expect(useMoves.find((m) => m.item === "m1")?.ref).toBe("PJ-501");
    expect(useMoves.find((m) => m.item === "m2")?.qty).toBeCloseTo(-0.54, 5);
  });

  it("کار در تراکنش به‌روز می‌شود (بدون حرکت ییتیم)", async () => {
    seedPlanJob();
    await startJob("PJ-501", actor);
    expect(tx.job.update).toHaveBeenCalledTimes(1);
    expect(tx.move.create).toHaveBeenCalledTimes(2);
    expect(jobs[0]!.status).toBe("run");
  });

  it("کسری BOM کار را مسدود می‌کند («مواد اولیه کافی نیست»)", async () => {
    seedPlanJob();
    onHand = { m1: 50, m2: 105 }; // نیاز m1 = 81
    await expect(startJob("PJ-501", actor)).rejects.toThrow(
      /مواد اولیه کافی نیست.*گچ/,
    );
    // حرکتی ساخته نشده و وضعیت تغییر نکرده
    expect(moves).toHaveLength(0);
    expect(jobs[0]!.status).toBe("plan");
  });

  it("کار با وضعیت غیر plan قابل شروع نیست", async () => {
    seedPlanJob({ status: "run" });
    await expect(startJob("PJ-501", actor)).rejects.toThrow(/قابل شروع نیست/);
  });

  it("کار ناموجود → ۴۰۴", async () => {
    await expect(startJob("PJ-999", actor)).rejects.toThrow();
  });

  it("موجودی بعد از شروع به‌روز می‌شود (مصرف مواد از raw)", async () => {
    seedPlanJob();
    await startJob("PJ-501", actor);
    // حرکت use در moves است — جمع جبری موجودی raw|m1 را کم می‌کند
    const sum = moves.filter((m) => m.kind === "use" && m.item === "m1").reduce((a, m) => a + m.qty, 0);
    expect(sum).toBe(-81);
  });
});

describe("updateJob — گذار run → qc (app/prod.js:123)", () => {
  it("گذار run → qc مجاز است", async () => {
    seedPlanJob({ status: "run" });
    const job = await updateJob("PJ-501", { status: "qc" }, actor);
    expect(job.status).toBe("qc");
  });

  it("گذار از plan → qc رد می‌شود", async () => {
    seedPlanJob({ status: "plan" });
    await expect(updateJob("PJ-501", { status: "qc" }, actor)).rejects.toThrow(
      /گذار وضعیت مجاز نیست/,
    );
  });

  it("گذار به وضعیت غیر qc رد می‌شود", async () => {
    seedPlanJob({ status: "run" });
    await expect(updateJob("PJ-501", { status: "done" }, actor)).rejects.toThrow(
      /گذار وضعیت مجاز نیست/,
    );
  });
});

describe("qcJob — کنترل کیفیت (PHASE_05 §۳.۷)", () => {
  it("good + waste ≤ qty مجاز است", async () => {
    seedPlanJob({ status: "qc", qty: 100 });
    const job = await qcJob("PJ-501", { good: 95, waste: 5 }, actor);
    expect(job.status).toBe("sent");
    expect(job.good).toBe(95);
    expect(job.waste).toBe(5);
    expect(job.qcAt).not.toBeNull();
  });

  it("good + waste > qty با خطای فارسی رد می‌شود (قانون سرور)", async () => {
    seedPlanJob({ status: "qc", qty: 100 });
    await expect(
      qcJob("PJ-501", { good: 90, waste: 20 }, actor),
    ).rejects.toThrow(/مجموع سالم و ضایعات/);
    // وضعیت تغییر نکرده
    expect(jobs[0]!.status).toBe("qc");
    expect(jobs[0]!.good).toBeNull();
  });

  it("good = qty و waste = 0 مجاز است", async () => {
    seedPlanJob({ status: "qc", qty: 100 });
    const job = await qcJob("PJ-501", { good: 100, waste: 0 }, actor);
    expect(job.status).toBe("sent");
    expect(job.waste).toBe(0);
  });

  it("ثبت QC در وضعیت غیر qc رد می‌شود", async () => {
    seedPlanJob({ status: "run" });
    await expect(qcJob("PJ-501", { good: 5, waste: 0 }, actor)).rejects.toThrow(
      /کنترل کیفیت/,
    );
  });
});

describe("receiveJob — دریافت در دپو (app/stock.js:73)", () => {
  it("حرکت job مثبت در depot با ref کار ساخته می‌شود", async () => {
    seedPlanJob({ status: "sent", good: 80, waste: 2 });
    const job = await receiveJob("PJ-501", {}, actor);
    expect(job.status).toBe("done");
    expect(job.recvQty).toBe(80);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.kind).toBe("job");
    expect(moves[0]!.wh).toBe("depot");
    expect(moves[0]!.item).toBe("p1");
    expect(moves[0]!.qty).toBe(80);
    expect(moves[0]!.ref).toBe("PJ-501");
  });

  it("مقدار پیش‌فرض good است (app/stock.js:73)", async () => {
    seedPlanJob({ status: "sent", good: 80, waste: 2 });
    const job = await receiveJob("PJ-501", {}, actor);
    expect(job.recvQty).toBe(80);
  });

  it("مقدار اختیاری مجاز است + هشدار غیرمسدود", async () => {
    seedPlanJob({ status: "sent", good: 80, waste: 2 });
    const job = await receiveJob("PJ-501", { qty: 75 }, actor);
    expect(job.recvQty).toBe(75);
    expect(job.warning).toContain("یکسان نیست");
  });

  it("مقدار دریافت صفر رد می‌شود", async () => {
    seedPlanJob({ status: "sent", good: 80, waste: 2 });
    await expect(receiveJob("PJ-501", { qty: 0 }, actor)).rejects.toThrow(
      /بزرگ‌تر از صفر/,
    );
  });

  it("دریافت در وضعیت غیر sent رد می‌شود", async () => {
    seedPlanJob({ status: "qc" });
    await expect(receiveJob("PJ-501", {}, actor)).rejects.toThrow(/فرستاده به دپو/);
  });
});

describe("getJob / listJobs — خواندن", () => {
  it("جزئیات کار با bomSnapshot برمی‌گردد", async () => {
    seedPlanJob({ bomSnapshot: [{ materialId: "m1", code: "RM-101", name: "گچ", unit: "کیلو", perUnit: 8.1, total: 81, onHand: 3500, short: 0 }] });
    const job = await getJob("PJ-501");
    expect(job.id).toBe("PJ-501");
    expect((job.bomSnapshot as any[])).toHaveLength(1);
  });

  it("کار ناموجود → ۴۰۴", async () => {
    await expect(getJob("PJ-999")).rejects.toThrow();
  });

  it("لیست با فیلتر وضعیت", async () => {
    seedPlanJob({ status: "plan" });
    jobs.push({ ...jobs[0]!, id: "PJ-502", status: "run" });
    const result = await listJobs({ status: "run", q: "", page: 1, pageSize: 50 });
    expect(result.total).toBe(1);
    expect(result.items[0]!.status).toBe("run");
  });

  it("لیست همه کارها بدون فیلتر", async () => {
    seedPlanJob();
    jobs.push({ ...jobs[0]!, id: "PJ-502" });
    const result = await listJobs({ status: null, q: "", page: 1, pageSize: 50 });
    expect(result.items).toHaveLength(2);
  });
});

describe("جریان کامل یکپارچه plan → done (PHASE_05 §۳)", () => {
  it("کل چرخه با حرکت‌های صحیح انجام می‌شود", async () => {
    const created = await createJob({ productId: "p1", qty: 10 }, actor);
    const started = await startJob(created.id, actor);
    expect(started.status).toBe("run");
    // مرحله qc با updateJob
    await updateJob(created.id, { status: "qc" }, actor);
    const qcd = await qcJob(created.id, { good: 9, waste: 1 }, actor);
    expect(qcd.status).toBe("sent");
    const done = await receiveJob(created.id, { qty: 9 }, actor);
    expect(done.status).toBe("done");
    expect(done.recvQty).toBe(9);
    // حرکت‌ها: ۲ use (شروع) + ۱ job (دریافت)
    expect(moves.filter((m) => m.kind === "use")).toHaveLength(2);
    expect(moves.filter((m) => m.kind === "job")).toHaveLength(1);
    // همه حرکت‌ها ref کار دارند (بدون حرکت ییتیم)
    expect(moves.every((m) => m.ref === created.id)).toBe(true);
    // هیچ حرکت double-count نشده: use در raw + job در depot
    expect(moves.filter((m) => m.wh === "raw")).toHaveLength(2);
    expect(moves.filter((m) => m.wh === "depot")).toHaveLength(1);
  });
});
