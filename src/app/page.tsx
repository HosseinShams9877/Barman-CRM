"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Dashboard } from "@modules/home";
import { useMeQuery } from "@modules/auth/hooks/useAuth";

/**
 * / — داشبورد خانه (PHASE_07 §۱۰ / A-7.3).
 *
 * کاربر مهمان به صفحه ورود هدایت می‌شود. صفحه فقط لایه نمایش است
 * (CD-09) — scoping و فیلتر مبلغ در سرور اجرا می‌شوند (CD-05).
 */
export default function HomePage() {
  const router = useRouter();
  const me = useMeQuery();

  useEffect(() => {
    if (!me.isLoading && me.data === null) {
      router.replace("/login");
    }
  }, [me.isLoading, me.data, router]);

  if (me.data === null) return null;
  return (
    <div className="container-app py-8">
      <Dashboard />
    </div>
  );
}
