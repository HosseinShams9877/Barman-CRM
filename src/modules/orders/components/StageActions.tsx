/**
 * StageActions — اقدامات هر مرحله‌ی خط لوله (PHASE_04 §۱۰).
 *
 * هر اقدام فقط در مرحله‌ای که سرور آن را می‌پذیرد ارائه می‌شود (ماشین
 * حالت order.service.ts:618 `applyStageAction` — منبع حقیقت):
 *   submit  فقط stage 1 (accountId اجباری — doSubmit)
 *   approve stage 2 (smOk) یا 3 (mgrOk)
 *   return  فقط stage 2/3 → 1 با backNote
 *   send    فقط stage 4 → 5 با via
 *   finalize فقط stage 5 → 6 یا ۹ با agreedHow
 *   paccept فقط stage 6 با start/end جلالی
 *   startProduction/made فقط stage 7
 *   qc      فقط stage 8 (why وقتی waste>0 اجباری)
 *   receive/daccept فقط stage 9
 *   prep    فقط stage 10 (همه‌ی چک‌لیست تیک‌اجباری)
 *   deliver فقط stage 11 با تحویل‌گیرنده
 *
 * پنهان‌سازی دکمه بر اساس مجوز کلاینت است (R-02) — سرور منبع حقیقت
 * است و هر اقدام غیرمجاز با ۴۰۳ رد می‌شود. اعتبارسنجی کلاینت همان
 * اسکیمای سرور است (R-13) با نقشه‌ی خطای فارسی (CD-28).
 */
"use client";

import { useState } from "react";
import { Button, Card, Input } from "@components/ui";
import { JalaliDateInput } from "@components/shared";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { faErrorMap } from "@core/validation";
import { formatMoney } from "@core/formatting";
import { useAccountsQuery } from "@modules/customers/hooks/useAccounts";
import {
  AGREED_HOW,
  BACK_REASONS,
  PREP_CHECKS,
  QC_CHECKS,
  SEND_VIA_LABELS,
  SEND_VIAS,
} from "../constants";
import type { AgreedHowKey, SendVia } from "../constants";
import { stageActionSchema, type StageAction } from "../schemas/order.schema";
import { useStageActionMutation } from "../hooks/useOrderMutations";
import type { OrderDetail, OrderDetailNoMoney } from "../types/order.types";

/** کلیدهای چک‌لیست کیفیت/آماده‌سازی — همان ماشین مقداری Demo (order.js). */
type QcCheckKey = (typeof QC_CHECKS)[number];
type PrepCheckKey = (typeof PREP_CHECKS)[number];

export type StageActionsProps = {
  order: OrderDetail | OrderDetailNoMoney;
};

/**
 * پنل اقدامات مرحله‌ی فعلی — در وضعیت باز و با مجوز تغییر وضعیت
 * نمایش داده می‌شود. سایر حالت‌ها فقط یک توضیح می‌دهند.
 */
export function StageActions({ order }: StageActionsProps) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canChange = permissions.has("orders.status.change");

  if (order.status === "done") {
    return (
      <Card>
        <p className="text-muted">این سفارش تسویه و بسته شده است؛ اقدامی ممکن نیست.</p>
      </Card>
    );
  }
  if (order.status === "cancelled") {
    return (
      <Card>
        <p className="text-muted">این سفارش لغو شده است؛ اقدامی ممکن نیست.</p>
      </Card>
    );
  }
  if (!canChange) {
    return (
      <Card>
        <p className="text-muted">شما مجوز تغییر مرحله‌ی این سفارش را ندارید.</p>
      </Card>
    );
  }

  switch (order.stage) {
    case 1:
      return <SubmitPanel order={order} />;
    case 2:
    case 3:
      return (
        <div className="flex flex-col gap-4">
          <ApprovePanel order={order} />
          <ReturnPanel order={order} />
        </div>
      );
    case 4:
      return <SendPanel order={order} />;
    case 5:
      return <FinalizePanel order={order} />;
    case 6:
      return <PacceptPanel order={order} />;
    case 7:
      return <ProductionPanel order={order} />;
    case 8:
      return <QcPanel order={order} />;
    case 9:
      return (
        <div className="flex flex-col gap-4">
          <ReceivePanel order={order} />
          <DacceptPanel order={order} />
        </div>
      );
    case 10:
      return <PrepPanel order={order} />;
    case 11:
      return <DeliverPanel order={order} />;
    default:
      return null;
  }
}

// --- زیرساختر مشترک -----------------------------------------------------

type PanelProps = {
  order: OrderDetail | OrderDetailNoMoney;
};

/** رابط مشترک همه‌ی پنل‌ها: ارسال اقدام + خطای سرور + خطای هر فیلد. */
function useStageAction(orderId: string) {
  const action = useStageActionMutation();
  const run = (payload: StageAction): void => {
    action.mutate({ id: orderId, data: payload });
  };
  return { run, pending: action.isPending, error: action.error?.message ?? null };
}

/** بدنه‌ی مشترک پنل: عنوان، خطای سرور و فرم. */
function PanelShell({
  title,
  description,
  error,
  children,
}: {
  title: string;
  description?: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="h3">{title}</h2>
          {description ? <p className="field-hint">{description}</p> : null}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        {children}
      </div>
    </Card>
  );
}

/** اعتبارسنجی کلاینت با همان اسکیمای سرور (R-13) — خطای هر فیلد. */
function validate(payload: StageAction): Record<string, string> | null {
  const parsed = stageActionSchema.safeParse(payload, { error: faErrorMap as never });
  if (parsed.success) return null;
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!fields[key]) fields[key] = issue.message || "مقدار نامعتبر است.";
  }
  return fields;
}

/** مقدار عددی فیلد متن — رشته‌ی خالی/نامعتبر به NaN (خطای اعتبارسنجی). */
function num(v: string): number {
  return v.trim().length === 0 ? Number.NaN : Number(v);
}

// --- مرحله ۱: ارسال برای تأیید ------------------------------------------

function SubmitPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const accounts = useAccountsQuery({ page: 1, pageSize: 200, q: "", includeInactive: false });
  const [accountId, setAccountId] = useState(order.accountId ?? "");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const needsAccount = !order.accountId;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = {
      action: "submit",
      ...(needsAccount ? { accountId } : {}),
      note: note.trim(),
    };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="ارسال برای تأیید"
      description="پیش‌فاکتور به مدیر فروش / مدیریت ارسال می‌شود. مشتری در این مرحله اجباری است."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        {needsAccount ? (
          <div className="field">
            <label className="field-label" htmlFor="submit-account">
              مشتری (حساب)
            </label>
            <select
              id="submit-account"
              className="select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={pending}
              required
            >
              <option value="">— انتخاب کنید —</option>
              {accounts.data?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name.length > 0 ? a.name : a.id}
                </option>
              ))}
            </select>
            {fields.accountId ? (
              <p className="field-error" role="alert">
                {fields.accountId}
              </p>
            ) : null}
          </div>
        ) : null}
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          ارسال برای تأیید
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مراحل ۲/۳: تأیید ----------------------------------------------------

function ApprovePanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = { action: "approve", note: note.trim() };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="تأیید پیش‌فاکتور"
      description={
        order.stage === 2
          ? "تأیید شما به‌عنوان مدیر فروش ثبت می‌شود و پیش‌فاکتور به مدیریت می‌رود."
          : "تأیید شما به‌عنوان مدیریت ثبت می‌شود و پیش‌فاکتور برای ارسال آماده می‌شود."
      }
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          تأیید پیش‌فاکتور
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مراحل ۲/۳: بازگشت ---------------------------------------------------

function ReturnPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = {
      action: "return",
      reason: reason.length > 0 ? reason : undefined,
      note: note.trim(),
    };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="بازگشت برای اصلاح"
      description="پیش‌فاکتور به مرحله‌ی ۱ بازمی‌گردد و باید دوباره ارسال شود."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="return-reason">
            دلیل بازگشت
          </label>
          <select
            id="return-reason"
            className="select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
          >
            <option value="">— دلایل آماده —</option>
            {BACK_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="return-note">
            یادداشت بازگشت
          </label>
          <textarea
            id="return-note"
            className="textarea"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            required
          />
          {fields.note ? (
            <p className="field-error" role="alert">
              {fields.note}
            </p>
          ) : (
            <p className="field-hint">یادداشت بازگشت اجباری است.</p>
          )}
        </div>
        <Button type="submit" variant="danger" isLoading={pending}>
          بازگرداندن پیش‌فاکتور
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۴: ارسال برای مشتری -------------------------------------------

function SendPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [via, setVia] = useState<SendVia[]>([]);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const toggleVia = (key: SendVia): void => {
    setVia((list) => (list.includes(key) ? list.filter((v) => v !== key) : [...list, key]));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = { action: "send", via, note: note.trim() };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="ارسال پیش‌فاکتور برای مشتری"
      description="حداقل یک کانال ارسال را انتخاب کنید — پیش‌فاکتور به مرحله‌ی مالی می‌رود."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <fieldset className="stack gap-2">
          <legend className="field-label">کانال ارسال</legend>
          {SEND_VIAS.map((v) => (
            <label key={v} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={via.includes(v)}
                onChange={() => toggleVia(v)}
                disabled={pending}
              />
              <span>{SEND_VIA_LABELS[v]}</span>
            </label>
          ))}
          {fields.via ? (
            <p className="field-error" role="alert">
              {fields.via}
            </p>
          ) : null}
        </fieldset>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          ارسال پیش‌فاکتور
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۵: قطعی‌سازی ---------------------------------------------------

function FinalizePanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [how, setHow] = useState("");
  const [agreedNote, setAgreedNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const total = "calc" in order ? order.calc.total : null;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    if (how.length === 0) {
      setFields({ agreedHow: "نحوه‌ی توافق مشتری را انتخاب کنید." });
      return;
    }
    const payload: StageAction = {
      action: "finalize",
      agreedHow: how as AgreedHowKey,
      agreedNote: agreedNote.trim(),
    };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="قطعی‌سازی سفارش"
      description="سفارش تولیدی به تولید می‌رود؛ سفارش نمایندگی مراحل ۶/۷/۸ را پرش می‌کند."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        {total !== null ? (
          <p className="field-hint">
            مبلغ نهایی: <span dir="ltr">{formatMoney(total)} ریال</span> — برنامه‌ی پرداخت باید
            با این مبلغ تسویه شود (اختلاف حداکثر ۱ ریال).
          </p>
        ) : null}
        <div className="field">
          <label className="field-label" htmlFor="finalize-how">
            نحوه‌ی توافق مشتری
          </label>
          <select
            id="finalize-how"
            className="select"
            value={how}
            onChange={(e) => setHow(e.target.value)}
            disabled={pending}
            required
          >
            <option value="">— انتخاب کنید —</option>
            {AGREED_HOW.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          {fields.agreedHow ? (
            <p className="field-error" role="alert">
              {fields.agreedHow}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="finalize-note">
            یادداشت توافق
          </label>
          <textarea
            id="finalize-note"
            className="textarea"
            rows={2}
            value={agreedNote}
            onChange={(e) => setAgreedNote(e.target.value)}
            disabled={pending}
          />
        </div>
        <Button type="submit" isLoading={pending}>
          قطعی‌سازی سفارش
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۶: پذیرش تولید ------------------------------------------------

function PacceptPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const today = order.prod?.start ?? "";
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(order.prod?.end ?? "");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = {
      action: "paccept",
      start,
      end,
      note: note.trim(),
    };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="پذیرش تولید"
      description="زمان‌بندی تولید را ثبت کنید — پایان باید بعد از شروع باشد."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <JalaliDateInput
            id="paccept-start"
            label="شروع تولید"
            value={start}
            onChange={setStart}
            error={fields.start}
            disabled={pending}
            required
          />
          <JalaliDateInput
            id="paccept-end"
            label="پایان تولید"
            value={end}
            onChange={setEnd}
            error={fields.end}
            disabled={pending}
            required
          />
        </div>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          ثبت پذیرش تولید
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۷: تولید ------------------------------------------------------

function ProductionPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleStart = (): void => {
    setFields({});
    run({ action: "startProduction" });
  };

  const handleMade = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = { action: "made", note: note.trim() };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="تولید"
      description="شروع تولید فقط زمان تولید را ثبت می‌کند و مرحله را تغییر نمی‌دهد."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={handleStart}
            disabled={pending || (order.prod?.startedAt ?? null) !== null}
            isLoading={pending}
          >
            شروع تولید
          </Button>
          {(order.prod?.startedAt ?? null) !== null ? (
            <span className="field-hint">تولید آغاز شده است.</span>
          ) : null}
        </div>
        <form className="stack gap-3" onSubmit={handleMade} noValidate>
          <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
          <Button type="submit" isLoading={pending}>
            پایان تولید → کنترل کیفیت
          </Button>
        </form>
      </div>
    </PanelShell>
  );
}

// --- مرحله ۸: کنترل کیفیت ------------------------------------------------

function QcPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [good, setGood] = useState("");
  const [waste, setWaste] = useState("0");
  const [why, setWhy] = useState("");
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<QcCheckKey[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});

  const toggleCheck = (key: QcCheckKey): void => {
    setChecks((list) => (list.includes(key) ? list.filter((c) => c !== key) : [...list, key]));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = {
      action: "qc",
      good: num(good),
      waste: num(waste),
      why: why.trim(),
      note: note.trim(),
      checks,
    };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="کنترل کیفیت"
      description="تعداد تولید و ضایعات را وارد کنید — دلیل ضایعات وقتی بزرگ‌تر از صفر است اجباری می‌شود."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="qc-good"
            name="good"
            label="تعداد تولید شده"
            type="number"
            min={1}
            value={good}
            onChange={(e) => setGood(e.target.value)}
            error={fields.good}
            disabled={pending}
            dir="ltr"
          />
          <Input
            id="qc-waste"
            name="waste"
            label="تعداد ضایعات"
            type="number"
            min={0}
            value={waste}
            onChange={(e) => setWaste(e.target.value)}
            error={fields.waste}
            disabled={pending}
            dir="ltr"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="qc-why">
            دلیل ضایعات
          </label>
          <textarea
            id="qc-why"
            className="textarea"
            rows={2}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            disabled={pending}
          />
          {fields.why ? (
            <p className="field-error" role="alert">
              {fields.why}
            </p>
          ) : null}
        </div>
        <fieldset className="stack gap-2">
          <legend className="field-label">چک‌لیست کیفیت</legend>
          {QC_CHECKS.map((c) => (
            <label key={c} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={checks.includes(c)}
                onChange={() => toggleCheck(c)}
                disabled={pending}
              />
              <span>{c}</span>
            </label>
          ))}
        </fieldset>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          ثبت کنترل کیفیت → بار
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۹: دریافت بار -------------------------------------------------

function ReceivePanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = { action: "receive", note: note.trim() };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="دریافت بار"
      description="رسید بار را ثبت کنید — این مرحله را به تأیید دریافت منتقل نمی‌کند."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" variant="ghost" isLoading={pending}>
          ثبت رسید بار
        </Button>
      </form>
    </PanelShell>
  );
}

function DacceptPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = { action: "daccept", note: note.trim() };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="تأیید دریافت"
      description="بار دریافت شد و سفارش به آماده‌سازی می‌رود."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          تأیید دریافت → آماده‌سازی
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۱۰: آماده‌سازی -------------------------------------------------

function PrepPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [packs, setPacks] = useState("");
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<PrepCheckKey[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});

  const toggleCheck = (key: PrepCheckKey): void => {
    setChecks((list) => (list.includes(key) ? list.filter((c) => c !== key) : [...list, key]));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = {
      action: "prep",
      packs: num(packs),
      note: note.trim(),
      checks,
    };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="آماده‌سازی بار"
      description="تمام موارد چک‌لیست باید تیک بخورند — سفارش بعد از آن به تحویل می‌رود."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <Input
          id="prep-packs"
          name="packs"
          label="تعداد بسته‌ها"
          type="number"
          min={1}
          value={packs}
          onChange={(e) => setPacks(e.target.value)}
          error={fields.packs}
          disabled={pending}
          dir="ltr"
        />
        <fieldset className="stack gap-2">
          <legend className="field-label">چک‌لیست آماده‌سازی</legend>
          {PREP_CHECKS.map((c) => (
            <label key={c} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={checks.includes(c)}
                onChange={() => toggleCheck(c)}
                disabled={pending}
              />
              <span>{c}</span>
            </label>
          ))}
          {fields.checks ? (
            <p className="field-error" role="alert">
              {fields.checks}
            </p>
          ) : null}
        </fieldset>
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          ثبت آماده‌سازی → تحویل
        </Button>
      </form>
    </PanelShell>
  );
}

// --- مرحله ۱۱: تحویل -----------------------------------------------------

function DeliverPanel({ order }: PanelProps) {
  const { run, pending, error } = useStageAction(order.id);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFields({});
    const payload: StageAction = { action: "deliver", to: to.trim(), note: note.trim() };
    const bad = validate(payload);
    if (bad) {
      setFields(bad);
      return;
    }
    run(payload);
  };

  return (
    <PanelShell
      title="تحویل به مشتری"
      description="نام تحویل‌گیرنده اجباری است — سفارش پس از تحویل تسویه و بسته می‌شود."
      error={error}
    >
      <form className="stack gap-3" onSubmit={handleSubmit} noValidate>
        <Input
          id="deliver-to"
          name="to"
          label="تحویل‌گیرنده"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          error={fields.to}
          disabled={pending}
        />
        <NoteField value={note} onChange={setNote} disabled={pending} error={fields.note} />
        <Button type="submit" isLoading={pending}>
          ثبت تحویل و بستن سفارش
        </Button>
      </form>
    </PanelShell>
  );
}

// --- فیلد مشترک یادداشت ---------------------------------------------------

function NoteField({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor="stage-note">
        یادداشت
      </label>
      <textarea
        id="stage-note"
        className="textarea"
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
