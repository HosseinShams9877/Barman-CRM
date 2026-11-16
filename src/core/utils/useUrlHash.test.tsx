import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUrlHash } from "./useUrlHash";

describe("hash tabs follow native history and Next navigation", () => {
  it("pushState and replaceState update the rendered tab without hashchange", () => {
    window.history.replaceState({}, "", "/finance");
    const { result } = renderHook(() => useUrlHash());
    expect(result.current).toBe("");
    act(() => window.history.pushState({ tab: "pay" }, "", "#pay"));
    expect(result.current).toBe("#pay");
    expect(window.history.state).toEqual({ tab: "pay" });
    act(() => window.history.replaceState({ tab: "rec" }, "", "#rec"));
    expect(result.current).toBe("#rec");
  });

  it("all subscribers update and remounting does not wrap history again", () => {
    const first = renderHook(() => useUrlHash());
    const wrapped = window.history.pushState;
    const second = renderHook(() => useUrlHash());
    act(() => window.history.pushState({}, "", "#stock"));
    expect(first.result.current).toBe("#stock");
    expect(second.result.current).toBe("#stock");
    first.unmount(); second.unmount();
    const third = renderHook(() => useUrlHash());
    expect(window.history.pushState).toBe(wrapped);
    act(() => window.history.replaceState({}, "", "#hist"));
    expect(third.result.current).toBe("#hist");
  });
});
