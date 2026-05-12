import confetti from "canvas-confetti";

/** Quick celebratory burst — used for streak milestones and practice completions. */
export function celebrate(intensity: "small" | "big" = "small") {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const base = {
    spread: intensity === "big" ? 90 : 65,
    startVelocity: intensity === "big" ? 55 : 40,
    ticks: 200,
    scalar: 0.9,
    origin: { y: 0.7 },
  } as const;

  confetti({ ...base, particleCount: intensity === "big" ? 140 : 80 });

  if (intensity === "big") {
    setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0.1, y: 0.8 } }), 150);
    setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 0.9, y: 0.8 } }), 300);
  }
}