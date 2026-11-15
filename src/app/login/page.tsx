"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input } from "@components/ui";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { useLoginMutation } from "@modules/auth/hooks/useAuth";
import { loginSchema } from "@modules/auth/schemas";

/**
 * صفحه ورود — راست‌چین و فارسی (PHASE_02 §۱۰).
 *
 * ارسال فرم به POST /api/auth/login از طریق mutation می‌رود؛ اعتبارسنجی
 * اصلی در سرور با Zod انجام می‌شود (CD-04) — بررسی کلاینت فقط UX است.
 * کوکی HttpOnly توسط سرور ست می‌شود و کلاینت هرگز رمز را نگه نمی‌دارد.
 */
export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const login = useLoginMutation();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // موفقیت ورود → رفتن به خانه (کوکی HttpOnly هم‌اکنون ست شده است)
  useEffect(() => {
    if (login.data) {
      toast.push(`خوش آمدید، ${login.data.name}`, "success");
      router.replace("/");
    }
  }, [login.data, router, toast]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);

    // بررسی اولیه در کلاینت — نسخه سرور (CD-04 گام ۳) منبع حقیقت است
    const parsed = loginSchema.safeParse({ name: name.trim(), password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in messages) {
          errors[field] = messages[field as keyof typeof messages];
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    login.mutate(parsed.data, {
      onError: (err: ApiError) => {
        // ۴۰۱ پیام فارسی یکسان «نام کاربری یا رمز عبور نادرست است» را دارد
        setFormError(err.message);
      },
    });
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <h1 className="login-title h2">ورود به سامانه بارمان</h1>
        <p className="login-hint text-muted">
          برای ادامه، نام کاربری و رمز عبور خود را وارد کنید.
        </p>

        {formError ? (
          <p className="login-error field-error" role="alert">
            {formError}
          </p>
        ) : null}

        <form className="login-form stack gap-4" onSubmit={handleSubmit} noValidate>
          <Input
            id="login-name"
            name="name"
            label="نام کاربری"
            autoComplete="username"
            required
            value={name}
            error={fieldErrors.name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            id="login-password"
            name="password"
            type="password"
            label="رمز عبور"
            autoComplete="current-password"
            required
            value={password}
            error={fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" size="lg" isLoading={login.isPending} className="login-submit">
            ورود
          </Button>
        </form>
      </div>
    </div>
  );
}

const messages = {
  name: "نام کاربری الزامی است.",
  password: "رمز عبور الزامی است.",
} as const;
