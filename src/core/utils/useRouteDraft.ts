"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

/** Local form/filter edits survive typing; navigating to a different query resets defaults. */
export function useRouteDraft<T>(defaults: T): [T, (next: T | ((current: T) => T)) => void] {
  const source = useSearchParams().toString();
  const [draft, setDraft] = useState<{ source: string; value: T } | null>(null);
  const value = draft?.source === source ? draft.value : defaults;
  return [value, (next) => setDraft({ source, value: typeof next === "function" ? (next as (current: T) => T)(value) : next })];
}
