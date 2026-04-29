import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Star, Crown, KeyRound, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Greeting } from "@/components/Greeting";
import { StatCard } from "@/components/StatCard";
import { AssignmentCard, AssignmentStatus } from "@/components/AssignmentCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  id: string;
  class_id: string;
  title: string;
  unit_tag: string | null;
  due_date: string | null;
  status: AssignmentStatus;
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState({ star: 0, crown: 0 });
  const [completedMonth, setCompletedMonth] = useState(0);
  const [hasClasses, setHasClasses] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: asgn }, { data: c }, { data: members }, { data: subs }] = await Promise.all([
      supabase.from("assignments").select("id, class_id, title, unit_tag, due_date")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("student_coins").select("star_coins, crown_coins").eq("student_id", user.id).maybeSingle(),
      supabase.from("class_members").select("class_id").eq("student_id", user.id),
      supabase.from("submissions").select("submitted_at").eq("student_id", user.id),
    ]);

    setHasClasses((members ?? []).length > 0);
    if (c) setCoins({ star: c.star_coins, crown: c.crown_coins });

    const since = new Date(); since.setMonth(since.getMonth() - 1);
    setCompletedMonth((subs ?? []).filter((s: any) => new Date(s.submitted_at) >= since).length);

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

  const join = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    const { error } = await supabase.rpc("join_class_by_code", { _code: joinCode.trim() });
    setJoining(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Joined class");
    setJoinCode("");
    load();
  };

  const weekEnd = Date.now() + 7 * 86_400_000;
  const dueThisWeek = rows.filter(r =>
    r.status !== "submitted" && r.due_date && new Date(r.due_date).getTime() <= weekEnd
  ).length;
  const upcoming = rows.filter(r => r.status !== "submitted").slice(0, 6);
  const needsPractice = rows.filter(r =>
    r.status !== "submitted" && r.due_date && new Date(r.due_date).getTime() < Date.now()
  ).slice(0, 4);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Greeting subtitle="Here's what's on your plate today." />

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Due this week" value={dueThisWeek} icon={CalendarDays} tone="indigo" loading={loading} />
          <StatCard label="Completed this month" value={completedMonth} icon={CheckCircle2} tone="emerald" loading={loading} />
          <StatCard label="Star coins" value={coins.star} icon={Star} tone="amber" loading={loading} />
          <StatCard label="Crown coins" value={coins.crown} icon={Crown} tone="indigo" loading={loading} />
        </div>

        {!loading && !hasClasses ? (
          <Card className="overflow-hidden border-0 shadow-elevated">
            <div className="bg-gradient-soft p-8 text-center">
              <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
                <KeyRound className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold">Join your first class</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ask your teacher for a 6-character join code.</p>
              <div className="mt-4 mx-auto flex max-w-sm gap-2">
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123" className="text-center font-mono tracking-widest" maxLength={6} />
                <Button onClick={join} disabled={joining || joinCode.length < 4}>
                  {joining ? "Joining..." : "Join"}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Upcoming assignments</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/student/assignments">View all</Link>
                </Button>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ) : upcoming.length === 0 ? (
                <EmptyState icon={Sparkles} title="You're all caught up!"
                  description="No assignments are waiting. Check back soon." />
              ) : (
                <div className="space-y-3">
                  {upcoming.map(r => (
                    <AssignmentCard key={r.id} title={r.title} classLabel={classes[r.class_id]}
                      unitTag={r.unit_tag} dueDate={r.due_date} status={r.status} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Needs practice</h2>
              {loading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : needsPractice.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    Nothing overdue — great work.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {needsPractice.map(r => (
                    <Card key={r.id} className="border-warning/40 bg-warning-soft/40">
                      <CardContent className="p-3">
                        <p className="text-sm font-semibold truncate">{r.title}</p>
                        <p className="text-xs text-warning">{classes[r.class_id]} · {r.unit_tag ?? "—"}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
