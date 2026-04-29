import { CalendarDays, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignmentStatus = "not_started" | "in_progress" | "submitted";

const STATUS: Record<AssignmentStatus, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "bg-secondary text-secondary-foreground" },
  in_progress: { label: "In progress", cls: "bg-warning-soft text-warning" },
  submitted: { label: "Submitted", cls: "bg-success-soft text-success" },
};

function urgencyBorder(due: string | null | undefined, status?: AssignmentStatus) {
  if (status === "submitted") return "border-l-success";
  if (!due) return "border-l-border";
  const ms = new Date(due).getTime() - Date.now();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 1) return "border-l-destructive";
  if (days < 3) return "border-l-warning";
  return "border-l-success";
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const day = 86_400_000;
  if (abs < day) {
    const h = Math.round(ms / 3_600_000);
    if (h === 0) return "due now";
    return ms > 0 ? `due in ${h}h` : `${-h}h overdue`;
  }
  const d = Math.round(ms / day);
  return ms > 0 ? `due in ${d}d` : `${-d}d overdue`;
}

export const AssignmentCard = ({
  title,
  className: classNameProp,
  unitTag,
  dueDate,
  status = "not_started",
  className,
  submissionStats,
  onClick,
  rightSlot,
}: {
  title: string;
  className?: string;
  classNameProp?: string;
  unitTag?: string | null;
  dueDate?: string | null;
  status?: AssignmentStatus;
  submissionStats?: { submitted: number; total: number };
  onClick?: () => void;
  rightSlot?: React.ReactNode;
}) => {
  const s = STATUS[status];
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-4 rounded-xl border border-border border-l-4 bg-card p-4 shadow-card transition-base hover-lift",
        urgencyBorder(dueDate, status),
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold leading-tight truncate">{title}</h3>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", s.cls)}>
            {s.label}
          </span>
        </div>
        {classNameProp && (
          <p className="text-xs text-muted-foreground mt-0.5">{classNameProp}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {unitTag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary">
              <Tag className="h-3 w-3" />{unitTag}
            </span>
          )}
          {dueDate && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              <span className="ml-1">· {relativeTime(dueDate)}</span>
            </span>
          )}
          {submissionStats && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              {submissionStats.submitted}/{submissionStats.total} submitted
            </span>
          )}
        </div>
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
};