import type { ReactNode } from "react";
import { cn } from "@core/utils";

export type CardProps = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ title, actions, children, className }: CardProps) {
  return (
    <section className={cn("card", className)}>
      {title || actions ? (
        <header className="flex items-center justify-between gap-4">
          {title ? <h2 className="h2">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}
