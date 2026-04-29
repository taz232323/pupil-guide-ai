import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-gradient-soft px-6 py-12 text-center animate-fade-in">
    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
      <Icon className="h-7 w-7" />
    </div>
    <p className="text-base font-semibold">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);