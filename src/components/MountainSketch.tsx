import { cn } from "@/lib/utils";

type Variant = "range" | "peak" | "path";

/**
 * Hand-drawn pencil-style mountain line art — Grapheion's signature motif.
 * Pure SVG strokes (currentColor) so it adapts to light/dark via text color.
 * Decorative only: aria-hidden, no pointer events.
 *
 *  - "range" : a wide mountain range with sun, clouds and pines (page headers)
 *  - "peak"  : a single tall peak with a summit flag (hero / class cards)
 *  - "path"  : rolling hill with a winding dashed trail to a flag (CTA bands)
 */
export function MountainSketch({
  variant = "range",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const common = {
    "aria-hidden": true as const,
    className: cn("pointer-events-none select-none", className),
    fill: "none" as const,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (variant === "peak") {
    return (
      <svg viewBox="0 0 220 170" strokeWidth={1.4} {...common}>
        <circle cx="170" cy="42" r="20" opacity="0.7" />
        <path d="M14 150 L78 54 L112 104 L140 70 L206 150 Z" />
        <path d="M64 76 L78 54 L92 76 L84 80 L78 70 L72 80 Z" opacity="0.8" />
        <path d="M126 86 L140 70 L154 90" opacity="0.7" />
        <path d="M40 150 v-16 M40 142 l-7 6 M40 138 l7 5" opacity="0.6" />
        <path d="M58 150 v-12 M58 144 l-5 5 M58 140 l5 4" opacity="0.5" />
        <path d="M8 150 H212" opacity="0.5" />
      </svg>
    );
  }

  if (variant === "path") {
    return (
      <svg viewBox="0 0 300 150" strokeWidth={1.4} {...common}>
        <path d="M6 132 C70 120 90 70 150 78 C210 86 236 116 294 104" opacity="0.6" />
        <path
          d="M40 138 C90 132 110 110 150 112 C196 114 214 96 250 86"
          strokeDasharray="2 7"
          opacity="0.8"
        />
        <path d="M250 86 v-26" />
        <path d="M250 60 l24 7 -24 8 Z" />
        <path d="M150 112 l9 -13 9 13 -6 2 -3 -5 -3 5 Z" opacity="0.7" />
        <path d="M86 124 l7 -10 7 10 -5 2 -2 -4 -2 4 Z" opacity="0.6" />
      </svg>
    );
  }

  // "range"
  return (
    <svg viewBox="0 0 360 150" strokeWidth={1.3} {...common}>
      <circle cx="286" cy="40" r="22" opacity="0.6" />
      <path d="M2 132 L70 52 L112 100 L150 66 L198 124 L238 92 L300 132 Z" />
      <path d="M58 70 L70 52 L82 70 L75 74 L70 65 L65 74 Z" opacity="0.85" />
      <path d="M136 84 L150 66 L164 86" opacity="0.7" />
      <path d="M250 70 q14 -10 28 0" opacity="0.5" />
      <path d="M236 56 q10 -7 20 0" opacity="0.4" />
      <path d="M40 132 v-15 M40 124 l-7 6 M40 120 l7 5 M40 128 l-5 4" opacity="0.6" />
      <path d="M320 132 v-13 M320 125 l-6 5 M320 121 l6 4" opacity="0.55" />
      <path d="M338 132 v-9 M338 127 l-4 4 M338 124 l4 3" opacity="0.45" />
      <path d="M0 132 H360" opacity="0.45" />
    </svg>
  );
}

export default MountainSketch;
