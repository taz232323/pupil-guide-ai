import { useEffect, useState } from "react";
import { Clock3, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ClassRow = { id: string; name: string };
type Shield = { id: string; class_id: string; shield_date: string; consumed: boolean; consumed_at: string | null };

export function StreakShieldPanel({ shields: shieldCount }: { shields: number; onChange?: () => void }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [recent, setRecent] = useState<Shield[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: cm } = await supabase
        .from("class_members")
        .select("class_id, classes:classes(id, name, daily_practice_enabled)")
        .eq("student_id", user.id);
      const list: ClassRow[] = ((cm as any[]) ?? [])
        .map((r) => r.classes)
        .filter((c) => c && c.daily_practice_enabled)
        .map((c) => ({ id: c.id, name: c.name }));
      setClasses(list);

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: sh } = await supabase
        .from("streak_freeze_activations")
        .select("id, class_id, shield_date, consumed, consumed_at")
        .eq("student_id", user.id)
        .gte("shield_date", since.toISOString().slice(0, 10))
        .order("shield_date", { ascending: false })
        .limit(12);
      setRecent(((sh as Shield[]) ?? []));
    })();
  }, [user]);

  return (
    <Card className="border-border/60 shadow-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Inventory</p>
            <div className="flex items-center gap-2 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {shieldCount} Streak Shield{shieldCount === 1 ? "" : "s"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Shields apply automatically after a missed daily practice day. One shield protects one missed day.
            </p>
          </div>
        </div>

        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
            <ShieldAlert className="h-4 w-4" /> Join a class with daily practice to use shields.
          </p>
        ) : shieldCount > 0 ? (
          <div className="rounded-lg border border-primary/20 bg-primary-soft/50 px-3 py-2 text-sm">
            <span className="font-medium">Auto-protection ready.</span>{" "}
            If you miss practice in any daily-practice class, Grapheion will use a shield to keep your streak alive.
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            No shields available. Earn more from quests, daily rewards, or teacher rewards.
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Recent shield activity</p>
            <ul className="text-sm space-y-1">
              {recent.map((s) => {
                const cls = classes.find((c) => c.id === s.class_id)?.name ?? "Class";
                const d = new Date(s.shield_date + "T00:00:00");
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-1.5 bg-accent/40">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      {s.consumed ? (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">
                        {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="max-w-24 truncate text-xs text-muted-foreground">{cls}</span>
                      <Badge variant={s.consumed ? "default" : "secondary"} className="text-[10px]">
                        {s.consumed ? "Used" : "Ready"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
