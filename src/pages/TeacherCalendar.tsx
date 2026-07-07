import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, ListChecks, Sparkles, Trash2, ExternalLink,
  Flame, CalendarPlus, LinkIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { classColor, isOverdue } from "@/lib/calendar";
import { MountainSketch } from "@/components/MountainSketch";
import { ProgressRing } from "@/components/ProgressRing";
import { CountUp } from "@/components/CountUp";
import {
  ASSIGNMENT_TYPES,
  DEFAULT_ASSIGNMENT_TYPE,
  DEFAULT_RESOURCE_KIND,
  RESOURCE_KINDS,
  type AssignmentType,
  type ResourceKind,
  type ResourceLink,
  getResourceKindMeta,
  normalizeResourceLinks,
} from "@/lib/assignmentMetadata";

type TAssignment = {
  id: string; title: string; class_id: string; class_name: string;
  due_date: string | null; total_students: number; submitted_count: number;
};
type Reminder = {
  id: string; student_id: string; title: string; note: string | null;
  start_at: string; duration_minutes: number; kind: string;
};
type Submission = { id: string; assignment_id: string; student_id: string; submitted_at: string; graded: boolean };
type CalendarView = "month" | "week" | "heatmap" | "planning";
type ClassRow = { id: string; name: string };
type ClassMemberRow = { class_id: string };
type AssignmentCalendarRow = {
  id: string;
  title: string;
  class_id: string;
  due_date: string | null;
  classes?: { name: string | null } | null;
};
type GradeKeyRow = { assignment_id: string; student_id: string };
type ProfileRow = { id: string; full_name: string | null };

export default function TeacherCalendar() {
  const { user } = useAuth();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(new Date());
  const [classes, setClasses] = useState<{ id: string; name: string; member_count: number }[]>([]);
  const [assignments, setAssignments] = useState<TAssignment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [gradingQueue, setGradingQueue] = useState<{ id: string; assignment_id: string; assignment_title: string; class_name: string; class_id: string; student_name: string; submitted_at: string }[]>([]);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [editingReminder, setEditingReminder] = useState<Partial<Reminder> | null>(null);
  const [scheduleAsg, setScheduleAsg] = useState<{ date: Date } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    // Classes taught
    const { data: cls } = await supabase.from("classes").select("id, name").eq("teacher_id", user.id);
    const classList = cls ?? [];
    // Member counts
    const memberCounts = new Map<string, number>();
    if (classList.length > 0) {
      const { data: members } = await supabase.from("class_members").select("class_id").in("class_id", classList.map(c => c.id));
      ((members ?? []) as ClassMemberRow[]).forEach((m) => memberCounts.set(m.class_id, (memberCounts.get(m.class_id) ?? 0) + 1));
    }
    setClasses(classList.map(c => ({ ...c, member_count: memberCounts.get(c.id) ?? 0 })));

    // Assignments
    const { data: asgs } = await supabase
      .from("assignments").select("id, title, class_id, due_date, classes(name)")
      .eq("teacher_id", user.id);
    const baseAsgs = (asgs ?? []) as AssignmentCalendarRow[];

    // Submissions for these assignments
    const asgIds = baseAsgs.map(a => a.id);
    let subs: Submission[] = [];
    if (asgIds.length > 0) {
      const { data } = await supabase.from("submissions")
        .select("id, assignment_id, student_id, submitted_at").in("assignment_id", asgIds);
      subs = (data ?? []) as Submission[];
    }
    const submissionsByAsg = new Map<string, Submission[]>();
    subs.forEach(s => {
      if (!submissionsByAsg.has(s.assignment_id)) submissionsByAsg.set(s.assignment_id, []);
      submissionsByAsg.get(s.assignment_id)!.push(s);
    });

    setAssignments(baseAsgs.map(a => ({
      id: a.id, title: a.title, class_id: a.class_id,
      class_name: a.classes?.name ?? "Class", due_date: a.due_date,
      total_students: memberCounts.get(a.class_id) ?? 0,
      submitted_count: submissionsByAsg.get(a.id)?.length ?? 0,
    })));

    // Grading queue: submissions without an assignment_grade row
    if (subs.length > 0) {
      const { data: grades } = await supabase.from("assignment_grades")
        .select("assignment_id, student_id").in("assignment_id", asgIds);
      const gradedKeys = new Set(((grades ?? []) as GradeKeyRow[]).map((g) => `${g.assignment_id}:${g.student_id}`));
      const studentIds = Array.from(new Set(subs.map(s => s.student_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
      const nameById = new Map(((profs ?? []) as ProfileRow[]).map((p) => [p.id, p.full_name || "Student"]));
      const asgById = new Map(baseAsgs.map(a => [a.id, a]));
      const queue = subs
        .filter(s => !gradedKeys.has(`${s.assignment_id}:${s.student_id}`))
        .sort((a, b) => +new Date(a.submitted_at) - +new Date(b.submitted_at))
        .map(s => ({
          id: s.id, assignment_id: s.assignment_id,
          assignment_title: asgById.get(s.assignment_id)?.title ?? "Assignment",
          class_name: asgById.get(s.assignment_id)?.classes?.name ?? "Class",
          class_id: asgById.get(s.assignment_id)?.class_id ?? "",
          student_name: nameById.get(s.student_id) ?? "Student",
          submitted_at: s.submitted_at,
        }));
      setGradingQueue(queue);
    } else {
      setGradingQueue([]);
    }

    // Personal reminders
    const { data: rems } = await supabase.from("personal_reminders").select("*").eq("student_id", user.id);
    setReminders((rems ?? []) as Reminder[]);
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`tcal:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "personal_reminders", filter: `student_id=eq.${user.id}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Day map
  const dayItems = useMemo(() => {
    const m = new Map<string, { assignments: TAssignment[]; reminders: Reminder[] }>();
    const ensure = (k: string) => { if (!m.has(k)) m.set(k, { assignments: [], reminders: [] }); return m.get(k)!; };
    for (const a of assignments) {
      if (!a.due_date) continue;
      ensure(format(parseISO(a.due_date), "yyyy-MM-dd")).assignments.push(a);
    }
    for (const r of reminders) {
      ensure(format(parseISO(r.start_at), "yyyy-MM-dd")).reminders.push(r);
    }
    return m;
  }, [assignments, reminders]);

  const overdue = useMemo(() =>
    assignments
      .filter(a => a.due_date && isOverdue(a.due_date, false) && a.submitted_count < a.total_students)
      .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!)),
    [assignments]
  );

  const upcoming = useMemo(() =>
    assignments
      .filter(a => a.due_date && new Date(a.due_date) >= new Date())
      .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!))
      .slice(0, 5),
    [assignments]
  );

  // Workload donut: assignments due within the visible month vs total scheduled.
  const workload = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const scheduled = assignments.filter(a => a.due_date);
    const inMonth = scheduled.filter(a => {
      const d = parseISO(a.due_date!);
      return d >= monthStart && d <= monthEnd;
    }).length;
    return { inMonth, total: scheduled.length };
  }, [assignments, cursor]);

  const saveReminder = async (r: Partial<Reminder>) => {
    if (!user || !r.title || !r.start_at) return;
    if (r.id) {
      const { error } = await supabase.from("personal_reminders").update({
        title: r.title, note: r.note ?? null, start_at: r.start_at,
        duration_minutes: r.duration_minutes ?? 30, kind: r.kind ?? "reminder",
      }).eq("id", r.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("personal_reminders").insert({
        student_id: user.id, title: r.title, note: r.note ?? null, start_at: r.start_at,
        duration_minutes: r.duration_minutes ?? 30, kind: r.kind ?? "reminder",
      });
      if (error) return toast.error(error.message);
    }
    setEditingReminder(null);
    toast.success("Saved");
  };

  const deleteReminder = async (id: string) => {
    const { error } = await supabase.from("personal_reminders").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const rescheduleAssignment = async (assignmentId: string, newDate: Date) => {
    // keep original time if any
    const a = assignments.find(x => x.id === assignmentId);
    const orig = a?.due_date ? parseISO(a.due_date) : null;
    const target = new Date(newDate);
    if (orig) target.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    else target.setHours(23, 59, 0, 0);
    const { error } = await supabase.from("assignments").update({ due_date: target.toISOString() }).eq("id", assignmentId);
    if (error) return toast.error(error.message);
    toast.success("Rescheduled");
  };

  const prev = () => setCursor(view === "week" || view === "planning" ? subWeeks(cursor, 1) : subMonths(cursor, 1));
  const next = () => setCursor(view === "week" || view === "planning" ? addWeeks(cursor, 1) : addMonths(cursor, 1));

  return (
    <DashboardShell title="Calendar" subtitle="Plan ahead and stay on top of grading.">
      {/* Header accent */}
      <div className="relative overflow-hidden -mt-2 mb-2">
        <MountainSketch variant="range" className="pointer-events-none absolute -top-6 right-0 hidden sm:block w-56 text-muted-foreground/30" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="planning">Planning</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" variant="outline" onClick={prev} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
        <Button size="sm" variant="outline" onClick={next} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm font-medium ml-1">
          {view === "month" || view === "heatmap"
            ? format(cursor, "MMMM yyyy")
            : `Week of ${format(startOfWeek(cursor), "MMM d, yyyy")}`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScheduleAsg({ date: new Date() })}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Schedule
          </Button>
          <Button size="sm" onClick={() => setEditingReminder({ start_at: new Date().toISOString(), kind: "reminder", duration_minutes: 30 })}>
            <Plus className="h-4 w-4 mr-1" /> Reminder
          </Button>
        </div>
      </div>

      {/* Legend */}
      {classes.length > 0 && view !== "heatmap" && (
        <div className="flex flex-wrap gap-2 mb-4 stagger-children">
          {classes.map(c => {
            const col = classColor(c.id);
            return (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-transform hover:scale-105"
                style={{ borderColor: col.border, color: col.fg, background: col.bg }}>
                <span className="h-2 w-2 rounded-full" style={{ background: col.border }} />
                {c.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <Card className="p-3 mb-4 border-destructive/40 bg-destructive/5 attention-pulse">
          <p className="text-sm font-semibold text-destructive mb-2">Overdue with missing submissions ({overdue.length})</p>
          <ul className="space-y-1.5">
            {overdue.map(a => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Link to={`/teacher/assignments/${a.id}`} className="font-medium hover:underline text-destructive truncate">{a.title}</Link>
                <span className="text-xs text-muted-foreground truncate">· {a.class_name}</span>
                <Badge variant="destructive" className="ml-auto shrink-0">
                  {a.total_students - a.submitted_count} missing
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Two-column layout: calendar + right rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div>
          {view === "month" && <MonthGrid cursor={cursor} dayItems={dayItems} onDayClick={setOpenDay}
            onScheduleDay={(d) => setScheduleAsg({ date: d })} />}
          {view === "week" && <WeekGrid cursor={cursor} dayItems={dayItems} />}
          {view === "heatmap" && <Heatmap cursor={cursor} assignments={assignments} />}
          {view === "planning" && <PlanningGrid cursor={cursor} assignments={assignments}
            draggingId={draggingId} setDraggingId={setDraggingId}
            onReschedule={rescheduleAssignment} />}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Workload donut */}
          <Card className="p-4 hover-lift">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base">Workload</h2>
              <span className="text-xs text-muted-foreground">{format(cursor, "MMMM")}</span>
            </div>
            <div className="flex items-center gap-4">
              <ProgressRing
                value={workload.total > 0 ? Math.round((workload.inMonth / workload.total) * 100) : 0}
                size={92}
                strokeWidth={9}
              >
                <span className="font-tabular text-2xl font-bold leading-none">
                  <CountUp value={workload.inMonth} />
                </span>
              </ProgressRing>
              <div className="text-sm">
                <p className="font-medium">Due this month</p>
                <p className="text-xs text-muted-foreground">
                  {workload.total} scheduled in total
                </p>
              </div>
            </div>
          </Card>

          {/* Upcoming schedule */}
          {upcoming.length > 0 && (
            <Card className="p-4 hover-lift">
              <h2 className="text-base mb-2">Upcoming schedule</h2>
              <ul className="space-y-2">
                {upcoming.map(a => {
                  const col = classColor(a.class_id);
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: col.border }} />
                      <Link to={`/teacher/assignments/${a.id}`} className="font-medium hover:underline truncate flex-1">{a.title}</Link>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {format(parseISO(a.due_date!), "MMM d")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <GradingQueue items={gradingQueue} />

          {/* Schedule an assignment CTA */}
          <Card className="p-4 bg-primary-soft border-primary/20">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <CalendarPlus className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <h3 className="text-base">Schedule an assignment</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Plan ahead and keep your classes on a steady rhythm.
                </p>
                <Button size="sm" onClick={() => setScheduleAsg({ date: new Date() })}>
                  <Plus className="h-4 w-4 mr-1" /> New assignment
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Day panel */}
      <Sheet open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {openDay && (() => {
            const k = format(openDay, "yyyy-MM-dd");
            const data = dayItems.get(k) ?? { assignments: [], reminders: [] };
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{format(openDay, "EEEE, MMM d")}</SheetTitle>
                  <SheetDescription>What's happening this day.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  {data.assignments.map(a => {
                    const col = classColor(a.class_id);
                    return (
                      <div key={a.id} className="rounded-md border p-2"
                        style={{ background: col.bg, borderColor: col.border }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: col.fg }}>{a.title}</p>
                            <p className="text-[11px] truncate" style={{ color: col.fg, opacity: 0.85 }}>
                              {a.class_name} · {format(parseISO(a.due_date!), "p")}
                            </p>
                          </div>
                          <Badge variant="secondary">{a.submitted_count}/{a.total_students}</Badge>
                        </div>
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2 mt-1 text-xs">
                          <Link to={`/teacher/assignments/${a.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1" />Open</Link>
                        </Button>
                      </div>
                    );
                  })}
                  {data.reminders.map(r => (
                    <div key={r.id} className="rounded-md border border-dashed p-2 bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => setEditingReminder(r)} className="text-left flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">📌 {r.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {format(parseISO(r.start_at), "p")}{r.note ? ` · ${r.note}` : ""}
                          </p>
                        </button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => deleteReminder(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {data.assignments.length === 0 && data.reminders.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => {
                      const d = new Date(openDay); d.setHours(9, 0, 0, 0);
                      setEditingReminder({ start_at: d.toISOString(), kind: "reminder", duration_minutes: 30 });
                    }}>
                      <Plus className="h-4 w-4 mr-1" /> Reminder
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setScheduleAsg({ date: openDay })}>
                      <CalendarPlus className="h-4 w-4 mr-1" /> Assignment
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <ReminderDialog
        value={editingReminder}
        onClose={() => setEditingReminder(null)}
        onSave={saveReminder}
        onDelete={editingReminder?.id ? () => { deleteReminder(editingReminder.id!); setEditingReminder(null); } : undefined}
      />

      <ScheduleAssignmentDialog
        value={scheduleAsg}
        classes={classes}
        onClose={() => setScheduleAsg(null)}
        onCreated={() => { setScheduleAsg(null); loadData(); }}
      />
    </DashboardShell>
  );
}

/* ============ Month grid ============ */
function MonthGrid({ cursor, dayItems, onDayClick, onScheduleDay }: {
  cursor: Date;
  dayItems: Map<string, { assignments: TAssignment[]; reminders: Reminder[] }>;
  onDayClick: (d: Date) => void;
  onScheduleDay: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const today = new Date();
  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div key={format(cursor, "yyyy-MM")} className="grid grid-cols-7 gap-1 animate-fade-up">
        {days.map(d => {
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const k = format(d, "yyyy-MM-dd");
          const data = dayItems.get(k) ?? { assignments: [], reminders: [] };
          const future = d >= new Date(today.toDateString());
          return (
            <div key={d.toISOString()}
              className={cn("min-h-[90px] rounded-md border p-1.5 relative group transition-spring hover:bg-accent hover:-translate-y-0.5",
                !inMonth && "opacity-40", isToday && "border-primary bg-primary/5 today-pulse-ring")}>
              <button onClick={() => onDayClick(d)} className="block w-full text-left">
                <div className={cn("text-xs font-semibold mb-1", isToday && "text-primary")}>{format(d, "d")}</div>
                <div className="space-y-0.5">
                  {data.assignments.slice(0, 3).map(a => {
                    const col = classColor(a.class_id);
                    const missing = a.submitted_count < a.total_students;
                    const past = a.due_date && new Date(a.due_date) < today;
                    const overdueStyle = past && missing;
                    return (
                      <div key={a.id}
                        className="text-[10px] truncate rounded px-1 py-0.5 border origin-left transition-transform hover:scale-105"
                        style={overdueStyle
                          ? { background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive) / 0.4)" }
                          : { background: col.bg, color: col.fg, borderColor: col.border }}>
                        {a.title} ({a.submitted_count}/{a.total_students})
                      </div>
                    );
                  })}
                  {data.reminders.slice(0, 2).map(r => (
                    <div key={r.id} className="text-[10px] truncate rounded px-1 py-0.5 border border-dashed text-muted-foreground origin-left transition-transform hover:scale-105">
                      📌 {r.title}
                    </div>
                  ))}
                  {(data.assignments.length + data.reminders.length) > 5 && (
                    <div className="text-[10px] text-muted-foreground">+more</div>
                  )}
                </div>
              </button>
              {future && (
                <button onClick={(e) => { e.stopPropagation(); onScheduleDay(d); }}
                  aria-label="Schedule assignment on this day"
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============ Week grid ============ */
function WeekGrid({ cursor, dayItems }: {
  cursor: Date;
  dayItems: Map<string, { assignments: TAssignment[]; reminders: Reminder[] }>;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <div key={format(cursor, "yyyy-MM-dd")} className="grid grid-cols-1 sm:grid-cols-7 gap-2 animate-fade-up">
      {days.map(d => {
        const data = dayItems.get(format(d, "yyyy-MM-dd")) ?? { assignments: [], reminders: [] };
        const isToday = isSameDay(d, today);
        return (
          <Card key={d.toISOString()} className={cn("p-2 min-h-[200px] transition-spring", isToday && "border-primary today-pulse-ring")}>
            <div className={cn("text-xs font-semibold mb-2", isToday && "text-primary")}>{format(d, "EEE d")}</div>
            <div className="space-y-1.5">
              {data.assignments.length === 0 && data.reminders.length === 0 && (
                <p className="text-[11px] text-muted-foreground">—</p>
              )}
              {data.assignments.map(a => {
                const col = classColor(a.class_id);
                return (
                  <Link key={a.id} to={`/teacher/assignments/${a.id}`}
                    className="block rounded-md border p-2 transition-transform hover:scale-[1.02]"
                    style={{ background: col.bg, borderColor: col.border }}>
                    <p className="text-xs font-medium truncate" style={{ color: col.fg }}>{a.title}</p>
                    <p className="text-[10px] truncate" style={{ color: col.fg, opacity: 0.85 }}>
                      {a.class_name} · {a.submitted_count}/{a.total_students}
                    </p>
                  </Link>
                );
              })}
              {data.reminders.map(r => (
                <div key={r.id} className="rounded-md border border-dashed p-2 bg-muted/30">
                  <p className="text-xs font-medium truncate">📌 {r.title}</p>
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(r.start_at), "p")}</p>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============ Heatmap ============ */
function Heatmap({ cursor, assignments }: { cursor: Date; assignments: TAssignment[] }) {
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (!a.due_date) continue;
    const k = format(parseISO(a.due_date), "yyyy-MM-dd");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  const today = new Date();
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="h-4 w-4 text-primary animate-flame-pulse" />
        <p className="text-sm font-semibold">Class load heatmap</p>
        <p className="text-xs text-muted-foreground">Darker days = more assignments due across all classes.</p>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div key={format(cursor, "yyyy-MM")} className="grid grid-cols-7 gap-1 animate-fade-up">
        {days.map(d => {
          const k = format(d, "yyyy-MM-dd");
          const n = counts.get(k) ?? 0;
          const intensity = n === 0 ? 0 : 0.15 + (n / max) * 0.65;
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()}
              className={cn("min-h-[60px] rounded-md border p-1.5 text-xs transition-transform hover:scale-105", !inMonth && "opacity-40", isToday && "today-pulse-ring")}
              style={{ background: `hsl(var(--primary) / ${intensity})` }}>
              <div className="font-semibold">{format(d, "d")}</div>
              {n > 0 && <div className={cn("mt-1 font-bold font-tabular", intensity > 0.4 ? "text-primary-foreground" : "text-primary")}>{n}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============ Planning grid (drag & drop) ============ */
function PlanningGrid({ cursor, assignments, draggingId, setDraggingId, onReschedule }: {
  cursor: Date;
  assignments: TAssignment[];
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  onReschedule: (assignmentId: string, date: Date) => void;
}) {
  // Mon–Fri (5 school days)
  const start = addDays(startOfWeek(cursor), 1);
  const days = Array.from({ length: 5 }, (_, i) => addDays(start, i));
  const today = new Date();

  const byDay = new Map<string, TAssignment[]>();
  for (const a of assignments) {
    if (!a.due_date) continue;
    const d = parseISO(a.due_date);
    if (d < days[0] || d > addDays(days[4], 1)) continue;
    const k = format(d, "yyyy-MM-dd");
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(a);
  }

  return (
    <Card className="p-3">
      <p className="text-sm font-semibold mb-2">Weekly planning · drag assignments between days</p>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {days.map(d => {
          const k = format(d, "yyyy-MM-dd");
          const items = byDay.get(k) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div key={k}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggingId) { onReschedule(draggingId, d); setDraggingId(null); } }}
              className={cn("min-h-[200px] rounded-md border p-2 transition-colors",
                isToday && "border-primary today-pulse-ring",
                draggingId && "border-dashed bg-accent/50")}>
              <p className={cn("text-xs font-semibold mb-2", isToday && "text-primary")}>{format(d, "EEE d")}</p>
              <div className="space-y-1.5">
                {items.length === 0 && <p className="text-[11px] text-muted-foreground">Drop here</p>}
                {items.map(a => {
                  const col = classColor(a.class_id);
                  return (
                    <div key={a.id} draggable
                      onDragStart={() => setDraggingId(a.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className="rounded-md border p-2 cursor-move"
                      style={{ background: col.bg, borderColor: col.border }}>
                      <p className="text-xs font-medium truncate" style={{ color: col.fg }}>{a.title}</p>
                      <p className="text-[10px] truncate" style={{ color: col.fg, opacity: 0.85 }}>{a.class_name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============ Grading Queue ============ */
function GradingQueue({ items }: { items: { id: string; assignment_id: string; assignment_title: string; class_name: string; class_id: string; student_name: string; submitted_at: string }[] }) {
  return (
    <Card className={cn("p-4 h-fit", items.length > 0 && "grading-shimmer")}>
      <div className="flex items-center gap-2 mb-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Grading queue</p>
        <Badge variant="secondary" className="ml-auto font-tabular">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">All caught up. ✨</p>
      ) : (
        <ul className="space-y-1.5 max-h-[500px] overflow-y-auto stagger-children">
          {items.slice(0, 30).map(it => {
            const col = classColor(it.class_id);
            return (
              <li key={it.id}>
                <Link to={`/teacher/assignments/${it.assignment_id}`}
                  className="block rounded-md border p-2 hover:bg-accent hover:translate-x-0.5 transition-spring">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: col.border }} />
                    <p className="text-xs font-medium truncate flex-1">{it.assignment_title}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {it.student_name} · {it.class_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Submitted {format(parseISO(it.submitted_at), "MMM d, p")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ============ Reminder Dialog (teacher) ============ */
function ReminderDialog({ value, onClose, onSave, onDelete }: {
  value: Partial<Reminder> | null;
  onClose: () => void;
  onSave: (r: Partial<Reminder>) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!value) return;
    setTitle(value.title ?? "");
    setNote(value.note ?? "");
    const d = value.start_at ? parseISO(value.start_at) : new Date();
    setDate(format(d, "yyyy-MM-dd"));
    setTime(format(d, "HH:mm"));
  }, [value]);

  if (!value) return null;
  const submit = () => {
    if (!title.trim()) return toast.error("Title required");
    const start = new Date(`${date}T${time}:00`);
    onSave({ ...value, title: title.trim(), note: note.trim() || null, start_at: start.toISOString() });
  };
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value.id ? "Edit reminder" : "New reminder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grade Unit 2 essays" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onDelete && <Button variant="ghost" className="text-destructive mr-auto" onClick={onDelete}>Delete</Button>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Schedule Assignment Dialog ============ */
function ScheduleAssignmentDialog({ value, classes, onClose, onCreated }: {
  value: { date: Date } | null;
  classes: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(DEFAULT_ASSIGNMENT_TYPE);
  const [classId, setClassId] = useState("");
  const [description, setDescription] = useState("");
  const [unitTag, setUnitTag] = useState("");
  const [materialNotes, setMaterialNotes] = useState("");
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!value) return;
    setTitle("");
    setAssignmentType(DEFAULT_ASSIGNMENT_TYPE);
    setClassId(classes[0]?.id ?? "");
    setDescription("");
    setUnitTag("");
    setMaterialNotes("");
    setResourceLinks([]);
    setRemindersEnabled(true);
    setDate(format(value.date, "yyyy-MM-dd"));
    setTime("23:59");
  }, [value, classes]);

  if (!value) return null;

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (!classId) return toast.error("Select a class");
    const resources = normalizeResourceLinks(resourceLinks);
    for (const resource of resources) {
      try {
        const url = new URL(resource.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        return toast.error(`Check the URL for "${resource.title}"`);
      }
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return toast.error("Not signed in"); }
    const due = new Date(`${date}T${time}:00`);
    const { error } = await supabase.from("assignments").insert({
      class_id: classId,
      teacher_id: user.id,
      assignment_type: assignmentType,
      title: title.trim(),
      description: description.trim() || null,
      unit_tag: unitTag.trim() || null,
      material_notes: materialNotes.trim() || null,
      resource_links: resources,
      reminders_enabled: remindersEnabled,
      due_date: due.toISOString(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Assignment scheduled");
    onCreated();
  };

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Schedule new assignment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz 3" />
          </div>
          <div>
            <Label>Class</Label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Assignment type</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ASSIGNMENT_TYPES.map((type) => {
                const selected = assignmentType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAssignmentType(type.value)}
                    className={cn(
                      "flex min-h-[78px] items-start gap-3 rounded-md border bg-card p-3 text-left transition-base hover:border-primary/40 hover:bg-primary-soft/30",
                      selected && "border-primary bg-primary-soft text-primary"
                    )}
                    aria-pressed={selected}
                  >
                    <type.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{type.label}</span>
                      <span className={cn("block text-xs leading-relaxed text-muted-foreground", selected && "text-primary/80")}>
                        {type.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div>
              <Label>Notes, slides, and class materials</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Add the directions or resources students need before they start.
              </p>
            </div>
            <Textarea
              rows={3}
              placeholder="Key notes, slide context, reading directions, or links students should review first."
              value={materialNotes}
              onChange={(e) => setMaterialNotes(e.target.value)}
            />
            <CalendarResourceLinks resources={resourceLinks} onChange={setResourceLinks} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Unit tag</Label>
              <Input value={unitTag} onChange={(e) => setUnitTag(e.target.value)} placeholder="Algebra - Unit 3" />
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <div>
                <Label className="cursor-pointer">Due-date reminders</Label>
                <p className="text-xs text-muted-foreground">Notify students before due.</p>
              </div>
              <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Due date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Due time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <Sparkles className="inline h-3 w-3 mr-1" />
            Add in-app questions from the assignment page after creating.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CalendarResourceLinks({
  resources,
  onChange,
}: {
  resources: ResourceLink[];
  onChange: (resources: ResourceLink[]) => void;
}) {
  const addResource = () => onChange([...resources, { title: "", url: "", kind: DEFAULT_RESOURCE_KIND }]);

  const updateResource = (index: number, patch: Partial<ResourceLink>) => {
    const next = [...resources];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeResource = (index: number) => onChange(resources.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 pt-1">
      {resources.map((resource, index) => {
        const KindIcon = getResourceKindMeta(resource.kind).icon;
        return (
          <div key={index} className="grid gap-2 rounded-md border bg-background p-2 sm:grid-cols-[132px_1fr]">
            <Select
              value={resource.kind}
              onValueChange={(value) => updateResource(index, { kind: value as ResourceKind })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_KINDS.map((kind) => (
                  <SelectItem key={kind.value} value={kind.value}>
                    {kind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-2 sm:grid-cols-[1fr_1.25fr_auto]">
              <div className="relative">
                <KindIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={`Resource ${index + 1} title`}
                  className="h-9 pl-8"
                  placeholder="Title"
                  value={resource.title}
                  onChange={(e) => updateResource(index, { title: e.target.value })}
                />
              </div>
              <div className="relative">
                <LinkIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={`Resource ${index + 1} URL`}
                  className="h-9 pl-8"
                  type="url"
                  placeholder="https://..."
                  value={resource.url}
                  onChange={(e) => updateResource(index, { url: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 justify-self-end text-destructive hover:text-destructive"
                aria-label="Remove resource"
                onClick={() => removeResource(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addResource}>
        <Plus className="h-3.5 w-3.5 mr-1" />Add material link
      </Button>
    </div>
  );
}
