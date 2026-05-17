import * as React from "react";
import { cn } from "@/lib/utils";
import wizardHatImg from "@/assets/cosmetics/wizard-hat.png";
import glassesImg from "@/assets/cosmetics/glasses.png";
import crownSilverImg from "@/assets/cosmetics/crown-silver.png";
import haloImg from "@/assets/cosmetics/halo.png";
import robotImg from "@/assets/cosmetics/robot.png";

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
  glasses: glassesImg,
  crown_silver: crownSilverImg,
  halo: haloImg,
  robot: robotImg,
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
  glasses:    { top: "25%",  left: "50%", width: "55%", scale: 1, rotation: 0, zIndex: 20 },
  crown_silver:{ top: "-22%", left: "50%", width: "70%", scale: 1, rotation: 0, zIndex: 30 },
  halo:       { top: "-40%", left: "50%", width: "60%", scale: 1, rotation: 0, zIndex: 30 },
  robot:      { top: "10%",  left: "50%", width: "85%", scale: 1, rotation: 0, zIndex: 20 },
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

/**
 * Layered 2D avatar system — each part is rendered as an independent
 * transparent image layer absolutely positioned inside the avatar frame.
 * Z-index ordering goes background → body → shirt → eyes → hair → accessory → hat.
 * Pass a partial map; missing layers are simply skipped so cosmetics can be
 * swapped dynamically without reloading the page.
 */
export type AvatarLayerKey =
  | "background"
  | "body"
  | "shirt"
  | "eyes"
  | "hair"
  | "accessory"
  | "hat";

export type AvatarLayers = Partial<Record<AvatarLayerKey, string | null | undefined>>;

export const AVATAR_LAYER_Z: Record<AvatarLayerKey, number> = {
  background: 0,
  body: 10,
  shirt: 20,
  eyes: 30,
  hair: 40,
  accessory: 50,
  hat: 60,
};

// Render order matches z-index; explicit list keeps DOM order stable.
const LAYER_ORDER: AvatarLayerKey[] = [
  "background",
  "body",
  "shirt",
  "eyes",
  "hair",
  "accessory",
  "hat",
];

/**
 * Per-layer geometry. All layers share the same square frame; these values
 * normalize their position/size against that frame so cosmetics from different
 * art passes still line up on one base character. Heights are % of frame.
 */
export const AVATAR_LAYER_STYLE: Record<AvatarLayerKey, React.CSSProperties> = {
  background: { inset: 0 },
  body:       { inset: 0 },
  shirt:      { inset: 0 },
  eyes:       { inset: 0 },
  hair:       { top: "-2%", left: 0, right: 0, height: "100%" },
  accessory:  { inset: 0 },
  // Headwear sits on top of the head — small, anchored to the top of the frame.
  hat:        { top: "-8%", left: "50%", width: "55%", height: "55%", transform: "translateX(-50%)" },
};

/** Optional per-layer CSS filter (used to tint skin / hair / shirt). */
export type AvatarLayerFilters = Partial<Record<AvatarLayerKey, string>>;

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
  xl: "h-40 w-40 text-5xl",
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
  frame = "card",
  baseImage,
  layers,
  layerFilters,
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
  /**
   * Visual container shape. "card" (default) renders a game-style rounded
   * square frame with soft depth so full-body character art is not clipped
   * into a circle. "circle" preserves the legacy circular mask.
   */
  frame?: "card" | "circle";
  /**
   * Optional transparent PNG/SVG character art rendered as the base avatar.
   * Cosmetics still layer above it using the existing z-index system.
   */
  baseImage?: string | null;
  /**
   * Multi-layer character system. Each provided URL is rendered as its own
   * absolutely-positioned transparent layer (background, body, shirt, eyes,
   * hair, accessory, hat). Layers scale proportionally with the avatar size
   * and stack via AVATAR_LAYER_Z. When provided, this takes precedence over
   * `baseImage` for the body slot but cosmetic items (hats, glasses, auras)
   * still render above using the legacy COSMETIC_LAYERS system.
   */
  layers?: AvatarLayers;
  /** Optional per-layer CSS filter strings (e.g. tinting skin/hair/shirt). */
  layerFilters?: AvatarLayerFilters;
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

  const shapeClass = frame === "circle" ? "rounded-full" : "rounded-2xl";
  const frameDecor =
    frame === "card"
      ? "border border-border/60 shadow-[0_6px_18px_-8px_hsl(var(--foreground)/0.35),inset_0_1px_0_hsl(var(--background)/0.6)] bg-gradient-to-b from-secondary/70 to-secondary"
      : "bg-secondary";

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
          className={cn("absolute inset-0 overflow-hidden pointer-events-none", shapeClass)}
          style={{ zIndex: 0, background: activeBackground.background }}
        />
      )}

      {/* Base avatar — bottom layer */}
      <span
        className={cn(
          "relative z-10 inline-flex h-full w-full items-center justify-center overflow-hidden text-secondary-foreground font-medium",
          shapeClass,
          frameDecor,
          activeBackground?.ring
        )}
      >
        {layers && Object.values(layers).some(Boolean) ? (
          // Layered character: each part renders as its own absolute layer.
          // The container is position:relative (this <span>), layers stack
          // by z-index and all scale proportionally via inset-0.
          <span className="relative block h-full w-full">
            {LAYER_ORDER.map((key) => {
              const src = layers[key];
              if (!src) return null;
              const geom = AVATAR_LAYER_STYLE[key];
              const filter = layerFilters?.[key];
              return (
                <img
                  key={key}
                  src={src}
                  alt=""
                  data-avatar-layer={key}
                  draggable={false}
                  className="absolute object-contain object-bottom select-none pointer-events-none"
                  style={{
                    ...geom,
                    zIndex: AVATAR_LAYER_Z[key],
                    filter,
                    width: geom.width ?? "100%",
                    height: geom.height ?? "100%",
                  }}
                />
              );
            })}
          </span>
        ) : baseImage ? (
          <img
            src={baseImage}
            alt=""
            className="h-full w-full object-contain object-bottom select-none pointer-events-none"
            draggable={false}
          />
        ) : (
          initials(name)
        )}
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
