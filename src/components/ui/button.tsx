import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-spring relative overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-medium ring-offset-background hover:scale-[1.04] active:scale-[0.96] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-[3px] focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100 disabled:hover:brightness-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(221_83%_30%/0.2),0_4px_12px_hsl(221_83%_53%/0.25)] hover:bg-primary-deep hover:shadow-[0_8px_24px_hsl(221_83%_53%/0.35)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_1px_2px_hsl(0_60%_30%/0.2)] hover:brightness-110 hover:shadow-[0_8px_24px_hsl(0_72%_51%/0.3)]",
        outline:
          "border border-border bg-card text-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-primary/10 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline hover:scale-100 hover:no-underline nav-underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[8px] px-3",
        lg: "h-11 rounded-[8px] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Spawn a ripple element at the click coordinates
      const target = e.currentTarget as HTMLElement;
      if (target && target.getBoundingClientRect) {
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement("span");
        ripple.className = "ripple-effect";
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        target.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 650);
      }
      onClick?.(e);
    };
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
