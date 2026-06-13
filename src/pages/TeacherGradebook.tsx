import { useEffect, useMemo, useState } from "react";
import { Download, Search, TrendingUp, Target, LifeBuoy, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/EmptyState";
import { CardListSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { MountainSketch } from "@/components/MountainSketch";

type ClassRow = { id: string; name: string };
type Student = { id: string; full_name: string | null; avatar_items: string[] };
type Assignment = { id: string; title: string; total: number };
type Submission = { assignment_id: string; student_id: string };
type Grade = { assignment_id: string; student_id: string; overall_score: number | null; overall_feedback: string | null; graded_at: string | null };

type CellState = "missing" | "pending" | "graded";
type Cell = {
  state: CellState;
  score: number | null;
  feedback: string | null;
  total: number;
  pct: number | null;
};

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "text-success";
  if (pct >= 70) return "text-warning";
  return "text-destructive";
}

function cellClasses(state: CellState, pct: number | null): string {
  if (state === "missing") return "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:scale-[1.03]";
  if (state === "pending") return "bg-warning-soft text-warning hover:brightness-95 hover:scale-[1.03] grading-shimmer";
  // graded — color band by score
  if (pct != null && pct < 70) return "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:scale-[1.03]";
  if (pct != null && pct < 80) return "bg-warning-soft text-warning hover:brightness-95 hover:scale-[1.03]";
  return "bg-success-soft text-success hover:brightness-95 hover:scale-[1.03]";
}

export default function TeacherGradebook() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // Load teacher's classes
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: cls } = await supabase
        .from("classes").select("id, name").eq("teacher_id", user.id).order("name");
      setClasses((cls ?? []) as ClassRow[]);
      if (cls && cls.length && !classId) setClassId(cls[0].id);
      setLoading(false);
    })();
  }, []);

  // Load gradebook for selected class
  const loadClass = async (cid: string) => {
    if (!cid) return;
    const [{ data: members }, { data: asgn }] = await Promise.all([
      supabase.from("class_members").select("student_id").eq("class_id", cid),
      supabase.from("assignments").select("id, title").eq("class_id", cid).order("created_at"),
    ]);
    const studentIds = (members ?? []).map((m: any) => m.student_id);
    const aIds = (asgn ?? []).map((a: any) => a.id);

    const [{ data: profs }, { data: qs }, { data: subs }, { data: gr }] = await Promise.all([
      studentIds.length
        ? supabase.from("profiles").select("id, full_name, avatar_items").in("id", studentIds)
        : Promise.resolve({ data: [] as Student[] }),
      aIds.length
        ? supabase.from("assignment_questions").select("assignment_id, max_score").in("assignment_id", aIds)
        : Promise.resolve({ data: [] as { assignment_id: string; max_score: number }[] }),
      aIds.length
        ? supabase.from("submissions").select("assignment_id, student_id").in("assignment_id", aIds)
        : Promise.resolve({ data: [] as Submission[] }),
      aIds.length
        ? supabase.from("assignment_grades").select("assignment_id, student_id, overall_score, overall_feedback, graded_at").in("assignment_id", aIds)
        : Promise.resolve({ data: [] as Grade[] }),
    ]);

    const totals = new Map<string, number>();
    (qs ?? []).forEach((q: any) => totals.set(q.assignment_id, (totals.get(q.assignment_id) ?? 0) + q.max_score));

    setStudents(((profs ?? []) as Student[]).sort((a, b) =>
      (a.full_name ?? "").localeCompare(b.full_name ?? "")));
    setAssignments((asgn ?? []).map((a: any) => ({
      id: a.id, title: a.title, total: totals.get(a.id) || 100,
    })));
    setSubmissions((subs ?? []) as Submission[]);
    setGrades((gr ?? []) as Grade[]);
  };

  useEffect(() => { if (classId) loadClass(classId); }, [classId]);

  // Realtime: refresh on grade changes for this class
  useEffect(() => {
    if (!classId) return;
    const ch = supabase.channel(`gradebook:${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_grades" },
        () => loadClass(classId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId]);

  const cellMap = useMemo(() => {
    const subSet = new Set(submissions.map((s) => `${s.assignment_id}|${s.student_id}`));
    const grMap = new Map(grades.map((g) => [`${g.assignment_id}|${g.student_id}`, g]));
    const map = new Map<string, Cell>();
    students.forEach((s) => {
      assignments.forEach((a) => {
        const key = `${a.id}|${s.id}`;
        const g = grMap.get(key);
        const submitted = subSet.has(key);
        let cell: Cell;
        if (g?.graded_at && g.overall_score != null) {
          cell = {
            state: "graded",
            score: g.overall_score,
            feedback: g.overall_feedback,
            total: a.total,
            pct: a.total > 0 ? Math.round((g.overall_score / a.total) * 100) : null,
          };
        } else if (submitted) {
          cell = { state: "pending", score: null, feedback: g?.overall_feedback ?? null, total: a.total, pct: null };
        } else {
          cell = { state: "missing", score: null, feedback: null, total: a.total, pct: null };
        }
        map.set(key, cell);
      });
    });
    return map;
  }, [students, assignments, submissions, grades]);

  const studentAvg = (sid: string): number | null => {
    const vals: number[] = [];
    assignments.forEach((a) => {
      const c = cellMap.get(`${a.id}|${sid}`);
      if (c?.pct != null) vals.push(c.pct);
    });
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  };

  const assignmentAvg = (aid: string): number | null => {
    const vals: number[] = [];
    students.forEach((s) => {
      const c = cellMap.get(`${aid}|${s.id}`);
      if (c?.pct != null) vals.push(c.pct);
    });
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  };

  const classAvg = useMemo(() => {
    const vals = students.map((s) => studentAvg(s.id)).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [students, cellMap]);

  // Summary stat chips derived from existing cell data.
  const stats = useMemo(() => {
    let meetingGoal = 0;
    let needsSupport = 0;
    students.forEach((s) => {
      const avg = studentAvg(s.id);
      if (avg == null) return;
      if (avg >= 80) meetingGoal += 1;
      else if (avg < 70) needsSupport += 1;
    });
    let missing = 0;
    cellMap.forEach((c) => {
      if (c.state === "missing") missing += 1;
    });
    return { meetingGoal, needsSupport, missing, totalStudents: students.length };
  }, [students, cellMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.full_name ?? "").toLowerCase().includes(q));
  }, [students, search]);

  const exportCsv = () => {
    const headers = ["Student", ...assignments.map((a) => `${a.title} (/${a.total})`), "Average %"];
    const rows = filtered.map((s) => {
      const cols = assignments.map((a) => {
        const c = cellMap.get(`${a.id}|${s.id}`);
        if (c?.state === "graded") return `${c.score}/${c.total}`;
        if (c?.state === "pending") return "Pending";
        return "Missing";
      });
      const avg = studentAvg(s.id);
      return [s.full_name ?? "", ...cols, avg != null ? `${avg}%` : ""];
    });
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map((c) => escape(String(c))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const className = classes.find((c) => c.id === classId)?.name ?? "gradebook";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className.replace(/[^\w]+/g, "_")}_gradebook.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveGrade = async (assignmentId: string, studentId: string, score: number | null, feedback: string) => {
    setBusy(true);
    try {
      const assignment = assignments.find((a) => a.id === assignmentId);
      const { error } = await supabase.from("assignment_grades").upsert(
        {
          assignment_id: assignmentId,
          student_id: studentId,
          overall_score: score,
          overall_feedback: feedback || null,
          graded_at: new Date().toISOString(),
        },
        { onConflict: "assignment_id,student_id" }
      );
      if (error) { toast.error(error.message); return false; }

      // notify student
      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "assignment_graded",
        message: `Your assignment "${assignment?.title ?? ""}" has been graded — check your feedback.`,
        link: `/student/assignments/${assignmentId}`,
      });

      toast.success("Grade saved");
      await loadClass(classId);
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <DashboardShell title="Gradebook"><CardListSkeleton count={3} /></DashboardShell>;
  }
  if (classes.length === 0) {
    return (
      <DashboardShell title="Gradebook">
        <EmptyState icon={BookOpen} title="No classes yet" description="Create a class to start grading." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Gradebook" subtitle="Spreadsheet view of student scores.">
      <div className="space-y-4 animate-page-enter">
        {/* Header accent */}
        <div className="relative overflow-hidden -mt-2">
          <MountainSketch variant="range" className="pointer-events-none absolute -top-6 right-0 hidden sm:block w-56 text-muted-foreground/30" />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <Label className="text-xs">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Search students</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name..."
                className="pl-8"
              />
            </div>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!students.length}>
            <Download className="h-4 w-4 mr-1" />Export CSV
          </Button>
        </div>

        {/* Summary stat chips */}
        {students.length > 0 && assignments.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Class average</p>
                  <p className="text-xl font-bold font-tabular">
                    {classAvg != null ? <CountUp value={classAvg} suffix="%" /> : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Meeting goal</p>
                  <p className="text-xl font-bold font-tabular">
                    <CountUp value={stats.meetingGoal} /> / {stats.totalStudents}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-warning-soft text-warning flex items-center justify-center shrink-0">
                  <LifeBuoy className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Needs support</p>
                  <p className="text-xl font-bold font-tabular"><CountUp value={stats.needsSupport} /></p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Missing</p>
                  <p className="text-xl font-bold font-tabular"><CountUp value={stats.missing} /></p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {students.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No students in this class yet.</p>
            ) : assignments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="overflow-x-auto">
                  <table className="border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 bg-card border-b border-r min-w-[220px] text-left px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Student
                        </th>
                        {assignments.map((a) => (
                          <th key={a.id} className="border-b px-2 py-2 min-w-[110px] max-w-[140px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs font-medium truncate text-left">
                                  {a.title}
                                  <div className="text-[10px] text-muted-foreground font-normal font-tabular">/ {a.total}</div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{a.title}</TooltipContent>
                            </Tooltip>
                          </th>
                        ))}
                        <th className="border-b border-l px-2 py-2 min-w-[80px] text-xs uppercase tracking-wide text-muted-foreground">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const avg = studentAvg(s.id);
                        return (
                          <tr key={s.id} className="border-b">
                            <td className="sticky left-0 z-10 bg-card border-r px-3 py-2 min-w-[220px]">
                              <div className="flex items-center gap-2">
                                <StudentAvatar size="sm" name={s.full_name ?? ""} items={s.avatar_items ?? []} />
                                <span className="font-medium truncate">{s.full_name || "Unnamed"}</span>
                              </div>
                            </td>
                            {assignments.map((a) => {
                              const c = cellMap.get(`${a.id}|${s.id}`)!;
                              const isClickable = c.state !== "missing" || true; // allow editing missing too
                              return (
                                <td key={a.id} className="p-1 align-middle">
                                  <GradeCellPopover
                                    assignmentTitle={a.title}
                                    studentName={s.full_name ?? "Student"}
                                    cell={c}
                                    busy={busy}
                                    onSave={(score, feedback) => saveGrade(a.id, s.id, score, feedback)}
                                  >
                                    <button
                                      className={cn(
                                        "w-full h-10 rounded-md text-xs font-semibold font-tabular transition-spring px-2",
                                        cellClasses(c.state, c.pct),
                                      )}
                                    >
                                      {c.state === "graded" && `${c.score}/${c.total}`}
                                      {c.state === "pending" && "Pending"}
                                      {c.state === "missing" && "Missing"}
                                    </button>
                                  </GradeCellPopover>
                                </td>
                              );
                            })}
                            <td className={cn("border-l px-2 py-2 text-right font-bold font-tabular", pctColor(avg))}>
                              {avg != null ? `${avg}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 font-semibold">
                        <td className={cn("sticky left-0 z-10 bg-muted/60 border-r border-t px-3 py-2 min-w-[220px]")}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs uppercase tracking-wide">Class Average</span>
                            <span className={cn("font-tabular", pctColor(classAvg))}>
                              {classAvg != null ? <CountUp value={classAvg} duration={800} suffix="%" /> : "—"}
                            </span>
                          </div>
                        </td>
                        {assignments.map((a) => {
                          const avg = assignmentAvg(a.id);
                          return (
                            <td key={a.id} className={cn("border-t px-2 py-2 text-center text-xs font-tabular", pctColor(avg))}>
                              {avg != null ? `${avg}%` : "—"}
                            </td>
                          );
                        })}
                        <td className={cn("border-t border-l px-2 py-2 text-right font-tabular", pctColor(classAvg))}>
                          {classAvg != null ? `${classAvg}%` : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function GradeCellPopover({
  children, cell, assignmentTitle, studentName, busy, onSave,
}: {
  children: React.ReactNode;
  cell: Cell;
  assignmentTitle: string;
  studentName: string;
  busy: boolean;
  onSave: (score: number | null, feedback: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");

  useEffect(() => {
    if (open) {
      setScore(cell.score != null ? String(cell.score) : "");
      setFeedback(cell.feedback ?? "");
    }
  }, [open, cell.score, cell.feedback]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{studentName}</p>
          <p className="font-semibold text-sm truncate">{assignmentTitle}</p>
        </div>
        <div>
          <Label className="text-xs">Score (out of {cell.total})</Label>
          <Input
            type="number"
            min={0}
            max={cell.total}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder={`/ ${cell.total}`}
            className="font-tabular"
          />
        </div>
        <div>
          <Label className="text-xs">Feedback</Label>
          <Textarea
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional feedback for the student..."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const num = score === "" ? null : Number(score);
              if (num != null && (Number.isNaN(num) || num < 0 || num > cell.total)) {
                toast.error(`Score must be between 0 and ${cell.total}`);
                return;
              }
              const ok = await onSave(num, feedback);
              if (ok) setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}