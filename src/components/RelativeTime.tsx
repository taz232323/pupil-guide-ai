import * as React from "react";
import { formatDistanceToNow, format, isToday, isYesterday, differenceInMinutes } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function relative(date: Date): string {
  const mins = Math.abs(differenceInMinutes(new Date(), date));
  if (mins < 1) return "just now";
  if (isToday(date)) return formatDistanceToNow(date, { addSuffix: true });
  if (isYesterday(date)) return `yesterday at ${format(date, "h:mm a")}`;
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Renders a human-friendly relative timestamp ("2 minutes ago", "yesterday at 4:12 PM"),
 * with the absolute date in a tooltip on hover. Auto-updates every 60s.
 */
export function RelativeTime({
  date,
  className,
  prefix,
}: {
  date: string | Date | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const [, tick] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  const label = relative(d);
  const absolute = format(d, "PPpp");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={d.toISOString()} className={className}>
          {prefix}{label}
        </time>
      </TooltipTrigger>
      <TooltipContent>{absolute}</TooltipContent>
    </Tooltip>
  );
}