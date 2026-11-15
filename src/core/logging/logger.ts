/**
 * لاگ‌گذاری ساخت‌یافته — فاز ۱ (core/logging طبق PHASE_01 §۵).
 * خروجی همیشه شامل سطح، زمان UTC (ms) و scope است.
 * هیچ رنگ یا وابستگی خارجی‌ای وجود ندارد.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function envLevel(): LogLevel {
  const raw = process.env["NEXT_PUBLIC_LOG_LEVEL"];
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

export type LogEntry = {
  level: LogLevel;
  scope: string;
  message: string;
  /** UTC میلی‌ثانیه (CD-07). */
  at: number;
  context?: Record<string, unknown>;
};

export type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
};

/** مخاطب نهایی خروجی — برای تست تزریق می‌شود. */
export type LogSink = (entry: LogEntry) => void;

const defaultSink: LogSink = (entry) => {
  const args: unknown[] = [entry.message];
  if (entry.context) args.push(entry.context);
  console[entry.level](...args);
};

export function createLogger(scope: string, sink: LogSink = defaultSink): Logger {
  const min = LEVEL_ORDER[envLevel()];
  const emit = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    if (LEVEL_ORDER[level] < min) return;
    sink({ level, scope, message, at: Date.now(), context });
  };
  return {
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
  };
}

/** لاگر سراسری برنامه. */
export const logger = createLogger("app");
