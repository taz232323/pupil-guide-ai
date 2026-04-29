import { cn } from "@/lib/utils";

// Shared catalog mapping cosmetic item keys to their emoji glyph.
export const COSMETIC_EMOJI: Record<string, string> = {
  hat_wizard: "🧙",
  glasses: "🕶️",
  crown_silver: "👑",
  halo: "😇",
  robot: "🤖",
  rainbow_aura: "🌈",
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
  const equipped = (items ?? []).map((k) => COSMETIC_EMOJI[k]).filter(Boolean);
  const hasAura = (items ?? []).includes("rainbow_aura");

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground font-medium shrink-0",
        hasAura && "ring-2 ring-offset-1 ring-offset-background ring-pink-400",
        SIZE_CLASS[size],
        className
      )}
      aria-label={name ?? "Avatar"}
    >
      <span>{initials(name)}</span>
      {equipped
        .filter((_, i) => (items ?? [])[i] !== "rainbow_aura")
        .slice(0, 3)
        .map((emoji, i) => (
          <span
            key={i}
            className="absolute -top-1.5 leading-none"
            style={{ transform: `translateX(${(i - 1) * 8}px)` }}
            aria-hidden
          >
            {emoji}
          </span>
        ))}
    </span>
  );
};
