import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Trophy, Star, ArrowRight, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { StreakFlame } from "@/components/StreakFlame";
import { useStreakFlames } from "@/hooks/useStreakFlames";
import { STUDENT_COINS_CHANGED_EVENT } from "@/lib/studentRefreshEvents";
import { CountUp } from "@/components/CountUp";

type Entry = { id: string; display: string; items: string[]; coins: number };

export function LeaderboardWidget() {
  const { user } = useAuth();
  const [top, setTop] = useState<Entry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myCoins, setMyCoins] = useState(0);
  const streaks = useStreakFlames(top.map(t => t.id));

  const load = async () => {
    if (!user) return;
    const { data: cm } = await supabase.from("class_members").select("class_id");
    const classIds = (cm ?? []).map((r: any) => r.class_id);
    if (classIds.length === 0) { setTop([]); setMyRank(null); return; }
    const { data: peers } = await supabase
      .from("class_members").select("student_id").in("class_id", classIds);
    const ids = Array.from(new Set((peers ?? []).map((r: any) => r.student_id)));
    if (ids.length === 0) return;
    const [{ data: profs }, { data: coins }, { data: anonClasses }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, leaderboard_username, avatar_items").in("id", ids),
      supabase.from("student_coins").select("student_id, star_coins").in("student_id", ids),
      supabase.from("classes").select("id, leaderboard_anonymous").in("id", classIds),
    ]);
    const anyAnon = (anonClasses ?? []).some((c: any) => c.leaderboard_anonymous);
    const pmap = new Map<string, any>();
    (profs ?? []).forEach((p: any) => pmap.set(p.id, p));
    const cmap = new Map<string, number>();
    (coins ?? []).forEach((c: any) => cmap.set(c.student_id, c.star_coins ?? 0));
    const entries: Entry[] = ids.map((sid) => {
      const p = pmap.get(sid);
      const display = anyAnon
        ? (p?.leaderboard_username || (sid === user.id ? "(set a username)" : "Anonymous"))
        : (p?.full_name || p?.leaderboard_username || "Student");
      return { id: sid, display, items: (p?.avatar_items ?? []) as string[], coins: cmap.get(sid) ?? 0 };
    }).sort((a, b) => b.coins - a.coins);

    setTop(entries.slice(0, 3));
    const idx = entries.findIndex(e => e.id === user.id);
    setMyRank(idx >= 0 ? idx + 1 : null);
    setMyCoins(cmap.get(user.id) ?? 0);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const onCoinsChanged = () => load();
    window.addEventListener(STUDENT_COINS_CHANGED_EVENT, onCoinsChanged);
    const ch = supabase.channel("dash-lb-coins")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_coins" }, () => load())
      .subscribe();
    return () => {
      window.removeEventListener(STUDENT_COINS_CHANGED_EVENT, onCoinsChanged);
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (!user || top.length === 0) return null;

  return (
    <Card className="border-0 shadow-card hover-lift transition-spring animate-fade-up">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" /> Leaderboard
        </CardTitle>
        <Link to="/student/leaderboard" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {top.map((e, i) => {
          const Icon = i === 0 ? Crown : i === 1 ? Medal : Trophy;
          const isMe = e.id === user.id;
          const rankClass = i === 0 ? "rank-gold" : i === 1 ? "rank-silver" : "rank-bronze";
          return (
            <div key={e.id} className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2 transition-spring hover-lift animate-fade-up",
              rankClass,
              isMe ? "rank-me border-primary bg-primary/10" : "border-primary/15",
            )}
            style={{ animationDelay: `${i * 60}ms` }}>
              <Icon className={cn("h-4 w-4 shrink-0",
                i === 0 ? "text-gold" : i === 1 ? "text-muted-foreground" : "text-warning")} />
              <StudentAvatar size="sm" name={e.display} items={e.items} />
              <span className="flex-1 text-sm font-medium truncate">
                {e.display}{isMe && <span className="ml-1.5 text-xs text-primary">(You)</span>}
              </span>
              {(streaks.get(e.id) ?? 0) > 0 && (
                <StreakFlame streak={streaks.get(e.id)!} size="sm" />
              )}
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="h-3.5 w-3.5 fill-gold text-gold" /><CountUp value={e.coins} className="font-tabular" />
              </span>
            </div>
          );
        })}
        {myRank !== null && myRank > 3 && (
          <div className="mt-1 rank-me rounded-lg border border-primary bg-primary/10 px-3 py-2 flex items-center gap-3 transition-spring hover-lift">
            <span className="w-6 text-center text-sm font-bold font-tabular text-primary">#{myRank}</span>
            <span className="flex-1 text-sm font-medium">You</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /><CountUp value={myCoins} className="font-tabular" />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
