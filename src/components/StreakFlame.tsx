import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { xs: 12, sm: 14, md: 18, lg: 24 };

export type FlameTier =
  | "ember"     // 1–6
  | "blazing"   // 7–29
  | "sapphire"  // 30–59
  | "mythic"    // 60–99
  | "emerald"   // 100–149
  | "crimson"   // 150–249
  | "golden";   // 250+

export function flameTier(streak: number): FlameTier {
  if (streak >= 250) return "golden";
  if (streak >= 150) return "crimson";
  if (streak >= 100) return "emerald";
  if (streak >= 60)  return "mythic";
  if (streak >= 30)  return "sapphire";
  if (streak >= 7)   return "blazing";
  return "ember";
}

type TierStyle = {
  stops: [string, string, string, string];
  core: [string, string];
  text: string;
  glow: string;
  particle: string;
  growth: number; // scale multiplier
  particles: number;
};

const TIERS: Record<FlameTier, TierStyle> = {
  ember: {
    stops:  ["#FFE680", "#FFB020", "#FF6A1F", "#B33B0E"],
    core:   ["#FFFFFF", "#FFD27A"],
    text:   "text-orange-600 dark:text-orange-400",
    glow:   "drop-shadow(0 0 1.5px rgba(255,180,80,0.4))",
    particle: "#FF8A1F",
    growth: 1.0,
    particles: 0,
  },
  blazing: {
    stops:  ["#FFF1B8", "#FFC83D", "#FF7A1F", "#C72A0E"],
    core:   ["#FFFFFF", "#FFE066"],
    text:   "text-amber-600 dark:text-amber-400",
    glow:   "drop-shadow(0 0 4px rgba(255,170,40,0.65))",
    particle: "#FFB020",
    growth: 1.1,
    particles: 0,
  },
  sapphire: {
    stops:  ["#DCEFFF", "#7CC4FF", "#2E7BFF", "#0A2A8A"],
    core:   ["#FFFFFF", "#BFE0FF"],
    text:   "text-sky-500 dark:text-sky-300",
    glow:   "drop-shadow(0 0 5px rgba(60,140,255,0.75)) drop-shadow(0 0 10px rgba(40,90,220,0.45))",
    particle: "#4FA8FF",
    growth: 1.18,
    particles: 3,
  },
  mythic: {
    stops:  ["#F2D8FF", "#C97BFF", "#7A2CD8", "#3A1063"],
    core:   ["#FFFFFF", "#E8C8FF"],
    text:   "text-violet-500 dark:text-violet-300",
    glow:   "drop-shadow(0 0 6px rgba(170,90,255,0.8)) drop-shadow(0 0 12px rgba(110,40,200,0.5))",
    particle: "#C97BFF",
    growth: 1.25,
    particles: 4,
  },
  emerald: {
    stops:  ["#D9FFE6", "#5FE89B", "#10A95E", "#04472A"],
    core:   ["#FFFFFF", "#C9F7DC"],
    text:   "text-emerald-500 dark:text-emerald-300",
    glow:   "drop-shadow(0 0 6px rgba(40,210,120,0.85)) drop-shadow(0 0 14px rgba(20,150,80,0.5))",
    particle: "#5FE89B",
    growth: 1.32,
    particles: 4,
  },
  crimson: {
    stops:  ["#FFD9D9", "#FF6B5A", "#D11A1A", "#5A0606"],
    core:   ["#FFFFFF", "#FFC2BA"],
    text:   "text-red-500 dark:text-red-400",
    glow:   "drop-shadow(0 0 7px rgba(255,80,60,0.9)) drop-shadow(0 0 14px rgba(200,30,30,0.55))",
    particle: "#FF6B5A",
    growth: 1.4,
    particles: 5,
  },
  golden: {
    stops:  ["#FFFFFF", "#FFE680", "#FFB000", "#7A4A00"],
    core:   ["#FFFFFF", "#FFEBA0"],
    text:   "text-amber-500 dark:text-amber-300",
    glow:   "drop-shadow(0 0 8px rgba(255,205,80,1)) drop-shadow(0 0 16px rgba(255,160,40,0.75))",
    particle: "#FFD24A",
    growth: 1.5,
    particles: 6,
  },
};

export const FLAME_TIER_LABEL: Record<FlameTier, string> = {
  ember:    "Ember",
  blazing:  "Blazing",
  sapphire: "Sapphire",
  mythic:   "Mythic",
  emerald:  "Emerald",
  crimson:  "Crimson",
  golden:   "Golden",
};

interface Props {
  streak: number;
  size?: Size;
  showCount?: boolean;
  /** Mark this flame as the class champion — rotating sparkles + crown. */
  isChampion?: boolean;
  className?: string;
}

/**
 * StreakFlame — rarity-tiered flame with tier-specific colors, glow, and particles.
 * Tiers: ember → blazing → sapphire → mythic → emerald → crimson → golden.
 * isChampion overlays rotating gold sparkles and a tiny crown.
 */
export function StreakFlame({ streak, size = "sm", showCount = true, isChampion, className }: Props) {
  const t = flameTier(streak);
  const cfg = TIERS[t];
  const px = SIZE_PX[size] * cfg.growth;
  const prev = useRef(streak);
  const prevTier = useRef<FlameTier>(t);
  const [pulse, setPulse] = useState(false);
  const [evolve, setEvolve] = useState(false);
  useEffect(() => {
    if (streak > prev.current) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 700);
      if (flameTier(streak) !== prevTier.current) {
        setEvolve(true);
        setTimeout(() => setEvolve(false), 1200);
      }
      prev.current = streak;
      prevTier.current = flameTier(streak);
      return () => clearTimeout(id);
    }
    prev.current = streak;
    prevTier.current = flameTier(streak);
  }, [streak]);

  if (streak <= 0) return null;

  const titleParts = [`${streak} day streak`, FLAME_TIER_LABEL[t] + " Flame"];
  if (isChampion) titleParts.push("Class Champion");

  return (
    <span
      className={cn(
        "group inline-flex items-center gap-0.5 leading-none align-middle select-none",
        pulse && "streak-pulse",
        evolve && "streak-evolve",
        className,
      )}
      title={titleParts.join(" · ")}
      aria-label={`${streak} day streak`}
    >
      <span
        className="relative inline-flex items-center justify-center transition-[filter] duration-200 group-hover:brightness-110"
        style={{ width: px, height: px, filter: cfg.glow }}
      >
        {isChampion && (
          <>
            {/* Tiny crown above the flame */}
            <svg
              viewBox="0 0 24 12"
              width={px * 0.7}
              height={px * 0.35}
              aria-hidden
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 drop-shadow-[0_0_3px_rgba(255,200,0,0.9)]"
            >
              <path d="M2 11 L4 3 L8 8 L12 1 L16 8 L20 3 L22 11 Z" fill="#FFD24A" stroke="#B8860B" strokeWidth="0.8" strokeLinejoin="round" />
            </svg>
            <span className="streak-champion-ring" aria-hidden />
          </>
        )}
        <svg
          viewBox="0 0 24 24"
          width={px}
          height={px}
          className="streak-flicker"
          aria-hidden
        >
          <defs>
            <linearGradient id={`sf-grad-${t}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={cfg.stops[0]} />
              <stop offset="45%" stopColor={cfg.stops[1]} />
              <stop offset="80%" stopColor={cfg.stops[2]} />
              <stop offset="100%" stopColor={cfg.stops[3]} />
            </linearGradient>
            <linearGradient id={`sf-core-${t}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={cfg.core[0]} stopOpacity="0.95" />
              <stop offset="60%"  stopColor={cfg.core[1]} stopOpacity="0.85" />
              <stop offset="100%" stopColor={cfg.stops[2]} stopOpacity="0" />
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
        {Array.from({ length: cfg.particles }).map((_, i) => (
          <span
            key={i}
            className="streak-particle"
            style={{
              ["--px" as any]: `${(i % 2 === 0 ? -1 : 1) * (4 + (i * 2) % 6)}px`,
              ["--py" as any]: `${-12 - (i * 2)}px`,
              ["--pcolor" as any]: cfg.particle,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
      </span>
      {showCount && (
        <span
          className={cn(
            "tabular-nums font-semibold",
            cfg.text,
            size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
          )}
        >
          {streak}
        </span>
      )}
    </span>
  );
}
