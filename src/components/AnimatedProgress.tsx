import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  max?: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  showLabel?: boolean;
  label?: string;
};

/**
 * Smoothly-animating progress bar with a gradient fill, soft inner shadow,
 * and a subtle shimmer that runs while progress < 100%.
 */
export function AnimatedProgress({
  value,
  max = 100,
  className,
  trackClassName,
  barClassName,
  showLabel,
  label,
}: Props) {
  const target = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPct(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const complete = target >= 100;

  return (
    <div className={cn("space-y-1", className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label ?? "Progress"}</span>
          <span className="font-medium tabular-nums">
            {Math.round(value)} / {max}
          </span>
        </div>
      )}
      <div
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border/60",
          trackClassName,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            complete
              ? "bg-gradient-to-r from-success to-teal shadow-[0_0_12px_hsl(var(--success)/0.55)]"
              : "bg-gradient-to-r from-primary to-teal",
            barClassName,
          )}
          style={{ width: `${pct}%` }}
        >
          {!complete && pct > 4 && (
            <div
              className="h-full w-full bg-[linear-gradient(90deg,transparent,hsl(0_0%_100%/0.35),transparent)] bg-[length:200%_100%] animate-shimmer opacity-70"
            />
          )}
        </div>
      </div>
    </div>
  );
}