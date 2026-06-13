import { cn } from "@/lib/utils";

/**
 * Three dots with a sequential wave (typing / thinking indicator).
 * Pure CSS via the `.typing-dots` utility. Honors reduced motion globally.
 */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("typing-dots", className)} role="status" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

export default ThinkingDots;
