import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Tag, CheckCircle2, XCircle, Save, Pencil, BellRing, AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SpinnerButton } from "@/components/SpinnerButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuestionBuilder, DraftQuestion, validateQuestions } from "@/components/assignments/QuestionBuilder";
import { Reveal } from "@/components/Reveal";
import { MountainSketch } from "@/components/MountainSketch";

type QType = "multiple_choice" | "short_answer" | "long_answer";
type Question = {
  id: string;
  position: number;
  question_type: QType;
  prompt: string;
  options: string[] | null;
  correct_index: number | null;
  max_score: number;
};
type Answer = {
  id: string;
  question_id: string;
  student_id: string;
  selected_index: number | null;
  text_response: string | null;
  is_correct: boolean | null;
  score: number | null;
  feedback: string | null;
};
type Profile = { id: string; full_name: string | null };

export default function TeacherAssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [className, setClassName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [reminding, setReminding] = useState(false);
  const [grades, setGrades] = useState<Record<string, { overall_score: number | null; overall_feedback: string | null }>>({});
  const [activeStudent, setActiveStudent] = useState<string | null>(null);

  // Edit questions dialog
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<DraftQuestion[]>([]);
  const [savingQs, setSavingQs] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: a, error } = await supabase
      .from("assignments").select("*").eq("id", id).maybeSingle();
    if (error || !a) { toast.error("Not found"); navigate("/teacher/assignments"); return; }
    setAssignment(a);

    const [{ data: cls }, { data: qs }, { data: ans }, { data: subs }, { data: gr }] = await Promise.all([
      supabase.from("classes").select("name").eq("id", a.class_id).maybeSingle(),
      supabase.from("assignment_questions").select("*").eq("assignment_id", id).order("position"),
      supabase.from("assignment_answers").select("*").eq("assignment_id", id),
      supabase.from("submissions").select("student_id").eq("assignment_id", id),
      supabase.from("assignment_grades").select("student_id, overall_score, overall_feedback").eq("assignment_id", id),
    ]);
    setClassName(cls?.name ?? "Class");
    setQuestions((qs ?? []) as Question[]);
    setAnswers((ans ?? []) as Answer[]);

    const submitted = new Set<string>();
    (ans ?? []).forEach((r: any) => submitted.add(r.student_id));
    (subs ?? []).forEach((r: any) => submitted.add(r.student_id));
    setSubmittedIds(submitted);

    // Build student list from class members + anyone with answer/submission
    const sIds = new Set<string>();
    (ans ?? []).forEach((r: any) => sIds.add(r.student_id));
    (subs ?? []).forEach((r: any) => sIds.add(r.student_id));
    const { data: members } = await supabase.from("class_members").select("student_id").eq("class_id", a.class_id);
    (members ?? []).forEach((m: any) => sIds.add(m.student_id));
    const ids = Array.from(sIds);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setStudents(profs ?? []);
      if (!activeStudent && profs && profs.length) setActiveStudent(profs[0].id);
    }
    const gmap: typeof grades = {};
    (gr ?? []).forEach((g: any) => { gmap[g.student_id] = { overall_score: g.overall_score, overall_feedback: g.overall_feedback }; });
    setGrades(gmap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const am = submittedIds.has(a.id) ? 1 : 0;
      const bm = submittedIds.has(b.id) ? 1 : 0;
      if (am !== bm) return am - bm; // missing first
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [students, submittedIds]);

  const missingStudents = useMemo(
    () => students.filter((s) => !submittedIds.has(s.id)),
    [students, submittedIds]
  );

  const remindMissing = async () => {
    if (!id || !assignment || missingStudents.length === 0) return;
    setReminding(true);
    try {
      const rows = missingStudents.map((s) => ({
        user_id: s.id,
        type: "assignment_reminder",
        message: `Reminder: "${assignment.title}" is still missing from your work`,
        link: `/student/assignments/${id}`,
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) { toast.error(error.message); return; }
      toast.success(`Reminded ${missingStudents.length} student${missingStudents.length === 1 ? "" : "s"}`);
    } finally { setReminding(false); }
  };

  const openEditQuestions = () => {
    setDraft(questions.map((q) => ({
      id: q.id, question_type: q.question_type, prompt: q.prompt,
      options: q.options ?? undefined, correct_index: q.correct_index, max_score: q.max_score,
    })));
    setEditOpen(true);
  };

  const saveQuestions = async () => {
    const err = validateQuestions(draft);
    if (err) { toast.error(err); return; }
    if (!id) return;
    setSavingQs(true);
    try {
      // Replace strategy: delete removed, upsert kept/new
      const keepIds = new Set(draft.filter((d) => d.id).map((d) => d.id!));
      const toDelete = questions.filter((q) => !keepIds.has(q.id)).map((q) => q.id);
      if (toDelete.length) {
        const { error } = await supabase.from("assignment_questions").delete().in("id", toDelete);
        if (error) { toast.error(error.message); return; }
      }
      const rows = draft.map((d, i) => ({
        id: d.id, assignment_id: id, position: i,
        question_type: d.question_type, prompt: d.prompt.trim(),
        options: d.question_type === "multiple_choice" ? d.options : null,
        correct_index: d.question_type === "multiple_choice" ? d.correct_index : null,
        max_score: d.max_score,
      }));
      // Insert new ones (no id) and update existing
      const inserts = rows.filter((r) => !r.id).map(({ id: _omit, ...rest }) => rest);
      const updates = rows.filter((r) => r.id);
      if (inserts.length) {
        const { error } = await supabase.from("assignment_questions").insert(inserts);
        if (error) { toast.error(error.message); return; }
      }
      for (const u of updates) {
        const { error } = await supabase.from("assignment_questions").update(u).eq("id", u.id!);
        if (error) { toast.error(error.message); return; }
      }
      toast.success("Questions saved");
      setEditOpen(false);
      load();
    } finally { setSavingQs(false); }
  };

  const updateAnswer = async (a: Answer, patch: Partial<Pick<Answer, "score" | "feedback">>) => {
    const next = answers.map((x) => x.id === a.id ? { ...x, ...patch } : x);
    setAnswers(next);
    const { error } = await supabase.from("assignment_answers")
      .update({ ...patch, graded_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) toast.error(error.message);
  };

  const saveOverall = async (studentId: string) => {
    if (!id) return;
    const g = grades[studentId] ?? { overall_score: null, overall_feedback: null };
    const { error } = await supabase.from("assignment_grades").upsert(
      {
        assignment_id: id, student_id: studentId,
        overall_score: g.overall_score, overall_feedback: g.overall_feedback,
        graded_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" }
    );
    if (error) { toast.error(error.message); return; }
    toast.success("Overall grade saved");

    // Notify student
    await supabase.from("notifications").insert({
      user_id: studentId,
      type: "assignment_graded",
      message: `Your work on "${assignment.title}" has been graded`,
      link: `/student/assignments/${id}`,
    });
  };

  if (loading) {
    return <DashboardShell title="Assignment"><Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card></DashboardShell>;
  }
  if (!assignment) return null;

  const studentAnswers = answers.filter((a) => a.student_id === activeStudent);
  const totalEarned = studentAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const totalPossible = questions.reduce((sum, q) => sum + q.max_score, 0);

  return (
    <DashboardShell title="Assignment Review">
      <div className="space-y-4 animate-page-enter">
        <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/assignments")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>

        <Card className="relative overflow-hidden">
          <MountainSketch
            variant="range"
            className="pointer-events-none absolute -top-4 right-0 hidden sm:block w-64 text-muted-foreground/30"
          />
          <CardContent className="relative p-6 space-y-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{className}</span>
              {assignment.unit_tag && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span>{assignment.unit_tag}</span>
                </>
              )}
            </div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
              <Button variant="outline" size="sm" onClick={openEditQuestions}>
                <Pencil className="h-4 w-4 mr-1" />Edit questions
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">{className}</span>
              {assignment.unit_tag && (
                <span className="inline-flex items-center gap-1 rounded-full bg-plum-soft px-3 py-1 text-xs font-medium text-plum">
                  <Tag className="h-3 w-3" />{assignment.unit_tag}
                </span>
              )}
              {assignment.due_date && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />Due {new Date(assignment.due_date).toLocaleDateString()}
                </span>
              )}
            </div>
            {assignment.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-2 border-t">{assignment.description}</p>
            )}
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 mt-2">
              <div>
                <p className="text-sm font-medium">Due-date reminders</p>
                <p className="text-xs text-muted-foreground">Notify students 3 days and 24 hours before this assignment is due.</p>
              </div>
              <Switch
                checked={!!assignment.reminders_enabled}
                onCheckedChange={async (v) => {
                  setAssignment({ ...assignment, reminders_enabled: v });
                  const { error } = await supabase.from("assignments").update({ reminders_enabled: v }).eq("id", assignment.id);
                  if (error) toast.error(error.message);
                  else toast.success(v ? "Reminders on" : "Reminders off");
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-1 border-b border-border">
          <span className="border-b-2 border-primary px-3 pb-2.5 text-sm font-medium text-primary">Review</span>
          <span className="px-3 pb-2.5 text-sm text-muted-foreground">Overview</span>
          <span className="px-3 pb-2.5 text-sm text-muted-foreground">Analytics</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[210px_1fr_300px] items-start">
          <Card>
            <CardHeader className="space-y-2 pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Submissions</span>
                <span className="text-[11px] font-normal text-muted-foreground font-tabular">
                  {submittedIds.size}/{students.length}
                </span>
              </CardTitle>
              {missingStudents.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={remindMissing}
                  disabled={reminding}
                >
                  <BellRing className="h-3 w-3 mr-1" />
                  Remind {missingStudents.length} missing
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-2">
              {students.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No students yet</p>
              ) : sortedStudents.map((s, i) => {
                const hasSub = submittedIds.has(s.id);
                return (
                  <Reveal key={s.id} delay={i * 40}>
                  <button
                    onClick={() => setActiveStudent(s.id)}
                    className={cn(
                      "w-full text-left px-2 py-2 rounded-lg text-sm transition-spring flex items-center gap-2",
                      activeStudent === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted hover:translate-x-0.5"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold font-tabular",
                        activeStudent === s.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary-soft text-primary"
                      )}
                    >
                      {(s.full_name || "U").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate flex-1">{s.full_name || "Unnamed"}</span>
                    {hasSub ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                          activeStudent === s.id
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-success-soft text-success"
                        )}
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Submitted
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                          activeStudent === s.id
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-destructive/10 text-destructive attention-pulse"
                        )}
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Missing
                      </span>
                    )}
                  </button>
                  </Reveal>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <p className="text-xs text-muted-foreground">Student work</p>
                <CardTitle className="text-base mt-0.5">
                  {students.find((s) => s.id === activeStudent)?.full_name || "Select a student"}
                </CardTitle>
              </div>
              {activeStudent && questions.length > 0 && (
                <span className="text-sm font-semibold font-tabular">{totalEarned} / {totalPossible}</span>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {!activeStudent ? (
                <p className="text-sm text-muted-foreground">Pick a student to review their answers.</p>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">This assignment has no questions yet. Click "Edit questions" to add some.</p>
              ) : questions.map((q, i) => {
                const a = studentAnswers.find((x) => x.question_id === q.id);
                return (
                  <Reveal key={q.id} delay={i * 60} className="space-y-2 pb-4 border-b last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground"><span className="font-tabular">Q{i + 1}</span> · <span className="font-tabular">{q.max_score}</span> pts</p>
                        <p className="font-medium whitespace-pre-wrap">{q.prompt}</p>
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      {q.question_type === "multiple_choice" ? (
                        <>
                          {a?.selected_index != null ? (
                            <p className="flex items-center gap-2">
                              {a.is_correct
                                ? <CheckCircle2 className="h-4 w-4 text-success" />
                                : <XCircle className="h-4 w-4 text-destructive" />}
                              <span className="font-medium">
                                {String.fromCharCode(65 + a.selected_index)}. {q.options?.[a.selected_index]}
                              </span>
                              {!a.is_correct && q.correct_index != null && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  Correct: {String.fromCharCode(65 + q.correct_index)}. {q.options?.[q.correct_index]}
                                </span>
                              )}
                            </p>
                          ) : <p className="italic text-muted-foreground">No answer</p>}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{a?.text_response || <span className="italic text-muted-foreground">No answer</span>}</p>
                      )}
                    </div>
                    {a && (
                      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                        <div>
                          <Label className="text-xs">Score (/{q.max_score})</Label>
                          <Input
                            type="number" min={0} max={q.max_score}
                            value={a.score ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? null : Math.max(0, Math.min(q.max_score, Number(e.target.value)));
                              setAnswers(answers.map((x) => x.id === a.id ? { ...x, score: v } : x));
                            }}
                            onBlur={(e) => {
                              const v = e.target.value === "" ? null : Math.max(0, Math.min(q.max_score, Number(e.target.value)));
                              updateAnswer(a, { score: v });
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Feedback</Label>
                          <Input
                            value={a.feedback ?? ""}
                            onChange={(e) => setAnswers(answers.map((x) => x.id === a.id ? { ...x, feedback: e.target.value } : x))}
                            onBlur={(e) => updateAnswer(a, { feedback: e.target.value })}
                            placeholder="Optional comment..."
                          />
                        </div>
                      </div>
                    )}
                  </Reveal>
                );
              })}
            </CardContent>
          </Card>

          {/* Right: Score panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeStudent ? (
                <p className="text-sm text-muted-foreground">Pick a student to grade their work.</p>
              ) : (
                <>
                  <div className="rounded-xl bg-muted/50 px-4 py-3">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <span className="font-tabular text-4xl font-bold tracking-tight">{totalEarned}</span>
                        <span className="font-tabular text-lg text-muted-foreground"> / {totalPossible}</span>
                      </div>
                      {totalPossible > 0 && (
                        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success font-tabular">
                          {Math.round((totalEarned / totalPossible) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      {grades[activeStudent]?.overall_score != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" />Graded
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                          Not graded
                        </span>
                      )}
                    </div>
                  </div>

                  {questions.length > 0 && (
                    <ul className="space-y-1.5">
                      {questions.map((q, i) => {
                        const a = studentAnswers.find((x) => x.question_id === q.id);
                        const earned = a?.score ?? 0;
                        const full = earned >= q.max_score && q.max_score > 0;
                        return (
                          <li key={q.id} className="flex items-center gap-2 text-sm">
                            {full ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                            ) : earned > 0 ? (
                              <XCircle className="h-4 w-4 shrink-0 text-warning" />
                            ) : (
                              <span className="h-4 w-4 shrink-0 rounded-full border border-border" />
                            )}
                            <span className="flex-1 truncate text-muted-foreground">
                              <span className="font-tabular">Q{i + 1}</span> · {q.prompt}
                            </span>
                            <span
                              className={cn(
                                "font-tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                                full ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {earned} / {q.max_score}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs">Overall score</Label>
                    <Input
                      type="number"
                      value={grades[activeStudent]?.overall_score ?? ""}
                      onChange={(e) =>
                        setGrades({
                          ...grades,
                          [activeStudent]: {
                            ...(grades[activeStudent] ?? { overall_feedback: null }),
                            overall_score: e.target.value === "" ? null : Number(e.target.value),
                          },
                        })
                      }
                      placeholder={`/ ${totalPossible}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Feedback</Label>
                    <Textarea
                      rows={4}
                      value={grades[activeStudent]?.overall_feedback ?? ""}
                      onChange={(e) =>
                        setGrades({
                          ...grades,
                          [activeStudent]: {
                            ...(grades[activeStudent] ?? { overall_score: null }),
                            overall_feedback: e.target.value,
                          },
                        })
                      }
                      placeholder="Comments for the student..."
                    />
                  </div>
                  <Button className="w-full" onClick={() => saveOverall(activeStudent)}>
                    <Save className="h-4 w-4 mr-1" />Save feedback
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit questions</DialogTitle></DialogHeader>
          <QuestionBuilder questions={draft} onChange={setDraft} />
          <DialogFooter>
            <SpinnerButton onClick={saveQuestions} loading={savingQs} loadingText="Saving...">Save questions</SpinnerButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}