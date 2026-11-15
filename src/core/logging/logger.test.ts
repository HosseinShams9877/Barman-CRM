import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, type LogEntry, type LogSink } from "./logger";

const LEVELS = ["debug", "info", "warn", "error"] as const;

describe("logger", () => {
  let sink: LogSink;
  let entries: LogEntry[];

  beforeEach(() => {
    entries = [];
    sink = (entry) => entries.push(entry);
  });

  it("وجود scope و زمان در هر ورودی", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const log = createLogger("scope-a", sink);
    log.info("hello", { k: 1 });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.scope).toBe("scope-a");
    expect(entries[0]?.level).toBe("info");
    expect(entries[0]?.message).toBe("hello");
    expect(entries[0]?.at).toBe(1_700_000_000_000);
    expect(entries[0]?.context).toEqual({ k: 1 });
    vi.useRealTimers();
  });

  it("سطح پیش‌فرض info، پیام‌های debug فیلتر می‌شوند", () => {
    const log = createLogger("s", sink);
    log.debug("d");
    log.info("i");
    log.error("e");
    expect(entries.map((e) => e.level)).toEqual(["info", "error"]);
  });

  it("با sink بدون خطا کار می‌کند", () => {
    const log = createLogger("s", () => {});
    expect(() => log.warn("w")).not.toThrow();
  });

  it("همه سطوح وقتی NEXT_PUBLIC_LOG_LEVEL=debug منتشر می‌شوند", () => {
    process.env["NEXT_PUBLIC_LOG_LEVEL"] = "debug";
    try {
      const log = createLogger("s", sink);
      LEVELS.forEach((l) => log[l]("m"));
      expect(entries.map((e) => e.level)).toEqual([...LEVELS]);
    } finally {
      delete process.env["NEXT_PUBLIC_LOG_LEVEL"];
    }
  });

  it("مقدار نامعتبر env سطح را به info برگرداند", () => {
    process.env["NEXT_PUBLIC_LOG_LEVEL"] = "nonsense";
    try {
      const log = createLogger("s", sink);
      log.debug("d");
      log.info("i");
      expect(entries.map((e) => e.level)).toEqual(["info"]);
    } finally {
      delete process.env["NEXT_PUBLIC_LOG_LEVEL"];
    }
  });
});
