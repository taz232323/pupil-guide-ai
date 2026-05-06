import { cn } from "@/lib/utils";
import wizardHatImg from "@/assets/cosmetics/wizard-hat.png";

// Shared catalog mapping cosmetic item keys to their emoji glyph.
export const COSMETIC_EMOJI: Record<string, string> = {
  hat_wizard: "🧙",
  glasses: "🕶️",
  crown_silver: "👑",
  halo: "😇",
  robot: "🤖",
  rainbow_aura: "🌈",
};

// Image-backed cosmetics override the emoji glyph with a transparent PNG/SVG.
const COSMETIC_IMAGE: Record<string, string> = {
  hat_wizard: wizardHatImg,
};

// Z-index ordering for cosmetic layers. Higher = rendered on top.
// Background sits behind the base avatar; face/hair/accessories stack above.
const COSMETIC_LAYERS: Record<
  string,
  { z: number; position: string; layer: "background" | "face" | "hair" | "accessory" }
> = {
  rainbow_aura: { z: 0,  position: "inset-0",                                  layer: "background" },
  glasses:      { z: 20, position: "inset-0 flex items-center justify-center", layer: "face" },
  robot:        { z: 20, position: "inset-0 flex items-center justify-center", layer: "face" },
  halo:         { z: 30, position: "-top-3 left-1/2 -translate-x-1/2",         layer: "hair" },
  hat_wizard:   { z: 30, position: "-top-3 left-1/2 -translate-x-1/2",         layer: "hair" },
  crown_silver: { z: 30, position: "-top-3 left-1/2 -translate-x-1/2",         layer: "hair" },
};

const SIZE_CLASS = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-12 w-12 text-lg",
  lg: "h-24 w-24 text-3xl",
};

export type AvatarSize = keyof typeof SIZE_CLASS;

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export const StudentAvatar = ({
  name,
  items = [],
  size = "sm",
  className,
}: {
  name?: string | null;
  items?: string[] | null;
  size?: AvatarSize;
  className?: string;
}) => {
  const equipped = (items ?? []).filter((k) => COSMETIC_EMOJI[k]);
  const hasAura = equipped.includes("rainbow_aura");

  // Sort by z so layers render bottom → top in DOM order too.
  const sorted = [...equipped].sort(
    (a, b) => (COSMETIC_LAYERS[a]?.z ?? 10) - (COSMETIC_LAYERS[b]?.z ?? 10)
  );

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 align-middle",
        SIZE_CLASS[size],
        className
      )}
      aria-label={name ?? "Avatar"}
    >
      {/* Base avatar — bottom layer */}
      <span
        className={cn(
          "relative z-10 inline-flex h-full w-full items-center justify-center rounded-full bg-secondary text-secondary-foreground font-medium",
          hasAura && "ring-2 ring-offset-1 ring-offset-background ring-pink-400"
        )}
      >
        {initials(name)}
      </span>

      {/* Cosmetic overlay container — does not affect layout size */}
      <span
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {sorted.map((key) => {
          const cfg = COSMETIC_LAYERS[key] ?? { z: 20, position: "inset-0 flex items-center justify-center", layer: "accessory" as const };
          const img = COSMETIC_IMAGE[key];
          if (img) {
            // Image cosmetic: ~70% of avatar width, centered, sits above the head.
            return (
              <span
                key={key}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ zIndex: cfg.z, top: "-22%", width: "70%" }}
              >
                <img
                  src={img}
                  alt=""
                  className="block w-full h-auto pointer-events-none select-none"
                  draggable={false}
                />
              </span>
            );
          }
          return (
            <span
              key={key}
              className={cn("absolute leading-none", cfg.position)}
              style={{ zIndex: cfg.z }}
            >
              {COSMETIC_EMOJI[key]}
            </span>
          );
        })}
      </span>
    </span>
  );
};
