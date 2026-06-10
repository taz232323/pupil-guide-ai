import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { xs: 12, sm: 14, md: 18, lg: 24 };

function tier(streak: number) {
  if (streak >= 100) return "legendary" as const;
  if (streak >= 30) return "large" as const;
  if (streak >= 7) return "medium" as const;
  return "small" as const;
}

interface Props {
  streak: number;
  size?: Size;
  showCount?: boolean;
  className?: string;
}

/**
 * StreakFlame — gradient flame icon with tier-based glow.
 * - 1–6: small  • 7–29: medium glow  • 30–99: large stronger glow  • 100+: legendary + particles
 */
export function StreakFlame({ streak, size = "sm", showCount = true, className }: Props) {
  const t = tier(streak);
  const px = SIZE_PX[size] * (t === "legendary" ? 1.35 : t === "large" ? 1.2 : t === "medium" ? 1.08 : 1);
  const prev = useRef(streak);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (streak > prev.current) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 700);
      prev.current = streak;
      return () => clearTimeout(id);
    }
    prev.current = streak;
  }, [streak]);

  if (streak <= 0) return null;

  const glow =
    t === "legendary"
      ? "drop-shadow(0 0 6px rgba(255,140,0,0.85)) drop-shadow(0 0 12px rgba(255,80,0,0.6))"
      : t === "large"
      ? "drop-shadow(0 0 5px rgba(255,140,0,0.7)) drop-shadow(0 0 10px rgba(255,80,0,0.45))"
      : t === "medium"
      ? "drop-shadow(0 0 3px rgba(255,160,40,0.55))"
      : "drop-shadow(0 0 1.5px rgba(255,180,80,0.35))";

  return (
    <span
      className={cn(
        "group inline-flex items-center gap-0.5 leading-none align-middle select-none",
        pulse && "streak-pulse",
        className,
      )}
      title={`${streak} day streak`}
      aria-label={`${streak} day streak`}
    >
      <span
        className="relative inline-flex items-center justify-center transition-[filter] duration-200 group-hover:[filter:drop-shadow(0_0_8px_rgba(255,140,0,0.95))_drop-shadow(0_0_14px_rgba(255,80,0,0.65))]"
        style={{ width: px, height: px, filter: glow }}
      >
        <svg
          viewBox="0 0 24 24"
          width={px}
          height={px}
          className="streak-flicker"
          aria-hidden
        >
          <defs>
            <linearGradient id={`sf-grad-${t}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFE680" />
              <stop offset="45%" stopColor="#FFB020" />
              <stop offset="80%" stopColor="#FF5A1F" />
              <stop offset="100%" stopColor="#C2185B" />
            </linearGradient>
            <linearGradient id={`sf-core-${t}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#FFE066" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FF8A1F" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.5c.6 2.7-.4 4.5-1.7 6-1.4 1.7-3.3 3.1-3.3 6 0 3 2.3 6 5 7 2.7 1 6.5-1 7.2-4.2.6-2.6-.7-4.6-1.7-6.2-.4-.6-.4-1 .1-1.4.6-.5.4-1.4-.4-1.4-1.6 0-2.7 1-3.3 2-.3.5-.9.4-1-.2-.2-2.5-.4-5-1-7.6z"
            fill={`url(#sf-grad-${t})`}
          />
          <path
            d="M12 9.5c.4 1.3-.2 2.2-.9 2.9-.8.8-1.6 1.6-1.6 3 0 1.6 1.3 3 2.8 3 1.6 0 3-1.3 3-2.9 0-1.3-.7-2.1-1.3-3-.6-.9-1.6-2-2-3z"
            fill={`url(#sf-core-${t})`}
          />
        </svg>
        {t === "legendary" && (
          <>
            <span className="streak-particle streak-particle-1" />
            <span className="streak-particle streak-particle-2" />
            <span className="streak-particle streak-particle-3" />
          </>
        )}
      </span>
      {showCount && (
        <span
          className={cn(
            "tabular-nums font-semibold text-orange-600 dark:text-orange-400",
            size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
          )}
        >
          {streak}
        </span>
      )}
    </span>
  );
}
