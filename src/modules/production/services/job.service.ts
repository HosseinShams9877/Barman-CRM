/**
 * سرویس کار تولید — بازسازی جریان `app/prod.js` (۱۱۷–۱۲۴) و `app/stock.js`
 * (۷۳–۷۸) — CLAUDE.md §۱۳: هر قانون با ارجاع به خط Demo ثبت شده است.
 *
 *  - ایجاد کار: app/prod.js:118-119 (data-jnew) — محصول + qty + color + end.
 *  - شروع کار: app/prod.js:121-122 (data-jstart) — guard کسری BOM («مواد
 *    اولیه کافی نیست») سپس حرکت‌های `use` (منفی) به ازای هر ماده +
 *    `status: "run"` + `startedAt`.
 *  - تولید شد: app/prod.js:123 (data-jmade) — `status: "qc"`.
 *  - ثبت QC: app/prod.js:124 (data-jqc) — good/waste + `status: "sent"` + qcAt.
 *  - دریافت دپو: app/stock.js:73-78 (jrecv) — حرکت `kind: "job"` با qty،
 *    `status: "done"` + recvQty/recvAt.
 *
 * اصل حرکت‌های سیستمی (PHASE_05 §۸/§۱۲): هر حرکت در همان تراکنش با
 * عملیات کسب‌کارش ایجاد می‌شود — حرکت ییتیم یا شمارش دوگانه نیست.
 */
import { prisma } from "@core/database/client";
import { Prisma } from "@prisma/client";
import { badRequest, conflict, notFound } from "@core/errors";
import { newMoveId, nextPrefixedId } from "@core/database";
import { instantToJalaliIso } from "@core/calendar";
import { computeOnHand } from "@modules/inventory/services/stock.service";
import { signedQty } from "@modules/inventory/lib/kinds";
import {
  JOB_ID_PREFIX,
  JOB_STATUS,
  JOB_STATUS_LABELS,
  JOB_TRANSITIONS,
} from "../constants";
import type {
  BomLine,
  CreateJobInput,
  JobDetail,
  JobListParams,
  JobListResult,
  JobRow,
  QcInput,
  ReceiveInput,
  UpdateJobInput,
} from "../types/job.types";
import { buildBomPreview, computeBomNeed, round3 } from "./bom.service";

/** اجراکننده عملیات — از نشست سرور پر می‌شود. */
export interface JobActor {
  userId: string;
  roles: string[];
}

/** تبدیل ردیف Prisma به JobRow (نقشه مستقیم فیلدهای Demo). */
function toRow(
  j: {
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
    createdAt: bigint;
    createdBy: string;
    product?: { name: string; code: string; unit: string } | null;
    creator?: { name: string } | null;
  },
): JobRow {
  const status = j.status as (typeof JOB_STATUS)[number];
  return {
    id: j.id,
    productId: j.productId,
    productName: j.product?.name ?? j.productId,
    productCode: j.product?.code ?? "",
    unit: j.product?.unit ?? "",
    qty: round3(j.qty),
    color: j.color,
    end: j.end === null ? null : Number(j.end),
    status,
    statusLabel: JOB_STATUS_LABELS[status] ?? status,
    good: j.good === null ? null : round3(j.good),
    waste: j.waste === null ? null : round3(j.waste),
    startedAt: j.startedAt === null ? null : Number(j.startedAt),
    qcAt: j.qcAt === null ? null : Number(j.qcAt),
    recvQty: j.recvQty === null ? null : round3(j.recvQty),
    recvAt: j.recvAt === null ? null : Number(j.recvAt),
    endDay: j.end === null ? null : instantToJalaliIso(Number(j.end)),
    createdAt: Number(j.createdAt),
    createdByName: j.creator?.name ?? j.createdBy,
  };
}

/** بارگذاری کار با روابط — یا خطای ۴۰۴. */
async function loadJobOr404(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: { product: true, creator: true },
  });
  if (!job) throw notFound("کار تولید پیدا نشد.");
  return job;
}

/** تبدیل bomSnapshot ذخیره‌شده به BomLine[]. */
function parseBomSnapshot(raw: unknown): BomLine[] {
  if (!Array.isArray(raw)) return [];
  return raw as BomLine[];
}

/** جزئیات کار با پیش‌نمایش BOM ذخیره‌شده. */
export async function getJob(id: string): Promise<JobDetail> {
  const job = await loadJobOr404(id);
  return { ...toRow(job), bomSnapshot: parseBomSnapshot(job.bomSnapshot) };
}

/**
 * GET /api/jobs — لیست کارها با فیلتر وضعیت و جستجوی محصول/شناسه.
 *
 * Demo: `jobs().sort((a,b) => b.created - a.created)` — app/prod.js:73.
 * جستجو روی نام/کد محصول و شناسه کار انجام می‌شود.
 */
export async function listJobs(params: JobListParams): Promise<JobListResult> {
  const where: { status?: string; OR?: object[] } = {};
  if (params.status) where.status = params.status;
  const q = params.q.trim().toLowerCase();
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { product: { name: { contains: q } } },
      { product: { code: { contains: q } } },
    ];
  }

  const [rows, total, products, creators] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { product: true, creator: true },
    }),
    prisma.job.count({ where }),
    prisma.product.findMany({ select: { id: true, name: true, code: true, unit: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const creatorById = new Map(creators.map((u) => [u.id, u.name]));

  const items = rows.map((r) =>
    toRow({
      ...r,
      color: r.color,
      product: productById.get(r.productId) ?? null,
      creator: r.createdBy ? { name: creatorById.get(r.createdBy) ?? r.createdBy } : null,
    }),
  );

  return { items, total, page: params.page, pageSize: params.pageSize };
}

/**
 * POST /api/jobs — ایجاد کار جدید — data-jnew در Demo (app/prod.js:118).
 *
 * فقط محصولات خط تولید مجازند — `X.products("prod")` (app/prod.js:74).
 * پیش‌نمایش BOM به‌عنوان `bomSnapshot` ذخیره می‌شود (PHASE_05 §۶).
 */
export async function createJob(input: CreateJobInput, actor: JobActor): Promise<JobDetail> {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw badRequest("محصول انتخاب‌شده وجود ندارد.");

  // app/prod.js:74 — فقط محصولات خط تولید
  if (product.line !== "prod") {
    throw badRequest("فقط محصولات خط تولید داخلی برای کار تولید مجاز هستند.");
  }

  const preview = await buildBomPreview(input.productId, input.qty);
  const existing = await prisma.job.findMany({ select: { id: true } });
  const id = nextPrefixedId(JOB_ID_PREFIX, existing.map((j) => j.id));
  const now = Date.now();
  const end = input.end ?? now + 3 * 24 * 60 * 60 * 1000;

  const job = await prisma.job.create({
    data: {
      id,
      productId: input.productId,
      qty: round3(input.qty),
      color: input.color?.trim() || null,
      end: BigInt(end),
      status: "plan",
      bomSnapshot: preview.lines as unknown as Prisma.InputJsonValue,
      createdBy: actor.userId,
      createdAt: BigInt(now),
      updatedAt: BigInt(now),
    },
    include: { product: true, creator: true },
  });

  return { ...toRow(job), bomSnapshot: preview.lines };
}

/**
 * POST /api/jobs/[id]/start — شروع تولید — data-jstart (app/prod.js:121).
 *
 * قانون Demo: اگر کسری BOM باشد مسدود می‌شود («مواد اولیه کافی نیست:
 * <نام مواد>»)؛ در غیر این صورت به ازای هر ماده BOM حرکت `use` با مقدار
 * منفی ایجاد می‌شود و وضعیت به `run` می‌رود.
 *
 * همه در یک تراکنش — حرکت ییتیم نمی‌ماند (PHASE_05 §۸).
 */
export async function startJob(id: string, actor: JobActor): Promise<JobDetail> {
  const job = await loadJobOr404(id);
  if (job.status !== "plan") {
    throw conflict(`این کار در وضعیت «${JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] ?? job.status}» است و قابل شروع نیست.`);
  }

  // app/prod.js:121 — guard کسری BOM
  const [need, onHandMap] = await Promise.all([
    computeBomNeed(job.productId, job.qty),
    computeOnHand(),
  ]);
  const materialNames = await prisma.material.findMany({ select: { id: true, name: true } });
  const nameById = new Map(materialNames.map((m) => [m.id, m.name]));
  const shortages: string[] = [];
  for (const [materialId, required] of Object.entries(need)) {
    const have = onHandMap[`raw|${materialId}`] ?? 0;
    if (have < required) shortages.push(nameById.get(materialId) ?? materialId);
  }
  if (shortages.length) {
    throw badRequest(`مواد اولیه کافی نیست: ${shortages.join("، ")}`);
  }

  const now = Date.now();
  // app/prod.js:122 — حرکت‌های use + انتقال وضعیت، در یک تراکنش
  const updated = await prisma.$transaction(async (tx) => {
    for (const [materialId, required] of Object.entries(need)) {
      await tx.move.create({
        data: {
          id: newMoveId(),
          wh: "raw",
          item: materialId,
          qty: signedQty("use", round3(required)),
          kind: "use",
          ref: job.id,
          at: BigInt(now),
          byUserId: actor.userId,
          note: `تولید برای انبار ${job.id}`,
        },
      });
    }
    return tx.job.update({
      where: { id: job.id },
      data: { status: "run", startedAt: BigInt(now), updatedAt: BigInt(now) },
      include: { product: true, creator: true },
    });
  });

  return { ...toRow(updated), bomSnapshot: parseBomSnapshot(updated.bomSnapshot) };
}

/**
 * PATCH /api/jobs/[id] — گذار `run → qc` — data-jmade (app/prod.js:123).
 *
 * سایر گذارها هرکدام اندپوینت اختصاصی دارند (start/qc/receive) چون
 * همراه با اثر جانبی روی حرکت‌های انبار هستند.
 */
export async function updateJob(id: string, input: UpdateJobInput, _actor: JobActor): Promise<JobDetail> {
  const job = await loadJobOr404(id);
  const allowed = JOB_TRANSITIONS[job.status as keyof typeof JOB_TRANSITIONS];
  if (input.status !== "qc" || allowed !== "qc") {
    throw badRequest("گذار وضعیت مجاز نیست.");
  }
  const now = Date.now();
  const updated = await prisma.job.update({
    where: { id },
    data: { status: "qc", updatedAt: BigInt(now) },
    include: { product: true, creator: true },
  });
  return { ...toRow(updated), bomSnapshot: parseBomSnapshot(updated.bomSnapshot) };
}

/**
 * POST /api/jobs/[id]/qc — ثبت کنترل کیفیت — data-jqc (app/prod.js:124).
 *
 * قانون PHASE_05 §۳.۷/§۱۲ (دروازه خروج ۳): `good + waste ≤ qty` —
 * در Demo بررسی نشده، ولی طبق مشخصات فاز دقیقاً در سرور اجرا می‌شود.
 */
export async function qcJob(id: string, input: QcInput, _actor: JobActor): Promise<JobDetail> {
  const job = await loadJobOr404(id);
  if (job.status !== "qc") {
    throw conflict("ثبت کیفیت فقط در وضعیت «کنترل کیفیت» ممکن است.");
  }
  if (input.good + input.waste > job.qty) {
    throw badRequest(
      `مجموع سالم و ضایعات (${round3(input.good + input.waste)} ${job.product?.unit ?? ""}) نمی‌تواند بیشتر از مقدار کار (${round3(job.qty)}) باشد.`,
    );
  }

  const now = Date.now();
  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: "sent",
      good: round3(input.good),
      waste: round3(input.waste),
      qcAt: BigInt(now),
      updatedAt: BigInt(now),
    },
    include: { product: true, creator: true },
  });
  return { ...toRow(updated), bomSnapshot: parseBomSnapshot(updated.bomSnapshot) };
}

/**
 * POST /api/jobs/[id]/receive — دریافت در دپو — jrecv (app/stock.js:73-78).
 *
 * حرکت `kind: "job"` با مقدار دریافت در دپو + `status: "done"` + recvQty.
 * مقدار پیش‌فرض `good` است — app/stock.js:73.
 *
 * هشدار سیستماتیک `q2 !== j.good` در Demo (app/stock.js:77) غیرمسدودکننده
 * است؛ اینجا هم عبور مجاز است (فقط در پاسخ گزارش می‌شود).
 */
export async function receiveJob(
  id: string,
  input: ReceiveInput,
  actor: JobActor,
): Promise<JobDetail & { warning: string | null }> {
  const job = await loadJobOr404(id);
  if (job.status !== "sent") {
    throw conflict("دریافت فقط در وضعیت «فرستاده به دپو» ممکن است.");
  }

  const qty = input.qty ?? job.good ?? 0;
  if (!(qty > 0)) throw badRequest("مقدار دریافت باید بزرگ‌تر از صفر باشد.");

  const warning = job.good !== null && qty !== job.good ? "مقدار دریافت با مقدار سالم یکسان نیست" : null;

  const now = Date.now();
  const updated = await prisma.$transaction(async (tx) => {
    // app/stock.js:73 — حرکت ورود تولید برای انبار
    await tx.move.create({
      data: {
        id: newMoveId(),
        wh: "depot",
        item: job.productId,
        qty: signedQty("job", round3(qty)),
        kind: "job",
        ref: job.id,
        at: BigInt(now),
        byUserId: actor.userId,
        note: "ورود تولید برای انبار",
      },
    });
    return tx.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        recvQty: round3(qty),
        recvAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      include: { product: true, creator: true },
    });
  });

  return { ...toRow(updated), bomSnapshot: parseBomSnapshot(updated.bomSnapshot), warning };
}
