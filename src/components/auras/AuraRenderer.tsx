import * as React from "react";
import Beams from "./Beams";

/**
 * Registry of "React-based" auras. Any aura key present here will be rendered
 * as a live React component *behind* the avatar instead of a static image.
 * Add more ReactBits auras below with minimal code.
 */
const REACT_AURAS: Record<string, React.ComponentType> = {
  aura_beams: () => (
    <Beams
      beamWidth={2}
      beamHeight={15}
      beamNumber={12}
      lightColor="#ffffff"
      speed={2}
      noiseIntensity={1.75}
      scale={0.2}
      rotation={30}
    />
  ),
};

export function isReactAura(key: string | undefined | null): boolean {
  return !!key && key in REACT_AURAS;
}

export function AuraRenderer({ auraKey }: { auraKey: string }) {
  const Aura = REACT_AURAS[auraKey];
  if (!Aura) return null;
  return (
    <div
      key={auraKey}
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none select-none aura-fade-in"
      style={{ zIndex: 0 }}
    >
      <Aura />
    </div>
  );
}