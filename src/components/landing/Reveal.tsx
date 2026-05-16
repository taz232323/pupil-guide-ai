import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Variant = "fade-up" | "scale-in" | "wipe";

interface RevealProps {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  threshold?: number;
  style?: CSSProperties;
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
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
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
  }, [threshold]);

  const defaultDuration =
    variant === "scale-in" ? 400 : variant === "wipe" ? 700 : 600;
  const d = duration ?? defaultDuration;

  const base: CSSProperties = {
    transitionProperty: "transform, opacity, clip-path",
    transitionDuration: `${d}ms`,
    transitionDelay: `${delay}ms`,
    transitionTimingFunction:
      variant === "scale-in"
        ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
        : "cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform, opacity",
  };

  let hidden: CSSProperties = {};
  let visible: CSSProperties = {};

  if (variant === "fade-up") {
    hidden = { opacity: 0, transform: "translate3d(0, 24px, 0)" };
    visible = { opacity: 1, transform: "translate3d(0, 0, 0)" };
  } else if (variant === "scale-in") {
    hidden = { opacity: 0, transform: "scale(0.8)" };
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