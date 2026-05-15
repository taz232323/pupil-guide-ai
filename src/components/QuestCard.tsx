import { useState } from "react";
import { CheckCircle2, Coins, ShieldCheck, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedProgress } from "@/components/AnimatedProgress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RewardOverlay, type RewardData } from "@/components/RewardOverlay";

export type QuestRow = {
  quest_key: string;
  title: string;
  description: string;
  kind: "weekly" | "ongoing";
  goal_type: string;
  goal_value: number;
  reward_coins: number;
  reward_freezes: number;
  period_key: string;
  progress: number;
  claimed: boolean;
};

type Props = { quest: QuestRow; onClaimed: () => void };

export function QuestCard({ quest, onClaimed }: Props) {
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<RewardData | null>(null);
  const complete = quest.progress >= quest.goal_value;
  const cappedProgress = Math.min(quest.progress, quest.goal_value);

  async function claim() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_quest", {
        _quest_key: quest.quest_key,
      });
      if (error) throw error;
      const r = data as any;
      setReward({
        title: "Quest complete!",
        subtitle: r.title,
        coins: r.coins,
        intensity: r.freezes ? "big" : "small",
      });
      onClaimed();
    } catch (e: any) {
      toast.error(e.message || "Could not claim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RewardOverlay open={!!reward} data={reward} onClose={() => setReward(null)} />
      <Card
        className={
          "relative overflow-hidden border-border/60 transition-base hover-lift " +
          (quest.claimed ? "opacity-70" : "")
        }
      >
        {complete && !quest.claimed && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-success/10 via-transparent to-warning/10" />
        )}
        <CardContent className="relative p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="rounded-xl bg-accent p-2 ring-1 ring-border/60 shadow-card">
                {quest.kind === "weekly" ? (
                  <Target className="h-5 w-5 text-primary" />
                ) : (
                  <Trophy className="h-5 w-5 text-warning" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold leading-tight">{quest.title}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {quest.kind === "weekly" ? "Weekly" : "Quest"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{quest.description}</p>
              </div>
            </div>
          </div>

          <AnimatedProgress
            value={cappedProgress}
            max={quest.goal_value}
            label="Progress"
            showLabel
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {quest.reward_coins > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-warning font-medium">
                  <Coins className="h-3.5 w-3.5" />+{quest.reward_coins}
                </span>
              )}
              {quest.reward_freezes > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-primary font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />+{quest.reward_freezes}
                </span>
              )}
            </div>
            {quest.claimed ? (
              <span className="inline-flex items-center gap-1 text-sm text-success font-medium">
                <CheckCircle2 className="h-4 w-4" /> Claimed
              </span>
            ) : (
              <Button size="sm" disabled={!complete || busy} onClick={claim}>
                {complete ? (busy ? "Claiming…" : "Claim") : "In progress"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}