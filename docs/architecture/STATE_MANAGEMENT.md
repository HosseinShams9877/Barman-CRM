# STATE_MANAGEMENT — معماری مدیریت وضعیت هدف

> طرح (فاز صفر). طبق سند راهرسی: TanStack React Query v5 متمرکز — «به جای ad hoc `useEffect + fetch`».

## ۱. وضعیت موجود (Demo)

| جنبه | Demo | ریسک |
|---|---|---|
| بازیابی داده | snapshot کامل در load اول (sync XHR) + poll `/api/rev` هر ۳s | R-29 |
| ذخیره محلی | `localStorage` + fallback `window.name` | شکننده |
| به‌روزرسانی | re-render کامل صفحه (`paint()`) با حفظ `scrollY` | R-26 |
| تداخل | last-write-wins، بدون تشخیص تعارض | R-06 |
| رویداد | `br:sync` برای بازنویسی | — |

## ۲. طرح هدف

### ۲.۱ طبقه‌بندی وضعیت

| نوع | ابزار | مثال |
|---|---|---|
| وضعیت سرور (server state) | **React Query v5** | سرنخ‌ها، سفارش‌ها، موجودی، کاربران |
| وضعیت فرم محلی | `useState` / `react-hook-form` | مقادیر ورودی قبل از ارسال |
| وضعیت UI محلی | `useState` / contexto محلی | باز/بسته شدن دیالوگ، تب فعال |
| وضعیت سراسری UI | Context (سبک) | تم، جهت RTL |
| وضعیت persistent محلی | `localStorage` (با fallback) | فیلترهای ذخیره‌شده (`br.finF` معادل) |

### ۲.۲ React Query — مرکزی

```ts
// src/core/query/client.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // داده‌ها ۳۰ ثانیه تازه می‌مانند
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,  // جایگزین poll که ۳ ثانیه‌ای Demo
    },
    mutations: { onError: notifyError },
  },
});
```

### ۲.۳ کلیدهای query — ساختار سلسله‌مراتبی

```ts
// src/modules/leads/queries/keys.ts
export const leadsKeys = {
  all: ["leads"] as const,
  list: (filter: LeadFilter) => [...leadsKeys.all, "list", filter] as const,
  detail: (id: string) => [...leadsKeys.all, "detail", id] as const,
};
```

### ۲.۴ الگوی mutation با invalidation

```ts
const mutation = useMutation({
  mutationFn: leadsService.update,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: leadsKeys.all });
  },
});
```

قانون: **هر mutation دقیقاً کلیدهای تحت تأثیر را invalidate می‌کند** — نه همه چیز را.

### ۲.۵ لایه‌های نمایش (loading / error / empty)

اجباری (طبق سند راهرسی): هر query با سه وضعیت صریح ترکیب می‌شود:

| وضعیت | کامپوننت (در `src/components/feedback`) |
|---|---|
| loading | `<LoadingState/>` یا skeleton |
| error | `<ErrorState/>` با دکمه تلاش دوباره |
| empty | `<EmptyState/>` با راهنمای فارسی |

هیچ‌گاه `null` رندر نمی‌شود و هیچ‌گاه رابطه fetch با `useEffect` نوشته نمی‌شود.

### ۲.۶ همزمانی — جایگزین polling

| Demo | هدف |
|---|---|
| poll `/api/rev` هر ۳s | `staleTime` + focus refetch (بهینه‌تر، شفاف) |
| snapshot کامل | query‌های دانه‌ای (list/detail جدا) |
| last-write-wins | برای تداخل: **optimistic update + مقایسه مهر زمانی** |

در Phase 6 (Q-15): در صورت نیاز همزمانی قوی‌تر، WebSockets/SSE به‌عنوان لایه کمکی اضافه می‌شود — معماری query کلاینت ثابت می‌ماند.

### ۲.۷ مدیریت فرم

- `react-hook-form` + `zod` resolver — اسکیمای مشترک با سرور.
- وضعیت dirty گارد خروج (default `sync guard` معادل).

## ۳. عددها و ثابت‌ها

- `staleTime` پایه: ۳۰s
- `retry`: ۲
- `gcTime`: ۵ دقیقه
- `refetchInterval`: **استفاده نمی‌شود** (مگر برای داده لحظه‌ای مانند گزارش زنده)
