import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Coins,
  Crown,
  Flame,
  LogOut,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GradePredictorModal } from "@/components/GradePredictorModal";

type StudentProfile = {
  name: string;
  items: string[];
};

type AssignmentStatus = "submitted" | "missing" | "graded";

type AssignmentSummary = {
  id: string;
  title: string;
  dueDate: string | null;
  status: AssignmentStatus;
  earned: number | null;
  total: number;
  pct: number | null;
};

type ClassSummary = {
  id: string;
  name: string;
  subject: string | null;
  teacherId: string;
  teacherName: string;
  teacherItems: string[];
  currentStreak: number;
  average: number | null;
  totalEarned: number;
  totalPossible: number;
  assignments: AssignmentSummary[];
};

type TeacherContact = {
  id: string;
  name: string;
  items: string[];
  classes: { id: string; name: string }[];
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const yesterdayKey = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function letterGrade(pct: number | null): string {
  if (pct == null) return "-";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function gradeTone(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "text-success";
  if (pct >= 70) return "text-warning";
  return "text-destructive";
}

function statusClasses(status: AssignmentStatus): string {
  if (status === "graded") return "border-success/30 bg-success-soft text-success";
  if (status === "submitted") return "border-primary/30 bg-primary-soft text-primary";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function formatDate(value: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function validStreak(row: { current_streak?: number | null; last_practice_date?: string | null } | undefined) {
  if (!row) return 0;
  const last = row.last_practice_date;
  if (last && last !== todayKey() && last !== yesterdayKey()) return 0;
  return row.current_streak ?? 0;
}

export default function ParentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const parentMode = sessionStorage.getItem("access_mode") === "parent";

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile>({ name: "Student", items: [] });
  const [coins, setCoins] = useState({ star: 0, crown: 0 });
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherContact | null>(null);
  const [predictorClassId, setPredictorClassId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!authLoading && !parentMode) {
      navigate("/student", { replace: true });
    }
  }, [authLoading, navigate, parentMode]);

  useEffect(() => {
    if (!user || !parentMode) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: profile }, { data: coinRow }, { data: memberships, error: membersError }] =
          await Promise.all([
            supabase.from("profiles").select("full_name, avatar_items").eq("id", user.id).maybeSingle(),
            supabase.from("student_coins").select("star_coins, crown_coins").eq("student_id", user.id).maybeSingle(),
            supabase.from("class_members").select("class_id").eq("student_id", user.id),
          ]);

        if (membersError) throw membersError;

        const studentProfile = {
          name: profile?.full_name || "Student",
          items: (profile?.avatar_items ?? []) as string[],
        };
        const classIds = (memberships ?? []).map((m: any) => m.class_id);

        if (!classIds.length) {
          if (!cancelled) {
            setStudent(studentProfile);
            setCoins({
              star: coinRow?.star_coins ?? 0,
              crown: coinRow?.crown_coins ?? 0,
            });
            setClasses([]);
            setLoading(false);
          }
          return;
        }

        const { data: classRows, error: classesError } = await supabase
          .from("classes")
          .select("id, name, subject, teacher_id")
          .in("id", classIds);
        if (classesError) throw classesError;

        const classList = (classRows ?? []) as any[];
        const teacherIds = Array.from(
          new Set(classList.map((c) => c.teacher_id).filter(Boolean)),
        );

        const [{ data: teacherProfiles }, { data: assignments }, { data: streakRows }] =
          await Promise.all([
            teacherIds.length
              ? supabase.from("profiles").select("id, full_name, avatar_items").in("id", teacherIds)
              : Promise.resolve({ data: [] as any[] }),
            supabase
              .from("assignments")
              .select("id, class_id, title, due_date")
              .in("class_id", classIds)
              .order("due_date", { ascending: true, nullsFirst: false }),
            supabase
              .from("daily_practice_streaks")
              .select("class_id, current_streak, last_practice_date")
              .eq("student_id", user.id)
              .in("class_id", classIds),
          ]);

        const assignmentRows = (assignments ?? []) as any[];
        const assignmentIds = assignmentRows.map((a) => a.id);

        const [{ data: questions }, { data: submissions }, { data: grades }] = await Promise.all([
          assignmentIds.length
            ? supabase.from("assignment_questions").select("assignment_id, max_score").in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [] as any[] }),
          assignmentIds.length
            ? supabase.from("submissions").select("assignment_id, submitted_at").eq("student_id", user.id).in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [] as any[] }),
          assignmentIds.length
            ? supabase.from("assignment_grades").select("assignment_id, overall_score, graded_at").eq("student_id", user.id).in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const teacherMap = new Map<string, { name: string; items: string[] }>();
        (teacherProfiles ?? []).forEach((p: any) => {
          teacherMap.set(p.id, {
            name: p.full_name || "Teacher",
            items: (p.avatar_items ?? []) as string[],
          });
        });

        const totals = new Map<string, number>();
        (questions ?? []).forEach((q: any) => {
          totals.set(q.assignment_id, (totals.get(q.assignment_id) ?? 0) + Number(q.max_score ?? 0));
        });

        const submissionMap = new Map((submissions ?? []).map((s: any) => [s.assignment_id, s]));
        const gradeMap = new Map((grades ?? []).map((g: any) => [g.assignment_id, g]));
        const streakMap = new Map((streakRows ?? []).map((s: any) => [s.class_id, s]));

        const summaries: ClassSummary[] = classList.map((c) => {
          const teacher = teacherMap.get(c.teacher_id);
          const classAssignments = assignmentRows
            .filter((a) => a.class_id === c.id)
            .map((a) => {
              const total = totals.get(a.id) || 100;
              const submission = submissionMap.get(a.id);
              const grade = gradeMap.get(a.id);
              let status: AssignmentStatus = "missing";
              let earned: number | null = null;
              let pct: number | null = null;

              if (grade?.graded_at && grade.overall_score != null) {
                status = "graded";
                earned = Number(grade.overall_score);
                pct = total > 0 ? Math.round((earned / total) * 100) : null;
              } else if (submission?.submitted_at) {
                status = "submitted";
              }

              return {
                id: a.id,
                title: a.title,
                dueDate: a.due_date,
                status,
                earned,
                total,
                pct,
              };
            });

          const graded = classAssignments.filter((a) => a.pct != null);
          const average = graded.length
            ? Math.round(graded.reduce((sum, a) => sum + (a.pct ?? 0), 0) / graded.length)
            : null;
          const totalEarned = graded.reduce((sum, a) => sum + (a.earned ?? 0), 0);
          const totalPossible = graded.reduce((sum, a) => sum + a.total, 0);

          return {
            id: c.id,
            name: c.name,
            subject: c.subject,
            teacherId: c.teacher_id,
            teacherName: teacher?.name ?? "Teacher",
            teacherItems: teacher?.items ?? [],
            currentStreak: validStreak(streakMap.get(c.id)),
            average,
            totalEarned,
            totalPossible,
            assignments: classAssignments,
          };
        });

        if (!cancelled) {
          setStudent(studentProfile);
          setCoins({
            star: coinRow?.star_coins ?? 0,
            crown: coinRow?.crown_coins ?? 0,
          });
          setClasses(summaries);
        }
      } catch (error: any) {
        toast.error(error?.message ?? "Could not load parent dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [parentMode, user]);

  const teacherContacts = useMemo(() => {
    const map = new Map<string, TeacherContact>();
    classes.forEach((c) => {
      const current = map.get(c.teacherId) ?? {
        id: c.teacherId,
        name: c.teacherName,
        items: c.teacherItems,
        classes: [],
      };
      current.classes.push({ id: c.id, name: c.name });
      map.set(c.teacherId, current);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  const lowClasses = classes.filter((c) => c.average != null && c.average < 70);

  const openMessage = (teacher: TeacherContact) => {
    setSelectedTeacher(teacher);
    setSelectedClassId(teacher.classes[0]?.id ?? "");
    setMessage("");
  };

  const sendParentMessage = async () => {
    if (!user || !selectedTeacher || !selectedClassId) return;
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const { data: insertedMessage, error } = await (supabase as any).from("messages").insert({
        class_id: selectedClassId,
        sender_id: user.id,
        recipient_id: selectedTeacher.id,
        body: text,
        sender_role: "parent",
      }).select("id").single();

      if (error) {
        toast.error(error.message);
        return;
      }

      if (insertedMessage?.id) {
        const { error: notifyError } = await supabase.functions.invoke("notify-parent-message", {
          body: { messageId: insertedMessage.id },
        });

        if (notifyError) {
          toast.warning("Message sent, but the email notification could not be delivered yet.");
        }
      }

      toast.success("Message sent to teacher.");
      setSelectedTeacher(null);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  const exitParentView = () => {
    sessionStorage.removeItem("access_mode");
    navigate("/student", { replace: true });
  };

  if (!parentMode) return null;

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-elevated sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <StudentAvatar size="lg" name={student.name} items={student.items} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight">{student.name}</h1>
                <Badge className="border-primary/30 bg-primary-soft text-primary hover:bg-primary-soft">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Parent View
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Read-only progress dashboard</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={exitParentView}
          >
            <LogOut className="h-4 w-4" /> Exit Parent View
          </Button>
        </header>

        {lowClasses.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Class average below 70%</p>
              <p className="text-sm text-destructive/85">
                {lowClasses.map((c) => `${c.name} (${c.average}%)`).join(", ")}
              </p>
            </div>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={<BookOpen className="h-5 w-5 text-primary" />}
            label="Classes"
            value={String(classes.length)}
            caption="Enrolled"
          />
          <MetricCard
            icon={<Coins className="h-5 w-5 text-gold" />}
            label="Star Coins"
            value={String(coins.star)}
            caption="Current balance"
          />
          <MetricCard
            icon={<Crown className="h-5 w-5 text-plum" />}
            label="Crown Coins"
            value={String(coins.crown)}
            caption="Current balance"
          />
        </section>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            Loading parent dashboard...
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            This student is not enrolled in any classes yet.
          </div>
        ) : (
          <section className="space-y-4">
            {classes.map((classItem) => (
              <Card key={classItem.id} className="border-0 bg-card text-card-foreground shadow-card">
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">{classItem.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {classItem.subject || "General"} · {classItem.teacherName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge className="border-gold/30 bg-gold-soft text-gold hover:bg-gold-soft">
                      <Flame className="mr-1 h-3 w-3" />
                      {classItem.currentStreak} day streak
                    </Badge>
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-right">
                      <p className={cn("text-2xl font-bold tabular-nums leading-none", gradeTone(classItem.average))}>
                        {classItem.average != null ? `${classItem.average}%` : "-"}
                      </p>
                      <p className={cn("text-xs font-semibold", gradeTone(classItem.average))}>
                        {letterGrade(classItem.average)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPredictorClassId(classItem.id)}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> What if?
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {classItem.assignments.length === 0 ? (
                    <p className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                      No assignments posted yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Assignment</th>
                            <th className="px-3 py-2 text-left font-medium">Due</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                            <th className="px-3 py-2 text-right font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {classItem.assignments.map((assignment) => (
                            <tr key={assignment.id} className="transition-colors hover:bg-muted/40">
                              <td className="px-3 py-3 font-medium text-foreground">{assignment.title}</td>
                              <td className="px-3 py-3 text-muted-foreground">{formatDate(assignment.dueDate)}</td>
                              <td className="px-3 py-3">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                    statusClasses(assignment.status),
                                  )}
                                >
                                  {assignment.status}
                                </span>
                              </td>
                              <td className={cn("px-3 py-3 text-right font-semibold tabular-nums", gradeTone(assignment.pct))}>
                                {assignment.earned != null
                                  ? `${formatPoints(assignment.earned)} / ${formatPoints(assignment.total)} (${assignment.pct}%)`
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Contact Teachers</h2>
              <p className="text-sm text-muted-foreground">Messages identify you as Parent of {student.name}.</p>
            </div>
          </div>
          {teacherContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teachers are available yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {teacherContacts.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3 transition-spring hover-lift"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar size="sm" name={teacher.name} items={teacher.items} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{teacher.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacher.classes.map((c) => c.name).join(", ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openMessage(teacher)}
                    className="shrink-0"
                  >
                    <MessageCircle className="h-4 w-4" /> Message
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacher(null)}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Parent of {student.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send a message to {selectedTeacher?.name}. It will appear in the teacher inbox with a parent label.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedTeacher && selectedTeacher.classes.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                >
                  {selectedTeacher.classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id} className="bg-background">
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 5000))}
              placeholder="Write your message..."
              rows={5}
            />
            <p className="text-right text-[10px] tabular-nums text-muted-foreground">{message.length} / 5000</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedTeacher(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!message.trim() || sending}
              onClick={sendParentMessage}
            >
              <Send className="h-4 w-4" /> {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {(() => {
        const classItem = predictorClassId ? classes.find((item) => item.id === predictorClassId) : null;
        return (
          <GradePredictorModal
            open={!!predictorClassId}
            onOpenChange={(open) => !open && setPredictorClassId(null)}
            className={classItem?.name ?? ""}
            currentPct={classItem?.average ?? null}
            totalEarned={classItem?.totalEarned ?? 0}
            totalPossible={classItem?.totalPossible ?? 0}
          />
        );
      })()}
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card transition-spring hover-lift">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-2">{icon}</div>
      </div>
    </div>
  );
}
