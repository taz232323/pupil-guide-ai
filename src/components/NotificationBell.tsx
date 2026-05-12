import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ClipboardList, MessageSquare, ShoppingBag, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(type: string) {
  switch (type) {
    case "submission":
    case "assignment":
    case "new_assignment":
      return ClipboardList;
    case "message":
    case "new_message":
      return MessageSquare;
    case "privilege_approved":
      return CheckCircle2;
    case "privilege_denied":
      return XCircle;
    case "privilege_request":
      return ShoppingBag;
    default:
      return Bell;
  }
}

function colorFor(type: string) {
  switch (type) {
    case "privilege_approved":
      return "text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/15";
    case "privilege_denied":
      return "text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-500/15";
    case "privilege_request":
      return "text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15";
    case "message":
    case "new_message":
      return "text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/15";
    default:
      return "text-primary bg-primary/10";
  }
}

export const NotificationBell = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const markedThisOpen = useRef(false);

  // initial load + realtime
  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (active && data) setItems(data as Notification[]);
      });

    const ch = supabase
      .channel(`notifications:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setItems((prev) => [p.new as Notification, ...prev].slice(0, 30))
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => {
          const updated = p.new as Notification;
          setItems((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  // Mark all unread as read when panel opens
  useEffect(() => {
    if (!open || !user) return;
    if (markedThisOpen.current) return;
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    markedThisOpen.current = true;
    // optimistic
    setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (error) {
          // revert by refetching
          supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30)
            .then(({ data }) => data && setItems(data as Notification[]));
        }
      });
  }, [open, items, user]);

  // Reset mark guard when panel closes
  useEffect(() => {
    if (!open) markedThisOpen.current = false;
  }, [open]);

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative rounded-full", className)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-pulse text-primary")} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background animate-pulse-ring"
              aria-hidden
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1 px-6">
                You'll see updates about assignments, messages and shop requests here.
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {items.map((n) => {
                const Icon = iconFor(n.type);
                const inner = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      !n.read && "bg-primary/5",
                      n.link && "hover:bg-accent cursor-pointer"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        colorFor(n.type)
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                    )}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} onClick={() => setOpen(false)} className="block">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
