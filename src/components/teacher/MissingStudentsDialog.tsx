import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, AlertTriangle } from "lucide-react";

export type MissingEntry = {
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  dueDate: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  entries: MissingEntry[];
  groupBy?: "student" | "assignment";
}

export function MissingStudentsDialog({
  open, onOpenChange, title, subtitle, entries, groupBy = "student",
}: Props) {
  const groups = new Map<string, MissingEntry[]>();
  entries.forEach((e) => {
    const key = groupBy === "student" ? e.studentName : e.assignmentTitle;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  });
  const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No missing assignments. Everyone is up to date!
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-3">
              {sorted.map(([heading, items]) => (
                <div key={heading}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    {heading} <span className="text-destructive">· {items.length}</span>
                  </p>
                  <ul className="space-y-1">
                    {items.map((e, i) => (
                      <li key={`${e.assignmentId}-${e.studentId}-${i}`}>
                        <Link
                          to={`/teacher/assignments/${e.assignmentId}`}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover-lift hover:bg-muted"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {groupBy === "student" ? e.assignmentTitle : e.studentName}
                            </p>
                            {e.dueDate && (
                              <p className="text-[11px] text-muted-foreground">
                                Due {new Date(e.dueDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}