import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Trophy, Star, Crown, Medal, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { StreakFlame } from "@/components/StreakFlame";
import { useStreakFlames } from "@/hooks/useStreakFlames";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type ClassRow = { id: string; name: string; subject: string; leaderboard_anonymous: boolean };
type ProfileRow = { id: string; full_name: string | null; leaderboard_username: string | null; avatar_items: string[] };
type Entry = { studentId: string; display: string; items: string[]; coins: number; streak: number };

function displayFor(p: ProfileRow | undefined, anonymous: boolean, isMe: boolean) {
  if (!p) return "Student";
  if (anonymous) return p.leaderboard_username || (isMe ? "(set a username)" : "Anonymous");
  return p.full_name || p.leaderboard_username || "Student";
}

export default function StudentLeaderboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [coinsByStudent, setCoinsByStudent] = useState<Map<string, number>>(new Map());
  const [membersByClass, setMembersByClass] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");
  const [promptOpen, setPromptOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [sortBy, setSortBy] = useState<"coins" | "streak">("coins");

  const allMemberIds = useMemo(() => {
    const s = new Set<string>();
    membersByClass.forEach(arr => arr.forEach(id => s.add(id)));
    return Array.from(s);
  }, [membersByClass]);
  const streaks = useStreakFlames(allMemberIds);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name, subject, leaderboard_anonymous");
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
        supabase.from("profiles").select("id, full_name, leaderboard_username, avatar_items").in("id", ids),
        supabase.from("student_coins").select("student_id, star_coins").in("student_id", ids),
      ]);
      const pmap = new Map<string, ProfileRow>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, {
        id: p.id, full_name: p.full_name, leaderboard_username: p.leaderboard_username,
        avatar_items: (p.avatar_items ?? []) as string[],
      }));
      setProfiles(pmap);
      const cmap = new Map<string, number>();
      (coins ?? []).forEach((c: any) => cmap.set(c.student_id, c.star_coins ?? 0));
      setCoinsByStudent(cmap);

      // Prompt to set leaderboard username if missing
      const me = pmap.get(user.id);
      if (me && !me.leaderboard_username) {
        setUsernameDraft("");
        setPromptOpen(true);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on any student_coins change
  useEffect(() => {
    const ch = supabase.channel("leaderboard-coins")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_coins" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const buildEntries = (studentIds: string[], anonymous: boolean): Entry[] => {
    const seen = new Set<string>();
    const list: Entry[] = [];
    for (const sid of studentIds) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      const p = profiles.get(sid);
      list.push({
        studentId: sid,
        display: displayFor(p, anonymous, sid === user?.id),
        items: p?.avatar_items ?? [],
        coins: coinsByStudent.get(sid) ?? 0,
        streak: streaks.get(sid) ?? 0,
      });
    }
    return list.sort((a, b) => {
      if (sortBy === "streak") return b.streak - a.streak || b.coins - a.coins || a.display.localeCompare(b.display);
      return b.coins - a.coins || b.streak - a.streak || a.display.localeCompare(b.display);
    });
  };

  const allClassesEntries = useMemo(() => {
    // Combine across all enrolled classes; coin total is the student's total balance (counted once)
    const allIds = new Set<string>();
    classes.forEach(c => (membersByClass.get(c.id) ?? []).forEach(s => allIds.add(s)));
    // anyClassAnonymous: if ANY enrolled class is anonymous, anonymize across the All tab
    const anyAnonymous = classes.some(c => c.leaderboard_anonymous);
    return buildEntries(Array.from(allIds), anyAnonymous);
  }, [classes, membersByClass, profiles, coinsByStudent, user, streaks, sortBy]);

  const renderRow = (e: Entry, idx: number) => {
    const isMe = e.studentId === user?.id;
    const rank = idx + 1;
    const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Trophy : null;
    return (
      <li
        key={e.studentId}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
          isMe ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card hover:bg-muted/40"
        )}
      >
        <div className={cn(
          "w-8 text-center font-bold tabular-nums",
          rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-orange-500" : "text-muted-foreground"
        )}>
          {RankIcon ? <RankIcon className="h-5 w-5 mx-auto" /> : `#${rank}`}
        </div>
        <StudentAvatar size="sm" name={e.display} items={e.items} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {e.display}{isMe && <span className="ml-2 text-xs text-primary">(You)</span>}
          </p>
        </div>
        {e.streak > 0 && <StreakFlame streak={e.streak} size="sm" />}
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
          {e.coins}
        </div>
      </li>
    );
  };

  const saveUsername = async () => {
    if (!user) return;
    const v = usernameDraft.trim();
    if (v.length < 2) { toast.error("Pick at least 2 characters"); return; }
    setSavingUsername(true);
    const { error } = await supabase.from("profiles")
      .update({ leaderboard_username: v }).eq("id", user.id);
    setSavingUsername(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Leaderboard username saved");
    setPromptOpen(false);
    load();
  };

  return (
    <DashboardShell title="Leaderboard" subtitle="See who's earning the most Star Coins.">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Sort by:</span>
        <Button size="sm" variant={sortBy === "coins" ? "default" : "outline"} onClick={() => setSortBy("coins")}>
          <Star className="h-3.5 w-3.5 mr-1.5 fill-current" /> Coins
        </Button>
        <Button size="sm" variant={sortBy === "streak" ? "default" : "outline"} onClick={() => setSortBy("streak")}>
          <Flame className="h-3.5 w-3.5 mr-1.5" /> Top Streaks
        </Button>
      </div>
      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : classes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Join a class to see leaderboards. <Link to="/student/classes" className="text-primary underline">Go to classes</Link>
        </CardContent></Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all"><Trophy className="h-4 w-4 mr-1.5" />All Classes</TabsTrigger>
            {classes.map(c => (
              <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Ranking</CardTitle>
                <CardDescription>Combined Star Coin totals across every class you're in.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {allClassesEntries.map(renderRow)}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {classes.map(c => {
            const entries = buildEntries(membersByClass.get(c.id) ?? [], c.leaderboard_anonymous);
            return (
              <TabsContent key={c.id} value={c.id} className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {c.name}
                      {c.leaderboard_anonymous && (
                        <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 font-normal text-muted-foreground">
                          Anonymous mode
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{c.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No students yet.</p>
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

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick a leaderboard username</DialogTitle>
            <DialogDescription>
              This is the name shown when a teacher turns on anonymous mode for a class. You can change it later in your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lb-username">Username</Label>
            <Input id="lb-username" value={usernameDraft} maxLength={30}
              onChange={(e) => setUsernameDraft(e.target.value)} placeholder="e.g. NightOwl42" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromptOpen(false)}>Skip for now</Button>
            <Button onClick={saveUsername} disabled={savingUsername}>
              {savingUsername ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
