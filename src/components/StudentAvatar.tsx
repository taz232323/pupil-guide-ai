import * as React from "react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import { cn } from "@/lib/utils";
import magicAuraImg from "@/assets/avatar/layers/aura-magic.svg";
import rainbowAuraImg from "@/assets/avatar/layers/aura-rainbow.svg";
import headwearWizardImg from "@/assets/avatar/layers/headwear-wizard.svg";
import headwearHaloImg from "@/assets/avatar/layers/headwear-halo.svg";
import headwearCrownSilverImg from "@/assets/avatar/layers/headwear-crown-silver.svg";

/* ------------------------------------------------------------------ *
 *  Avatar state model (DiceBear Avataaars + Grapheion cosmetics)
 * ------------------------------------------------------------------ */

export type AvatarState = {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyes: string;
  clothing: string;
  clothesColor: string;
  /** Cosmetic overlay headwear (wizard hat, halo, crown). Empty = none. */
  headwear: string;
  /** DiceBear accessory (glasses/sunglasses). Empty = none. */
  accessory: string;
  /** Background aura. */
  aura: string;
};

export type AvatarCategory = keyof AvatarState;

export const DEFAULT_AVATAR_STATE: AvatarState = {
  skinTone: "skin_light",
  hairStyle: "hairstyle_short",
  hairColor: "hair_brown",
  eyes: "eyes_default",
  clothing: "clothes_hoodie",
  clothesColor: "clothes_purple",
  headwear: "",
  accessory: "",
  aura: "aura_magic",
};

/* ---------- DiceBear option mappings ---------- */

const SKIN_HEX: Record<string, string> = {
  skin_light: "ffdbb4",
  skin_tan: "edb98a",
  skin_brown: "d08b5b",
  skin_deep: "614335",
};

const HAIR_HEX: Record<string, string> = {
  hair_brown: "724133",
  hair_black: "2c1b18",
  hair_blonde: "b58143",
  hair_red: "c93305",
};

const HAIR_TOP: Record<string, string> = {
  hairstyle_short: "shortHairShortFlat",
  hairstyle_long: "longButNotTooLong",
  hairstyle_curly: "curly",
  hairstyle_bun: "bun",
  hairstyle_buzz: "shortHairShortRound",
  hairstyle_dreads: "dreads",
  hairstyle_big: "bigHair",
};

const EYES_MAP: Record<string, string> = {
  eyes_default: "default",
  eyes_happy: "happy",
  eyes_wink: "wink",
  eyes_squint: "squint",
  eyes_hearts: "hearts",
};

const CLOTHING_MAP: Record<string, string> = {
  clothes_hoodie: "hoodie",
  clothes_blazer: "blazerAndShirt",
  clothes_shirt: "shirtCrewNeck",
  clothes_vneck: "shirtVNeck",
  clothes_overall: "overall",
  clothes_collar: "collarAndSweater",
};

const CLOTHES_HEX: Record<string, string> = {
  clothes_purple: "6d3bd1",
  clothes_blue: "5199e4",
  clothes_green: "a7ffc4",
  clothes_red: "ff5c5c",
  clothes_black: "262e33",
  clothes_white: "ffffff",
  // legacy keys
  shirt_purple: "6d3bd1",
  shirt_blue: "5199e4",
  shirt_green: "a7ffc4",
  shirt_red: "ff5c5c",
};

const DICEBEAR_ACCESSORIES: Record<string, string> = {
  glasses: "prescription02",
  sunglasses: "sunglasses",
  wayfarers: "wayfarers",
  round_glasses: "round",
};

/* Cosmetic overlay assets (rendered on top of dicebear svg). */
const HEADWEAR_OVERLAY: Record<
  string,
  { src: string; top: string; widthPct: number }
> = {
  hat_wizard: { src: headwearWizardImg, top: "-18%", widthPct: 62 },
  halo: { src: headwearHaloImg, top: "-6%", widthPct: 58 },
  crown_silver: { src: headwearCrownSilverImg, top: "-4%", widthPct: 52 },
};

const AURA_OVERLAY: Record<string, string> = {
  aura_magic: magicAuraImg,
  rainbow_aura: rainbowAuraImg,
};

/* Reverse category lookup for legacy items[] arrays. */
export const AVATAR_ITEM_CATEGORY: Record<string, AvatarCategory> = {};
for (const k of Object.keys(SKIN_HEX)) AVATAR_ITEM_CATEGORY[k] = "skinTone";
for (const k of Object.keys(HAIR_HEX)) AVATAR_ITEM_CATEGORY[k] = "hairColor";
for (const k of Object.keys(HAIR_TOP)) AVATAR_ITEM_CATEGORY[k] = "hairStyle";
for (const k of Object.keys(EYES_MAP)) AVATAR_ITEM_CATEGORY[k] = "eyes";
for (const k of Object.keys(CLOTHING_MAP)) AVATAR_ITEM_CATEGORY[k] = "clothing";
for (const k of Object.keys(CLOTHES_HEX)) AVATAR_ITEM_CATEGORY[k] = "clothesColor";
for (const k of Object.keys(DICEBEAR_ACCESSORIES)) AVATAR_ITEM_CATEGORY[k] = "accessory";
for (const k of Object.keys(HEADWEAR_OVERLAY)) AVATAR_ITEM_CATEGORY[k] = "headwear";
for (const k of Object.keys(AURA_OVERLAY)) AVATAR_ITEM_CATEGORY[k] = "aura";
// extra accessory keys preserved for legacy
AVATAR_ITEM_CATEGORY["robot"] = "accessory";

/* Legacy emoji catalog (still referenced by Shop). */
export const COSMETIC_EMOJI: Record<string, string> = {
  hat_wizard: "🧙",
  glasses: "🕶️",
  crown_silver: "👑",
  halo: "😇",
  robot: "🤖",
  rainbow_aura: "🌈",
};

/* ---------- State helpers ---------- */

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
  return [
    state.skinTone,
    state.hairStyle,
    state.hairColor,
    state.eyes,
    state.clothing,
    state.clothesColor,
    state.headwear,
    state.accessory,
    state.aura,
  ].filter(Boolean);
}

export function updateAvatarState(state: AvatarState, key: string): AvatarState {
  const category = AVATAR_ITEM_CATEGORY[key];
  if (!category) return state;
  return { ...state, [category]: key };
}

export function clearAvatarCategory(state: AvatarState, category: AvatarCategory): AvatarState {
  // Optional-only categories truly clear; others fall back to defaults.
  if (category === "headwear" || category === "accessory") {
    return { ...state, [category]: "" };
  }
  return { ...state, [category]: DEFAULT_AVATAR_STATE[category] };
}

export function sameAvatarState(a: AvatarState, b: AvatarState): boolean {
  return avatarStateToItems(a).join("|") === avatarStateToItems(b).join("|");
}

export function normalizeEquipped(items: string[] | null | undefined): string[] {
  return avatarStateToItems(avatarStateFromItems(items));
}

/* ---------- DiceBear renderer ---------- */

type DicebearOpts = {
  state: AvatarState;
  seed: string;
  withAccessory: boolean;
  /** Hide hair (used when wizard hat covers the head). */
  hideHair?: boolean;
};

function buildDicebearOptions({ state, seed, withAccessory, hideHair }: DicebearOpts) {
  const skin = SKIN_HEX[state.skinTone] ?? SKIN_HEX.skin_light;
  const hairColorHex = HAIR_HEX[state.hairColor] ?? HAIR_HEX.hair_brown;
  const top = HAIR_TOP[state.hairStyle] ?? HAIR_TOP.hairstyle_short;
  const eyes = EYES_MAP[state.eyes] ?? "default";
  const clothing = CLOTHING_MAP[state.clothing] ?? "hoodie";
  const clothesHex = CLOTHES_HEX[state.clothesColor] ?? "6d3bd1";
  const accessory = withAccessory ? DICEBEAR_ACCESSORIES[state.accessory] : undefined;
  return {
    seed,
    skinColor: [skin],
    top: hideHair ? (["shortHairShortFlat"] as string[]) : [top],
    topProbability: hideHair ? 0 : 100,
    hairColor: [hairColorHex],
    eyes: [eyes] as string[],
    clothing: [clothing] as string[],
    clothesColor: [clothesHex],
    accessories: accessory ? [accessory] : undefined,
    accessoriesProbability: accessory ? 100 : 0,
    facialHairProbability: 0,
    backgroundColor: ["transparent"],
  };
}

/** Public: returns an SVG data URI for an avatar state. Memoize at call sites. */
export function getAvatarDataUri(state: AvatarState, seed = "grapheion"): string {
  const opts = buildDicebearOptions({
    state,
    seed,
    withAccessory: !!state.accessory && state.accessory !== "robot",
  });
  return createAvatar(avataaars, opts as any).toDataUri();
}

/* AVATAR_THUMBNAILS kept for backwards compat (Profile uses it for legacy keys). */
export const AVATAR_THUMBNAILS: Record<string, string> = {
  hat_wizard: headwearWizardImg,
  halo: headwearHaloImg,
  crown_silver: headwearCrownSilverImg,
  aura_magic: magicAuraImg,
  rainbow_aura: rainbowAuraImg,
};

/* ---------- Component ---------- */

const SIZE_CLASS = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-lg",
  lg: "h-24 w-24 text-3xl",
  xl: "h-40 w-40 text-5xl",
};

export type AvatarSize = keyof typeof SIZE_CLASS;

/* Backwards-compat exports referenced elsewhere */
export type CosmeticPositionConfig = {
  x?: number;
  y?: number;
  scale?: number;
  zIndex?: number;
};
export type AvatarLayerKey = "background" | "body" | "accessory" | "hat";
export type AvatarLayers = Partial<Record<AvatarLayerKey, string | null | undefined>>;
export type AvatarLayerFilters = Partial<Record<AvatarLayerKey, string>>;
export type AvatarLayerGeometry = CosmeticPositionConfig;
export type AvatarLayerGeometryMap = Partial<Record<AvatarLayerKey, AvatarLayerGeometry>>;

export const StudentAvatar = ({
  name,
  items = [],
  avatarState,
  size = "sm",
  className,
  frame = "card",
}: {
  name?: string | null;
  items?: string[] | null;
  avatarState?: AvatarState;
  size?: AvatarSize;
  className?: string;
  positionConfigs?: Record<string, CosmeticPositionConfig | null | undefined>;
  frame?: "card" | "circle";
}) => {
  const state = avatarState ?? avatarStateFromItems(items);
  const seed = (name && name.trim()) || "grapheion";

  // Wizard hat covers hair fully; halo/crown sit above hair so keep hair visible.
  const hideHair = state.headwear === "hat_wizard";
  const dataUri = React.useMemo(
    () => getAvatarDataUri({ ...state, headwear: "" }, seed) /* hat rendered as overlay */
      // We re-derive with hideHair semantics via a custom call below; keep simple here.
      ,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      seed,
      state.skinTone,
      state.hairStyle,
      state.hairColor,
      state.eyes,
      state.clothing,
      state.clothesColor,
      state.accessory,
    ]
  );

  const hatDataUri = React.useMemo(() => {
    if (!hideHair) return dataUri;
    return createAvatar(
      avataaars,
      buildDicebearOptions({ state, seed, withAccessory: !!state.accessory, hideHair: true }) as any
    ).toDataUri();
  }, [hideHair, dataUri, state, seed]);

  const auraSrc = AURA_OVERLAY[state.aura];
  const headwear = HEADWEAR_OVERLAY[state.headwear];

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
          "relative inline-flex h-full w-full items-center justify-center text-secondary-foreground font-medium overflow-hidden",
          shapeClass,
          frameDecor
        )}
      >
        {/* Aura background */}
        {auraSrc && (
          <img
            src={auraSrc}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-70 pointer-events-none select-none"
            style={{ zIndex: 0 }}
          />
        )}
        {/* DiceBear character */}
        <img
          src={hideHair ? hatDataUri : dataUri}
          alt=""
          draggable={false}
          className="relative h-full w-full object-contain object-bottom select-none pointer-events-none"
          style={{ zIndex: 10 }}
        />
        {/* Cosmetic headwear overlay */}
        {headwear && (
          <img
            src={headwear.src}
            alt=""
            draggable={false}
            className="absolute left-1/2 -translate-x-1/2 select-none pointer-events-none"
            style={{
              top: headwear.top,
              width: `${headwear.widthPct}%`,
              zIndex: 30,
              filter: "drop-shadow(0 2px 4px hsl(0 0% 0% / 0.25))",
            }}
          />
        )}
      </span>
    </span>
  );
};
