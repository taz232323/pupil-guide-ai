import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Star, Crown, KeyRound, Sparkles, Flame, Zap, ArrowRight, ClipboardList,
  MessageSquare, ShoppingBag, Award, BookOpen, FileText, MessageCircle, Bell, Layers,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useOverduePenaltyToast } from "@/hooks/useOverduePenaltyToast";
import { DashboardShell } from "@/components/DashboardShell";
import { AssignmentStatus } from "@/components/AssignmentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { JoinClassCard } from "@/components/JoinClassCard";
import { LeaderboardWidget } from "@/components/LeaderboardWidget";

type Row = {
  id: string;
  class_id: string;
  title: string;
  unit_tag: string | null;
  due_date: string | null;
  status: AssignmentStatus;
};

type NotifRow = { id: string; type: string; message: string; link: string | null; created_at: string };

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  return x;
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/** Login streak via localStorage. Returns current consecutive day count. */
function useStreak(userId?: string) {
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const key = `streak:${userId}`;
    const today = startOfDay().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) as { last: string; count: number } : null;
      if (!data) {
        localStorage.setItem(key, JSON.stringify({ last: today, count: 1 }));
        setStreak(1); return;
      }
      if (data.last === today) { setStreak(data.count); return; }
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yKey = startOfDay(yesterday).toISOString().slice(0, 10);
      const next = data.last === yKey ? data.count + 1 : 1;
      localStorage.setItem(key, JSON.stringify({ last: today, count: next }));
      setStreak(next);
    } catch {
      setStreak(1);
    }
  }, [userId]);
  return streak;
}

/** XP derived from coins. Each star = 10 XP, each crown = 100 XP. Level curve quadratic. */
function levelFromXp(xp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
  const curBase = ((level - 1) ** 2) * 50;
  const nextBase = (level ** 2) * 50;
  const into = xp - curBase;
  const span = nextBase - curBase;
  return { level, into, span, pct: Math.min(100, Math.round((into / span) * 100)) };
}

function notifIcon(type: string) {
  if (type.includes("submission") || type.includes("assignment")) return FileText;
  if (type.includes("grade")) return Award;
  if (type.includes("message")) return MessageCircle;
  if (type.includes("module")) return Layers;
  return Bell;
}

/** Circular progress ring using SVG */
const Ring = ({ value, size = 64, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-secondary" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          className="stroke-primary transition-all duration-700"
          fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums">{label ?? `${value}%`}</span>
    </div>
  );
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useOverduePenaltyToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState({ star: 0, crown: 0 });
  const [hasClasses, setHasClasses] = useState(true);
  const [name, setName] = useState("");
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const streak = useStreak(user?.id);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: asgn }, { data: c }, { data: members }, { data: prof }, { data: notifData }, { count: msgCount }] = await Promise.all([
      supabase.from("assignments").select("id, class_id, title, unit_tag, due_date")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("student_coins").select("star_coins, crown_coins").eq("student_id", user.id).maybeSingle(),
      supabase.from("class_members").select("class_id").eq("student_id", user.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("notifications").select("id, type, message, link, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id).is("read_at", null),
    ]);

    setHasClasses((members ?? []).length > 0);
    if (c) setCoins({ star: c.star_coins, crown: c.crown_coins });
    setName((prof?.full_name as string) || (user.email?.split("@")[0] ?? ""));
    setNotifs((notifData as NotifRow[]) ?? []);
    setUnreadMsgs(msgCount ?? 0);

    const aIds = (asgn ?? []).map((a: any) => a.id);
    const cIds = Array.from(new Set((asgn ?? []).map((a: any) => a.class_id)));
    const [{ data: statuses }, { data: cls }] = await Promise.all([
      aIds.length
        ? supabase.from("assignment_status_records").select("assignment_id, status")
            .eq("student_id", user.id).in("assignment_id", aIds)
        : Promise.resolve({ data: [] as any[] }),
      cIds.length ? supabase.from("classes").select("id, name").in("id", cIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const sm = new Map<string, AssignmentStatus>();
    (statuses ?? []).forEach((s: any) => sm.set(s.assignment_id, s.status));
    const cm: Record<string, string> = {};
    (cls ?? []).forEach((c: any) => { cm[c.id] = c.name; });
    setClasses(cm);
    setRows((asgn ?? []).map((a: any) => ({ ...a, status: sm.get(a.id) ?? "not_started" })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const todayEnd = endOfDay().getTime();
  const tomorrowEnd = endOfDay(new Date(Date.now() + 86_400_000)).getTime();
  const todayStart = startOfDay().getTime();

  const dueTodayCount = rows.filter(r =>
    r.status !== "submitted" && r.due_date &&
    new Date(r.due_date).getTime() >= todayStart &&
    new Date(r.due_date).getTime() <= todayEnd
  ).length;

  const focusItems = rows
    .filter(r => r.status !== "submitted" && r.due_date && new Date(r.due_date).getTime() <= tomorrowEnd)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  // Weekly progress per class
  const weekStart = startOfWeek().getTime();
  const weekEnd = weekStart + 7 * 86_400_000;
  const weeklyByClass = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    rows.forEach(r => {
      if (!r.due_date) return;
      const t = new Date(r.due_date).getTime();
      if (t < weekStart || t > weekEnd) return;
      const cur = map.get(r.class_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (r.status === "submitted") cur.done += 1;
      map.set(r.class_id, cur);
    });
    return Array.from(map.entries()).map(([id, v]) => ({
      id, name: classes[id] ?? "Class",
      ...v,
      pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));
  }, [rows, classes, weekStart, weekEnd]);

  const xp = coins.star * 10 + coins.crown * 100;
  const lvl = levelFromXp(xp);

  const heroTagline = loading
    ? "Loading your day…"
    : dueTodayCount > 0
      ? `You have ${dueTodayCount} assignment${dueTodayCount === 1 ? "" : "s"} due today — let's get them done.`
      : "You're all caught up — great work. ✨";

  const QUICK_LINKS = [
    { to: "/student/assignments", label: "Assignments", icon: ClipboardList, tone: "bg-primary-soft text-primary" },
    { to: "/messages", label: "Messages", icon: MessageSquare, tone: "bg-teal-soft text-teal", badge: unreadMsgs },
    { to: "/shop", label: "Shop", icon: ShoppingBag, tone: "bg-warning-soft text-warning" },
    { to: "/student/grades", label: "Grades", icon: Award, tone: "bg-success-soft text-success" },
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Hero greeting */}
        <div className="rounded-3xl bg-gradient-hero p-6 sm:p-8 text-white shadow-elevated animate-fade-in relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-20 bottom-0 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium opacity-80">{timeGreeting()}</p>
              <h1 className="mt-1 text-2xl sm:text-4xl font-bold tracking-tight truncate">
                {name || "Welcome back"} 👋
              </h1>
              <p className="mt-2 text-sm sm:text-base opacity-95 max-w-xl">{heroTagline}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
                <Flame className="h-5 w-5 text-warning" />
                <div className="leading-tight">
                  <p className="text-lg font-bold tabular-nums">{streak}</p>
                  <p className="text-[10px] uppercase tracking-wide opacity-80">Day streak</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
                <Star className="h-5 w-5 text-warning fill-warning" />
                <p className="text-lg font-bold tabular-nums">{coins.star}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
                <Crown className="h-5 w-5" />
                <p className="text-lg font-bold tabular-nums">{coins.crown}</p>
              </div>
            </div>
          </div>
        </div>

        {!loading && !hasClasses ? (
          <JoinClassCard variant="hero" onJoined={load} />
        ) : (
          <>
            <JoinClassCard variant="compact" onJoined={load} />
            {/* Today's Focus — most prominent */}
            <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary-soft via-card to-card p-5 sm:p-6 shadow-elevated">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">Today's Focus</h2>
                    <p className="text-xs text-muted-foreground">Due today or tomorrow, sorted by urgency.</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/student/assignments">All <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
              {loading ? (
                <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              ) : focusItems.length === 0 ? (
                <div className="rounded-2xl bg-card/60 px-6 py-10 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-success" />
                  <p className="mt-2 font-semibold">Nothing urgent</p>
                  <p className="text-sm text-muted-foreground">No assignments due today or tomorrow.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {focusItems.map(r => {
                    const due = new Date(r.due_date!);
                    const isToday = due.getTime() <= todayEnd;
                    return (
                      <li key={r.id}
                        className="group flex items-center gap-3 rounded-xl bg-card border border-border p-3 sm:p-4 hover-lift cursor-pointer"
                        onClick={() => navigate(`/student/assignments/${r.id}`)}>
                        <span className={cn(
                          "shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl",
                          isToday ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning"
                        )}>
                          <ClipboardList className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {classes[r.class_id] ?? "Class"} · {isToday ? "Due today" : "Due tomorrow"} · {due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/student/assignments/${r.id}`); }}>
                          Start <ArrowRight className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Quick Links */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_LINKS.map(q => (
                <Link key={q.to} to={q.to}
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card transition-base hover-lift">
                  <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl", q.tone)}>
                    <q.icon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold">{q.label}</p>
                  {!!q.badge && q.badge > 0 && (
                    <span className="absolute top-2 right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {q.badge}
                    </span>
                  )}
                </Link>
              ))}
            </section>

            {/* Level + Coins compact row */}
            <section className="grid gap-3 sm:grid-cols-3">
              <Card className="sm:col-span-2 border-0 shadow-card">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <Zap className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Level</p>
                        <p className="text-lg font-bold leading-none">Lv {lvl.level}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">{lvl.into} / {lvl.span} XP</p>
                  </div>
                  <Progress value={lvl.pct} className="h-3" />
                </CardContent>
              </Card>
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 sm:p-5 flex items-center justify-around">
                  <div className="flex flex-col items-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft text-warning">
                      <Star className="h-5 w-5 fill-warning" />
                    </span>
                    <p className="mt-1 text-xl font-bold tabular-nums">{coins.star}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Stars</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Crown className="h-5 w-5" />
                    </span>
                    <p className="mt-1 text-xl font-bold tabular-nums">{coins.crown}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Crowns</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Weekly progress + What's New */}
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">This week's progress</h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/student/classes">My classes <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                  </div>
                ) : weeklyByClass.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No assignments due this week.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {weeklyByClass.map(w => (
                      <Card key={w.id} className="border-0 shadow-card hover-lift cursor-pointer"
                        onClick={() => navigate(`/student/classes/${w.id}`)}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <Ring value={w.pct} label={`${w.done}/${w.total}`} />
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{w.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {w.done === w.total ? "Week complete 🎉" : `${w.total - w.done} to go this week`}
                            </p>
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                              <BookOpen className="h-3 w-3" /> {w.pct}% done
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <LeaderboardWidget />

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">What's new</h2>
                {loading ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : notifs.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No recent activity yet.
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="space-y-2">
                    {notifs.map(n => {
                      const Icon = notifIcon(n.type);
                      const target = n.link || "/student";
                      return (
                        <li key={n.id}>
                          <Link to={target}
                            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover-lift">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug line-clamp-2">{n.message}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{relTime(n.created_at)}</p>
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
