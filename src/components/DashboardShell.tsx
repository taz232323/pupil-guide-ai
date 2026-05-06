import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  GraduationCap, LayoutDashboard, BookOpen, ClipboardList, MessageSquare, Award,
  ShoppingBag, User, LineChart, Star, Crown, LogOut, Calendar, Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/StudentAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";
import { StudyBuddy } from "@/components/StudyBuddy";
import grapheionMark from "@/assets/grapheion-mark.png";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; shortLabel?: string; icon: typeof LayoutDashboard };

const STUDENT_NAV: NavItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/classes", label: "My Classes", shortLabel: "Classes", icon: BookOpen },
  { to: "/student/assignments", label: "Assignments", shortLabel: "Work", icon: ClipboardList },
  { to: "/student/calendar", label: "Calendar", icon: Calendar },
  { to: "/student/grades", label: "Grades", icon: Award },
  { to: "/student/leaderboard", label: "Leaderboard", shortLabel: "Ranks", icon: Trophy },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/profile", label: "Profile", icon: User },
];

const TEACHER_NAV: NavItem[] = [
  { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
  { to: "/teacher/classes", label: "My Classes", shortLabel: "Classes", icon: BookOpen },
  { to: "/teacher/assignments", label: "Assignments", shortLabel: "Work", icon: ClipboardList },
  { to: "/teacher/calendar", label: "Calendar", icon: Calendar },
  { to: "/teacher/gradebook", label: "Gradebook", shortLabel: "Grades", icon: Award },
  { to: "/teacher/progress", label: "Progress", icon: LineChart },
  { to: "/teacher/shop", label: "Shop", icon: ShoppingBag },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
];

function useCoins(userId?: string) {
  const [coins, setCoins] = useState<{ star: number; crown: number } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase.from("student_coins").select("star_coins, crown_coins")
      .eq("student_id", userId).maybeSingle().then(({ data }) => {
        if (active && data) setCoins({ star: data.star_coins, crown: data.crown_coins });
      });
    const ch = supabase.channel("coins:" + userId)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "student_coins", filter: `student_id=eq.${userId}` },
        (p) => {
          const row = p.new as { star_coins: number; crown_coins: number } | null;
          if (row) setCoins({ star: row.star_coins, crown: row.crown_coins });
        }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [userId]);
  return coins;
}

function useProfile(userId?: string) {
  const [p, setP] = useState<{ name: string; items: string[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const load = () => {
      supabase.from("profiles").select("full_name, avatar_items").eq("id", userId).maybeSingle()
        .then(({ data }) => setP({
          name: (data?.full_name as string) || "",
          items: (data?.avatar_items ?? []) as string[],
        }));
    };
    load();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.userId === userId) load();
    };
    window.addEventListener("profile:updated", handler);
    return () => window.removeEventListener("profile:updated", handler);
  }, [userId]);
  return p;
}

export const DashboardShell = ({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  const { user, role, signOut } = useAuth();
  const coins = useCoins(role === "student" ? user?.id : undefined);
  const profile = useProfile(user?.id);
  const nav = role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const { pathname } = useLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const unread = useUnreadMessages();

  const handleDelete = async () => {
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) { toast.error(error.message); return; }
    toast.success("Account deleted");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const isActive = (to: string) =>
    to === pathname || (to !== "/student" && to !== "/teacher" && pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-5 py-5 border-b border-border">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src={grapheionMark}
              alt="Grapheion"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              style={{ background: "transparent" }}
            />
            <span className="font-bold tracking-tight text-lg text-primary">Grapheion</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-base",
                  active
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.to === "/messages" && unread > 0 && (
                  <Badge
                    variant={active ? "secondary" : "default"}
                    className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px] tabular-nums justify-center"
                  >
                    {unread > 99 ? "99+" : unread}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User card */}
        <div className="border-t border-border p-3 space-y-2">
          {role === "student" && coins && (
            <div className="flex gap-2">
              <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-warning-soft px-2 py-1.5 text-xs font-semibold text-warning">
                <Star className="h-3.5 w-3.5 fill-current" /> {coins.star}
              </span>
              <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-soft px-2 py-1.5 text-xs font-semibold text-primary">
                <Crown className="h-3.5 w-3.5 fill-current" /> {coins.crown}
              </span>
            </div>
          )}
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary transition-base"
          >
            <StudentAvatar size="sm" name={profile?.name || user?.email} items={profile?.items} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{profile?.name || user?.email?.split("@")[0]}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{role}</p>
            </div>
          </Link>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={signOut} className="flex-1 justify-start">
              <LogOut className="h-3.5 w-3.5 mr-1" />Sign out
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10">
              Delete
            </Button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={grapheionMark}
                alt="Grapheion"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                style={{ background: "transparent" }}
              />
              <span className="font-bold text-primary">Grapheion</span>
            </Link>
            <div className="flex items-center gap-1.5">
              {role === "student" && coins && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                    <Star className="h-3 w-3 fill-current" />{coins.star}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    <Crown className="h-3 w-3 fill-current" />{coins.crown}
                  </span>
                </>
              )}
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Account menu"
                    className="rounded-full ring-offset-background transition-base hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <StudentAvatar size="sm" name={profile?.name || user?.email} items={profile?.items} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate">
                        {profile?.name || user?.email?.split("@")[0]}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{role}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(true)}
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    Delete account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-30 h-14 items-center justify-end gap-2 border-b border-border bg-card/80 backdrop-blur px-6">
          <NotificationBell />
        </header>

        <main
          key={pathname}
          className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:pb-10 max-w-6xl w-full mx-auto animate-fade-in pb-[calc(72px+env(safe-area-inset-bottom))]"
        >
          {(title || actions) && (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                {title && <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>}
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              {actions}
            </div>
          )}
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul
            className="grid min-h-[68px]"
            style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
          >
            {nav.map((item) => {
              const active = isActive(item.to);
              return (
                <li key={item.to} className="flex-1 min-w-0">
                  <NavLink
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 px-2 py-2.5 h-full min-h-[68px] text-[10px] leading-tight font-medium transition-base w-full",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <span className="relative">
                      <item.icon className={cn("h-5 w-5", active && "drop-shadow")} />
                      {item.to === "/messages" && unread > 0 && (
                        <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold flex items-center justify-center tabular-nums">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </span>
                    <span className="block w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Permanently delete your account?"
        description="This cannot be undone. All of your data will be removed."
        confirmLabel="Delete account"
        destructive
        onConfirm={handleDelete}
      />
      {(role === "student" || role === "teacher") && <StudyBuddy />}
    </div>
  );
};
