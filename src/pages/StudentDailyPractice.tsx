import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flame, Loader2, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RewardOverlay, type RewardData } from "@/components/RewardOverlay";
import { notifyStudentCoinsChanged, notifyStudentStreaksChanged } from "@/lib/studentRefreshEvents";

const MIN = 5;

type Q = {
  id: string;
  position: number;
  question_type: "multiple_choice" | "short_answer";
  prompt: string;
  options: string[] | null;
  selected_index: number | null;
  text_response: string | null;
  is_correct: boolean | null;
};

export default function StudentDailyPractice() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [className, setClassName] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [reward, setReward] = useState<RewardData | null>(null);

  const answeredCount = useMemo(
    () =>
      questions.filter(
        (q) => q.selected_index !== null || (q.text_response && q.text_response.trim().length > 0),
      ).length,
    [questions],
  );
  const minReached = answeredCount >= MIN;

  useEffect(() => {
    if (!classId || !user) return;
    (async () => {
      setLoading(true);
      const { data: cls } = await supabase
        .from("classes")
        .select("name, daily_practice_enabled")
        .eq("id", classId)
        .maybeSingle();
      if (!cls) {
        toast.error("Class not found");
        setLoading(false);
        return;
      }
      setClassName(cls.name);
      setEnabled(!!cls.daily_practice_enabled);

      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from("daily_practice_sessions")
        .select("*")
        .eq("student_id", user.id)
        .eq("class_id", classId)
        .eq("practice_date", today)
        .maybeSingle();
      if (existing) {
        setSessionId(existing.id);
        if (existing.status === "submitted") {
          setResults({ alreadySubmitted: true, answered: existing.total_answered, correct: existing.total_correct });
        }
        const { data: ans } = await supabase
          .from("daily_practice_answers")
          .select("id, position, question_type, prompt, options, selected_index, text_response, is_correct")
          .eq("session_id", existing.id)
          .order("position");
        setQuestions((ans || []) as any);
      }
      setLoading(false);
    })();
  }, [classId, user]);

  async function generateBatch() {
    if (!classId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-practice-generate", {
        body: { classId, batchSize: 5 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSessionId((data as any).session.id);
      setQuestions((prev) => [...prev, ...((data as any).questions as Q[])]);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  }

  async function saveAnswer(q: Q, patch: Partial<Q>) {
    setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, ...patch } : x)));
    const update: any = {};
    if ("selected_index" in patch) {
      update.selected_index = patch.selected_index;
      // auto-grade MC
      const { data: row } = await supabase
        .from("daily_practice_answers")
        .select("correct_index")
        .eq("id", q.id)
        .maybeSingle();
      if (row && row.correct_index !== null) {
        update.is_correct = patch.selected_index === row.correct_index;
      }
    }
    if ("text_response" in patch) update.text_response = patch.text_response;
    await supabase.from("daily_practice_answers").update(update).eq("id", q.id);
  }

  async function submit() {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-practice-submit", {
        body: { sessionId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResults(data);
      const r: any = data;
      notifyStudentCoinsChanged({ userId: user?.id, reason: "daily_practice_submit" });
      notifyStudentStreaksChanged({ userId: user?.id, reason: "daily_practice_submit" });
      const pct = r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
      const shieldText = r.shieldsConsumed > 0
        ? `${r.shieldsConsumed} Streak Shield${r.shieldsConsumed === 1 ? "" : "s"} protected your streak.`
        : null;
      setReward({
        title: r.milestoneHit ? `${r.milestoneHit}-day streak!` : "Practice complete!",
        subtitle: r.milestoneHit
          ? "Milestone unlocked — keep the fire going."
          : shieldText ?? "Nice work — your streak grows.",
        coins: r.baseCoins + (r.milestoneBonus ?? 0),
        bonusCoins: r.bonusCoins,
        streak: r.currentStreak,
        milestone: r.milestoneHit ?? null,
        scoreLabel: `${r.correct} / ${r.answered} correct (${pct}%)`,
        intensity: r.milestoneHit ? "big" : "small",
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell>
      <RewardOverlay open={!!reward} data={reward} onClose={() => setReward(null)} />
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Daily Practice
                </CardTitle>
                <CardDescription>{className}</CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1"><Flame className="h-3 w-3" /> Streak today</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : enabled === false ? (
              <p className="text-sm text-muted-foreground">Daily Practice is not enabled for this class.</p>
            ) : results ? (
              <ResultsView results={results} />
            ) : (
              <>
                <div className="space-y-1">
                  <Progress value={Math.min(100, (answeredCount / MIN) * 100)} />
                  <p className="text-xs text-muted-foreground">
                    {minReached
                      ? "Minimum reached — submit or keep practicing."
                      : `${answeredCount} of ${MIN} minimum answered — keep going`}
                  </p>
                </div>
                {questions.length === 0 && (
                  <Button onClick={generateBatch} disabled={generating} className="w-full">
                    {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    Start practice
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {!results && questions.map((q, idx) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Question {idx + 1}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {q.question_type === "multiple_choice" ? "Multiple choice" : "Short answer"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-foreground text-base mt-1">{q.prompt}</CardDescription>
            </CardHeader>
            <CardContent>
              {q.question_type === "multiple_choice" && q.options ? (
                <div className="space-y-2">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => saveAnswer(q, { selected_index: i })}
                      className={`w-full text-left rounded-md border px-3 py-2 text-sm transition ${
                        q.selected_index === i ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <Textarea
                  defaultValue={q.text_response || ""}
                  placeholder="Type your answer…"
                  onBlur={(e) => saveAnswer(q, { text_response: e.target.value })}
                />
              )}
            </CardContent>
          </Card>
        ))}

        {!results && questions.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateBatch} disabled={generating} className="flex-1">
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              More questions
            </Button>
            <Button onClick={submit} disabled={!minReached || submitting} className="flex-1">
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Submit Session
            </Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function ResultsView({ results }: { results: any }) {
  if (results.alreadySubmitted) {
    return (
      <div className="space-y-1">
        <p className="text-sm">You've already completed today's practice.</p>
        <p className="text-xs text-muted-foreground">{results.answered} answered · {results.correct} correct</p>
      </div>
    );
  }
  const { answered, correct, baseCoins, bonusCoins, milestoneBonus, milestoneHit, currentStreak, shieldsConsumed } = results;
  const pct = answered ? Math.round((correct / answered) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">Session complete</p>
        <p className="text-2xl font-semibold mt-1">{correct} / {answered} correct ({pct}%)</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-sm">⭐ +{baseCoins} for completing the minimum</p>
        {bonusCoins > 0 && <p className="text-sm">✨ +{bonusCoins} bonus for extra questions</p>}
        {milestoneBonus > 0 && (
          <p className="text-sm">🎉 +{milestoneBonus} milestone bonus ({milestoneHit}-day streak!)</p>
        )}
        {shieldsConsumed > 0 && (
          <p className="text-sm">🛡 {shieldsConsumed} Streak Shield{shieldsConsumed === 1 ? "" : "s"} protected missed practice.</p>
        )}
        <p className="text-sm font-medium pt-1 flex items-center gap-1">
          <Flame className="h-4 w-4 text-orange-500" /> {currentStreak}-day streak — keep it going tomorrow!
        </p>
      </div>
      <p className="text-sm text-muted-foreground italic">
        {pct >= 80 ? "Outstanding work! 🌟" : pct >= 50 ? "Great effort — keep it up!" : "Every rep counts. Try again tomorrow!"}
      </p>
    </div>
  );
}
