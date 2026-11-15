/**
 * Provider و hookهای مشترک React Query (CD-09).
 */
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createQueryClient, queryKeys } from "./queryClient";

export { createQueryClient, queryKeys, DEFAULT_QUERY_CONFIG } from "./queryClient";

/** Provider سراسری — یک QueryClient برای هر session کلاینت. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
