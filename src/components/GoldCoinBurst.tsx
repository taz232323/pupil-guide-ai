import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Trigger key — changing it replays the burst. */
  triggerKey: string | number;
  /** Approximate number of coins. */
  count?: number;
};

type Coin = {
  id: number;
  size: number;
  tx: number;
  peak: number;
  floor: number;
  rotZ: number;
  spinDur: number;
  delay: number;
  duration: number;
  z: number; // depth — bigger = closer
  hueShift: number;
};

/**
 * Premium gold-coin burst overlay used in place of confetti.
 * Pure DOM/CSS — GPU accelerated via transform/opacity only.
 */
export function GoldCoinBurst({ triggerKey, count = 26 }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2100);
    return () => clearTimeout(t);
  }, [triggerKey]);

  const coins = useMemo<Coin[]>(() => {
    const arr: Coin[] = [];
    for (let i = 0; i < count; i++) {
      const close = Math.random() < 0.18; // ~5 "foreground" coins
      const size = close
        ? 56 + Math.random() * 28
        : 22 + Math.random() * 22;
      const angle = (Math.random() - 0.5) * Math.PI * 0.95; // -85°..85° from up
      const power = 180 + Math.random() * 220;
      arr.push({
        id: i,
        size,
        tx: Math.sin(angle) * power * (close ? 1.4 : 1),
        peak: -(220 + Math.random() * 180) * (close ? 1.2 : 1),
        floor: 280 + Math.random() * 220,
        rotZ: (Math.random() - 0.5) * 540,
        spinDur: 400 + Math.random() * 500,
        delay: Math.random() * 180,
        duration: 1400 + Math.random() * 350,
        z: close ? 2 : 1,
        hueShift: (Math.random() - 0.5) * 12,
      });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey, count]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 280,
        y: -40 - Math.random() * 220,
        delay: Math.random() * 400,
        size: 4 + Math.random() * 6,
      })),
    [triggerKey]
  );

  if (!visible) return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
    >
      {/* Gold flash */}
      <div className="gcb-flash absolute inset-0" />

      {/* Light rays from emission point */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="gcb-rays" />
        <div className="gcb-glow" />

        {/* Sparkles */}
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="gcb-sparkle"
            style={{
              width: s.size,
              height: s.size,
              ["--sx" as any]: `${s.x}px`,
              ["--sy" as any]: `${s.y}px`,
              animationDelay: `${s.delay}ms`,
            }}
          />
        ))}

        {/* Coins */}
        {coins.map((c) => (
          <span
            key={c.id}
            className="gcb-coin"
            style={{
              width: c.size,
              height: c.size,
              zIndex: c.z,
              filter: c.z === 2 ? "drop-shadow(0 8px 14px rgba(0,0,0,0.35))" : undefined,
              ["--tx" as any]: `${c.tx}px`,
              ["--peak" as any]: `${c.peak}px`,
              ["--floor" as any]: `${c.floor}px`,
              ["--rotZ" as any]: `${c.rotZ}deg`,
              ["--spin" as any]: `${c.spinDur}ms`,
              animationDelay: `${c.delay}ms`,
              animationDuration: `${c.duration}ms`,
            }}
          >
            <span
              className="gcb-coin-face"
              style={{ animationDuration: `${c.spinDur}ms` }}
            />
          </span>
        ))}
      </div>
    </div>,
    document.body
  );
}

export default GoldCoinBurst;