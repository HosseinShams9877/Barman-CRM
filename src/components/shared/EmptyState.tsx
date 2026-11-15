import type { ReactNode } from "react";
import { cn } from "@core/utils";

export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

/**
 * حالت خالی — برای هر کوئری بدون داده (CD-09: الزامی).
 */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn("card empty-state", className)}>
      {icon ? <div className="empty-state-icon" aria-hidden="true">{icon}</div> : null}
      <h3 className="h3">{title}</h3>
      {description ? <p className="text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
