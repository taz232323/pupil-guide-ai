import * as React from "react";
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

/**
 * Background / aura cosmetics. These render BEHIND the avatar circle,
 * clipped to a circle so they never overflow the avatar container.
 * Add new entries here (or load from DB) to swap textures later.
 */
const BACKGROUND_TEXTURES: Record<string, { background: string; ring?: string }> = {
  rainbow_aura: {
    background:
      "conic-gradient(from 0deg, #ff5b8a, #ffb648, #ffe156, #5be0a0, #4ec3ff, #a779ff, #ff5b8a)",
    ring: "ring-2 ring-offset-1 ring-offset-background ring-pink-400",
  },
  // Example future textures — uncomment / extend as needed:
  // galaxy_aura: { background: "radial-gradient(circle at 30% 30%, #6a5cff, #1a0033 70%)" },
  // gold_aura:   { background: "radial-gradient(circle, #ffe27a, #b8860b)" },
};

// Default position_config used when the DB row doesn't provide one.
export type CosmeticPositionConfig = {
  top?: string | number;
  left?: string | number;
  scale?: number;
  rotation?: number; // degrees
  width?: string | number; // % of avatar width
  zIndex?: number;
};

// Per-key fallback configs for built-in image cosmetics.
const DEFAULT_POSITION_CONFIG: Record<string, CosmeticPositionConfig> = {
  hat_wizard: { top: "-22%", left: "50%", width: "70%", scale: 1, rotation: 0, zIndex: 30 },
};

/**
 * Render a cosmetic image positioned via a position_config object
 * (typically loaded from the `cosmetics.position_config` JSON column).
 * Supports: top, left, scale, rotation, width, zIndex.
 */
export function cosmeticStyleFromConfig(cfg: CosmeticPositionConfig | undefined | null): React.CSSProperties {
  const c = cfg ?? {};
  const scale = c.scale ?? 1;
  const rotation = c.rotation ?? 0;
  return {
    position: "absolute",
    top: c.top ?? "-20%",
    left: c.left ?? "50%",
    width: c.width ?? "70%",
    zIndex: c.zIndex ?? 20,
    // Combine centering + scale + rotation
    transform: `translateX(-50%) scale(${scale}) rotate(${rotation}deg)`,
    transformOrigin: "center center",
    pointerEvents: "none",
  };
}

// Z-index ordering for cosmetic layers. Higher = rendered on top.
// Background sits behind the base avatar; face/hair/accessories stack above.
// Layer scale: background < base avatar (z-10) < face/accessory < hair.
export type CosmeticLayer = "background" | "face" | "hair" | "accessory";

export const COSMETIC_LAYERS: Record<
  string,
  { z: number; position: string; layer: CosmeticLayer }
> = {
  rainbow_aura: { z: 0,  position: "inset-0",                                  layer: "background" },
  glasses:      { z: 20, position: "inset-0 flex items-center justify-center", layer: "face" },
  robot:        { z: 20, position: "inset-0 flex items-center justify-center", layer: "face" },
  halo:         { z: 30, position: "-top-3 left-1/2 -translate-x-1/2",         layer: "hair" },
  hat_wizard:   { z: 30, position: "-top-3 left-1/2 -translate-x-1/2",         layer: "hair" },
  crown_silver: { z: 30, position: "-top-3 left-1/2 -translate-x-1/2",         layer: "hair" },
};

/** Returns the layer (hat/face/aura/etc.) for a cosmetic key. */
export function getCosmeticLayer(key: string): CosmeticLayer {
  return COSMETIC_LAYERS[key]?.layer ?? "accessory";
}

/**
 * Normalize an equipped list:
 * - drops unknown items (missing from catalog → fail-safe)
 * - removes duplicates
 * - keeps only ONE item per layer (last-equipped wins)
 */
export function normalizeEquipped(items: string[] | null | undefined): string[] {
  const seenLayers = new Set<CosmeticLayer>();
  const seenKeys = new Set<string>();
  const out: string[] = [];
  // Iterate in reverse so the LAST equipped of a given layer wins.
  for (const key of [...(items ?? [])].reverse()) {
    if (!key || seenKeys.has(key)) continue;
    if (!COSMETIC_EMOJI[key] && !COSMETIC_IMAGE[key] && !BACKGROUND_TEXTURES[key]) continue;
    const layer = getCosmeticLayer(key);
    if (seenLayers.has(layer)) continue;
    seenLayers.add(layer);
    seenKeys.add(key);
    out.unshift(key);
  }
  return out;
}

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
  positionConfigs,
}: {
  name?: string | null;
  items?: string[] | null;
  size?: AvatarSize;
  className?: string;
  /**
   * Optional map of cosmetic key -> position_config loaded from the DB.
   * Overrides the built-in defaults so different hats/glasses can be
   * positioned without code changes.
   */
  positionConfigs?: Record<string, CosmeticPositionConfig | null | undefined>;
}) => {
  // Constraint: one per layer, no dupes, unknown keys silently dropped.
  const equipped = normalizeEquipped(items);
  const [brokenAssets, setBrokenAssets] = React.useState<Set<string>>(() => new Set());

  // Pick the active background cosmetic (only one allowed by normalizeEquipped).
  const activeBackgroundKey = equipped.find((k) => BACKGROUND_TEXTURES[k]);
  const activeBackground = activeBackgroundKey ? BACKGROUND_TEXTURES[activeBackgroundKey] : null;

  // Foreground cosmetics only — backgrounds are rendered separately below.
  const sorted = [...equipped]
    .filter((k) => !BACKGROUND_TEXTURES[k])
    .sort((a, b) => (COSMETIC_LAYERS[a]?.z ?? 10) - (COSMETIC_LAYERS[b]?.z ?? 10));

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 align-middle",
        SIZE_CLASS[size],
        className
      )}
      aria-label={name ?? "Avatar"}
    >
      {/* Background / aura layer — behind the avatar, clipped to a circle */}
      {activeBackground && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
          style={{ zIndex: 0, background: activeBackground.background }}
        />
      )}

      {/* Base avatar — bottom layer */}
      <span
        className={cn(
          "relative z-10 inline-flex h-full w-full items-center justify-center rounded-full bg-secondary text-secondary-foreground font-medium",
          activeBackground?.ring
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
          // If the image asset previously failed to load, fall back to emoji.
          if (img && !brokenAssets.has(key)) {
            // Image cosmetic — positioned dynamically from position_config
            // (DB row) with a built-in default fallback per key.
            const posCfg =
              positionConfigs?.[key] ?? DEFAULT_POSITION_CONFIG[key] ?? { zIndex: cfg.z };
            return (
              <span key={key} style={cosmeticStyleFromConfig(posCfg)}>
                <img
                  src={img}
                  alt=""
                  className="block w-full h-auto pointer-events-none select-none"
                  draggable={false}
                  onError={() => {
                    setBrokenAssets((prev) => {
                      const next = new Set(prev);
                      next.add(key);
                      return next;
                    });
                  }}
                />
              </span>
            );
          }
          // Emoji fallback — also used when no glyph exists at all.
          const glyph = COSMETIC_EMOJI[key];
          if (!glyph) return null; // missing asset → render nothing rather than break UI
          return (
            <span
              key={key}
              className={cn("absolute leading-none", cfg.position)}
              style={{ zIndex: cfg.z }}
            >
              {glyph}
            </span>
          );
        })}
      </span>
    </span>
  );
};
