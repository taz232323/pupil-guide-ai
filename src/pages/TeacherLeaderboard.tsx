import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Trophy, Star, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ClassRow = { id: string; name: string; subject: string };
type ProfileRow = { id: string; full_name: string | null; avatar_items: string[] };
type Entry = { studentId: string; display: string; items: string[]; coins: number };

export default function TeacherLeaderboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [starByStudent, setStarByStudent] = useState<Map<string, number>>(new Map());
  const [crownByStudent, setCrownByStudent] = useState<Map<string, number>>(new Map());
  const [membersByClass, setMembersByClass] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");
  const [currency, setCurrency] = useState<"star" | "crown">("star");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, subject")
      .eq("teacher_id", user.id);
    const classList = (cls ?? []) as ClassRow[];
    setClasses(classList);

    const classIds = classList.map(c => c.id);
    if (classIds.length === 0) { setLoading(false); return; }

    const { data: cm } = await supabase
      .from("class_members").select("class_id, student_id").in("class_id", classIds);
    const byClass = new Map<string, string[]>();
    const allStudentIds = new Set<string>();
    (cm ?? []).forEach((r: any) => {
      const arr = byClass.get(r.class_id) ?? [];
      arr.push(r.student_id);
      byClass.set(r.class_id, arr);
      allStudentIds.add(r.student_id);
    });
    setMembersByClass(byClass);

    const ids = Array.from(allStudentIds);
    if (ids.length) {
      const [{ data: profs }, { data: coins }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_items").in("id", ids),
        supabase.from("student_coins").select("student_id, star_coins, crown_coins").in("student_id", ids),
      ]);
      const pmap = new Map<string, ProfileRow>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, {
        id: p.id, full_name: p.full_name,
        avatar_items: (p.avatar_items ?? []) as string[],
      }));
      setProfiles(pmap);
      const smap = new Map<string, number>();
      const cmap = new Map<string, number>();
      (coins ?? []).forEach((c: any) => {
        smap.set(c.student_id, c.star_coins ?? 0);
        cmap.set(c.student_id, c.crown_coins ?? 0);
      });
      setStarByStudent(smap);
      setCrownByStudent(cmap);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("teacher-leaderboard-coins")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_coins" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const buildEntries = (studentIds: string[]): Entry[] => {
    const seen = new Set<string>();
    const list: Entry[] = [];
    const source = currency === "star" ? starByStudent : crownByStudent;
    for (const sid of studentIds) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      const p = profiles.get(sid);
      list.push({
        studentId: sid,
        display: p?.full_name || "Student",
        items: p?.avatar_items ?? [],
        coins: source.get(sid) ?? 0,
      });
    }
    return list.sort((a, b) => b.coins - a.coins || a.display.localeCompare(b.display));
  };

  const allEntries = useMemo(() => {
    const allIds = new Set<string>();
    classes.forEach(c => (membersByClass.get(c.id) ?? []).forEach(s => allIds.add(s)));
    return buildEntries(Array.from(allIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, membersByClass, profiles, starByStudent, crownByStudent, currency]);

  const CoinIcon = currency === "star" ? Star : Crown;
  const coinColor = currency === "star" ? "fill-amber-400 text-amber-500" : "fill-primary text-primary";

  const renderRow = (e: Entry, idx: number) => {
    const rank = idx + 1;
    const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Trophy : null;
    return (
      <li
        key={e.studentId}
        className="flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-muted/40 px-3 py-2.5 transition-colors"
      >
        <div className={cn(
          "w-8 text-center font-bold tabular-nums",
          rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-orange-500" : "text-muted-foreground"
        )}>
          {RankIcon ? <RankIcon className="h-5 w-5 mx-auto" /> : `#${rank}`}
        </div>
        <StudentAvatar size="sm" name={e.display} items={e.items} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{e.display}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <CoinIcon className={cn("h-4 w-4", coinColor)} />
          {e.coins}
        </div>
      </li>
    );
  };

  return (
    <DashboardShell title="Leaderboard" subtitle="See how your students rank by coins earned.">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Rank by:</span>
        <Button
          size="sm"
          variant={currency === "star" ? "default" : "outline"}
          onClick={() => setCurrency("star")}
        >
          <Star className="h-3.5 w-3.5 mr-1.5 fill-current" /> Star Coins
        </Button>
        <Button
          size="sm"
          variant={currency === "crown" ? "default" : "outline"}
          onClick={() => setCurrency("crown")}
        >
          <Crown className="h-3.5 w-3.5 mr-1.5 fill-current" /> Crown Coins
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : classes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          You don't have any classes yet. <Link to="/teacher/classes" className="text-primary underline">Create a class</Link>
        </CardContent></Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all"><Trophy className="h-4 w-4 mr-1.5" />All My Classes</TabsTrigger>
            {classes.map(c => (
              <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Ranking</CardTitle>
                <CardDescription>
                  Combined {currency === "star" ? "Star" : "Crown"} Coin totals across every class you teach.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students yet.</p>
                ) : (
                  <ul className="space-y-2">{allEntries.map(renderRow)}</ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {classes.map(c => {
            const entries = buildEntries(membersByClass.get(c.id) ?? []);
            return (
              <TabsContent key={c.id} value={c.id} className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription>{c.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No students in this class yet.</p>
                    ) : (
                      <ul className="space-y-2">{entries.map(renderRow)}</ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </DashboardShell>
  );
}