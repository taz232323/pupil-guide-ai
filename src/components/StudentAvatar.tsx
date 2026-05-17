import * as React from "react";
import { cn } from "@/lib/utils";
import magicAuraImg from "@/assets/avatar/layers/aura-magic.svg";
import rainbowAuraImg from "@/assets/avatar/layers/aura-rainbow.svg";
import bodySkinLightImg from "@/assets/avatar/layers/body-skin-light.svg";
import bodySkinTanImg from "@/assets/avatar/layers/body-skin-tan.svg";
import bodySkinBrownImg from "@/assets/avatar/layers/body-skin-brown.svg";
import bodySkinDeepImg from "@/assets/avatar/layers/body-skin-deep.svg";
import hairBrownImg from "@/assets/avatar/layers/hair-brown.svg";
import hairBlackImg from "@/assets/avatar/layers/hair-black.svg";
import hairBlondeImg from "@/assets/avatar/layers/hair-blonde.svg";
import hairRedImg from "@/assets/avatar/layers/hair-red.svg";
import shirtPurpleImg from "@/assets/avatar/layers/shirt-purple.svg";
import shirtBlueImg from "@/assets/avatar/layers/shirt-blue.svg";
import shirtGreenImg from "@/assets/avatar/layers/shirt-green.svg";
import shirtRedImg from "@/assets/avatar/layers/shirt-red.svg";
import headwearWizardImg from "@/assets/avatar/layers/headwear-wizard.svg";
import headwearHaloImg from "@/assets/avatar/layers/headwear-halo.svg";
import headwearCrownSilverImg from "@/assets/avatar/layers/headwear-crown-silver.svg";
import accessoryGlassesImg from "@/assets/avatar/layers/accessory-glasses.svg";
import accessoryRobotImg from "@/assets/avatar/layers/accessory-robot.svg";

// Shared catalog mapping cosmetic item keys to their emoji glyph.
export const COSMETIC_EMOJI: Record<string, string> = {
  hat_wizard: "🧙",
  glasses: "🕶️",
  crown_silver: "👑",
  halo: "😇",
  robot: "🤖",
  rainbow_aura: "🌈",
};

export type AvatarState = {
  skinTone: string;
  hair: string;
  clothing: string;
  headwear: string;
  accessory: string;
  aura: string;
};

export const DEFAULT_AVATAR_STATE: AvatarState = {
  skinTone: "skin_light",
  hair: "hair_brown",
  clothing: "shirt_purple",
  headwear: "",
  accessory: "",
  aura: "aura_magic",
};

export type AvatarCategory = keyof AvatarState;

export const AVATAR_ITEM_CATEGORY: Record<string, AvatarCategory> = {
  skin_light: "skinTone",
  skin_tan: "skinTone",
  skin_brown: "skinTone",
  skin_deep: "skinTone",
  hair_brown: "hair",
  hair_black: "hair",
  hair_blonde: "hair",
  hair_red: "hair",
  shirt_purple: "clothing",
  shirt_blue: "clothing",
  shirt_green: "clothing",
  shirt_red: "clothing",
  hat_wizard: "headwear",
  halo: "headwear",
  crown_silver: "headwear",
  glasses: "accessory",
  robot: "accessory",
  aura_magic: "aura",
  rainbow_aura: "aura",
};

export function avatarStateFromItems(items: string[] | null | undefined): AvatarState {
  const state: AvatarState = { ...DEFAULT_AVATAR_STATE };
  for (const key of items ?? []) {
    const category = AVATAR_ITEM_CATEGORY[key];
    if (!category) continue;
    state[category] = key;
  }
  return state;
}

export function avatarStateToItems(state: AvatarState): string[] {
  return [state.skinTone, state.hair, state.clothing, state.headwear, state.accessory, state.aura]
    .filter(Boolean);
}

export function updateAvatarState(state: AvatarState, key: string): AvatarState {
  const category = AVATAR_ITEM_CATEGORY[key];
  if (!category) return state;
  return { ...state, [category]: key };
}

export function clearAvatarCategory(state: AvatarState, category: AvatarCategory): AvatarState {
  if (category === "skinTone" || category === "hair" || category === "clothing" || category === "aura") {
    return { ...state, [category]: DEFAULT_AVATAR_STATE[category] };
  }
  return { ...state, [category]: "" };
}

export function sameAvatarState(a: AvatarState, b: AvatarState): boolean {
  return avatarStateToItems(a).join("|") === avatarStateToItems(b).join("|");
}

export type AvatarLayerKey =
  | "background"
  | "body"
  | "shirt"
  | "hair"
  | "accessory"
  | "hat";

export type AvatarLayers = Partial<Record<AvatarLayerKey, string | null | undefined>>;

export type AvatarLayerGeometry = {
  x?: number;
  y?: number;
  scale?: number;
  zIndex?: number;
};

export type AvatarLayerGeometryMap = Partial<Record<AvatarLayerKey, AvatarLayerGeometry>>;

export const AVATAR_LAYER_Z: Record<AvatarLayerKey, number> = {
  background: 0,
  body: 10,
  shirt: 20,
  hair: 30,
  accessory: 40,
  hat: 50,
};

const LAYER_ORDER: AvatarLayerKey[] = ["background", "body", "shirt", "hair", "accessory", "hat"];

export const DEFAULT_AVATAR_GEOMETRY: Record<AvatarLayerKey, Required<AvatarLayerGeometry>> = {
  background: { x: 0, y: 0, scale: 1, zIndex: AVATAR_LAYER_Z.background },
  body: { x: 0, y: 0, scale: 1, zIndex: AVATAR_LAYER_Z.body },
  shirt: { x: 0, y: 0, scale: 1, zIndex: AVATAR_LAYER_Z.shirt },
  hair: { x: 0, y: 0, scale: 1, zIndex: AVATAR_LAYER_Z.hair },
  accessory: { x: 0, y: 0, scale: 1, zIndex: AVATAR_LAYER_Z.accessory },
  hat: { x: 0, y: 0, scale: 1, zIndex: AVATAR_LAYER_Z.hat },
};

const AVATAR_ASSETS: Record<string, { layer: AvatarLayerKey; src: string; geometry?: AvatarLayerGeometry }> = {
  aura_magic: { layer: "background", src: magicAuraImg },
  rainbow_aura: { layer: "background", src: rainbowAuraImg },
  skin_light: { layer: "body", src: bodySkinLightImg },
  skin_tan: { layer: "body", src: bodySkinTanImg },
  skin_brown: { layer: "body", src: bodySkinBrownImg },
  skin_deep: { layer: "body", src: bodySkinDeepImg },
  hair_brown: { layer: "hair", src: hairBrownImg },
  hair_black: { layer: "hair", src: hairBlackImg },
  hair_blonde: { layer: "hair", src: hairBlondeImg },
  hair_red: { layer: "hair", src: hairRedImg },
  shirt_purple: { layer: "shirt", src: shirtPurpleImg },
  shirt_blue: { layer: "shirt", src: shirtBlueImg },
  shirt_green: { layer: "shirt", src: shirtGreenImg },
  shirt_red: { layer: "shirt", src: shirtRedImg },
  hat_wizard: { layer: "hat", src: headwearWizardImg },
  halo: { layer: "hat", src: headwearHaloImg },
  crown_silver: { layer: "hat", src: headwearCrownSilverImg },
  glasses: { layer: "accessory", src: accessoryGlassesImg },
  robot: { layer: "accessory", src: accessoryRobotImg },
};

export const AVATAR_THUMBNAILS: Record<string, string> = Object.fromEntries(
  Object.entries(AVATAR_ASSETS).map(([key, value]) => [key, value.src])
);

function layersFromState(state: AvatarState): AvatarLayers {
  const layers: AvatarLayers = {};
  for (const key of avatarStateToItems(state)) {
    const asset = AVATAR_ASSETS[key];
    if (asset) layers[asset.layer] = asset.src;
  }
  return layers;
}

function geometryFromState(state: AvatarState): AvatarLayerGeometryMap {
  const geometry: AvatarLayerGeometryMap = {};
  for (const key of avatarStateToItems(state)) {
    const asset = AVATAR_ASSETS[key];
    if (asset?.geometry) geometry[asset.layer] = asset.geometry;
  }
  return geometry;
}

// Legacy DB cosmetic configs are intentionally normalized into the shared canvas.
export type CosmeticPositionConfig = {
  x?: number;
  y?: number;
  scale?: number;
  zIndex?: number;
};

export type AvatarLayerFilters = Partial<Record<AvatarLayerKey, string>>;

export function normalizeEquipped(items: string[] | null | undefined): string[] {
  return avatarStateToItems(avatarStateFromItems(items));
}

const SIZE_CLASS = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-lg",
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

function layerStyle(key: AvatarLayerKey, geometry?: AvatarLayerGeometryMap): React.CSSProperties {
  const base = DEFAULT_AVATAR_GEOMETRY[key];
  const custom = geometry?.[key];
  const x = custom?.x ?? base.x;
  const y = custom?.y ?? base.y;
  const scale = Math.min(Math.max(custom?.scale ?? base.scale, 0.2), 1.15);
  return {
    inset: 0,
    zIndex: custom?.zIndex ?? base.zIndex,
    transform: `translate(${x}%, ${y}%) scale(${scale})`,
    transformOrigin: "50% 50%",
  };
}

export const StudentAvatar = ({
  name,
  items = [],
  avatarState,
  size = "sm",
  className,
  frame = "card",
  baseImage,
  layers,
  layerFilters,
  layerGeometry,
}: {
  name?: string | null;
  items?: string[] | null;
  avatarState?: AvatarState;
  size?: AvatarSize;
  className?: string;
  positionConfigs?: Record<string, CosmeticPositionConfig | null | undefined>;
  frame?: "card" | "circle";
  baseImage?: string | null;
  layers?: AvatarLayers;
  layerFilters?: AvatarLayerFilters;
  layerGeometry?: AvatarLayerGeometryMap;
}) => {
  const resolvedState = avatarState ?? avatarStateFromItems(items);
  const resolvedLayers = layers ?? layersFromState(resolvedState);
  const resolvedGeometry = layerGeometry ?? geometryFromState(resolvedState);
  const hasLayers = Object.values(resolvedLayers).some(Boolean);

  const shapeClass = frame === "circle" ? "rounded-full" : "rounded-2xl";
  const frameDecor =
    frame === "card"
      ? "border border-border/60 shadow-[0_6px_18px_-8px_hsl(var(--foreground)/0.35),inset_0_1px_0_hsl(var(--background)/0.6)] bg-gradient-to-b from-secondary/70 to-secondary"
      : "bg-secondary";

  return (
    <span
      className={cn("relative inline-flex shrink-0 align-middle", SIZE_CLASS[size], className)}
      aria-label={name ?? "Avatar"}
    >
      <span
        className={cn(
          "relative inline-flex h-full w-full items-center justify-center overflow-hidden text-secondary-foreground font-medium",
          shapeClass,
          frameDecor
        )}
      >
        {hasLayers ? (
          <span className="relative block aspect-square h-full w-full overflow-hidden">
            {LAYER_ORDER.map((key) => {
              const src = resolvedLayers[key];
              if (!src) return null;
              return (
                <img
                  key={key}
                  src={src}
                  alt=""
                  data-avatar-layer={key}
                  draggable={false}
                  className="absolute h-full w-full object-contain object-center select-none pointer-events-none"
                  style={{
                    ...layerStyle(key, resolvedGeometry),
                    filter: layerFilters?.[key],
                  }}
                />
              );
            })}
          </span>
        ) : baseImage ? (
          <img
            src={baseImage}
            alt=""
            className="h-full w-full object-contain object-center select-none pointer-events-none"
            draggable={false}
          />
        ) : (
          initials(name)
        )}
      </span>
    </span>
  );
};
