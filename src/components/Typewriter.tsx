import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  text: string;
  /** ms per character */
  speed?: number;
  /** delay before typing starts (ms) */
  startDelay?: number;
  className?: string;
  /** show a blinking caret while/after typing */
  caret?: boolean;
};

/**
 * Types out `text` one character at a time using requestAnimationFrame.
 * Falls back to instant full text when reduced motion is requested.
 */
export function Typewriter({ text, speed = 45, startDelay = 0, className, caret = true }: Props) {
  const reduced = prefersReducedMotion();
  const [count, setCount] = useState(reduced ? text.length : 0);
  const [done, setDone] = useState(reduced);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (reduced) {
      setCount(text.length);
      setDone(true);
      return;
    }
    setCount(0);
    setDone(false);
    let startTime: number | null = null;
    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime - startDelay;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const next = Math.min(text.length, Math.floor(elapsed / speed));
      setCount(next);
      if (next < text.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, speed, startDelay, reduced]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      {caret && !done && <span className="typewriter-caret" aria-hidden />}
    </span>
  );
}

export default Typewriter;
