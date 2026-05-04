import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Award, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { CardListSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";

type ClassRow = { id: string; name: string; subject: string };
type Assignment = {
  id: string;
  class_id: string;
  title: string;
  unit_tag: string | null;
  due_date: string | null;
  total_possible: number;
};
type Submission = { assignment_id: string; submitted_at: string };
type Grade = { assignment_id: string; overall_score: number | null; graded_at: string | null };

type AssignmentRow = {
  id: string;
  title: string;
  unit: string;
  submitted_at: string | null;
  earned: number | null;
  total: number;
  pct: number | null;
  state: "graded" | "pending" | "missing";
};

function letterGrade(pct: number | null): string {
  if (pct == null) return "—";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "text-success";
  if (pct >= 70) return "text-warning";
  return "text-destructive";
}

function StateBadge({ row }: { row: AssignmentRow }) {
  if (row.state === "missing")
    return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">Missing</span>;
  if (row.state === "pending")
    return <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">Pending</span>;
  return <span className={cn("rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", "text-success")}>Graded</span>;
}

export default function StudentGrades() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: members } = await supabase.from("class_members").select("class_id").eq("student_id", user.id);
      const classIds = (members ?? []).map((m: any) => m.class_id);
      if (!classIds.length) { setLoading(false); return; }

      const { data: cls } = await supabase.from("classes").select("id, name, subject").in("id", classIds);
      setClasses((cls ?? []) as ClassRow[]);

      const { data: asgn } = await supabase
        .from("assignments")
        .select("id, class_id, title, unit_tag, due_date")
        .in("class_id", classIds);
      const aIds = (asgn ?? []).map((a: any) => a.id);

      const [{ data: qs }, { data: subs }, { data: gr }] = await Promise.all([
        aIds.length
          ? supabase.from("assignment_questions").select("assignment_id, max_score").in("assignment_id", aIds)
          : Promise.resolve({ data: [] as { assignment_id: string; max_score: number }[] }),
        aIds.length
          ? supabase.from("submissions").select("assignment_id, submitted_at").eq("student_id", user.id).in("assignment_id", aIds)
          : Promise.resolve({ data: [] as Submission[] }),
        aIds.length
          ? supabase.from("assignment_grades").select("assignment_id, overall_score, graded_at").eq("student_id", user.id).in("assignment_id", aIds)
          : Promise.resolve({ data: [] as Grade[] }),
      ]);

      const totals = new Map<string, number>();
      (qs ?? []).forEach((q: any) => totals.set(q.assignment_id, (totals.get(q.assignment_id) ?? 0) + q.max_score));

      setAssignments((asgn ?? []).map((a: any) => ({
        ...a,
        total_possible: totals.get(a.id) ?? 0,
      })));
      setSubmissions((subs ?? []) as Submission[]);
      setGrades((gr ?? []) as Grade[]);
      setLoading(false);
    })();
  }, []);

  // Build per-class rows
  const perClass = useMemo(() => {
    const subMap = new Map(submissions.map((s) => [s.assignment_id, s.submitted_at]));
    const grMap = new Map(grades.map((g) => [g.assignment_id, g]));

    return classes.map((c) => {
      const items = assignments.filter((a) => a.class_id === c.id);
      const rows: AssignmentRow[] = items.map((a) => {
        const submitted_at = subMap.get(a.id) ?? null;
        const g = grMap.get(a.id);
        const total = a.total_possible || 100;
        let state: AssignmentRow["state"] = "missing";
        let earned: number | null = null;
        let pct: number | null = null;
        if (g?.graded_at && g.overall_score != null) {
          state = "graded";
          earned = g.overall_score;
          pct = total > 0 ? Math.round((g.overall_score / total) * 100) : null;
        } else if (submitted_at) {
          state = "pending";
        }
        return {
          id: a.id,
          title: a.title,
          unit: a.unit_tag?.trim() || "General",
          submitted_at,
          earned,
          total,
          pct,
          state,
        };
      });

      // Group by unit
      const unitMap = new Map<string, AssignmentRow[]>();
      rows.forEach((r) => {
        const arr = unitMap.get(r.unit) ?? [];
        arr.push(r);
        unitMap.set(r.unit, arr);
      });
      const units = Array.from(unitMap.entries()).map(([name, items]) => {
        const graded = items.filter((i) => i.pct != null);
        const avg = graded.length
          ? Math.round(graded.reduce((s, i) => s + (i.pct ?? 0), 0) / graded.length)
          : null;
        return { name, items, avg };
      });

      const gradedRows = rows.filter((r) => r.pct != null);
      const overall = gradedRows.length
        ? Math.round(gradedRows.reduce((s, r) => s + (r.pct ?? 0), 0) / gradedRows.length)
        : null;

      return { class: c, units, overall, totalCount: rows.length };
    });
  }, [classes, assignments, submissions, grades]);

  const gpaPct = useMemo(() => {
    const vals = perClass.map((p) => p.overall).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [perClass]);

  return (
    <DashboardShell title="Grades" subtitle="Your performance across all classes.">
      {loading ? (
        <CardListSkeleton count={3} />
      ) : classes.length === 0 ? (
        <EmptyState icon={BookOpen} title="No classes yet" description="Join a class to start tracking your grades." />
      ) : (
        <div className="space-y-6">
          {/* GPA Summary */}
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary-soft/40 to-transparent">
            <CardContent className="p-6 flex flex-wrap items-center gap-6">
              <div className="rounded-full bg-primary/15 p-4">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Overall Average</p>
                <p className="text-sm text-muted-foreground">Across {classes.length} {classes.length === 1 ? "class" : "classes"}</p>
              </div>
              <div className="text-right">
                <p className={cn("text-5xl font-bold tabular-nums", pctColor(gpaPct))}>
                  {gpaPct != null ? `${gpaPct}%` : "—"}
                </p>
                <p className={cn("text-lg font-semibold", pctColor(gpaPct))}>
                  {letterGrade(gpaPct)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Class cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perClass.map(({ class: c, overall }) => {
              const open = expanded === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setExpanded(open ? null : c.id)}
                  className={cn(
                    "text-left rounded-xl border bg-card p-4 shadow-card transition-base hover:shadow-md",
                    open ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                    </div>
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <p className={cn("text-3xl font-bold tabular-nums leading-none", pctColor(overall))}>
                      {overall != null ? `${overall}%` : "—"}
                    </p>
                    <p className={cn("text-base font-semibold pb-0.5", pctColor(overall))}>
                      {letterGrade(overall)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expanded breakdown */}
          {expanded && (() => {
            const data = perClass.find((p) => p.class.id === expanded);
            if (!data) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{data.class.name} — Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {data.units.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assignments in this class yet.</p>
                  ) : (
                    <>
                      {data.units.map((u) => (
                        <div key={u.name} className="space-y-2">
                          <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{u.name}</h3>
                            <span className={cn("text-sm font-bold tabular-nums", pctColor(u.avg))}>
                              {u.avg != null ? `${u.avg}%` : "—"}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                                  <th className="text-left font-medium py-2 pr-2">Assignment</th>
                                  <th className="text-left font-medium py-2 px-2 hidden sm:table-cell">Submitted</th>
                                  <th className="text-right font-medium py-2 px-2">Points</th>
                                  <th className="text-right font-medium py-2 pl-2">Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {u.items.map((row) => (
                                  <tr
                                    key={row.id}
                                    onClick={() => navigate(`/student/assignments/${row.id}`)}
                                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                                  >
                                    <td className="py-2 pr-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">{row.title}</span>
                                        <StateBadge row={row} />
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-muted-foreground hidden sm:table-cell">
                                      {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                                      {row.earned != null ? `${row.earned} / ${row.total}` : `— / ${row.total}`}
                                    </td>
                                    <td className={cn("py-2 pl-2 text-right font-semibold tabular-nums", pctColor(row.pct))}>
                                      {row.pct != null ? `${row.pct}%` : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 bg-primary-soft/30 px-4 py-3">
                        <span className="font-bold uppercase tracking-wide text-sm">Class Average</span>
                        <span className={cn("text-2xl font-bold tabular-nums", pctColor(data.overall))}>
                          {data.overall != null ? `${data.overall}% · ${letterGrade(data.overall)}` : "—"}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </DashboardShell>
  );
}