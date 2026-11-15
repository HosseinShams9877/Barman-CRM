import { cn } from "@core/utils";
import { Spinner } from "./Spinner";

export type LoadingStateProps = {
  label?: string;
  className?: string;
};

/**
 * حالت بارگذاری رسمی — برای هر کوئری اجباری است (CD-09).
 * نقش status روی خود Spinner است تا تکرار نشود.
 */
export function LoadingState({ label = "در حال بارگذاری…", className }: LoadingStateProps) {
  return (
    <div className={cn("loading-state", className)}>
      <Spinner className="loading-state-spinner" label={label} />
      <span className="loading-state-label" aria-hidden="true">{label}</span>
    </div>
  );
}
