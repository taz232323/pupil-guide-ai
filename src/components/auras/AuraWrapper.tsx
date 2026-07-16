import { lazy, Suspense } from "react";

const Aurora = lazy(() => import("./Aurora"));

/**
 * Central registry of animated (WebGL/React) auras.
 * Static image-based auras remain in StudentAvatar's AURA_OVERLAY.
 * Add a new entry here to introduce another ReactBits aura with minimal code changes.
 */
export const ANIMATED_AURAS: Record<string, () => JSX.Element> = {
  aura_aurora: () => (
    <Aurora
      colorStops={["#7cff67", "#B497CF", "#5227FF"]}
      blend={0.5}
      amplitude={1.0}
      speed={1}
    />
  ),
};

export function isAnimatedAura(key: string | undefined | null): boolean {
  return !!key && key in ANIMATED_AURAS;
}

/**
 * Circular animated aura, clipped to a circle around the avatar.
 * Includes a 250ms fade-in + glow burst when equipped, plus a periodic shimmer.
 */
export function AuraWrapper({ auraKey }: { auraKey: string }) {
  const render = ANIMATED_AURAS[auraKey];
  if (!render) return null;
  return (
    <span
      aria-hidden
      className="absolute inset-0 pointer-events-none select-none aura-animated-enter"
      style={{
        zIndex: 0,
        borderRadius: "9999px",
        overflow: "hidden",
        // Slight outward glow so the aura reads as a wearable halo.
        boxShadow:
          "0 0 24px 2px rgba(124,255,103,0.25), 0 0 40px 6px rgba(82,39,255,0.20)",
      }}
    >
      <span className="absolute inset-0 aura-shimmer">
        <Suspense fallback={null}>{render()}</Suspense>
      </span>
    </span>
  );
}