"use client";

import { useSyncExternalStore } from "react";

const URL_CHANGE = "barman:urlchange";
let historyObserved = false;

/** pushState/replaceState (including Next Link) do not emit hashchange. */
function observeHistory(): void {
  if (historyObserved) return;
  historyObserved = true;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    push(...args);
    window.dispatchEvent(new Event(URL_CHANGE));
  };
  window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    replace(...args);
    window.dispatchEvent(new Event(URL_CHANGE));
  };
}

const subscribe = (onChange: () => void): (() => void) => {
  observeHistory();
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE, onChange);
  };
};
const snapshot = (): string => window.location.hash;
const serverSnapshot = (): string => "";
/** Hash tabs use a stable hydration snapshot and follow browser back/forward. */
export function useUrlHash(): string { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
