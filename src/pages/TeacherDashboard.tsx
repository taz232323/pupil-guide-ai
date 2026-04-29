import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, ClipboardList, Inbox, ShieldCheck, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Greeting } from "@/components/Greeting";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeacherPrivilegeRequests } from "./TeacherPrivilegeRequests";

type ClassOverview = {
  id: string; name: string; subject: string;
  studentCount: number; rate: number;
};

type SubmissionRow = {
  id: string; assignment_id: string; student_id: string; submitted_at: string;
  studentName: string; assignmentTitle: string;
};

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0, weekAsgn: 0, pendingSubs: 0, pendingApprovals: 0,
  });
  const [recentSubs, setRecentSubs] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: cls } = await supabase
        .from("classes").select("id, name, subject").eq("teacher_id", user.id);
      const classList = (cls ?? []) as { id: string; name: string; subject: string }[];
      const ids = classList.map(c => c.id);

      if (ids.length === 0) {
        setClasses([]); setStats({ totalStudents: 0, weekAsgn: 0, pendingSubs: 0, pendingApprovals: 0 });
        setRecentSubs([]); setLoading(false); return;
      }

      const [{ data: members }, { data: asgn }, { data: subs }, { data: approvals }] = await Promise.all([
        supabase.from("class_members").select("class_id, student_id").in("class_id", ids),
        supabase.from("assignments").select("id, class_id, created_at").in("class_id", ids),
        supabase.from("submissions").select("id, assignment_id, student_id, submitted_at")
          .in("assignment_id", []).then(async () => {
            const aIds = ((await supabase.from("assignments").select("id").in("class_id", ids)).data ?? []).map((a: any) => a.id);
            return aIds.length
              ? supabase.from("submissions").select("id, assignment_id, student_id, submitted_at")
                  .in("assignment_id", aIds).order("submitted_at", { ascending: false }).limit(8)
              : { data: [] as any[] };
          }),
        supabase.from("shop_purchases").select("id").eq("status", "pending").in("class_id", ids),
      ]);

      const week = Date.now() - 7 * 86_400_000;
      const weekAsgn = (asgn ?? []).filter((a: any) => new Date(a.created_at).getTime() >= week).length;
      const totalStudents = new Set((members ?? []).map((m: any) => m.student_id)).size;

      // class overview rates
      const memByClass = new Map<string, number>();
      (members ?? []).forEach((m: any) => memByClass.set(m.class_id, (memByClass.get(m.class_id) ?? 0) + 1));
      const asgnByClass = new Map<string, string[]>();
      (asgn ?? []).forEach((a: any) => {
        const arr = asgnByClass.get(a.class_id) ?? [];
        arr.push(a.id); asgnByClass.set(a.class_id, arr);
      });
      const allAsgnIds = (asgn ?? []).map((a: any) => a.id);
      const { data: allSubs } = allAsgnIds.length
        ? await supabase.from("submissions").select("assignment_id, student_id").in("assignment_id", allAsgnIds)
        : { data: [] as any[] };

      const subSet = new Set((allSubs ?? []).map((s: any) => `${s.assignment_id}|${s.student_id}`));
      const overview: ClassOverview[] = classList.map(c => {
        const studentCount = memByClass.get(c.id) ?? 0;
        const aIds = asgnByClass.get(c.id) ?? [];
        const expected = studentCount * aIds.length;
        let done = 0;
        const studentIds = (members ?? []).filter((m: any) => m.class_id === c.id).map((m: any) => m.student_id);
        aIds.forEach(aid => studentIds.forEach((sid: string) => { if (subSet.has(`${aid}|${sid}`)) done++; }));
        return { ...c, studentCount, rate: expected > 0 ? done / expected : 0 };
      });

      // pending = expected - done across all
      const totalExpected = overview.reduce((sum, c) => sum + c.studentCount * (asgnByClass.get(c.id)?.length ?? 0), 0);
      const totalDone = overview.reduce((sum, c) => sum + Math.round(c.rate * c.studentCount * (asgnByClass.get(c.id)?.length ?? 0)), 0);

      // resolve names for recent subs
      const recent = (subs as any).data ?? subs ?? [];
      const sIds = Array.from(new Set(recent.map((s: any) => s.student_id))) as string[];
      const aIdsRecent = Array.from(new Set(recent.map((s: any) => s.assignment_id))) as string[];
      const [{ data: profs }, { data: titles }] = await Promise.all([
        sIds.length ? supabase.from("profiles").select("id, full_name").in("id", sIds) : Promise.resolve({ data: [] as any[] }),
        aIdsRecent.length ? supabase.from("assignments").select("id, title").in("id", aIdsRecent) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || "Student"]));
      const tmap = new Map((titles ?? []).map((t: any) => [t.id, t.title]));
      const recentRows: SubmissionRow[] = recent.map((s: any) => ({
        id: s.id, assignment_id: s.assignment_id, student_id: s.student_id, submitted_at: s.submitted_at,
        studentName: pmap.get(s.student_id) || "Student",
        assignmentTitle: tmap.get(s.assignment_id) || "Assignment",
      }));

      setClasses(overview);
      setStats({
        totalStudents, weekAsgn,
        pendingSubs: Math.max(totalExpected - totalDone, 0),
        pendingApprovals: (approvals ?? []).length,
      });
      setRecentSubs(recentRows);
      setLoading(false);
    })();
  }, [user]);

  const relTime = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Greeting subtitle="A snapshot of your classes today." />

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total students" value={stats.totalStudents} icon={Users} tone="indigo" loading={loading} />
          <StatCard label="Assignments this week" value={stats.weekAsgn} icon={ClipboardList} tone="teal" loading={loading} />
          <StatCard label="Pending submissions" value={stats.pendingSubs} icon={Inbox} tone="amber" loading={loading} />
          <StatCard label="Shop approvals" value={stats.pendingApprovals} icon={ShieldCheck} tone="emerald" loading={loading} />
        </div>

        {!loading && classes.length === 0 ? (
          <Card className="overflow-hidden border-0 shadow-elevated">
            <div className="bg-gradient-soft p-8 text-center">
              <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
                <Plus className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold">Create your first class</h2>
              <p className="mt-1 text-sm text-muted-foreground">Set up a class to invite students and post assignments.</p>
              <Button asChild className="mt-4">
                <Link to="/teacher/classes">Create class</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Class overview</h2>
                <Button variant="ghost" size="sm" asChild><Link to="/teacher/classes">Manage</Link></Button>
              </div>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[0,1,2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map(c => (
                    <Card key={c.id} className="hover-lift">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.subject}</p>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />{c.studentCount}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Avg completion</span>
                            <span className="font-semibold tabular-nums">{Math.round(c.rate * 100)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-hero transition-all"
                              style={{ width: `${Math.min(100, Math.round(c.rate * 100))}%` }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Submissions inbox</h2>
                {loading ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : recentSubs.length === 0 ? (
                  <EmptyState icon={Inbox} title="No submissions yet"
                    description="Once students turn in work, it will appear here." />
                ) : (
                  <Card>
                    <CardContent className="p-2">
                      <ul className="divide-y divide-border">
                        {recentSubs.map(s => (
                          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{s.studentName}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.assignmentTitle}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">{relTime(s.submitted_at)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Pending approvals</h2>
                <TeacherPrivilegeRequests />
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
