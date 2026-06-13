import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SpinnerButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

/**
 * Drop-in replacement for Button that shows a small spinner when `loading` is true.
 * Disables the button while loading to prevent duplicate submissions.
 */
export const SpinnerButton = React.forwardRef<HTMLButtonElement, SpinnerButtonProps>(
  ({ loading, loadingText, disabled, children, className, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        className={cn("transition-spring hover:scale-[1.02] active:scale-[0.98]", className)}
        {...rest}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />}
        <span>{loading && loadingText ? loadingText : children}</span>
      </Button>
    );
  }
);
SpinnerButton.displayName = "SpinnerButton";