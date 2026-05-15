import { useCallback, useEffect, useState } from "react";
import { Sparkles, Target, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DailyLoginBox } from "@/components/DailyLoginBox";
import { QuestCard, type QuestRow } from "@/components/QuestCard";
import { StreakShieldPanel } from "@/components/StreakShieldPanel";

export default function StudentRewards() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [shields, setShields] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: q }, { data: c }] = await Promise.all([
      supabase.rpc("get_quests_progress"),
      supabase
        .from("student_coins")
        .select("streak_freezes")
        .eq("student_id", user.id)
        .maybeSingle(),
    ]);
    setQuests((q as QuestRow[]) ?? []);
    setShields((c as any)?.streak_freezes ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const weekly = quests.filter((q) => q.kind === "weekly");
  const ongoing = quests.filter((q) => q.kind === "ongoing");

  return (
    <DashboardShell title="Rewards & Quests">
      <div className="space-y-6 animate-page-enter">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-warning" /> Rewards & Quests
          </h1>
          <p className="text-sm text-muted-foreground">
            Open your daily box, finish quests, and stockpile rare Streak Shields.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <DailyLoginBox />
          <StreakShieldPanel shields={shields} onChange={refresh} />
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Weekly challenges</h2>
            <span className="text-xs text-muted-foreground">resets Monday</span>
          </div>
          {loading ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
          ) : weekly.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No weekly challenges right now.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 stagger-children">
              {weekly.map((q) => (
                <QuestCard key={q.quest_key} quest={q} onClaimed={refresh} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Study quests</h2>
            <span className="text-xs text-muted-foreground">long-term goals</span>
          </div>
          {ongoing.length === 0 ? null : (
            <div className="grid gap-3 md:grid-cols-2 stagger-children">
              {ongoing.map((q) => (
                <QuestCard key={q.quest_key} quest={q} onClaimed={refresh} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}