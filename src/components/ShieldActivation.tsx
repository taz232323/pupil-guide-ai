import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  show: boolean;
  onDone?: () => void;
};

/**
 * Fullscreen premium "streak shield activated" effect.
 * - Pop-in shield with elastic bounce
 * - Side-to-side wiggle
 * - Blue/gold energy pulse rings
 * - Orbiting sparkle particles
 * - Diagonal shimmer sweep
 * - Subtle camera shake on the whole overlay
 */
export function ShieldActivation({ show, onDone }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!show) return;
    setMounted(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      onDone?.();
    }, 2200);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  const orbiters = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => {
        const angle = (360 / 10) * i + Math.random() * 18;
        const radius = 110 + Math.random() * 40;
        const size = 6 + Math.random() * 6;
        const delay = 120 + i * 35;
        const duration = 1200 + Math.random() * 400;
        const gold = i % 2 === 0;
        return { angle, radius, size, delay, duration, gold };
      }),
    [mounted]
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      {/* Camera shake wrapper */}
      <div className="relative shield-shake" style={{ width: 0, height: 0 }}>
        {/* Soft backdrop glow */}
        <div className="shield-backdrop" />

        {/* Expanding energy pulse rings */}
        <div className="shield-pulse shield-pulse-1" />
        <div className="shield-pulse shield-pulse-2" />
        <div className="shield-pulse shield-pulse-3" />

        {/* Conic gold rays */}
        <div className="shield-rays" />

        {/* Shield with wiggle */}
        <div className="shield-wiggle">
          <div className="shield-pop">
            <svg
              width="180"
              height="200"
              viewBox="0 0 180 200"
              className="shield-svg"
            >
              <defs>
                <linearGradient id="sh-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9bd2ff" />
                  <stop offset="55%" stopColor="#3a8bff" />
                  <stop offset="100%" stopColor="#1d4fb8" />
                </linearGradient>
                <linearGradient id="sh-stroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff4b8" />
                  <stop offset="50%" stopColor="#ffd24a" />
                  <stop offset="100%" stopColor="#b8860b" />
                </linearGradient>
                <linearGradient id="sh-shimmer" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="45%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.85)" />
                  <stop offset="55%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
                <clipPath id="sh-clip">
                  <path d="M90 6 L168 32 L168 96 C168 142 134 178 90 194 C46 178 12 142 12 96 L12 32 Z" />
                </clipPath>
              </defs>

              {/* Shield body */}
              <path
                d="M90 6 L168 32 L168 96 C168 142 134 178 90 194 C46 178 12 142 12 96 L12 32 Z"
                fill="url(#sh-fill)"
                stroke="url(#sh-stroke)"
                strokeWidth="5"
                strokeLinejoin="round"
              />

              {/* Inner highlight */}
              <path
                d="M90 22 L150 42 L150 96 C150 134 122 164 90 178 C58 164 30 134 30 96 L30 42 Z"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />

              {/* Checkmark */}
              <path
                d="M60 96 L84 120 L124 76"
                fill="none"
                stroke="#fffbe6"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 6px rgba(255,235,160,0.85))" }}
              />

              {/* Shimmer sweep clipped to shield */}
              <g clipPath="url(#sh-clip)">
                <rect
                  className="shield-shimmer"
                  x="-220"
                  y="-20"
                  width="160"
                  height="260"
                  fill="url(#sh-shimmer)"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Orbiting sparkles */}
        {orbiters.map((o, idx) => (
          <span
            key={idx}
            className="shield-orbit"
            style={
              {
                width: `${o.size}px`,
                height: `${o.size}px`,
                animationDelay: `${o.delay}ms`,
                animationDuration: `${o.duration}ms`,
                ["--angle" as any]: `${o.angle}deg`,
                ["--radius" as any]: `${o.radius}px`,
                background: o.gold
                  ? "radial-gradient(circle, #fffbe6 0%, #ffd24a 55%, transparent 75%)"
                  : "radial-gradient(circle, #ffffff 0%, #7fc1ff 55%, transparent 75%)",
                boxShadow: o.gold
                  ? "0 0 10px rgba(255, 210, 74, 0.95)"
                  : "0 0 10px rgba(127, 193, 255, 0.95)",
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>,
    document.body
  );
}

export default ShieldActivation;