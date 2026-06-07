import { useEffect, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type RecentSave = { id: string; class_id: string; class_name: string; shield_date: string };

export function StreakShieldPanel({ shields: shieldCount }: { shields: number; onChange?: () => void }) {
  const { user } = useAuth();
  const [recent, setRecent] = useState<RecentSave[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: sh } = await supabase
        .from("streak_freeze_activations")
        .select("id, class_id, shield_date, classes:classes(name)")
        .eq("student_id", user.id)
        .eq("consumed", true)
        .order("shield_date", { ascending: false })
        .limit(5);
      setRecent(
        ((sh as any[]) ?? []).map((r) => ({
          id: r.id,
          class_id: r.class_id,
          class_name: r.classes?.name ?? "Class",
          shield_date: r.shield_date,
        }))
      );
    })();
  }, [user]);

  return (
    <Card className="border-border/60 shadow-card">
      <CardContent className="p-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Inventory</p>
          <div className="flex items-center gap-2 mt-0.5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {shieldCount} Streak Shield{shieldCount === 1 ? "" : "s"}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Shields protect your streak automatically. If you miss a day, one shield is used to keep your streak alive — no action needed.
          </p>
        </div>

        {recent.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Recently used</p>
            <ul className="text-sm space-y-1">
              {recent.map((s) => {
                const d = new Date(s.shield_date + "T00:00:00");
                return (
                  <li key={s.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 bg-accent/40">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.class_name} · streak saved</span>
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