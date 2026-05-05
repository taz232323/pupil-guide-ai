import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, ClipboardList, Inbox, Plus, GraduationCap, AlertTriangle, FileText,
  ShoppingBag, MessageSquare, Award, LineChart, Megaphone, ArrowRight,
  CalendarDays, Activity, ShieldCheck, CheckCircle2, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MissingStudentsDialog, type MissingEntry } from "@/components/teacher/MissingStudentsDialog";

type ClassRow = { id: string; name: string; subject: string };
type AsgnRow = { id: string; class_id: string; title: string; due_date: string | null };
type SubRow = { id: string; assignment_id: string; student_id: string; submitted_at: string };
type GradeRow = { assignment_id: string; student_id: string; overall_score: number | null; graded_at: string | null };
type PrivRow = { id: string; student_id: string; class_id: string | null; item_name: string; created_at: string };
type MsgRow = { id: string; sender_id: string; class_id: string; body: string; created_at: string };
type PurchaseRow = { id: string; student_id: string; item_name: string; created_at: string; status: string };
type QuestionRow = { assignment_id: string; max_score: number };

type ActivityItem = {
  id: string; type: "submission" | "message" | "purchase";
  studentId: string; text: string; ts: string; link: string;
};

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

const QUICK_ACTIONS = [
  { to: "/teacher/assignments", label: "Create Assignment", icon: Plus, tone: "bg-primary-soft text-primary" },
  { to: "/messages", label: "Send Announcement", icon: Megaphone, tone: "bg-teal-soft text-teal" },
  { to: "/teacher/gradebook", label: "Open Gradebook", icon: Award, tone: "bg-warning-soft text-warning" },
  { to: "/teacher/progress", label: "View Progress", icon: LineChart, tone: "bg-success-soft text-success" },
];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignments, setAssignments] = useState<AsgnRow[]>([]);
  const [submissions, setSubmissions] = useState<SubRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [questionTotals, setQuestionTotals] = useState<Record<string, number>>({});
  const [pendingPrivs, setPendingPrivs] = useState<PrivRow[]>([]);
  const [recentMsgs, setRecentMsgs] = useState<MsgRow[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseRow[]>([]);
  const [members, setMembers] = useState<{ class_id: string; student_id: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [unreadTeacherMsgs, setUnreadTeacherMsgs] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const [{ data: prof }, { data: cls }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("classes").select("id, name, subject").eq("teacher_id", user.id),
      ]);
      setName((prof?.full_name as string) || (user.email?.split("@")[0] ?? ""));

      const classList = (cls ?? []) as ClassRow[];
      setClasses(classList);
      const classIds = classList.map(c => c.id);

      if (classIds.length === 0) { setLoading(false); return; }

      const [{ data: asgn }, { data: mems }, { data: privs }, { data: msgsIn }, { count: unreadCnt }] = await Promise.all([
        supabase.from("assignments").select("id, class_id, title, due_date").in("class_id", classIds),
        supabase.from("class_members").select("class_id, student_id").in("class_id", classIds),
        supabase.from("shop_purchases").select("id, student_id, class_id, item_name, created_at")
          .eq("status", "pending").in("class_id", classIds).order("created_at", { ascending: true }),
        supabase.from("messages").select("id, sender_id, class_id, body, created_at")
          .in("class_id", classIds).neq("sender_id", user.id)
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id).is("read_at", null),
      ]);

      const asgnList = (asgn ?? []) as AsgnRow[];
      setAssignments(asgnList);
      setMembers((mems ?? []) as any);
      setPendingPrivs((privs ?? []) as PrivRow[]);
      setRecentMsgs((msgsIn ?? []) as MsgRow[]);
      setUnreadTeacherMsgs(unreadCnt ?? 0);

      const aIds = asgnList.map(a => a.id);
      const [{ data: subs }, { data: grds }, { data: qs }] = await Promise.all([
        aIds.length
          ? supabase.from("submissions").select("id, assignment_id, student_id, submitted_at")
              .in("assignment_id", aIds).order("submitted_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        aIds.length
          ? supabase.from("assignment_grades").select("assignment_id, student_id, overall_score, graded_at")
              .in("assignment_id", aIds)
          : Promise.resolve({ data: [] as any[] }),
        aIds.length
          ? supabase.from("assignment_questions").select("assignment_id, max_score").in("assignment_id", aIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setSubmissions((subs ?? []) as SubRow[]);
      setGrades((grds ?? []) as GradeRow[]);
      const totals: Record<string, number> = {};
      ((qs ?? []) as QuestionRow[]).forEach(q => {
        totals[q.assignment_id] = (totals[q.assignment_id] ?? 0) + (q.max_score ?? 0);
      });
      setQuestionTotals(totals);

      // Recent purchases (resolved or pending) across the teacher's class students
      const studentIds = Array.from(new Set(((mems ?? []) as any[]).map(m => m.student_id))) as string[];
      const { data: purchases } = studentIds.length
        ? await supabase.from("shop_purchases").select("id, student_id, item_name, created_at, status")
            .in("student_id", studentIds).order("created_at", { ascending: false }).limit(20)
        : { data: [] as any[] };
      setRecentPurchases((purchases ?? []) as PurchaseRow[]);

      // Profile lookup for student names referenced anywhere
      const allIds = new Set<string>([
        ...studentIds,
        ...((subs ?? []) as any[]).map(s => s.student_id),
        ...((msgsIn ?? []) as any[]).map(m => m.sender_id),
        ...((privs ?? []) as any[]).map(p => p.student_id),
      ]);
      if (allIds.size > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(allIds));
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || "Student"; });
        setProfiles(map);
      }

      setLoading(false);
    })();
  }, [user]);

  // Realtime: refresh when grades or submissions change for any of the teacher's assignments
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`teacher-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_grades" }, async () => {
        const aIds = assignments.map(a => a.id);
        if (!aIds.length) return;
        const { data } = await supabase
          .from("assignment_grades")
          .select("assignment_id, student_id, overall_score, graded_at")
          .in("assignment_id", aIds);
        setGrades((data ?? []) as GradeRow[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, async () => {
        const aIds = assignments.map(a => a.id);
        if (!aIds.length) return;
        const { data } = await supabase
          .from("submissions")
          .select("id, assignment_id, student_id, submitted_at")
          .in("assignment_id", aIds)
          .order("submitted_at", { ascending: false });
        setSubmissions((data ?? []) as SubRow[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, assignments]);

  const todayStart = startOfDay().getTime();
  const todayEnd = endOfDay().getTime();
  const dayAgo = Date.now() - 86_400_000;
  const classNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    classes.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [classes]);

  // Today's agenda
  const todaysAgenda = useMemo(() => assignments
    .filter(a => a.due_date && new Date(a.due_date).getTime() >= todayStart && new Date(a.due_date).getTime() <= todayEnd)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
  , [assignments, todayStart, todayEnd]);

  // Needs attention — ungraded submissions oldest first
  const ungradedSubs = useMemo(() => {
    const gradedKeys = new Set(grades.filter(g => g.graded_at).map(g => `${g.assignment_id}|${g.student_id}`));
    return submissions
      .filter(s => !gradedKeys.has(`${s.assignment_id}|${s.student_id}`))
      .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
  }, [submissions, grades]);

  // At-risk students: avg < 70 OR 3+ missing/overdue assignments
  const atRisk = useMemo(() => {
    const memByClass = new Map<string, string[]>();
    members.forEach(m => {
      const arr = memByClass.get(m.class_id) ?? [];
      arr.push(m.student_id); memByClass.set(m.class_id, arr);
    });
    const subKey = new Set(submissions.map(s => `${s.assignment_id}|${s.student_id}`));

    // Per-student class assignment for display
    const studentPrimaryClass = new Map<string, string>();
    members.forEach(m => {
      if (!studentPrimaryClass.has(m.student_id)) studentPrimaryClass.set(m.student_id, m.class_id);
    });

    // Missing/overdue counts (no submission for an assignment past its due date)
    const missingByStudent = new Map<string, number>();
    assignments.forEach(a => {
      if (!a.due_date) return;
      if (new Date(a.due_date).getTime() >= Date.now()) return;
      (memByClass.get(a.class_id) ?? []).forEach(sid => {
        if (!subKey.has(`${a.id}|${sid}`)) missingByStudent.set(sid, (missingByStudent.get(sid) ?? 0) + 1);
      });
    });

    // Average grade per student (across graded assignments)
    const pctSum = new Map<string, number>();
    const pctCount = new Map<string, number>();
    grades.forEach(g => {
      if (g.overall_score == null || !g.graded_at) return;
      const total = questionTotals[g.assignment_id] || 100;
      if (total <= 0) return;
      const pct = (g.overall_score / total) * 100;
      pctSum.set(g.student_id, (pctSum.get(g.student_id) ?? 0) + pct);
      pctCount.set(g.student_id, (pctCount.get(g.student_id) ?? 0) + 1);
    });

    const candidates = new Set<string>([
      ...Array.from(missingByStudent.keys()),
      ...Array.from(pctCount.keys()),
    ]);

    const flagged: { id: string; name: string; className: string; avg: number | null; missing: number; reason: "grade" | "missing" | "both" }[] = [];
    candidates.forEach(sid => {
      const missing = missingByStudent.get(sid) ?? 0;
      const cnt = pctCount.get(sid) ?? 0;
      const avg = cnt > 0 ? Math.round((pctSum.get(sid) ?? 0) / cnt) : null;
      const lowGrade = avg != null && avg < 70;
      const manyMissing = missing >= 3;
      if (!lowGrade && !manyMissing) return;
      const cid = studentPrimaryClass.get(sid);
      flagged.push({
        id: sid,
        name: profiles[sid] || "Student",
        className: (cid && classNameMap[cid]) || "—",
        avg,
        missing,
        reason: lowGrade && manyMissing ? "both" : lowGrade ? "grade" : "missing",
      });
    });

    return flagged
      .sort((a, b) => {
        const aScore = (a.avg ?? 100) - a.missing * 5;
        const bScore = (b.avg ?? 100) - b.missing * 5;
        return aScore - bScore;
      })
      .slice(0, 8);
  }, [assignments, members, submissions, grades, questionTotals, profiles, classNameMap]);

  // Class pulse
  const pulse = useMemo(() => {
    return classes.map(c => {
      const cAsgnIds = new Set(assignments.filter(a => a.class_id === c.id).map(a => a.id));
      const cMembers = members.filter(m => m.class_id === c.id).map(m => m.student_id);
      const studentCount = cMembers.length;

      const activeIds = new Set<string>();
      submissions.forEach(s => {
        if (cAsgnIds.has(s.assignment_id) && new Date(s.submitted_at).getTime() >= dayAgo)
          activeIds.add(s.student_id);
      });
      recentMsgs.forEach(m => {
        if (m.class_id === c.id && new Date(m.created_at).getTime() >= dayAgo) activeIds.add(m.sender_id);
      });

      const cGrades = grades.filter(g => cAsgnIds.has(g.assignment_id) && g.overall_score != null);
      const avg = cGrades.length
        ? Math.round(cGrades.reduce((s, g) => s + (g.overall_score ?? 0), 0) / cGrades.length)
        : null;

      const subKey = new Set(submissions.map(s => `${s.assignment_id}|${s.student_id}`));
      let missing = 0;
      assignments.forEach(a => {
        if (a.class_id !== c.id) return;
        if (!a.due_date || new Date(a.due_date).getTime() >= Date.now()) return;
        cMembers.forEach(sid => { if (!subKey.has(`${a.id}|${sid}`)) missing += 1; });
      });

      return { ...c, studentCount, active: activeIds.size, avg, missing };
    });
  }, [classes, assignments, submissions, grades, members, recentMsgs, dayAgo]);

  // All missing entries (overdue, no submission) — used by dialogs
  const missingEntries = useMemo<MissingEntry[]>(() => {
    const memByClass = new Map<string, string[]>();
    members.forEach(m => {
      const arr = memByClass.get(m.class_id) ?? [];
      arr.push(m.student_id); memByClass.set(m.class_id, arr);
    });
    const subKey = new Set(submissions.map(s => `${s.assignment_id}|${s.student_id}`));
    const out: MissingEntry[] = [];
    assignments.forEach(a => {
      if (!a.due_date || new Date(a.due_date).getTime() >= Date.now()) return;
      (memByClass.get(a.class_id) ?? []).forEach(sid => {
        if (subKey.has(`${a.id}|${sid}`)) return;
        out.push({
          studentId: sid,
          studentName: profiles[sid] || "Student",
          assignmentId: a.id,
          assignmentTitle: a.title,
          dueDate: a.due_date,
        });
      });
    });
    return out;
  }, [assignments, members, submissions, profiles]);

  const [missingDialog, setMissingDialog] = useState<
    | { kind: "class"; classId: string; className: string }
    | { kind: "student"; studentId: string; studentName: string }
    | null
  >(null);

  const dialogEntries = useMemo(() => {
    if (!missingDialog) return [];
    if (missingDialog.kind === "class") {
      const classAsgnIds = new Set(
        assignments.filter(a => a.class_id === missingDialog.classId).map(a => a.id)
      );
      return missingEntries.filter(e => classAsgnIds.has(e.assignmentId));
    }
    return missingEntries.filter(e => e.studentId === missingDialog.studentId);
  }, [missingDialog, missingEntries, assignments]);

  // Activity feed
  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    submissions.slice(0, 20).forEach(s => {
      items.push({
        id: `sub-${s.id}`, type: "submission", studentId: s.student_id, ts: s.submitted_at,
        text: `submitted "${assignments.find(a => a.id === s.assignment_id)?.title ?? "an assignment"}"`,
        link: `/teacher/assignments/${s.assignment_id}`,
      });
    });
    recentMsgs.forEach(m => {
      items.push({
        id: `msg-${m.id}`, type: "message", studentId: m.sender_id, ts: m.created_at,
        text: `sent a message: "${m.body.slice(0, 60)}${m.body.length > 60 ? "…" : ""}"`,
        link: `/messages`,
      });
    });
    recentPurchases.forEach(p => {
      items.push({
        id: `buy-${p.id}`, type: "purchase", studentId: p.student_id, ts: p.created_at,
        text: `redeemed ${p.item_name}`,
        link: `/teacher/shop`,
      });
    });
    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 10);
  }, [submissions, assignments, recentMsgs, recentPurchases]);

  const summary = loading
    ? "Loading your day…"
    : `You have ${ungradedSubs.length} ungraded submission${ungradedSubs.length === 1 ? "" : "s"}${unreadTeacherMsgs ? ` and ${unreadTeacherMsgs} message${unreadTeacherMsgs === 1 ? "" : "s"} waiting` : ""}.`;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Greeting */}
        <div className="rounded-3xl bg-gradient-hero p-6 sm:p-8 text-white shadow-elevated relative overflow-hidden animate-fade-in">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">{timeGreeting()}</p>
              <h1 className="mt-1 text-2xl sm:text-4xl font-bold tracking-tight truncate">
                {name || "Welcome back"} 👋
              </h1>
              <p className="mt-2 text-sm sm:text-base opacity-95 max-w-xl">{summary}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
                <Users className="h-5 w-5" />
                <div className="leading-tight">
                  <p className="text-lg font-bold tabular-nums">
                    {new Set(members.map(m => m.student_id)).size}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide opacity-80">Students</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
                <ClipboardList className="h-5 w-5" />
                <div className="leading-tight">
                  <p className="text-lg font-bold tabular-nums">{classes.length}</p>
                  <p className="text-[10px] uppercase tracking-wide opacity-80">Classes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!loading && classes.length === 0 ? (
          <Card className="overflow-hidden border-0 shadow-elevated">
            <div className="bg-gradient-soft px-6 py-14 sm:py-20 text-center">
              <div className="mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-card text-primary shadow-card">
                <GraduationCap className="h-10 w-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome to Grapheion</h2>
              <p className="mx-auto mt-2 max-w-md text-sm sm:text-base text-muted-foreground">
                Create your first class to invite students, post assignments, and start tracking progress.
              </p>
              <Button asChild size="lg" className="mt-6 h-12 px-8 text-base shadow-elevated">
                <Link to="/teacher/classes"><Plus className="h-5 w-5" />Create Class</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Today's Agenda */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-soft text-teal">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Today's Agenda</h2>
                    <p className="text-xs text-muted-foreground">Assignments due today across your classes.</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/teacher/assignments">All <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
              {loading ? (
                <Skeleton className="h-16 rounded-xl" />
              ) : todaysAgenda.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nothing is due today.</p>
              ) : (
                <ul className="space-y-2">
                  {todaysAgenda.map(a => (
                    <li key={a.id}>
                      <Link to={`/teacher/assignments/${a.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border p-3 hover-lift">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {classNameMap[a.class_id]} · Due {new Date(a.due_date!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Needs Attention — most prominent */}
            <section className="rounded-3xl border-2 border-warning/40 bg-gradient-to-br from-warning-soft/60 via-card to-card p-5 sm:p-6 shadow-elevated">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning text-warning-foreground shadow-card">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Needs Attention</h2>
                  <p className="text-xs text-muted-foreground">Items that need your action.</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* Ungraded */}
                <div className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Inbox className="h-4 w-4 text-primary" /> Ungraded
                    </p>
                    <span className="text-xs font-bold rounded-full bg-primary-soft text-primary px-2 py-0.5 tabular-nums">
                      {ungradedSubs.length}
                    </span>
                  </div>
                  {loading ? <Skeleton className="h-24 rounded-lg" /> : ungradedSubs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-5 w-5 text-success" /> All caught up
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {ungradedSubs.slice(0, 5).map(s => {
                        const a = assignments.find(x => x.id === s.assignment_id);
                        return (
                          <li key={s.id}>
                            <Link to={`/teacher/assignments/${s.assignment_id}`}
                              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-sm">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{profiles[s.student_id] || "Student"}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{a?.title ?? "Assignment"}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{relTime(s.submitted_at)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Pending privileges */}
                <div className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-teal" /> Privilege requests
                    </p>
                    <span className="text-xs font-bold rounded-full bg-teal-soft text-teal px-2 py-0.5 tabular-nums">
                      {pendingPrivs.length}
                    </span>
                  </div>
                  {loading ? <Skeleton className="h-24 rounded-lg" /> : pendingPrivs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center flex flex-col items-center gap-1">
                      <Sparkles className="h-5 w-5 text-success" /> No pending requests
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pendingPrivs.slice(0, 5).map(p => (
                        <li key={p.id}>
                          <Link to="/teacher/shop"
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{profiles[p.student_id] || "Student"}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.item_name}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">{relTime(p.created_at)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* At risk */}
                <div className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-destructive" /> At-risk students
                    </p>
                    <span className="text-xs font-bold rounded-full bg-destructive/10 text-destructive px-2 py-0.5 tabular-nums">
                      {atRisk.length}
                    </span>
                  </div>
                  {loading ? <Skeleton className="h-24 rounded-lg" /> : atRisk.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-5 w-5 text-success" /> Everyone is on track
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {atRisk.map(s => (
                        <li key={s.id}>
                          <Link to="/teacher/progress"
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{s.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {s.className}
                                {s.avg != null ? ` · ${s.avg}% avg` : ""}
                                {s.missing > 0 ? ` · ${s.missing} missing` : ""}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold px-2 py-0.5 shrink-0">
                              At Risk
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map(q => (
                <Link key={q.to} to={q.to}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card hover-lift">
                  <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl", q.tone)}>
                    <q.icon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-center">{q.label}</p>
                </Link>
              ))}
            </section>

            {/* Class Pulse + Activity */}
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Class Pulse
                  </h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/teacher/classes">All <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {pulse.map(c => {
                      const avgTone = c.avg == null ? "text-muted-foreground"
                        : c.avg >= 80 ? "text-success" : c.avg >= 70 ? "text-warning" : "text-destructive";
                      return (
                        <Link key={c.id} to={`/teacher/classes/${c.id}`}
                          className="block rounded-2xl border border-border bg-card p-4 shadow-card hover-lift">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1 shrink-0">
                              <Users className="h-3 w-3" />{c.studentCount}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-muted/50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active 24h</p>
                              <p className="mt-0.5 text-lg font-bold tabular-nums">{c.active}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg</p>
                              <p className={cn("mt-0.5 text-lg font-bold tabular-nums", avgTone)}>
                                {c.avg == null ? "—" : `${c.avg}%`}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Missing</p>
                              <p className={cn("mt-0.5 text-lg font-bold tabular-nums", c.missing > 0 ? "text-destructive" : "")}>
                                {c.missing}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-teal" /> Recent Activity
                </h2>
                {loading ? (
                  <Skeleton className="h-64 rounded-2xl" />
                ) : activity.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No recent activity yet.
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="space-y-2">
                    {activity.map(a => {
                      const Icon = a.type === "submission" ? FileText : a.type === "message" ? MessageSquare : ShoppingBag;
                      const tone = a.type === "submission" ? "bg-primary-soft text-primary"
                        : a.type === "message" ? "bg-teal-soft text-teal"
                        : "bg-warning-soft text-warning";
                      return (
                        <li key={a.id}>
                          <Link to={a.link}
                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover-lift">
                            <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug">
                                <span className="font-semibold">{profiles[a.studentId] || "Student"}</span>{" "}
                                <span className="text-muted-foreground">{a.text}</span>
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{relTime(a.ts)}</p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
