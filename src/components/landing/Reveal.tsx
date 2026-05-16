import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Variant =
  | "fade-up"
  | "scale-in"
  | "wipe"
  | "slide-left"      // hard slide from left, no fade
  | "slide-right"     // hard slide from right, no fade
  | "slide-down"      // hard slide from above, no fade
  | "slide-up-solid"  // hard slide from below, no fade
  | "fade-only"       // pure fade, no motion
  | "wipe-line";      // scaleX 0 -> 1 from left

interface RevealProps {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  threshold?: number;
  style?: CSSProperties;
  /** Trigger immediately on mount instead of waiting for viewport intersection. */
  triggerOnMount?: boolean;
}

export function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration,
  className = "",
  as: Tag = "div",
  threshold = 0.15,
  style,
  triggerOnMount = false,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (triggerOnMount) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, triggerOnMount]);

  const defaultDuration =
    variant === "scale-in" ? 400 :
    variant === "wipe" ? 700 :
    variant === "wipe-line" ? 700 :
    variant === "slide-up-solid" ? 400 :
    variant === "fade-only" ? 800 :
    variant.startsWith("slide-") ? 500 :
    600;
  const d = duration ?? defaultDuration;

  const base: CSSProperties = {
    transitionProperty: "transform, opacity, clip-path",
    transitionDuration: `${d}ms`,
    transitionDelay: `${delay}ms`,
    transitionTimingFunction:
      variant === "scale-in"
        ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
        : variant.startsWith("slide-")
        ? "cubic-bezier(0.16, 1, 0.3, 1)"
        : "cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform, opacity",
  };

  let hidden: CSSProperties = {};
  let visible: CSSProperties = {};

  if (variant === "fade-up") {
    hidden = { opacity: 0, transform: "translate3d(0, 24px, 0)" };
    visible = { opacity: 1, transform: "translate3d(0, 0, 0)" };
  } else if (variant === "scale-in") {
    hidden = { opacity: 0, transform: "scale(0.75)" };
    visible = { opacity: 1, transform: "scale(1)" };
  } else if (variant === "wipe") {
    hidden = {
      opacity: 0,
      clipPath: "inset(0 100% 0 0)",
      transform: "translate3d(-8px, 0, 0)",
    };
    visible = {
      opacity: 1,
      clipPath: "inset(0 0 0 0)",
      transform: "translate3d(0, 0, 0)",
    };
  } else if (variant === "slide-left") {
    hidden = { opacity: 1, transform: "translate3d(-120%, 0, 0)" };
    visible = { opacity: 1, transform: "translate3d(0, 0, 0)" };
  } else if (variant === "slide-right") {
    hidden = { opacity: 1, transform: "translate3d(120%, 0, 0)" };
    visible = { opacity: 1, transform: "translate3d(0, 0, 0)" };
  } else if (variant === "slide-down") {
    hidden = { opacity: 1, transform: "translate3d(0, -120%, 0)" };
    visible = { opacity: 1, transform: "translate3d(0, 0, 0)" };
  } else if (variant === "slide-up-solid") {
    hidden = { opacity: 1, transform: "translate3d(0, 80px, 0)" };
    visible = { opacity: 1, transform: "translate3d(0, 0, 0)" };
  } else if (variant === "fade-only") {
    hidden = { opacity: 0 };
    visible = { opacity: 1 };
  } else if (variant === "wipe-line") {
    hidden = { opacity: 1, transform: "scaleX(0)", transformOrigin: "left center" };
    visible = { opacity: 1, transform: "scaleX(1)", transformOrigin: "left center" };
  }

  const merged: CSSProperties = {
    ...base,
    ...(shown ? visible : hidden),
    ...style,
  };

  const Comp = Tag as any;
  return (
    <Comp ref={ref as any} className={className} style={merged}>
      {children}
    </Comp>
  );
}