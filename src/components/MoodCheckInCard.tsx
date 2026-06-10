import { useEffect, useMemo, useState } from "react";
import { HeartPulse, Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MOOD_OPTIONS, type MoodKey } from "@/lib/moodCheckins";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type MoodCheckIn = {
  id: string;
  class_id: string;
  student_id: string;
  teacher_id: string;
  prompt: string;
  responded_at: string | null;
  created_at: string;
};
const db = supabase as any;

export function MoodCheckInCard() {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<MoodCheckIn[]>([]);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [note, setNote] = useState("");
  const [wantsHelp, setWantsHelp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const activeCheckIn = checkIns[0] ?? null;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await db
      .from("mood_checkins")
      .select("*")
      .eq("student_id", user.id)
      .is("responded_at", null)
      .order("created_at", { ascending: true })
      .limit(5);

    if (error) {
      console.warn("mood check-in load failed:", error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as MoodCheckIn[];
    setCheckIns(rows);

    const classIds = Array.from(new Set(rows.map((row) => row.class_id)));
    if (classIds.length > 0) {
      const { data: classes } = await db
        .from("classes")
        .select("id, name")
        .in("id", classIds);
      const names: Record<string, string> = {};
      (classes ?? []).forEach((row: any) => {
        names[row.id] = row.name;
      });
      setClassNames(names);
    } else {
      setClassNames({});
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    setSelectedMood(null);
    setNote("");
    setWantsHelp(false);
  }, [activeCheckIn?.id]);

  const pendingLabel = useMemo(() => {
    if (checkIns.length <= 1) return null;
    return `${checkIns.length - 1} more waiting`;
  }, [checkIns.length]);

  const submit = async () => {
    if (!activeCheckIn || !selectedMood) {
      toast.error("Choose how you're feeling first");
      return;
    }

    setSubmitting(true);
    const { error } = await db.rpc("student_respond_mood_checkin", {
      _checkin_id: activeCheckIn.id,
      _mood_key: selectedMood,
      _note: note,
      _wants_help: wantsHelp,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Check-in sent");
    setCheckIns((current) => current.filter((row) => row.id !== activeCheckIn.id));
  };

  if (loading || !activeCheckIn) return null;

  return (
    <Card className="border-primary/30 bg-primary-soft/40 shadow-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Quick check-in</p>
                <p className="text-xs text-muted-foreground">
                  {classNames[activeCheckIn.class_id] ?? "Your class"}
                  {pendingLabel ? ` · ${pendingLabel}` : ""}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium">{activeCheckIn.prompt}</p>
          </div>

          <div className="w-full space-y-3 lg:max-w-2xl">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {MOOD_OPTIONS.map((option) => {
                const selected = selectedMood === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedMood(option.key)}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2 py-2 text-center transition-base hover:-translate-y-0.5 hover:shadow-card",
                      selected && option.tone,
                      selected && "ring-2 ring-primary/30"
                    )}
                    aria-pressed={selected}
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">{option.emoji}</span>
                    <span className="text-[11px] font-semibold leading-tight">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              rows={2}
              placeholder="Add a private note for your teacher (optional)"
              className="bg-card"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={wantsHelp} onCheckedChange={(value) => setWantsHelp(!!value)} />
                <span className="cursor-pointer text-sm font-medium">I want my teacher to check in with me</span>
              </label>
              <Button onClick={submit} disabled={submitting || !selectedMood} className="sm:w-auto">
                {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Send check-in
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
