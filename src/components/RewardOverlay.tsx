import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Coins, Flame, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoldCoinBurst } from "@/components/GoldCoinBurst";

export type RewardData = {
  title: string;
  subtitle?: string;
  coins?: number;
  bonusCoins?: number;
  streak?: number;
  milestone?: number | null;
  scoreLabel?: string;
  intensity?: "small" | "big";
};

type Props = {
  open: boolean;
  data: RewardData | null;
  onClose: () => void;
};

/**
 * Animated reward feedback shown after a submission.
 * Pure-CSS animations for entrance; canvas-confetti for the burst.
 */
export function RewardOverlay({ open, data, onClose }: Props) {
  const burstKey = useRef(0);
  useEffect(() => {
    if (!open || !data) return;
    burstKey.current += 1;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, data, onClose]);

  if (!open || !data) return null;

  const totalCoins = (data.coins ?? 0) + (data.bonusCoins ?? 0);
  const big = (data.intensity ?? (data.milestone ? "big" : "small")) === "big";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <GoldCoinBurst triggerKey={burstKey.current} count={big ? 34 : 22} />
      {/* Backdrop with blur and soft gradient wash */}
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-md" />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, hsl(var(--primary) / 0.35), transparent 70%)",
        }}
      />

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="reward-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated"
      >
        {/* Top gradient banner */}
        <div
          className="relative h-28 overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--teal)) 60%, hsl(var(--warning)) 100%)",
          }}
        >
          <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/20 blur-2xl reward-blob-a" />
          <div className="absolute -bottom-12 -right-6 h-44 w-44 rounded-full bg-white/15 blur-2xl reward-blob-b" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="reward-icon rounded-full bg-white/25 backdrop-blur-sm p-4 ring-1 ring-white/40 shadow-lg">
              {data.milestone ? (
                <Trophy className="h-9 w-9 text-white drop-shadow" />
              ) : (
                <Sparkles className="h-9 w-9 text-white drop-shadow" />
              )}
            </div>
          </div>

          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-2 top-2 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-center">
          <div className="space-y-1 reward-stagger">
            <h2 className="text-2xl font-semibold tracking-tight">{data.title}</h2>
            {data.subtitle && (
              <p className="text-sm text-muted-foreground">{data.subtitle}</p>
            )}
          </div>

          {data.scoreLabel && (
            <div className="reward-stagger rounded-xl border border-border/60 bg-gradient-soft px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Result
              </p>
              <p className="text-xl font-semibold mt-0.5">{data.scoreLabel}</p>
            </div>
          )}

          {totalCoins > 0 && (
            <div className="reward-stagger flex items-center justify-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-warning/30 bg-warning-soft px-4 py-2 shadow-card">
                <Coins className="h-5 w-5 text-warning" />
                <span className="font-semibold text-warning-foreground">
                  +{totalCoins} Star Coins
                </span>
              </div>
            </div>
          )}

          {(data.bonusCoins ?? 0) > 0 && (
            <p className="reward-stagger text-xs text-muted-foreground">
              Includes <span className="font-medium text-foreground">+{data.bonusCoins}</span> bonus
            </p>
          )}

          {data.streak ? (
            <div className="reward-stagger inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="font-medium">{data.streak}-day streak</span>
              {data.milestone && (
                <span className="ml-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning">
                  {data.milestone}-day milestone!
                </span>
              )}
            </div>
          ) : null}

          <div className="reward-stagger pt-2">
            <Button onClick={onClose} className="w-full">
              Awesome
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}