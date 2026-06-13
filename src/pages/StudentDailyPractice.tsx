import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flame, Loader2, Sparkles, Zap } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RewardOverlay, type RewardData } from "@/components/RewardOverlay";
import { notifyStudentCoinsChanged, notifyStudentStreaksChanged } from "@/lib/studentRefreshEvents";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { ProgressRing } from "@/components/ProgressRing";
import { MountainSketch } from "@/components/MountainSketch";
import { celebrate } from "@/lib/confetti";
import { cn } from "@/lib/utils";

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

  const correctCount = useMemo(() => questions.filter((q) => q.is_correct === true).length, [questions]);
  const gradedCount = useMemo(() => questions.filter((q) => q.is_correct !== null).length, [questions]);
  const incorrectCount = Math.max(0, gradedCount - correctCount);
  const skippedCount = Math.max(0, questions.length - answeredCount);
  const accuracyPct = gradedCount ? Math.round((correctCount / gradedCount) * 100) : 0;
  const goalTotal = Math.max(MIN, questions.length);

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
      celebrate(r.milestoneHit ? "big" : "small");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const showSidebar = !loading && enabled !== false && !results && questions.length > 0;

  return (
    <DashboardShell title="Practice" subtitle="Sharpen your skills, one question at a time.">
      <RewardOverlay open={!!reward} data={reward} onClose={() => setReward(null)} />

      <div className="relative overflow-hidden">
        <MountainSketch
          variant="range"
          className="pointer-events-none absolute -top-10 right-0 hidden w-64 text-muted-foreground/30 sm:block"
        />

        <div className={cn("grid grid-cols-1 gap-6", showSidebar && "lg:grid-cols-[1fr_18rem]")}>
          <div className="min-w-0 space-y-4">
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
                  <Badge variant="secondary" className="gap-1"><Flame className="h-3 w-3 text-gold animate-flame-pulse" /> Streak today</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
                ) : enabled === false ? (
                  <p className="text-sm text-muted-foreground">Daily Practice is not enabled for this class.</p>
                ) : results ? (
                  <ResultsView results={results} />
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          {questions.length > 0 ? (
                            <>Question <span className="font-tabular font-semibold text-foreground">{answeredCount}</span> of <span className="font-tabular font-semibold text-foreground">{goalTotal}</span></>
                          ) : (
                            <>Answer at least <span className="font-tabular font-semibold text-foreground">{MIN}</span> to finish</>
                          )}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold">
                          <Zap className="h-3 w-3 fill-gold" /> +<span className="font-tabular">10</span> XP
                        </span>
                      </div>
                      <Progress value={Math.min(100, (answeredCount / goalTotal) * 100)} />
                      <p className="text-xs text-muted-foreground">
                        {minReached
                          ? "Minimum reached — submit or keep practicing."
                          : "Keep going to unlock your reward."}
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
              <Reveal key={q.id} delay={idx * 60}>
                <Card className="hover-lift">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Question <span className="font-tabular">{idx + 1}</span>
                      <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                        {q.question_type === "multiple_choice" ? "Multiple choice" : "Short answer"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2 text-lg font-medium text-foreground">{q.prompt}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {q.question_type === "multiple_choice" && q.options ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {q.options.map((opt, i) => {
                          const selected = q.selected_index === i;
                          const letter = String.fromCharCode(65 + i);
                          return (
                            <button
                              key={i}
                              onClick={() => saveAnswer(q, { selected_index: i })}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-spring hover-lift",
                                selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-muted/40",
                              )}
                            >
                              <span className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-tabular",
                                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                              )}>
                                {letter}
                              </span>
                              <span className="min-w-0">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Textarea
                        defaultValue={q.text_response || ""}
                        placeholder="Type your answer..."
                        onBlur={(e) => saveAnswer(q, { text_response: e.target.value })}
                      />
                    )}
                  </CardContent>
                </Card>
              </Reveal>
            ))}

            {!results && questions.length > 0 && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={generateBatch} disabled={generating} className="flex-1">
                  {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  More questions
                </Button>
                <Button onClick={submit} disabled={!minReached || submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Submit answers
                </Button>
              </div>
            )}
          </div>

          {showSidebar && (
            <aside className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-4 w-4 text-gold animate-flame-pulse" /> Streak
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-1">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{d}</span>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 text-[10px] text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Complete today's practice to extend your streak.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <ProgressRing value={Math.round((answeredCount / goalTotal) * 100)} size={84} strokeWidth={9}>
                      <span className="font-tabular text-lg font-bold">{Math.round((answeredCount / goalTotal) * 100)}%</span>
                    </ProgressRing>
                    <ul className="flex-1 space-y-1.5 text-sm">
                      <li className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Correct</span>
                        <span className="font-tabular font-semibold">{correctCount}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Incorrect</span>
                        <span className="font-tabular font-semibold">{incorrectCount}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Skipped</span>
                        <span className="font-tabular font-semibold">{skippedCount}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Accuracy</span>
                      <span className="font-tabular font-semibold">{accuracyPct}%</span>
                    </div>
                    <Progress value={accuracyPct} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <Button
                    onClick={submit}
                    disabled={!minReached || submitting}
                    variant="outline"
                    className="w-full"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    View session summary
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate(-1)}>
                    End practice
                  </Button>
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function ResultsView({ results }: { results: any }) {
  if (results.alreadySubmitted) {
    return (
      <div className="space-y-1">
        <p className="text-sm">You've already completed today's practice.</p>
        <p className="text-xs text-muted-foreground"><span className="font-tabular">{results.answered}</span> answered · <span className="font-tabular">{results.correct}</span> correct</p>
      </div>
    );
  }
  const { answered, correct, baseCoins, bonusCoins, milestoneBonus, milestoneHit, currentStreak, shieldsConsumed } = results;
  const pct = answered ? Math.round((correct / answered) * 100) : 0;
  return (
    <div className="space-y-3 animate-pop-in">
      <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary-soft/30 to-plum-soft/10 p-4">
        <p className="text-sm text-muted-foreground">Session complete</p>
        <p className="mt-1 text-2xl font-semibold font-tabular">{correct} / {answered} correct (<CountUp value={pct} duration={900} suffix="%" />)</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-sm">Star coins +<span className="font-tabular">{baseCoins}</span> for completing the minimum</p>
        {bonusCoins > 0 && <p className="text-sm">Bonus +<span className="font-tabular">{bonusCoins}</span> for extra questions</p>}
        {milestoneBonus > 0 && (
          <p className="text-sm">Milestone +<span className="font-tabular">{milestoneBonus}</span> bonus (<span className="font-tabular">{milestoneHit}</span>-day streak!)</p>
        )}
        {shieldsConsumed > 0 && (
          <p className="text-sm"><span className="font-tabular">{shieldsConsumed}</span> Streak Shield{shieldsConsumed === 1 ? "" : "s"} protected missed practice.</p>
        )}
        <p className={cn("text-sm font-medium pt-1 flex items-center gap-1", milestoneHit && "streak-milestone-glow rounded-md px-2 py-1 -mx-2")}>
          <Flame className="h-4 w-4 text-gold animate-flame-pulse" /> <span className="font-tabular">{currentStreak}</span>-day streak — keep it going tomorrow!
        </p>
      </div>
      <p className="text-sm text-muted-foreground italic">
        {pct >= 80 ? "Outstanding work!" : pct >= 50 ? "Great effort — keep it up!" : "Every rep counts. Try again tomorrow!"}
      </p>
    </div>
  );
}
