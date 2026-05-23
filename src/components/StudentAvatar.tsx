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
  species_cat:    { key: "cat",    name: "Cat",    defaultFur: "fur_orange", allowedFur: ["fur_orange", "fur_grey", "fur_black", "fur_white", "fur_cream", "fur_brown"] },
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
 * All species share the same head footprint (cx=50, cy≈40, rx≈28, ry≈30)
 * so cosmetic headwear lines up identically. Shading uses soft radial
 * gradients + a single highlight blob — no harsh outlines, no paper edges.
 */
function speciesParts(species: string, fur: string, furDark: string, furLight: string) {
  const cx = 50;
  const stroke = darken(fur, 0.32);
  const sw = 0.6;

  // Shared face shading + highlight applied AFTER species silhouette.
  const shading = `
    <ellipse cx="${cx}" cy="48" rx="26" ry="26" fill="url(#headShade)"/>
    <ellipse cx="${cx - 8}" cy="32" rx="8" ry="5" fill="#ffffff" opacity="0.18"/>
  `;

  switch (species) {
    case "species_owl": {
      // OWL — feather treatment, no fur. Ear tufts are rounded plumes.
      const beak = "#f0a83a";
      const beakDark = darken(beak, 0.28);
      return `
        <!-- soft plumes / ear tufts -->
        <path d="M28,22 Q22,8 36,12 Q42,18 38,26 Z" fill="${furDark}"/>
        <path d="M72,22 Q78,8 64,12 Q58,18 62,26 Z" fill="${furDark}"/>
        <!-- head -->
        <ellipse cx="${cx}" cy="40" rx="28" ry="28" fill="${fur}"/>
        ${shading}
        <!-- facial disk: figure-8 of two soft circles -->
        <circle cx="40" cy="44" r="14" fill="${furLight}"/>
        <circle cx="60" cy="44" r="14" fill="${furLight}"/>
        <path d="M40,30 Q50,26 60,30" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" opacity="0.4"/>
        <!-- eye discs -->
        <circle cx="40" cy="44" r="6" fill="#ffffff"/>
        <circle cx="60" cy="44" r="6" fill="#ffffff"/>
        <!-- beak (smoothly integrated) -->
        <path d="M46,48 Q50,46 54,48 Q52,56 50,57 Q48,56 46,48 Z"
              fill="${beak}" stroke="${beakDark}" stroke-width="0.5" stroke-linejoin="round"/>
      `;
    }
    case "species_fox": {
      return `
        <!-- ears (rounded triangles) -->
        <path d="M24,30 Q22,10 38,22 Q34,30 26,32 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M76,30 Q78,10 62,22 Q66,30 74,32 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M27,28 Q26,18 35,24 Q33,28 28,30 Z" fill="${furLight}"/>
        <path d="M73,28 Q74,18 65,24 Q67,28 72,30 Z" fill="${furLight}"/>
        <!-- head -->
        <path d="M22,42 Q22,18 50,18 Q78,18 78,42 Q78,62 50,66 Q22,62 22,42 Z"
              fill="${fur}"/>
        ${shading}
        <!-- cheek/muzzle blaze -->
        <path d="M34,50 Q50,72 66,50 Q58,62 50,63 Q42,62 34,50 Z" fill="${furLight}"/>
        <!-- nose -->
        <ellipse cx="${cx}" cy="54" rx="3.2" ry="2.4" fill="${darken(fur,0.6)}"/>
        <path d="M50,56 L50,60" stroke="${darken(fur,0.5)}" stroke-width="0.6" stroke-linecap="round"/>
      `;
    }
    case "species_cat": {
      return `
        <!-- ears -->
        <path d="M26,28 Q24,10 40,22 Q36,28 28,30 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M74,28 Q76,10 60,22 Q64,28 72,30 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M29,26 Q28,16 37,22 Q35,27 30,28 Z" fill="${lighten(fur,0.5)}"/>
        <path d="M71,26 Q72,16 63,22 Q65,27 70,28 Z" fill="${lighten(fur,0.5)}"/>
        <!-- head -->
        <ellipse cx="${cx}" cy="42" rx="26" ry="25" fill="${fur}"/>
        ${shading}
        <!-- muzzle pad -->
        <path d="M38,50 Q50,62 62,50 Q56,58 50,58 Q44,58 38,50 Z" fill="${furLight}"/>
        <!-- nose -->
        <path d="M48,49 Q50,52 52,49 Q51,51 50,52 Q49,51 48,49 Z" fill="${darken(fur,0.6)}"/>
        <!-- whiskers -->
        <g stroke="${darken(fur,0.45)}" stroke-width="0.5" stroke-linecap="round" opacity="0.7">
          <line x1="40" y1="54" x2="26" y2="52"/>
          <line x1="40" y1="56" x2="26" y2="58"/>
          <line x1="60" y1="54" x2="74" y2="52"/>
          <line x1="60" y1="56" x2="74" y2="58"/>
        </g>
      `;
    }
    case "species_wolf": {
      return `
        <!-- larger pointed ears -->
        <path d="M20,30 Q18,8 38,22 Q34,32 24,32 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M80,30 Q82,8 62,22 Q66,32 76,32 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M24,28 Q23,16 34,22 Q31,29 26,30 Z" fill="${furLight}"/>
        <path d="M76,28 Q77,16 66,22 Q69,29 74,30 Z" fill="${furLight}"/>
        <!-- head — angular but smooth -->
        <path d="M20,44 Q20,18 50,18 Q80,18 80,44 Q78,62 50,68 Q22,62 20,44 Z"
              fill="${fur}"/>
        ${shading}
        <!-- muzzle -->
        <path d="M32,50 Q50,72 68,50 Q60,64 50,66 Q40,64 32,50 Z" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="55" rx="3.6" ry="2.6" fill="${darken(fur,0.6)}"/>
      `;
    }
    case "species_bear": {
      return `
        <!-- rounded ears -->
        <circle cx="28" cy="22" r="8.5" fill="${fur}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="72" cy="22" r="8.5" fill="${fur}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="28" cy="23" r="4.5" fill="${furLight}"/>
        <circle cx="72" cy="23" r="4.5" fill="${furLight}"/>
        <!-- head (extra round) -->
        <circle cx="${cx}" cy="42" r="28" fill="${fur}"/>
        ${shading}
        <!-- muzzle pad -->
        <ellipse cx="${cx}" cy="54" rx="14" ry="9" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="50" rx="3.6" ry="2.6" fill="${darken(fur,0.65)}"/>
        <path d="M50,52 L50,58" stroke="${darken(fur,0.55)}" stroke-width="0.6" stroke-linecap="round"/>
      `;
    }
    case "species_rabbit": {
      return `
        <!-- long ears -->
        <path d="M38,8 Q33,8 33,22 Q33,34 40,34 Q42,30 41,18 Q41,10 38,8 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M62,8 Q67,8 67,22 Q67,34 60,34 Q58,30 59,18 Q59,10 62,8 Z" fill="${fur}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
        <path d="M38,12 Q36,14 37,22 Q38,30 40,30 Q41,24 40,16 Z" fill="${lighten(fur,0.5)}"/>
        <path d="M62,12 Q64,14 63,22 Q62,30 60,30 Q59,24 60,16 Z" fill="${lighten(fur,0.5)}"/>
        <!-- head -->
        <ellipse cx="${cx}" cy="44" rx="24" ry="24" fill="${fur}"/>
        ${shading}
        <!-- muzzle / two cheek puffs -->
        <ellipse cx="46" cy="55" rx="6" ry="4" fill="${furLight}"/>
        <ellipse cx="54" cy="55" rx="6" ry="4" fill="${furLight}"/>
        <ellipse cx="${cx}" cy="51" rx="2.2" ry="1.5" fill="${darken(fur,0.5)}"/>
        <path d="M50,52 L50,55 M50,55 Q47,57 45,56 M50,55 Q53,57 55,56"
              fill="none" stroke="${darken(fur,0.55)}" stroke-width="0.6" stroke-linecap="round"/>
        <!-- front teeth -->
        <rect x="48.6" y="56.5" width="2.8" height="3" rx="0.5" fill="#fafafa" stroke="${darken(fur,0.3)}" stroke-width="0.3"/>
        <line x1="50" y1="56.6" x2="50" y2="59.4" stroke="${darken(fur,0.3)}" stroke-width="0.3"/>
      `;
    }
  }
  return "";
}

function eyesSvg(kind: string, accent: string, species: string) {
  // Owl uses wider-set eyes that sit inside the facial disks.
  const isOwl = species === "species_owl";
  const L = isOwl ? 40 : 42;
  const R = isOwl ? 60 : 58;
  const Y = isOwl ? 44 : 42;
  const sw = 1.4;
  const pupil = isOwl ? 3.2 : 2.8;
  switch (kind) {
    case "eyes_happy":
      return `
        <path d="M${L-4},${Y} Q${L},${Y-5} ${L+4},${Y}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
        <path d="M${R-4},${Y} Q${R},${Y-5} ${R+4},${Y}" stroke="${accent}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    case "eyes_wink":
      return `
        <circle cx="${L}" cy="${Y}" r="${pupil}" fill="${accent}"/>
        <circle cx="${L-0.9}" cy="${Y-1}" r="0.9" fill="#ffffff"/>
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
        <circle cx="${L}" cy="${Y}" r="${pupil}" fill="${accent}"/>
        <circle cx="${L-0.9}" cy="${Y-1}" r="0.9" fill="#ffffff"/>
        <circle cx="${R}" cy="${Y}" r="${pupil}" fill="${accent}"/>
        <circle cx="${R-0.9}" cy="${Y-1}" r="0.9" fill="#ffffff"/>`;
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

  // Owl uses feather treatment — no fur pattern overlay.
  const isOwl = state.species === "species_owl";
  const hasPattern = !isOwl && state.furPattern && state.furPattern !== "pattern_solid";
  const patId = "fpat";
  const patternOverlay = hasPattern
    ? `<g clip-path="url(#bodyClip)"><rect x="0" y="0" width="100" height="120" fill="url(#${patId})"/></g>`
    : "";

  // Torso: smaller, narrower, with soft gradient and rounded shoulders.
  const torso = `
    <!-- soft contact shadow under body -->
    <ellipse cx="50" cy="118" rx="34" ry="3" fill="#000" opacity="0.18"/>
    <!-- neck (tucks behind head) -->
    <path d="M44,64 Q50,70 56,64 L56,72 L44,72 Z" fill="${dark}" opacity="0.85"/>
    <!-- shoulders/shirt (narrower than head) -->
    <path d="M28,118 L28,90 Q28,76 40,74 L60,74 Q72,76 72,90 L72,118 Z"
          fill="url(#shirtGrad)"/>
    <!-- collar V -->
    <path d="M42,74 Q50,82 58,74" fill="${clothDark}" opacity="0.55"/>
    <!-- shirt highlight -->
    <path d="M34,84 Q34,78 42,77" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.18"/>
  `;

  // Body clip-path = head silhouette union (for fur pattern overlay)
  const bodyClipShapes = `
    <ellipse cx="50" cy="42" rx="30" ry="28"/>
    <ellipse cx="38" cy="16" rx="9" ry="16"/>
    <ellipse cx="62" cy="16" rx="9" ry="16"/>
  `;

  const parts = speciesParts(state.species, fur, dark, light);
  const eyes = eyesSvg(state.eyes, "#1a1f26", state.species);
  const acc = accessorySvg(state.accessory);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100%" height="100%" shape-rendering="geometricPrecision">
  <defs>
    ${patternDefs(patId, state.furPattern, fur, dark)}
    <radialGradient id="headShade" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </radialGradient>
    <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lighten(cloth, 0.12)}"/>
      <stop offset="100%" stop-color="${darken(cloth, 0.18)}"/>
    </linearGradient>
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
