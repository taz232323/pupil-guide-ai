import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ClassRow = { id: string; name: string };
type Shield = { id: string; class_id: string; shield_date: string; consumed: boolean };

export function StreakShieldPanel({ shields: shieldCount, onChange }: { shields: number; onChange: () => void }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [day, setDay] = useState<string>("");
  const [active, setActive] = useState<Shield[]>([]);
  const [busy, setBusy] = useState(false);

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
      if (list[0]) setClassId(list[0].id);

      const today = new Date().toISOString().slice(0, 10);
      const { data: sh } = await supabase
        .from("streak_freeze_activations")
        .select("id, class_id, shield_date, consumed")
        .eq("student_id", user.id)
        .gte("shield_date", today)
        .order("shield_date");
      setActive(((sh as Shield[]) ?? []));
    })();
  }, [user]);

  const dayOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const d = new Date();
    for (let i = 0; i <= 7; i++) {
      const dt = new Date(d);
      dt.setDate(d.getDate() + i);
      const value = dt.toISOString().slice(0, 10);
      const label =
        i === 0 ? "Today" : i === 1 ? "Tomorrow" : dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      out.push({ value, label });
    }
    return out;
  }, []);

  async function activate() {
    if (!classId || !day) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("activate_streak_shield", {
        _class_id: classId,
        _shield_date: day,
      });
      if (error) throw error;
      toast.success("Shield activated 🛡");
      const { data: sh } = await supabase
        .from("streak_freeze_activations")
        .select("id, class_id, shield_date, consumed")
        .eq("student_id", user!.id)
        .gte("shield_date", new Date().toISOString().slice(0, 10))
        .order("shield_date");
      setActive(((sh as Shield[]) ?? []));
      onChange();
    } catch (e: any) {
      toast.error(e.message || "Could not activate shield");
    } finally {
      setBusy(false);
    }
  }

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
              Activate one before a day you might miss daily practice — your streak survives.
            </p>
          </div>
        </div>

        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
            <ShieldAlert className="h-4 w-4" /> Join a class with daily practice to use shields.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="sm:w-1/2"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="sm:w-1/2"><SelectValue placeholder="Pick a day" /></SelectTrigger>
              <SelectContent>
                {dayOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={activate} disabled={!classId || !day || shieldCount < 1 || busy}>
              <CalendarPlus className="h-4 w-4 mr-1" />
              {busy ? "…" : "Activate"}
            </Button>
          </div>
        )}

        {active.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Active shields</p>
            <ul className="text-sm space-y-1">
              {active.map((s) => {
                const cls = classes.find((c) => c.id === s.class_id)?.name ?? "Class";
                const d = new Date(s.shield_date + "T00:00:00");
                return (
                  <li key={s.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 bg-accent/40">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground">{cls}</span>
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