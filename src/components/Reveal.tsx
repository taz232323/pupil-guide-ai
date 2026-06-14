import { ElementType, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** Stagger delay in ms (e.g. index * 60). */
  delay?: number;
  /** Add a slight 3D flip-in (rotateX) on reveal. */
  flip?: boolean;
  className?: string;
  as?: ElementType;
  /** Re-trigger every time it enters the viewport (default: once). */
  repeat?: boolean;
};

/**
 * Scroll-triggered reveal using IntersectionObserver (never scroll listeners).
 * Animates opacity + translateY (and optional rotateX) via transform/opacity only.
 * Honors prefers-reduced-motion through the global CSS reset.
 */
export function Reveal({
  children,
  delay = 0,
  flip = false,
  className,
  as,
  repeat = false,
}: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (!repeat) io.unobserve(entry.target);
          } else if (repeat) {
            setVisible(false);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [repeat]);

  return (
    <Tag
      ref={ref as never}
      className={cn("reveal", flip && "reveal-flip", visible && "is-visible", className)}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
