import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Slow-drifting background particles for the landing hero. Small dots rise
 * upward at varying speeds and opacities. Transform/opacity only; renders
 * nothing under reduced motion.
 */
export function HeroParticles({ count = 28, className }: { count?: number; className?: string }) {
  const reduced = prefersReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic pseudo-random spread (no Math.random at render).
        const seed = (i * 9301 + 49297) % 233280;
        const r = seed / 233280;
        const r2 = ((i * 4099 + 7919) % 233280) / 233280;
        const r3 = ((i * 1741 + 5557) % 233280) / 233280;
        const size = 2 + r2 * 4;
        return {
          id: i,
          left: r * 100,
          size,
          duration: 12 + r3 * 16,
          delay: -r * 22,
          opacity: 0.25 + r2 * 0.45,
          purple: i % 3 === 0,
        };
      }),
    [count],
  );

  if (reduced) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="float-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.purple ? "hsl(var(--plum) / 0.7)" : "hsl(var(--primary) / 0.7)",
            ["--p-duration" as never]: `${p.duration}s`,
            ["--p-delay" as never]: `${p.delay}s`,
            ["--p-opacity" as never]: p.opacity,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default HeroParticles;
