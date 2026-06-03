import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  class_id: string;
  class_name: string;
  current_streak: number;
  practiced_today: boolean;
};

export function StreakWidget() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get classes with daily practice enabled that the student is in
      const { data: memberships } = await supabase
        .from("class_members")
        .select("class_id, classes!inner(id, name, daily_practice_enabled)")
        .eq("student_id", user.id);
      const enabled = (memberships || []).filter(
        (m: any) => m.classes?.daily_practice_enabled,
      );
      if (enabled.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      const classIds = enabled.map((m: any) => m.class_id);
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const { data: streaks } = await supabase
        .from("daily_practice_streaks")
        .select("class_id, current_streak, last_practice_date")
        .eq("student_id", user.id)
        .in("class_id", classIds);
      const { data: todays } = await supabase
        .from("daily_practice_sessions")
        .select("class_id, status")
        .eq("student_id", user.id)
        .eq("practice_date", today)
        .in("class_id", classIds);

      const map = new Map<string, any>();
      (streaks || []).forEach((s: any) => map.set(s.class_id, s));
      const submittedToday = new Set(
        (todays || []).filter((t: any) => t.status === "submitted").map((t: any) => t.class_id),
      );

      const list: Row[] = enabled.map((m: any) => {
        const s = map.get(m.class_id);
        let cur = s?.current_streak || 0;
        // If they didn't practice yesterday or today, streak is broken
        if (s && s.last_practice_date && s.last_practice_date !== today && s.last_practice_date !== yesterday) {
          cur = 0;
        }
        return {
          class_id: m.class_id,
          class_name: m.classes.name,
          current_streak: cur,
          practiced_today: submittedToday.has(m.class_id),
        };
      });
      setRows(list);
      setLoading(false);
    })();
  }, [user]);

  if (loading || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" /> Daily Practice Streaks
        </CardTitle>
        <CardDescription>Keep your streak alive — practice every day.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.class_id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Flame className={`h-5 w-5 shrink-0 ${r.current_streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium line-clamp-2">{r.class_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.current_streak} day{r.current_streak === 1 ? "" : "s"}
                  {r.practiced_today ? " · ✅ done today" : " · practice today!"}
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant={r.practiced_today ? "outline" : "default"}>
              <Link to={`/student/practice/${r.class_id}`}>
                <Sparkles className="h-3 w-3 mr-1" /> {r.practiced_today ? "Review" : "Practice"}
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}