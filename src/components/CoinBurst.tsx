import { useEffect, useMemo, useState } from "react";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  /** Changing this value replays the burst. Use a falsy/0 initial value to stay idle. */
  trigger: number | string | null;
  /** Number of coin particles (8–12 recommended). */
  count?: number;
};

/**
 * Localized coin particle burst. Drop inside a `position: relative` container
 * near the award point. On each `trigger` change, 8–12 small coins scatter
 * outward in random directions (60–120px) and fade out over 600ms.
 * Transform/opacity only; disabled under reduced motion.
 */
export function CoinBurst({ trigger, count = 10 }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    if (prefersReducedMotion()) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 700);
    return () => clearTimeout(t);
  }, [trigger]);

  const particles = useMemo(() => {
    const n = Math.max(8, Math.min(12, count));
    return Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n + (i % 2 ? 0.4 : -0.3);
      const dist = 60 + ((i * 37) % 60); // 60–120px, deterministic per index
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        delay: (i % 4) * 25,
      };
    });
  }, [count, trigger]);

  if (!active) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {particles.map((p) => (
        <span
          key={p.id}
          className="coin-particle"
          style={{
            ["--cp-x" as never]: `${p.x}px`,
            ["--cp-y" as never]: `${p.y}px`,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

export default CoinBurst;
