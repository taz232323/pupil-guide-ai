import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "indigo" | "teal" | "amber" | "emerald";

const TONES: Record<Tone, { bg: string; fg: string; ring: string }> = {
  indigo: { bg: "bg-primary-soft", fg: "text-primary", ring: "ring-primary/20" },
  teal: { bg: "bg-teal-soft", fg: "text-teal", ring: "ring-teal/20" },
  amber: { bg: "bg-warning-soft", fg: "text-warning", ring: "ring-warning/20" },
  emerald: { bg: "bg-success-soft", fg: "text-success", ring: "ring-success/20" },
};

export const StatCard = ({
  label,
  value,
  icon: Icon,
  tone = "indigo",
  hint,
  loading,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  loading?: boolean;
}) => {
  const t = TONES[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-base hover:shadow-elevated hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", t.bg, t.fg, t.ring)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
};