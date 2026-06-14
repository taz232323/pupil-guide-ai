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
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/15 bg-gradient-soft px-6 py-12 text-center animate-fade-up">
    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 via-plum-soft/10 to-transparent text-primary shadow-card ring-1 ring-primary/15">
      <Icon className="h-7 w-7" />
    </div>
    <p className="text-base font-semibold text-foreground">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);