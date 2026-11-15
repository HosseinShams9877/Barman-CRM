import localFont from "next/font/local";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ErrorBoundary, ToastProvider } from "@components/feedback";
import { AppShell } from "@components/layout";
import { QueryProvider } from "@core/query";
import "./globals.css";

/** فونت Vazirmatn به‌صورت self-hosted (D-05) — معادل Demo در app/fonts/. */
const vazirmatn = localFont({
  src: [
    { path: "./fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM بارمان",
  description: "سامانه مدیریت ارتباط با مشتری تیم بارمان",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <ErrorBoundary>
          <QueryProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
