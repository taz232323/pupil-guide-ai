import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { CardListSkeleton } from "@/components/Skeletons";
import { GradePredictorModal } from "@/components/GradePredictorModal";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { ProgressRing } from "@/components/ProgressRing";
import { MountainSketch } from "@/components/MountainSketch";

const TILE_STYLES = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-plum-soft text-plum",
  "bg-warning-soft text-warning",
];

function barColor(pct: number | null): string {
  if (pct == null) return "bg-muted";
  if (pct >= 80) return "bg-success";
  if (pct >= 70) return "bg-warning";
  return "bg-destructive";
}

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
    return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive attention-pulse">Missing</span>;
  if (row.state === "pending")
    return <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning grading-shimmer">Pending</span>;
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
  const [predictorClass, setPredictorClass] = useState<string | null>(null);

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

      // Calculate total earned and total possible for grade predictor
      const totalEarned = gradedRows.reduce((s, r) => s + (r.earned ?? 0), 0);
      const totalPossible = gradedRows.reduce((s, r) => s + r.total, 0);

      return { class: c, units, overall, totalCount: rows.length, totalEarned, totalPossible };
    });
  }, [classes, assignments, submissions, grades]);

  const gpaPct = useMemo(() => {
    const vals = perClass.map((p) => p.overall).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [perClass]);

  return (
    <DashboardShell title="Grades" subtitle="See your progress and keep growing.">
      {/* Header accent */}
      <div className="relative overflow-hidden -mt-2 mb-2">
        <MountainSketch variant="range" className="pointer-events-none absolute -top-6 right-0 hidden sm:block w-56 text-muted-foreground/30" />
      </div>

      {loading ? (
        <CardListSkeleton count={3} />
      ) : classes.length === 0 ? (
        <EmptyState icon={BookOpen} title="No classes yet" description="Join a class to start tracking your grades." />
      ) : (
        <div className="space-y-6">
          {/* Overall donut */}
          <Card className="animate-pop-in hover-lift">
            <CardContent className="p-6 flex flex-wrap items-center gap-6">
              {gpaPct != null ? (
                <ProgressRing value={gpaPct} size={108} strokeWidth={10}>
                  <span className={cn("font-tabular text-2xl font-bold", pctColor(gpaPct))}>
                    <CountUp value={gpaPct} duration={1000} suffix="%" />
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall</span>
                </ProgressRing>
              ) : (
                <ProgressRing value={0} size={108} strokeWidth={10}>
                  <span className="font-tabular text-2xl font-bold text-muted-foreground">—</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall</span>
                </ProgressRing>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl">
                  {gpaPct != null && gpaPct >= 80
                    ? "Great work!"
                    : gpaPct != null
                    ? "Keep going!"
                    : "Let's get started"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your average is <span className={cn("font-semibold font-tabular", pctColor(gpaPct))}>{gpaPct != null ? `${gpaPct}%` : "—"}</span>
                  {" "}across <span className="font-tabular">{classes.length}</span> {classes.length === 1 ? "class" : "classes"}.
                </p>
                <span className={cn("mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold font-tabular", pctColor(gpaPct), gpaPct != null && gpaPct >= 80 ? "bg-success-soft" : gpaPct != null && gpaPct >= 70 ? "bg-warning-soft" : "bg-muted")}>
                  {letterGrade(gpaPct)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown */}
          <div className="space-y-3">
            <h2 className="text-lg">Breakdown</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {perClass.map(({ class: c, overall }, i) => {
                const open = expanded === c.id;
                const tile = TILE_STYLES[i % TILE_STYLES.length];
                return (
                  <Reveal
                    key={c.id}
                    delay={i * 60}
                    className={cn(
                      "relative rounded-2xl border bg-card p-4 shadow-card transition-spring hover-lift",
                      open ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPredictorClass(c.id);
                      }}
                      className="absolute top-2 right-2 flex items-center gap-1 bg-gradient-primary text-primary-foreground text-xs font-medium rounded-lg px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-spring hover:scale-105"
                    >
                      <Sparkles className="h-3 w-3" />
                      What if?
                    </button>
                    <button
                      onClick={() => setExpanded(open ? null : c.id)}
                      className="text-left w-full"
                    >
                      <div className="flex items-start gap-3 pr-16">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                        </div>
                        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <p className={cn("text-3xl font-bold font-tabular leading-none", pctColor(overall))}>
                          {overall != null ? <CountUp value={overall} duration={900} suffix="%" /> : "—"}
                        </p>
                        <span className={cn("text-base font-semibold font-tabular pb-0.5", pctColor(overall))}>
                          {letterGrade(overall)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", barColor(overall))}
                          style={{ width: `${overall ?? 0}%` }}
                        />
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Grade Predictor Modal */}
          {(() => {
            const data = predictorClass ? perClass.find((p) => p.class.id === predictorClass) : null;
            return (
              <GradePredictorModal
                open={!!predictorClass}
                onOpenChange={(open) => !open && setPredictorClass(null)}
                className={data?.class.name ?? ""}
                currentPct={data?.overall ?? null}
                totalEarned={data?.totalEarned ?? 0}
                totalPossible={data?.totalPossible ?? 0}
              />
            );
          })()}

          {/* Expanded breakdown */}
          {expanded && (() => {
            const data = perClass.find((p) => p.class.id === expanded);
            if (!data) return null;
            return (
              <Card className="animate-fade-up">
                <CardHeader>
                  <CardTitle className="text-lg">Assignment grades · {data.class.name}</CardTitle>
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
                            <span className={cn("text-sm font-bold font-tabular", pctColor(u.avg))}>
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
                                    <td className="py-2 px-2 text-right font-tabular text-muted-foreground">
                                      {row.earned != null ? `${row.earned} / ${row.total}` : `— / ${row.total}`}
                                    </td>
                                    <td className={cn("py-2 pl-2 text-right font-semibold font-tabular", pctColor(row.pct))}>
                                      {row.pct != null ? `${row.pct}%` : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary-soft/40 to-plum-soft/10 px-4 py-3">
                        <span className="font-bold uppercase tracking-wide text-sm">Class Average</span>
                        <span className={cn("text-2xl font-bold font-tabular", pctColor(data.overall))}>
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