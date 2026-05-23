import * as React from "react";
import { cn } from "@/lib/utils";
import magicAuraImg from "@/assets/avatar/layers/aura-magic.svg";
import rainbowAuraImg from "@/assets/avatar/layers/aura-rainbow.svg";
import headwearWizardImg from "@/assets/avatar/layers/headwear-wizard.svg";
import headwearHaloImg from "@/assets/avatar/layers/headwear-halo.svg";
import headwearCrownSilverImg from "@/assets/avatar/layers/headwear-crown-silver.svg";

/* ------------------------------------------------------------------ *
 *  Avatar state model — standing cartoon animals + Grapheion cosmetics
 * ------------------------------------------------------------------ */

export type AvatarState = {
  /** Animal species — drives silhouette (ears, snout, eyes). */
  species: string;
  /** Base fur color key (see FUR_HEX). */
  furColor: string;
  /** Fur pattern overlay: solid | striped | spotted | mixed. */
  furPattern: string;
  eyes: string;
  /** Shirt color worn on the upper torso. */
  clothesColor: string;
  /** Cosmetic overlay headwear (wizard hat, halo, crown). Empty = none. */
  headwear: string;
  /** Face accessory (glasses/sunglasses). Empty = none. */
  accessory: string;
  /** Background aura. */
  aura: string;
};

export type AvatarCategory = keyof AvatarState;
/** Legacy alias kept for backward compatibility with old imports. */
export type AvatarStyle = string;

export const DEFAULT_AVATAR_STATE: AvatarState = {
  species: "fox",
  furColor: "fur_orange",
  furPattern: "pattern_solid",
  eyes: "eyes_default",
  clothesColor: "clothes_purple",
  headwear: "",
  accessory: "",
  aura: "aura_magic",
};

/* ---------- Animal catalogs ---------- */

export type SpeciesKey = "owl" | "fox" | "cat" | "wolf" | "bear" | "rabbit";

export const SPECIES: Record<string, { key: SpeciesKey; name: string; defaultFur: string; allowedFur: string[] }> = {
  species_owl:    { key: "owl",    name: "Owl",    defaultFur: "fur_brown",  allowedFur: ["fur_brown", "fur_grey", "fur_white", "fur_black", "fur_cream"] },
  species_fox:    { key: "fox",    name: "Fox",    defaultFur: "fur_orange", allowedFur: ["fur_orange", "fur_red", "fur_grey", "fur_white", "fur_black"] },
  species_cat:    { key: "cat",    name: "Cat",    defaultFur: "fur_grey",   allowedFur: ["fur_grey", "fur_black", "fur_white", "fur_orange", "fur_cream", "fur_brown"] },
  species_wolf:   { key: "wolf",   name: "Wolf",   defaultFur: "fur_grey",   allowedFur: ["fur_grey", "fur_black", "fur_white", "fur_brown"] },
  species_bear:   { key: "bear",   name: "Bear",   defaultFur: "fur_brown",  allowedFur: ["fur_brown", "fur_black", "fur_cream", "fur_white"] },
  species_rabbit: { key: "rabbit", name: "Rabbit", defaultFur: "fur_white",  allowedFur: ["fur_white", "fur_grey", "fur_brown", "fur_cream", "fur_black"] },
};
const SPECIES_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIES).map(([k, v]) => [v.key, k])
);

export const FUR_HEX: Record<string, string> = {
  fur_orange: "#e87a35",
  fur_red:    "#b04a2a",
  fur_brown:  "#7a4a2a",
  fur_grey:   "#9aa3ab",
  fur_black:  "#2a2a2e",
  fur_white:  "#f1ece4",
  fur_cream:  "#e9d4ad",
};

export const FUR_PATTERNS: Record<string, string> = {
  pattern_solid:   "Solid",
  pattern_striped: "Striped",
  pattern_spotted: "Spotted",
  pattern_mixed:   "Mixed",
};

const EYES_KEYS = ["eyes_default", "eyes_happy", "eyes_wink", "eyes_sleepy", "eyes_star"] as const;
export const EYES_LABEL: Record<string, string> = {
  eyes_default: "Default",
  eyes_happy:   "Happy",
  eyes_wink:    "Wink",
  eyes_sleepy:  "Sleepy",
  eyes_star:    "Star",
};

export const CLOTHES_HEX: Record<string, string> = {
  clothes_purple: "#6d3bd1",
  clothes_blue:   "#5199e4",
  clothes_green:  "#65c98a",
  clothes_red:    "#ff5c5c",
  clothes_black:  "#262e33",
  clothes_white:  "#f5f5f5",
  clothes_yellow: "#f5c43b",
  clothes_pink:   "#ec7aa9",
  // legacy aliases
  shirt_purple: "#6d3bd1",
  shirt_blue:   "#5199e4",
  shirt_green:  "#65c98a",
  shirt_red:    "#ff5c5c",
};

const ACCESSORY_KEYS = ["glasses", "sunglasses", "wayfarers", "round_glasses"] as const;

/* Cosmetic overlay assets (rendered on top of dicebear svg). */
const HEADWEAR_OVERLAY: Record<
  string,
  { src: string; top: string; widthPct: number }
> = {
  hat_wizard:   { src: headwearWizardImg,     top: "-12%", widthPct: 62 },
  halo:         { src: headwearHaloImg,       top: "-4%",  widthPct: 58 },
  crown_silver: { src: headwearCrownSilverImg, top: "-2%", widthPct: 52 },
};

const AURA_OVERLAY: Record<string, string> = {
  aura_magic: magicAuraImg,
  rainbow_aura: rainbowAuraImg,
};

/* Reverse category lookup for legacy items[] arrays. */
export const AVATAR_ITEM_CATEGORY: Record<string, AvatarCategory> = {};
for (const k of Object.keys(SPECIES)) AVATAR_ITEM_CATEGORY[k] = "species";
for (const k of Object.keys(FUR_HEX)) AVATAR_ITEM_CATEGORY[k] = "furColor";
for (const k of Object.keys(FUR_PATTERNS)) AVATAR_ITEM_CATEGORY[k] = "furPattern";
for (const k of EYES_KEYS) AVATAR_ITEM_CATEGORY[k] = "eyes";
for (const k of Object.keys(CLOTHES_HEX)) AVATAR_ITEM_CATEGORY[k] = "clothesColor";
for (const k of ACCESSORY_KEYS) AVATAR_ITEM_CATEGORY[k] = "accessory";
for (const k of Object.keys(HEADWEAR_OVERLAY)) AVATAR_ITEM_CATEGORY[k] = "headwear";
for (const k of Object.keys(AURA_OVERLAY)) AVATAR_ITEM_CATEGORY[k] = "aura";

/** Legacy human-trait keys → silently mapped to nothing (ignored on load). */
const LEGACY_IGNORED = new Set<string>([
  // skin
  "skin_light","skin_tan","skin_brown","skin_deep",
  // hair colors
  "hair_brown","hair_black","hair_blonde","hair_red",
  // hair styles
  "male_short","male_messy","male_curly_short","male_fade","male_spiky","male_buzz","male_caesar",
  "female_long","female_ponytail","female_braids","female_wavy","female_bun","female_bob","female_big",
  "hairstyle_short","hairstyle_long","hairstyle_curly","hairstyle_bun","hairstyle_buzz","hairstyle_dreads","hairstyle_big",
  // style
  "style_male","style_female",
  // clothing types (we no longer track style — only color)
  "clothes_hoodie","clothes_blazer","clothes_shirt","clothes_vneck","clothes_overall","clothes_collar",
  // legacy eye / accessory variants
  "eyes_squint","eyes_hearts","robot",
]);
/** Legacy compat — kept so external imports don't break. */
export const STYLE_TO_KEY: Record<string, string> = {};

/* Legacy emoji catalog (still referenced by Shop). */
export const COSMETIC_EMOJI: Record<string, string> = {
  hat_wizard: "🧙",
  glasses: "🕶️",
  crown_silver: "👑",
  halo: "😇",
  rainbow_aura: "🌈",
};

/* ---------- State helpers ---------- */

export function avatarStateFromItems(items: string[] | null | undefined): AvatarState {
  const state: AvatarState = { ...DEFAULT_AVATAR_STATE };
  for (const key of items ?? []) {
    if (LEGACY_IGNORED.has(key)) continue;
    const category = AVATAR_ITEM_CATEGORY[key];
    if (!category) continue;
    (state as any)[category] = key;
  }
  // Make sure the chosen fur color is allowed for the species; otherwise fall back.
  const sp = SPECIES[state.species] ?? SPECIES.species_fox;
  if (!sp.allowedFur.includes(state.furColor)) {
    state.furColor = sp.defaultFur;
  }
  return state;
}

export function avatarStateToItems(state: AvatarState): string[] {
  return [
    state.species,
    state.furColor,
    state.furPattern,
    state.eyes,
    state.clothesColor,
    state.headwear,
    state.accessory,
    state.aura,
  ].filter(Boolean);
}

export function updateAvatarState(state: AvatarState, key: string): AvatarState {
  const category = AVATAR_ITEM_CATEGORY[key];
  if (!category) return state;
  if (category === "species") {
    if (state.species === key) return state;
    const sp = SPECIES[key];
    if (!sp) return state;
    const furOk = sp.allowedFur.includes(state.furColor);
    return {
      ...state,
      species: key,
      furColor: furOk ? state.furColor : sp.defaultFur,
    };
  }
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

/* ---------- Cartoon-animal SVG renderer ---------- */

function darken(hex: string, amt = 0.18): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(h.slice(0,2),16) * (1-amt)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2,4),16) * (1-amt)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4,6),16) * (1-amt)));
  return `#${[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}
function lighten(hex: string, amt = 0.4): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, Math.round(parseInt(h.slice(0,2),16) + (255-parseInt(h.slice(0,2),16))*amt));
  const g = Math.min(255, Math.round(parseInt(h.slice(2,4),16) + (255-parseInt(h.slice(2,4),16))*amt));
  const b = Math.min(255, Math.round(parseInt(h.slice(4,6),16) + (255-parseInt(h.slice(4,6),16))*amt));
  return `#${[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}

/**
 * Build the species-specific head + ears + facial features.
 * Anchored so the top of the head is at y≈12 across all species —
 * keeps cosmetic headwear aligned regardless of species.
 */
function speciesParts(species: string, fur: string, furDark: string, furLight: string) {
  const cx = 50;
  switch (species) {
    case "species_owl":
      return `
        <!-- ear tufts -->
        <path d="M30,18 L36,8 L42,20 Z" fill="${furDark}"/>
        <path d="M70,18 L64,8 L58,20 Z" fill="${furDark}"/>
        <!-- head -->
        <ellipse cx="${cx}" cy="40" rx="26" ry="28" fill="${fur}"/>
        <!-- face disc -->
        <ellipse cx="${cx}" cy="44" rx="20" ry="22" fill="${furLight}"/>
        <!-- beak -->
        <path d="M46,52 L54,52 L50,60 Z" fill="#f5b54a" stroke="${darken("#f5b54a",0.2)}" stroke-width="0.6"/>
      `;
    case "species_fox":
      return `
        <path d="M26,32 L22,12 L40,24 Z" fill="${fur}"/>
        <path d="M74,32 L78,12 L60,24 Z" fill="${fur}"/>
        <path d="M28,34 L26,18 L38,26 Z" fill="${furLight}"/>
        <path d="M72,34 L74,18 L62,26 Z" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="42" rx="24" ry="24" fill="${fur}"/>
        <path d="M34,52 Q50,68 66,52 Q60,62 50,64 Q40,62 34,52 Z" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="54" rx="4" ry="3.2" fill="${darken(fur,0.5)}"/>
      `;
    case "species_cat":
      return `
        <path d="M28,28 L24,12 L40,22 Z" fill="${fur}"/>
        <path d="M72,28 L76,12 L60,22 Z" fill="${fur}"/>
        <path d="M30,28 L28,18 L37,24 Z" fill="${furLight}"/>
        <path d="M70,28 L72,18 L63,24 Z" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="42" rx="24" ry="22" fill="${fur}"/>
        <ellipse cx="${cx}" cy="52" rx="10" ry="6" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="51" rx="2.4" ry="1.6" fill="${darken(fur,0.5)}"/>
        <!-- whiskers -->
        <line x1="38" y1="54" x2="28" y2="52" stroke="${darken(fur,0.4)}" stroke-width="0.6"/>
        <line x1="38" y1="56" x2="28" y2="58" stroke="${darken(fur,0.4)}" stroke-width="0.6"/>
        <line x1="62" y1="54" x2="72" y2="52" stroke="${darken(fur,0.4)}" stroke-width="0.6"/>
        <line x1="62" y1="56" x2="72" y2="58" stroke="${darken(fur,0.4)}" stroke-width="0.6"/>
      `;
    case "species_wolf":
      return `
        <path d="M24,28 L20,10 L40,22 Z" fill="${fur}"/>
        <path d="M76,28 L80,10 L60,22 Z" fill="${fur}"/>
        <path d="M26,28 L24,16 L37,24 Z" fill="${furLight}"/>
        <path d="M74,28 L76,16 L63,24 Z" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="42" rx="26" ry="24" fill="${fur}"/>
        <path d="M32,48 Q50,72 68,48 Q62,64 50,66 Q38,64 32,48 Z" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="56" rx="4.5" ry="3.4" fill="${darken(fur,0.55)}"/>
      `;
    case "species_bear":
      return `
        <circle cx="30" cy="22" r="8" fill="${fur}"/>
        <circle cx="70" cy="22" r="8" fill="${fur}"/>
        <circle cx="30" cy="22" r="4" fill="${furLight}"/>
        <circle cx="70" cy="22" r="4" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="42" rx="28" ry="26" fill="${fur}"/>
        <ellipse cx="${cx}" cy="52" rx="13" ry="9" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="50" rx="3.6" ry="2.6" fill="${darken(fur,0.55)}"/>
      `;
    case "species_rabbit":
      return `
        <ellipse cx="38" cy="14" rx="5" ry="14" fill="${fur}"/>
        <ellipse cx="62" cy="14" rx="5" ry="14" fill="${fur}"/>
        <ellipse cx="38" cy="16" rx="2.4" ry="10" fill="${furLight}"/>
        <ellipse cx="62" cy="16" rx="2.4" ry="10" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="44" rx="22" ry="22" fill="${fur}"/>
        <ellipse cx="${cx}" cy="54" rx="9" ry="5" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="52" rx="2.2" ry="1.5" fill="${darken(fur,0.4)}"/>
        <path d="M45,58 L50,62 L55,58" fill="none" stroke="${darken(fur,0.45)}" stroke-width="0.8" stroke-linecap="round"/>
      `;
  }
  return "";
}

function eyesSvg(kind: string, accent: string) {
  const L = 42, R = 58, Y = 42, sw = 1.6;
  switch (kind) {
    case "eyes_happy":
      return `
        <path d="M${L-4},${Y} Q${L},${Y-5} ${L+4},${Y}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
        <path d="M${R-4},${Y} Q${R},${Y-5} ${R+4},${Y}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    case "eyes_wink":
      return `
        <circle cx="${L}" cy="${Y}" r="2.4" fill="${accent}"/>
        <circle cx="${L-0.7}" cy="${Y-0.8}" r="0.7" fill="#ffffff"/>
        <path d="M${R-4},${Y+1} Q${R},${Y-4} ${R+4},${Y+1}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    case "eyes_sleepy":
      return `
        <path d="M${L-3.5},${Y} Q${L},${Y+2.5} ${L+3.5},${Y}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
        <path d="M${R-3.5},${Y} Q${R},${Y+2.5} ${R+3.5},${Y}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    case "eyes_star":
      return `
        <path d="M${L},${Y-3} L${L+0.9},${Y-0.9} L${L+3},${Y-0.6} L${L+1.2},${Y+0.8} L${L+1.7},${Y+3} L${L},${Y+1.6} L${L-1.7},${Y+3} L${L-1.2},${Y+0.8} L${L-3},${Y-0.6} L${L-0.9},${Y-0.9} Z" fill="#f5c43b" stroke="${accent}" stroke-width="0.4"/>
        <path d="M${R},${Y-3} L${R+0.9},${Y-0.9} L${R+3},${Y-0.6} L${R+1.2},${Y+0.8} L${R+1.7},${Y+3} L${R},${Y+1.6} L${R-1.7},${Y+3} L${R-1.2},${Y+0.8} L${R-3},${Y-0.6} L${R-0.9},${Y-0.9} Z" fill="#f5c43b" stroke="${accent}" stroke-width="0.4"/>`;
    case "eyes_default":
    default:
      return `
        <circle cx="${L}" cy="${Y}" r="2.6" fill="${accent}"/>
        <circle cx="${L-0.8}" cy="${Y-0.9}" r="0.8" fill="#ffffff"/>
        <circle cx="${R}" cy="${Y}" r="2.6" fill="${accent}"/>
        <circle cx="${R-0.8}" cy="${Y-0.9}" r="0.8" fill="#ffffff"/>`;
  }
}

function accessorySvg(kind: string) {
  switch (kind) {
    case "glasses":
      return `<g stroke="#1f242b" stroke-width="1.3" fill="none">
        <circle cx="42" cy="42" r="4.2" fill="#ffffff" fill-opacity="0.15"/>
        <circle cx="58" cy="42" r="4.2" fill="#ffffff" fill-opacity="0.15"/>
        <line x1="46.2" y1="42" x2="53.8" y2="42"/>
      </g>`;
    case "round_glasses":
      return `<g stroke="#1f242b" stroke-width="1.1" fill="none">
        <circle cx="42" cy="42" r="4.6" fill="#ffffff" fill-opacity="0.1"/>
        <circle cx="58" cy="42" r="4.6" fill="#ffffff" fill-opacity="0.1"/>
        <line x1="46.6" y1="42" x2="53.4" y2="42"/>
      </g>`;
    case "sunglasses":
      return `<g stroke="#0a0a0a" stroke-width="1" fill="#1a1a1a">
        <rect x="36" y="38" width="11" height="6" rx="2"/>
        <rect x="53" y="38" width="11" height="6" rx="2"/>
        <line x1="47" y1="41" x2="53" y2="41"/>
      </g>`;
    case "wayfarers":
      return `<g stroke="#0a0a0a" stroke-width="1" fill="#222831">
        <path d="M35,39 L48,39 L46,45 L37,45 Z"/>
        <path d="M52,39 L65,39 L63,45 L54,45 Z"/>
        <line x1="48" y1="40" x2="52" y2="40"/>
      </g>`;
    default:
      return "";
  }
}

function patternDefs(id: string, pattern: string, fur: string, dark: string) {
  switch (pattern) {
    case "pattern_striped":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(20)">
        <rect width="6" height="6" fill="${fur}"/>
        <rect width="6" height="2" fill="${dark}" opacity="0.55"/>
      </pattern>`;
    case "pattern_spotted":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="10" height="10">
        <rect width="10" height="10" fill="${fur}"/>
        <circle cx="3" cy="3" r="1.6" fill="${dark}" opacity="0.55"/>
        <circle cx="7" cy="7" r="1.2" fill="${dark}" opacity="0.45"/>
      </pattern>`;
    case "pattern_mixed":
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(15)">
        <rect width="12" height="12" fill="${fur}"/>
        <rect y="2" width="12" height="1.6" fill="${dark}" opacity="0.45"/>
        <circle cx="3" cy="8" r="1.4" fill="${dark}" opacity="0.5"/>
        <circle cx="9" cy="9" r="1" fill="${dark}" opacity="0.45"/>
      </pattern>`;
    case "pattern_solid":
    default:
      return "";
  }
}

function renderAvatarSvg(state: AvatarState): string {
  const sp = SPECIES[state.species] ?? SPECIES.species_fox;
  const fur = FUR_HEX[state.furColor] ?? FUR_HEX.fur_orange;
  const dark = darken(fur, 0.22);
  const light = lighten(fur, 0.35);
  const cloth = CLOTHES_HEX[state.clothesColor] ?? CLOTHES_HEX.clothes_purple;
  const clothDark = darken(cloth, 0.2);

  const hasPattern = state.furPattern && state.furPattern !== "pattern_solid";
  const patId = "fpat";
  const patternOverlay = hasPattern
    ? `<g clip-path="url(#bodyClip)"><rect x="0" y="0" width="100" height="120" fill="url(#${patId})"/></g>`
    : "";

  // Torso (upper body, shirt). Anchored at bottom of viewBox.
  const torso = `
    <!-- neck -->
    <rect x="44" y="62" width="12" height="6" fill="${dark}"/>
    <!-- shoulders/shirt -->
    <path d="M22,118 L22,86 Q22,72 36,70 L64,70 Q78,72 78,86 L78,118 Z"
          fill="${cloth}" stroke="${clothDark}" stroke-width="1"/>
    <!-- collar -->
    <path d="M40,70 Q50,78 60,70" fill="none" stroke="${clothDark}" stroke-width="1.2"/>
    <!-- arms hint -->
    <path d="M22,90 Q18,100 22,114" fill="none" stroke="${clothDark}" stroke-width="1"/>
    <path d="M78,90 Q82,100 78,114" fill="none" stroke="${clothDark}" stroke-width="1"/>
  `;

  // Body clip-path = head silhouette union (for fur pattern overlay)
  const bodyClipShapes = `
    <ellipse cx="50" cy="42" rx="28" ry="28"/>
    <ellipse cx="38" cy="14" rx="8" ry="16"/>
    <ellipse cx="62" cy="14" rx="8" ry="16"/>
  `;

  const parts = speciesParts(state.species, fur, dark, light);
  const eyes = eyesSvg(state.eyes, "#1a1f26");
  const acc = accessorySvg(state.accessory);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100%" height="100%">
  <defs>
    ${patternDefs(patId, state.furPattern, fur, dark)}
    <clipPath id="bodyClip">${bodyClipShapes}</clipPath>
  </defs>
  ${torso}
  ${parts}
  ${patternOverlay}
  ${eyes}
  ${acc}
</svg>`;
}

/** Public: returns an SVG data URI for an avatar state. Memoize at call sites. */
export function getAvatarDataUri(state: AvatarState, _seed = "grapheion"): string {
  const svg = renderAvatarSvg(state);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
  const dataUri = React.useMemo(
    () => getAvatarDataUri({ ...state, headwear: "" }) /* hat rendered as overlay */,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.species,
      state.furColor,
      state.furPattern,
      state.eyes,
      state.clothesColor,
      state.accessory,
    ]
  );

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
        {/* Cartoon animal character */}
        <img
          src={dataUri}
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
