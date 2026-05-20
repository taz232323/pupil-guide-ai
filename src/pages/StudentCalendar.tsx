import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, startOfMonth, startOfWeek, subMonths, subWeeks, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Sparkles, ListTodo, Trash2, ExternalLink, Check } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { classColor, estimateMinutes, isOverdue, daysUntil, type AssignmentLite } from "@/lib/calendar";

type Reminder = {
  id: string;
  student_id: string;
  title: string;
  note: string | null;
  start_at: string;
  duration_minutes: number;
  kind: string;
};

type DayItem =
  | { kind: "assignment"; id: string; date: Date; assignment: AssignmentLite; completed: boolean; overdue: boolean }
  | { kind: "reminder"; id: string; date: Date; reminder: Reminder };

export default function StudentCalendar() {
  const { user } = useAuth();
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(new Date());
  const [assignments, setAssignments] = useState<AssignmentLite[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [editingReminder, setEditingReminder] = useState<Partial<Reminder> | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(() => {
    const k = `study-suggestions-dismissed-${new Date().toDateString()}`;
    return localStorage.getItem(k) === "1";
  });

  // Load data
  const loadData = async () => {
    if (!user) return;
    // Classes the student is in
    const { data: memberships } = await supabase
      .from("class_members").select("class_id, classes(id, name)").eq("student_id", user.id);
    const cls = (memberships ?? []).map((m: any) => m.classes).filter(Boolean) as { id: string; name: string }[];
    setClasses(cls);
    const classIds = cls.map(c => c.id);
    if (classIds.length === 0) { setAssignments([]); return; }

    const { data: asgs } = await supabase
      .from("assignments")
      .select("id, title, class_id, due_date, classes(name)")
      .in("class_id", classIds);
    const baseAsgs: AssignmentLite[] = (asgs ?? []).map((a: any) => ({
      id: a.id, title: a.title, class_id: a.class_id,
      class_name: a.classes?.name ?? "Class", due_date: a.due_date,
    }));

    // Question counts (for time estimates)
    if (baseAsgs.length > 0) {
      const { data: qs } = await supabase
        .from("assignment_questions")
        .select("assignment_id, question_type")
        .in("assignment_id", baseAsgs.map(a => a.id));
      const counts = new Map<string, { n: number; open: boolean }>();
      (qs ?? []).forEach((q: any) => {
        const c = counts.get(q.assignment_id) ?? { n: 0, open: false };
        c.n += 1;
        if (q.question_type !== "multiple_choice") c.open = true;
        counts.set(q.assignment_id, c);
      });
      baseAsgs.forEach(a => {
        const c = counts.get(a.id);
        a.question_count = c?.n ?? 0;
        a.has_open_response = c?.open ?? false;
      });
    }
    setAssignments(baseAsgs);

    // Submissions = completed
    const { data: subs } = await supabase
      .from("submissions").select("assignment_id").eq("student_id", user.id);
    const submitted = new Set<string>((subs ?? []).map((s: any) => s.assignment_id));
    // Also pull status records (in case marked done w/o submission)
    const { data: statuses } = await supabase
      .from("assignment_status_records").select("assignment_id, status").eq("student_id", user.id);
    (statuses ?? []).forEach((s: any) => {
      if (s.status === "submitted" || s.status === "completed") submitted.add(s.assignment_id);
    });
    setCompletedIds(submitted);

    // Reminders
    const { data: rems } = await supabase
      .from("personal_reminders").select("*").eq("student_id", user.id);
    setReminders((rems ?? []) as Reminder[]);
  };

  useEffect(() => { loadData(); }, [user]);

  // Realtime for reminders
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`reminders:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "personal_reminders", filter: `student_id=eq.${user.id}` },
        () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_status_records", filter: `student_id=eq.${user.id}` },
        () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `student_id=eq.${user.id}` },
        () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Build day → items map
  const dayItems = useMemo(() => {
    const m = new Map<string, DayItem[]>();
    const push = (d: Date, item: DayItem) => {
      const k = format(d, "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(item);
    };
    for (const a of assignments) {
      if (!a.due_date) continue;
      const d = parseISO(a.due_date);
      const completed = completedIds.has(a.id);
      push(d, { kind: "assignment", id: a.id, date: d, assignment: a, completed, overdue: isOverdue(a.due_date, completed) });
    }
    for (const r of reminders) {
      const d = parseISO(r.start_at);
      push(d, { kind: "reminder", id: r.id, date: d, reminder: r });
    }
    // sort each day by time
    for (const arr of m.values()) arr.sort((a, b) => a.date.getTime() - b.date.getTime());
    return m;
  }, [assignments, reminders, completedIds]);

  const overdueItems = useMemo(() =>
    assignments
      .filter(a => a.due_date && isOverdue(a.due_date, completedIds.has(a.id)))
      .sort((a, b) => +new Date(a.due_date!) - +new Date(b.due_date!)),
    [assignments, completedIds]
  );

  const markDone = async (assignmentId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc("save_assignment_progress", {
      _assignment_id: assignmentId,
      _answers: [],
    });
    if (error) { toast.error(error.message); return; }
    toast.info("Open the assignment to submit completed work.");
  };

  const deleteReminder = async (id: string) => {
    const { error } = await supabase.from("personal_reminders").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const saveReminder = async (r: Partial<Reminder>) => {
    if (!user || !r.title || !r.start_at) return;
    if (r.id) {
      const { error } = await supabase.from("personal_reminders").update({
        title: r.title, note: r.note ?? null, start_at: r.start_at,
        duration_minutes: r.duration_minutes ?? 30, kind: r.kind ?? "reminder",
      }).eq("id", r.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("personal_reminders").insert({
        student_id: user.id, title: r.title, note: r.note ?? null, start_at: r.start_at,
        duration_minutes: r.duration_minutes ?? 30, kind: r.kind ?? "reminder",
      });
      if (error) { toast.error(error.message); return; }
    }
    setEditingReminder(null);
    toast.success("Saved");
  };

  // Header navigation
  const prev = () => setCursor(view === "month" ? subMonths(cursor, 1) : subWeeks(cursor, 1));
  const next = () => setCursor(view === "month" ? addMonths(cursor, 1) : addWeeks(cursor, 1));
  const goToday = () => setCursor(new Date());

  return (
    <DashboardShell title="Calendar" subtitle="Stay on top of every due date.">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week")}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" variant="outline" onClick={prev} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
        <Button size="sm" variant="outline" onClick={next} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm font-medium ml-1">
          {view === "month" ? format(cursor, "MMMM yyyy") : `Week of ${format(startOfWeek(cursor), "MMM d, yyyy")}`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}>
            <ListTodo className="h-4 w-4 mr-1" /> Plan My Week
          </Button>
          <Button size="sm" onClick={() => setEditingReminder({ start_at: new Date().toISOString(), kind: "reminder", duration_minutes: 30 })}>
            <Plus className="h-4 w-4 mr-1" /> Add Reminder
          </Button>
        </div>
      </div>

      {/* Legend */}
      {classes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {classes.map(c => {
            const col = classColor(c.id);
            return (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                style={{ borderColor: col.border, color: col.fg, background: col.bg }}>
                <span className="h-2 w-2 rounded-full" style={{ background: col.border }} />
                {c.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Overdue band */}
      {overdueItems.length > 0 && (
        <Card className="p-3 mb-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm font-semibold text-destructive mb-2">
            Overdue ({overdueItems.length})
          </p>
          <ul className="space-y-1.5">
            {overdueItems.map(a => {
              const col = classColor(a.class_id);
              return (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.border }} />
                  <Link to={`/student/assignments/${a.id}`} className="font-medium hover:underline text-destructive">
                    {a.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">· {a.class_name}</span>
                  <span className="text-xs text-destructive ml-auto">
                    Due {format(parseISO(a.due_date!), "MMM d")}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => markDone(a.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Calendar */}
      {view === "month"
        ? <MonthView cursor={cursor} dayItems={dayItems} onDayClick={setOpenDay} />
        : <WeekView cursor={cursor} dayItems={dayItems} onMarkDone={markDone}
            onDeleteReminder={deleteReminder} onEditReminder={(r) => setEditingReminder(r)} />}

      {/* Suggested study schedule */}
      {!suggestionsDismissed && (
        <StudySuggestions
          assignments={assignments} completedIds={completedIds}
          onAccept={async (blocks) => {
            if (!user) return;
            const rows = blocks.map(b => ({
              student_id: user.id, title: b.title, note: b.note,
              start_at: b.start_at, duration_minutes: b.duration_minutes, kind: "study_block",
            }));
            const { error } = await supabase.from("personal_reminders").insert(rows);
            if (error) toast.error(error.message);
            else { toast.success(`Added ${rows.length} study blocks`); }
          }}
          onDismiss={() => {
            const k = `study-suggestions-dismissed-${new Date().toDateString()}`;
            localStorage.setItem(k, "1");
            setSuggestionsDismissed(true);
          }}
        />
      )}

      {/* Day panel */}
      <Sheet open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {openDay && (
            <>
              <SheetHeader>
                <SheetTitle>{format(openDay, "EEEE, MMM d")}</SheetTitle>
                <SheetDescription>Everything scheduled for this day.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                {(dayItems.get(format(openDay, "yyyy-MM-dd")) ?? []).map((it) =>
                  it.kind === "assignment"
                    ? <AssignmentRow key={it.id} item={it} onMarkDone={markDone} />
                    : <ReminderRow key={it.id} reminder={it.reminder}
                        onEdit={() => setEditingReminder(it.reminder)}
                        onDelete={() => deleteReminder(it.reminder.id)} />
                )}
                {(dayItems.get(format(openDay, "yyyy-MM-dd")) ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
                )}
                <Button variant="outline" className="w-full" onClick={() => {
                  const d = new Date(openDay);
                  d.setHours(17, 0, 0, 0);
                  setEditingReminder({ start_at: d.toISOString(), kind: "reminder", duration_minutes: 30 });
                }}>
                  <Plus className="h-4 w-4 mr-1" /> Add reminder for this day
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Plan My Week sheet */}
      <Sheet open={planOpen} onOpenChange={setPlanOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><ListTodo className="h-5 w-5" /> Plan My Week</SheetTitle>
            <SheetDescription>The next 7 days, most urgent first.</SheetDescription>
          </SheetHeader>
          <PlanWeek assignments={assignments} reminders={reminders} completedIds={completedIds}
            onMarkDone={markDone} />
        </SheetContent>
      </Sheet>

      {/* Reminder dialog */}
      <ReminderDialog
        value={editingReminder}
        onClose={() => setEditingReminder(null)}
        onSave={saveReminder}
        onDelete={editingReminder?.id ? () => { deleteReminder(editingReminder.id!); setEditingReminder(null); } : undefined}
      />
    </DashboardShell>
  );
}

/* -------------- Month view -------------- */
function MonthView({ cursor, dayItems, onDayClick }: {
  cursor: Date;
  dayItems: Map<string, DayItem[]>;
  onDayClick: (d: Date) => void;
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
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const items = dayItems.get(format(d, "yyyy-MM-dd")) ?? [];
          return (
            <button key={d.toISOString()} onClick={() => onDayClick(d)}
              className={cn(
                "min-h-[80px] sm:min-h-[96px] rounded-md border p-1.5 text-left transition-colors hover:bg-accent",
                !inMonth && "opacity-40",
                isToday && "border-primary bg-primary/5"
              )}>
              <div className={cn("text-xs font-semibold mb-1", isToday && "text-primary")}>
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map(it => {
                  if (it.kind === "assignment") {
                    const col = classColor(it.assignment.class_id);
                    return (
                      <div key={it.id}
                        className={cn(
                          "text-[10px] truncate rounded px-1 py-0.5 border",
                          it.completed && "line-through opacity-60",
                        )}
                        style={it.overdue
                          ? { background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive) / 0.4)" }
                          : { background: col.bg, color: col.fg, borderColor: col.border }}>
                        {it.assignment.title}
                      </div>
                    );
                  }
                  return (
                    <div key={it.id} className="text-[10px] truncate rounded px-1 py-0.5 border border-dashed text-muted-foreground">
                      🔔 {it.reminder.title}
                    </div>
                  );
                })}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* -------------- Week view -------------- */
function WeekView({ cursor, dayItems, onMarkDone, onDeleteReminder, onEditReminder }: {
  cursor: Date;
  dayItems: Map<string, DayItem[]>;
  onMarkDone: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onEditReminder: (r: Reminder) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {days.map(d => {
        const items = dayItems.get(format(d, "yyyy-MM-dd")) ?? [];
        const isToday = isSameDay(d, today);
        return (
          <Card key={d.toISOString()} className={cn("p-2 min-h-[180px]", isToday && "border-primary")}>
            <div className={cn("text-xs font-semibold mb-2", isToday && "text-primary")}>
              {format(d, "EEE d")}
            </div>
            <div className="space-y-1.5">
              {items.length === 0 && <p className="text-[11px] text-muted-foreground">—</p>}
              {items.map(it => it.kind === "assignment"
                ? <AssignmentRow key={it.id} item={it} compact onMarkDone={onMarkDone} />
                : <ReminderRow key={it.id} compact reminder={it.reminder}
                    onEdit={() => onEditReminder(it.reminder)} onDelete={() => onDeleteReminder(it.reminder.id)} />)}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* -------------- Rows -------------- */
function AssignmentRow({ item, compact, onMarkDone }: {
  item: Extract<DayItem, { kind: "assignment" }>;
  compact?: boolean;
  onMarkDone: (id: string) => void;
}) {
  const col = classColor(item.assignment.class_id);
  return (
    <div className={cn("rounded-md border p-2", item.overdue && "border-destructive/40 bg-destructive/5")}
      style={!item.overdue ? { background: col.bg, borderColor: col.border } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-sm font-medium truncate", item.completed && "line-through opacity-60",
            item.overdue && "text-destructive")}
            style={!item.overdue ? { color: col.fg } : undefined}>
            {item.assignment.title}
          </p>
          <p className={cn("text-[11px] truncate", item.overdue && "text-destructive/80")}
            style={!item.overdue ? { color: col.fg, opacity: 0.85 } : undefined}>
            {item.assignment.class_name} · {format(item.date, "p")}
          </p>
        </div>
        {!compact && (
          <div className="flex gap-1 shrink-0">
            <Button asChild size="sm" variant="ghost" className="h-7 px-2">
              <Link to={`/student/assignments/${item.assignment.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
            </Button>
            {!item.completed && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onMarkDone(item.assignment.id)}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
      {compact && (
        <div className="flex gap-1 mt-1">
          <Button asChild size="sm" variant="ghost" className="h-6 px-1 text-[10px]">
            <Link to={`/student/assignments/${item.assignment.id}`}>Open</Link>
          </Button>
          {!item.completed && (
            <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => onMarkDone(item.assignment.id)}>
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderRow({ reminder, compact, onEdit, onDelete }: {
  reminder: Reminder; compact?: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed p-2 bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onEdit} className="min-w-0 text-left flex-1">
          <p className="text-sm font-medium truncate">🔔 {reminder.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {format(parseISO(reminder.start_at), "p")}
            {reminder.note ? ` · ${reminder.note}` : ""}
          </p>
        </button>
        {!compact && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------- Reminder Dialog -------------- */
function ReminderDialog({ value, onClose, onSave, onDelete }: {
  value: Partial<Reminder> | null;
  onClose: () => void;
  onSave: (r: Partial<Reminder>) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("reminder");

  useEffect(() => {
    if (!value) return;
    setTitle(value.title ?? "");
    setNote(value.note ?? "");
    setKind(value.kind ?? "reminder");
    const d = value.start_at ? parseISO(value.start_at) : new Date();
    setDate(format(d, "yyyy-MM-dd"));
    setTime(format(d, "HH:mm"));
  }, [value]);

  if (!value) return null;
  const submit = () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    const start = new Date(`${date}T${time}:00`);
    onSave({ ...value, title: title.trim(), note: note.trim() || null, start_at: start.toISOString(), kind });
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Study for math test" />
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
            <Label>Type</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="reminder">Reminder</option>
              <option value="study_block">Study block</option>
            </select>
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

/* -------------- Plan My Week -------------- */
function PlanWeek({ assignments, reminders, completedIds, onMarkDone }: {
  assignments: AssignmentLite[];
  reminders: Reminder[];
  completedIds: Set<string>;
  onMarkDone: (id: string) => void;
}) {
  const today = new Date(); today.setHours(0,0,0,0);
  const horizon = addDays(today, 7);
  const items = useMemo(() => {
    const arr: { date: Date; node: React.ReactNode; sort: number }[] = [];
    for (const a of assignments) {
      if (!a.due_date) continue;
      const d = parseISO(a.due_date);
      const completed = completedIds.has(a.id);
      const overdue = isOverdue(a.due_date, completed);
      if (completed) continue;
      if (!overdue && (d < today || d > horizon)) continue;
      const col = classColor(a.class_id);
      arr.push({
        date: d,
        sort: overdue ? -1 : d.getTime(),
        node: (
          <div className={cn("rounded-md border p-2", overdue && "border-destructive/40 bg-destructive/5")}
            style={!overdue ? { background: col.bg, borderColor: col.border } : undefined}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={!overdue ? { color: col.fg } : undefined}>{a.title}</p>
                <p className="text-[11px] truncate" style={!overdue ? { color: col.fg, opacity: 0.85 } : undefined}>
                  {a.class_name}
                </p>
              </div>
              <Badge variant={overdue ? "destructive" : "secondary"} className="shrink-0">
                {overdue ? "Overdue" : daysUntil(a.due_date) === 0 ? "Today" : `${daysUntil(a.due_date)}d`}
              </Badge>
            </div>
            <div className="flex gap-1 mt-1">
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <Link to={`/student/assignments/${a.id}`}>Open</Link>
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onMarkDone(a.id)}>Mark done</Button>
            </div>
          </div>
        ),
      });
    }
    return arr.sort((a, b) => a.sort - b.sort);
  }, [assignments, completedIds, onMarkDone]);

  // group by day
  const groups = new Map<string, typeof items>();
  items.forEach(it => {
    const k = format(it.date, "yyyy-MM-dd");
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  });

  if (items.length === 0) return <p className="text-sm text-muted-foreground mt-4">Nothing due in the next 7 days. 🎉</p>;
  return (
    <div className="mt-4 space-y-4">
      {Array.from(groups.entries()).map(([k, list]) => (
        <div key={k}>
          <p className="text-xs font-semibold text-muted-foreground mb-1">{format(parseISO(k), "EEE, MMM d")}</p>
          <div className="space-y-1.5">{list.map((x, i) => <div key={i}>{x.node}</div>)}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------- Study suggestions -------------- */
type SuggestedBlock = { title: string; note: string; start_at: string; duration_minutes: number };

function StudySuggestions({ assignments, completedIds, onAccept, onDismiss }: {
  assignments: AssignmentLite[];
  completedIds: Set<string>;
  onAccept: (blocks: SuggestedBlock[]) => Promise<void> | void;
  onDismiss: () => void;
}) {
  const blocks = useMemo<SuggestedBlock[]>(() => {
    const today = new Date();
    const horizon = addDays(today, 7);
    const usedSlots = new Map<string, Set<string>>(); // date -> classIds
    const out: SuggestedBlock[] = [];
    const upcoming = assignments
      .filter(a => a.due_date && !completedIds.has(a.id))
      .filter(a => { const d = parseISO(a.due_date!); return d > today && d <= horizon; })
      .sort((a, b) => +parseISO(a.due_date!) - +parseISO(b.due_date!));

    for (const a of upcoming) {
      const due = parseISO(a.due_date!);
      const minutes = estimateMinutes(a);
      // Pick day before due if possible, else today.
      let target = addDays(due, -1);
      if (target < today) target = today;
      // Avoid 2 of the same class on one day
      for (let i = 0; i < 5; i++) {
        const k = format(target, "yyyy-MM-dd");
        const used = usedSlots.get(k) ?? new Set<string>();
        if (!used.has(a.class_id)) break;
        target = addDays(target, -1);
        if (target < today) { target = addDays(today, i); }
      }
      const k = format(target, "yyyy-MM-dd");
      const used = usedSlots.get(k) ?? new Set<string>();
      used.add(a.class_id); usedSlots.set(k, used);
      // 5pm + 30-min offset per existing block that day
      const offset = (used.size - 1) * 60;
      const start = new Date(target); start.setHours(17, 0, 0, 0);
      start.setMinutes(start.getMinutes() + offset);
      out.push({
        title: `Study: ${a.title}`,
        note: `${a.class_name} · ~${minutes} min`,
        start_at: start.toISOString(),
        duration_minutes: Math.min(60, minutes),
      });
    }
    return out;
  }, [assignments, completedIds]);

  if (blocks.length === 0) return null;

  return (
    <Card className="p-4 mt-4 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Suggested study schedule</p>
          <p className="text-xs text-muted-foreground">
            Based on what's due this week, here's a plan you can add to your calendar.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {blocks.slice(0, 5).map((b, i) => (
              <li key={i} className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{format(parseISO(b.start_at), "EEE p")}</span>
                <span className="text-muted-foreground truncate">— {b.title}</span>
              </li>
            ))}
            {blocks.length > 5 && (
              <li className="text-xs text-muted-foreground">+{blocks.length - 5} more</li>
            )}
          </ul>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => onAccept(blocks)}>Add to calendar</Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
