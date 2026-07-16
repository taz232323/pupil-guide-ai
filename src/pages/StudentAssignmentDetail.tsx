import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Tag, AlertTriangle, Upload, LinkIcon, CheckCircle2, Award, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpinnerButton } from "@/components/SpinnerButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RewardOverlay, type RewardData } from "@/components/RewardOverlay";
import { notifyStudentCoinsChanged } from "@/lib/studentRefreshEvents";
import { getAssignmentTypeMeta, getResourceKindMeta, parseResourceLinks } from "@/lib/assignmentMetadata";

type Status = "not_started" | "in_progress" | "submitted";
type QType = "multiple_choice" | "short_answer" | "long_answer";
type Question = {
  id: string;
  position: number;
  question_type: QType;
  prompt: string;
  options: string[] | null;
  max_score: number;
};
type AnswerState = { selected_index?: number | null; text_response?: string };
type Assignment = {
  id: string;
  class_id: string;
  assignment_type: string | null;
  title: string;
  description: string | null;
  unit_tag: string | null;
  due_date: string | null;
  material_notes: string | null;
  resource_links: Json | null;
};
type AnswerRow = { question_id: string; selected_index: number | null; text_response: string | null };

function urgency(due: string | null): { label: string; cls: string } {
  if (!due) return { label: "No due date", cls: "bg-muted text-muted-foreground" };
  const ms = new Date(due).getTime() - Date.now();
  const days = ms / 86_400_000;
  if (ms < 0) return { label: `Overdue ${Math.ceil(-days)}d`, cls: "bg-destructive/15 text-destructive" };
  if (days < 1) return { label: "Due today", cls: "bg-destructive/15 text-destructive" };
  if (days < 3) return { label: `Due in ${Math.ceil(days)}d`, cls: "bg-warning-soft text-warning" };
  return { label: `Due in ${Math.ceil(days)}d`, cls: "bg-success-soft text-success" };
}

const STATUS_PILL: Record<Status, string> = {
  not_started: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/15 text-primary",
  submitted: "bg-success-soft text-success",
};

export default function StudentAssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [className, setClassName] = useState<string>("");
  const [status, setStatus] = useState<Status>("not_started");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [submission, setSubmission] = useState<{ file_path: string | null; link_url: string | null } | null>(null);
  const [grade, setGrade] = useState<{ overall_score: number | null; overall_feedback: string | null; graded_at: string | null } | null>(null);
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reward, setReward] = useState<RewardData | null>(null);

  const overdueDays = useMemo(() => {
    if (!assignment?.due_date || status === "submitted") return 0;
    const ms = Date.now() - new Date(assignment.due_date).getTime();
    return ms > 0 ? Math.max(1, Math.floor(ms / 86_400_000)) : 0;
  }, [assignment, status]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: a, error } = await (supabase as any)
      .from("assignments")
      .select("id, class_id, assignment_type, title, description, unit_tag, due_date, material_notes, resource_links")
      .eq("id", id).maybeSingle();
    if (error || !a) { toast.error("Assignment not found"); navigate("/student/assignments"); return; }
    setAssignment(a as Assignment);

    const [{ data: cls }, { data: stat }, { data: qs }, { data: sub }, { data: ans }, { data: gr }] = await Promise.all([
      supabase.from("classes").select("name").eq("id", a.class_id).maybeSingle(),
      supabase.from("assignment_status_records").select("status")
        .eq("assignment_id", id).eq("student_id", user.id).maybeSingle(),
      supabase.from("assignment_questions").select("id, position, question_type, prompt, options, max_score")
        .eq("assignment_id", id).order("position", { ascending: true }),
      supabase.from("submissions").select("file_path, link_url")
        .eq("assignment_id", id).eq("student_id", user.id).maybeSingle(),
      supabase.from("assignment_answers").select("question_id, selected_index, text_response")
        .eq("assignment_id", id).eq("student_id", user.id),
      supabase.from("assignment_grades").select("overall_score, overall_feedback, graded_at")
        .eq("assignment_id", id).eq("student_id", user.id).maybeSingle(),
    ]);
    setClassName(cls?.name ?? "Class");
    setStatus((stat?.status as Status) ?? "not_started");
    setQuestions((qs ?? []) as Question[]);
    setSubmission(sub ?? null);
    setGrade(gr ?? null);
    const map: Record<string, AnswerState> = {};
    ((ans ?? []) as AnswerRow[]).forEach((r) => {
      map[r.question_id] = { selected_index: r.selected_index, text_response: r.text_response };
    });
    setAnswers(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const setAnswer = (qid: string, patch: AnswerState) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));

  const saveProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !id) return;
    if (status === "submitted") return;
    const rows = questions
      .filter((q) => answers[q.id])
      .map((q) => ({
        assignment_id: id,
        question_id: q.id,
        student_id: user.id,
        selected_index: answers[q.id].selected_index ?? null,
        text_response: answers[q.id].text_response ?? null,
      }));
    if (rows.length) {
      await supabase.from("assignment_answers").upsert(rows, { onConflict: "question_id,student_id" });
    }
    if (status === "not_started") {
      await supabase.from("assignment_status_records").upsert(
        { assignment_id: id, student_id: user.id, status: "in_progress" },
        { onConflict: "assignment_id,student_id" }
      );
      setStatus("in_progress");
    }
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !id || !assignment) return;
    setBusy(true);
    try {
      // 1. Save all answers
      const rows = questions.map((q) => ({
        assignment_id: id,
        question_id: q.id,
        student_id: user.id,
        selected_index: answers[q.id]?.selected_index ?? null,
        text_response: answers[q.id]?.text_response ?? null,
      }));
      if (rows.length) {
        const { error: aerr } = await supabase
          .from("assignment_answers")
          .upsert(rows, { onConflict: "question_id,student_id" });
        if (aerr) { toast.error(aerr.message); return; }
      }

      // 2. Optional file/link
      const payload: { file_path?: string; link_url?: string } = {};
      if (file) {
        if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${id}/${user.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
        if (upErr) { toast.error(upErr.message); return; }
        payload.file_path = path;
      }
      if (link.trim()) {
        try {
          const u = new URL(link.trim());
          if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
          payload.link_url = link.trim();
        } catch { toast.error("Invalid link URL"); return; }
      }

      // 3. Submission row (always create one to mark as submitted)
      const { error: serr } = await supabase
        .from("submissions")
        .upsert(
          { assignment_id: id, student_id: user.id, ...payload },
          { onConflict: "assignment_id,student_id" }
        );
      if (serr) { toast.error(serr.message); return; }

      setReward({
        title: "Assignment submitted!",
        subtitle: assignment?.title ? `“${assignment.title}” is on its way to your teacher.` : "Great work — it's on its way to your teacher.",
        coins: 5,
        intensity: "small",
      });
      notifyStudentCoinsChanged({ userId: user.id, reason: "assignment_submission" });
      setStatus("submitted");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <DashboardShell title="Assignment"><Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card></DashboardShell>;
  }
  if (!assignment) return null;
  const u = urgency(assignment.due_date);
  const isSubmitted = status === "submitted";
  const assignmentType = getAssignmentTypeMeta(assignment.assignment_type);
  const AssignmentTypeIcon = assignmentType.icon;
  const resources = parseResourceLinks(assignment.resource_links);

  return (
    <DashboardShell title="Assignment">
      <RewardOverlay open={!!reward} data={reward} onClose={() => setReward(null)} />
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/student/assignments")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back to assignments
        </Button>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
                <AssignmentTypeIcon className="h-3 w-3" />{assignmentType.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                {className}
              </span>
              {assignment.unit_tag && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground">
                  <Tag className="h-3 w-3" />{assignment.unit_tag}
                </span>
              )}
              {assignment.due_date && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", u.cls)}>
                  <CalendarDays className="h-3 w-3" />
                  {new Date(assignment.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {u.label}
                </span>
              )}
              <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", STATUS_PILL[status])}>
                {status.replace("_", " ")}
              </span>
              {grade?.graded_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Award className="h-3 w-3" />Graded
                </span>
              )}
              {overdueDays > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                  <AlertTriangle className="h-3 w-3" />Costing {overdueDays} ⭐/day
                </span>
              )}
            </div>
            {assignment.description && (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap pt-2 border-t">
                {assignment.description}
              </div>
            )}
          </CardContent>
        </Card>

        {(assignment.material_notes || resources.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Class materials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignment.material_notes && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{assignment.material_notes}</p>
              )}
              {resources.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {resources.map((resource) => {
                    const kind = getResourceKindMeta(resource.kind);
                    const KindIcon = kind.icon;
                    return (
                      <a
                        key={`${resource.kind}-${resource.url}`}
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-w-0 items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm transition-base hover:border-primary/40 hover:bg-primary-soft/30"
                      >
                        <KindIcon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{resource.title}</span>
                          <span className="block text-xs text-muted-foreground">{kind.label}</span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </a>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {grade?.graded_at && (
          <Card className="border-2 border-primary/30 bg-primary-soft/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />Your Grade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {grade.overall_score != null && (
                <p className="text-3xl font-bold text-primary">{grade.overall_score}</p>
              )}
              {grade.overall_feedback && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Teacher Feedback</p>
                  <p className="text-sm whitespace-pre-wrap">{grade.overall_feedback}</p>
                </div>
              )}
              {grade.overall_score == null && !grade.overall_feedback && (
                <p className="text-sm text-muted-foreground">Your teacher has reviewed this assignment.</p>
              )}
            </CardContent>
          </Card>
        )}

        {questions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Questions ({questions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {questions.map((q, i) => (
                <div key={q.id} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-muted-foreground mt-1">Q{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium whitespace-pre-wrap">{q.prompt}</p>
                      <p className="text-xs text-muted-foreground">{q.max_score} points</p>
                    </div>
                  </div>
                  <div className="pl-7">
                    {q.question_type === "multiple_choice" && (q.options ?? []).map((opt, oi) => (
                      <button
                        key={oi}
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => setAnswer(q.id, { selected_index: oi })}
                        className={cn(
                          "w-full text-left px-3 py-2 my-1 rounded-md border transition-colors",
                          answers[q.id]?.selected_index === oi
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-muted",
                          isSubmitted && "cursor-not-allowed opacity-80"
                        )}
                      >
                        <span className="inline-block w-5 text-xs font-bold">{String.fromCharCode(65 + oi)}.</span>
                        {opt}
                      </button>
                    ))}
                    {q.question_type === "short_answer" && (
                      <Input
                        disabled={isSubmitted}
                        value={answers[q.id]?.text_response ?? ""}
                        onChange={(e) => setAnswer(q.id, { text_response: e.target.value })}
                        onBlur={saveProgress}
                        placeholder="Your answer..."
                      />
                    )}
                    {q.question_type === "long_answer" && (
                      <Textarea
                        disabled={isSubmitted}
                        rows={4}
                        value={answers[q.id]?.text_response ?? ""}
                        onChange={(e) => setAnswer(q.id, { text_response: e.target.value })}
                        onBlur={saveProgress}
                        placeholder="Write your response..."
                      />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Attach (optional)</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="file">
              <TabsList className="grid grid-cols-2 w-full max-w-sm">
                <TabsTrigger value="file">File</TabsTrigger>
                <TabsTrigger value="link">Link</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="pt-3 space-y-2">
                <Label htmlFor="att-file">Upload file (max 20MB)</Label>
                <Input id="att-file" type="file" disabled={isSubmitted} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {submission?.file_path && <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Upload className="h-3 w-3" />Already submitted a file</p>}
              </TabsContent>
              <TabsContent value="link" className="pt-3 space-y-2">
                <Label htmlFor="att-link">Paste link</Label>
                <Input id="att-link" type="url" placeholder="https://..." disabled={isSubmitted} value={link} onChange={(e) => setLink(e.target.value)} />
                {submission?.link_url && (
                  <a href={submission.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                    <LinkIcon className="h-3 w-3" />Submitted link
                  </a>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-4">
          {isSubmitted ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-success font-semibold shadow-card">
              <CheckCircle2 className="h-4 w-4" />Submitted
            </div>
          ) : (
            <SpinnerButton onClick={handleSubmit} loading={busy} loadingText="Submitting..." size="lg">
              Submit Assignment
            </SpinnerButton>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
