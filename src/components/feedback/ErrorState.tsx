import { cn } from "@core/utils";

export type ErrorStateProps = {
  /** پیام خطای فارسی — از پاکت خطای سرور یا یک پیام پیش‌فرض. */
  message?: string;
  /** عنوان کوتاه — پیش‌فرض «خطا». */
  title?: string;
  /** دکمه تلاش مجدد — فقط زمانی نمایش داده می‌شود که ارائه شده باشد. */
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
};

/**
 * حالت خطای رسمی — برای هر کوئری اجباری است (CD-09).
 * هنگام ارائه `onRetry` یک دکمه ghost نشان می‌دهد (retry).
 */
export function ErrorState({
  message = "بارگذاری اطلاعات ناموفق بود.",
  title = "خطا",
  onRetry,
  retryLabel = "تلاش مجدد",
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("card error-state", className)} role="alert">
      <h3 className="h3 error-state-title">{title}</h3>
      <p className="text-muted error-state-message">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm error-state-retry"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying || undefined}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
