import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button, ButtonProps } from "@/components/ui/button";

type Props = ButtonProps & {
  /** Tooltip text + accessible label. */
  label: string;
  /** Icon element (Lucide etc). */
  children: React.ReactNode;
};

/**
 * Icon-only button with a tooltip on hover and a screen-reader label.
 * Use anywhere we previously rendered a bare <Button size="icon">.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ label, children, size = "icon", variant = "ghost", ...rest }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} size={size} variant={variant} aria-label={label} {...rest}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }
);
IconButton.displayName = "IconButton";