import type { ReactNode } from "react";
import { Icon, type IconName } from "@components/ui/Icon";

export function PageHeader({ title, description, icon, children }: { title: string; description?: string; icon: IconName; children?: ReactNode }) {
  return <div className="ac-head"><span className="ac-head-icon"><Icon name={icon} /></span><div className="ac-head-text"><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{children ? <div className="ac-head-actions">{children}</div> : null}</div>;
}
