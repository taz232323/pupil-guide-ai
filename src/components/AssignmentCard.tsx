import { CalendarDays, Tag, Users, AlertTriangle, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignmentStatus = "not_started" | "in_progress" | "submitted";

const STATUS: Record<AssignmentStatus, { label: string; cls: string; tile: string }> = {
  not_started: { label: "Not started", cls: "bg-warning-soft text-warning", tile: "bg-warning-soft text-warning" },
  in_progress: { label: "In progress", cls: "bg-primary-soft text-primary", tile: "bg-primary-soft text-primary" },
  submitted: { label: "Submitted", cls: "bg-success-soft text-success", tile: "bg-success-soft text-success" },
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

function dueAccent(due: string | null | undefined, status?: AssignmentStatus) {
  if (status === "submitted" || !due) return "";
  const ms = new Date(due).getTime() - Date.now();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 1) return "text-destructive";
  if (days < 3) return "text-warning";
  return "";
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
  classLabel,
  unitTag,
  dueDate,
  status = "not_started",
  className,
  submissionStats,
  onClick,
  rightSlot,
}: {
  title: string;
  classLabel?: string;
  className?: string;
  unitTag?: string | null;
  dueDate?: string | null;
  status?: AssignmentStatus;
  submissionStats?: { submitted: number; total: number };
  onClick?: () => void;
  rightSlot?: React.ReactNode;
}) => {
  const s = STATUS[status];
  // Overdue penalty: 1 ⭐ per day late, capped per-student elsewhere.
  let overdueDays = 0;
  if (dueDate && status !== "submitted") {
    const ms = Date.now() - new Date(dueDate).getTime();
    if (ms > 0) overdueDays = Math.max(1, Math.floor(ms / 86_400_000));
  }
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-4 rounded-xl border border-border border-l-4 bg-card p-4 shadow-card transition-spring hover-lift",
        urgencyBorder(dueDate, status),
        onClick && "cursor-pointer",
        className
      )}
    >
      <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-spring group-hover:scale-110", s.tile)}>
        <ClipboardList className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold leading-tight truncate">{title}</h3>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", s.cls)}>
            {s.label}
          </span>
          {overdueDays > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive attention-pulse"
              title={`Overdue ${overdueDays} day${overdueDays === 1 ? "" : "s"} — costing you ${overdueDays} ⭐ per day`}
            >
              <AlertTriangle className="h-3 w-3" />
              -{overdueDays} ⭐/day
            </span>
          )}
        </div>
        {classLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{classLabel}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {unitTag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
              <Tag className="h-3 w-3" />{unitTag}
            </span>
          )}
          {dueDate && (
            <span className={cn("inline-flex items-center gap-1 text-muted-foreground", dueAccent(dueDate, status))}>
              <CalendarDays className="h-3 w-3" />
              {new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              <span className="ml-1 font-tabular">· {relativeTime(dueDate)}</span>
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