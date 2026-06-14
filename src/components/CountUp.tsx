import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  value: number;
  /** animation duration in ms */
  duration?: number;
  className?: string;
  /** decimal places */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** apply monospace tabular font so digits don't shift width while ticking */
  mono?: boolean;
};

/**
 * Counts up from the previous value to `value` with an ease-out curve via rAF.
 * Uses tabular numerals so width never shifts during the animation.
 */
export function CountUp({
  value,
  duration = 800,
  className,
  decimals = 0,
  prefix = "",
  suffix = "",
  mono = true,
}: Props) {
  const reduced = prefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const fromRef = useRef(reduced ? value : 0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduced]);

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={cn(mono && "font-tabular", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default CountUp;
