import { useEffect, useState } from "react";
import { Gift, Sparkles, ShieldCheck, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RewardOverlay, type RewardData } from "@/components/RewardOverlay";
import { notifyStudentCoinsChanged } from "@/lib/studentRefreshEvents";

type Claim = {
  reward_kind: string;
  coins_amount: number;
  freezes_amount: number;
};

function rewardLabel(kind: string) {
  switch (kind) {
    case "freeze": return "Streak Shield!";
    case "big_coins": return "Jackpot!";
    case "medium_coins": return "Solid haul!";
    default: return "Daily reward!";
  }
}

type Props = {
  onClaimed?: () => void;
};

export function DailyLoginBox({ onClaimed }: Props) {
  const { user } = useAuth();
  const [today, setToday] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [reward, setReward] = useState<RewardData | null>(null);

  useEffect(() => {
    if (!user) return;
    const date = new Date().toISOString().slice(0, 10);
    supabase
      .from("daily_login_claims")
      .select("reward_kind, coins_amount, freezes_amount")
      .eq("student_id", user.id)
      .eq("claim_date", date)
      .maybeSingle()
      .then(({ data }) => {
        setToday((data as Claim) ?? null);
        setLoading(false);
      });
  }, [user]);

  async function open() {
    setOpening(true);
    try {
      const { data, error } = await supabase.rpc("claim_daily_login_box");
      if (error) throw error;
      const r = data as any;
      setToday({
        reward_kind: r.kind,
        coins_amount: r.coins ?? 0,
        freezes_amount: r.freezes ?? 0,
      });
      setReward({
        title: rewardLabel(r.kind),
        subtitle:
          r.kind === "freeze"
            ? "An ultra-rare Streak Shield landed in your inventory."
            : "Come back tomorrow for another box.",
        coins: r.coins,
        intensity: r.kind === "freeze" || r.kind === "big_coins" ? "big" : "small",
      });
      if ((r.coins ?? 0) > 0) {
        notifyStudentCoinsChanged({ userId: user?.id, reason: "daily_login_box" });
      }
      onClaimed?.();
    } catch (e: any) {
      toast.error(e.message || "Could not open box");
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <RewardOverlay open={!!reward} data={reward} onClose={() => setReward(null)} />
      <Card className="relative overflow-hidden border-border/60 shadow-elevated">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--teal) / 0.10) 50%, hsl(var(--warning) / 0.18))",
          }}
        />
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-warning/30 blur-3xl animate-blob-slow" />
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl animate-blob-slower" />

        <CardContent className="relative p-5 flex items-center gap-4">
          <div className="shrink-0">
            <div
              className={
                "rounded-2xl p-4 ring-1 ring-border/60 shadow-card bg-card/80 backdrop-blur-sm " +
                (today ? "" : "animate-bounce-pop")
              }
            >
              <Gift className={"h-8 w-8 " + (today ? "text-muted-foreground" : "text-warning")} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily surprise</p>
            <h3 className="text-lg font-semibold leading-tight">
              {today ? "You opened today's box" : "Open today's box"}
            </h3>
            {today ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                {today.coins_amount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-warning">
                    <Coins className="h-3.5 w-3.5" />+{today.coins_amount}
                  </span>
                )}
                {today.freezes_amount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />+{today.freezes_amount} shield
                  </span>
                )}
                <span className="text-muted-foreground">· back tomorrow</span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Random coins — and very rarely a Streak Shield.
              </p>
            )}
          </div>
          <Button
            disabled={!!today || loading || opening}
            onClick={open}
            className="shrink-0"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {today ? "Opened" : opening ? "Opening…" : "Open"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
