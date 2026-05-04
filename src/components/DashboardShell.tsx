import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, ClipboardList, MessageSquare, Award,
  ShoppingBag, User, LineChart, Star, Crown, LogOut,
  ChevronLeft, ChevronRight, MoreHorizontal,
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
import eduflowLogo from "@/assets/eduflow-logo.png";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const STUDENT_GROUPS: NavGroup[] = [
  {
    label: "Learn",
    items: [
      { to: "/student", label: "Dashboard", icon: LayoutDashboard },
      { to: "/student/classes", label: "Classes", icon: BookOpen },
      { to: "/student/assignments", label: "Assignments", icon: ClipboardList },
      { to: "/student/grades", label: "Grades", icon: Award },
    ],
  },
  { label: "Connect", items: [{ to: "/messages", label: "Messages", icon: MessageSquare }] },
  {
    label: "Rewards",
    items: [
      { to: "/shop", label: "Shop", icon: ShoppingBag },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

const TEACHER_GROUPS: NavGroup[] = [
  {
    label: "Teach",
    items: [
      { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
      { to: "/teacher/classes", label: "Classes", icon: BookOpen },
      { to: "/teacher/assignments", label: "Assignments", icon: ClipboardList },
      { to: "/teacher/gradebook", label: "Gradebook", icon: Award },
    ],
  },
  { label: "Connect", items: [{ to: "/messages", label: "Messages", icon: MessageSquare }] },
  {
    label: "Tools",
    items: [
      { to: "/teacher/progress", label: "Progress", icon: LineChart },
      { to: "/teacher/shop", label: "Shop", icon: ShoppingBag },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

// Mobile bottom tab routes (4 primary)
const STUDENT_MOBILE: NavItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/assignments", label: "Assignments", icon: ClipboardList },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
];
const TEACHER_MOBILE: NavItem[] = [
  { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
  { to: "/teacher/classes", label: "Classes", icon: BookOpen },
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
    supabase.from("profiles").select("full_name, avatar_items").eq("id", userId).maybeSingle()
      .then(({ data }) => setP({
        name: (data?.full_name as string) || "",
        items: (data?.avatar_items ?? []) as string[],
      }));
  }, [userId]);
  return p;
}

const COLLAPSED_KEY = "eduflow:sidebar-collapsed";

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
  const groups = role === "teacher" ? TEACHER_GROUPS : STUDENT_GROUPS;
  const mobileTabs = role === "teacher" ? TEACHER_MOBILE : STUDENT_MOBILE;
  const allItems = groups.flatMap((g) => g.items);
  const mobileSet = new Set(mobileTabs.map((m) => m.to));
  const moreItems = allItems.filter((i) => !mobileSet.has(i.to));

  const { pathname } = useLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const unread = useUnreadMessages();

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const handleDelete = async () => {
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) { toast.error(error.message); return; }
    toast.success("Account deleted");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const isActive = (to: string) =>
    to === pathname || (to !== "/student" && to !== "/teacher" && pathname.startsWith(to));

  const renderNavLink = (item: NavItem, opts?: { mobileSheet?: boolean }) => {
    const active = isActive(item.to);
    const isMessages = item.to === "/messages";
    const linkClass = cn(
      "flex items-center gap-3 rounded-lg transition-base text-[13px] font-medium",
      collapsed && !opts?.mobileSheet ? "justify-center px-2 py-2.5" : "px-3 py-2",
      active
        ? "bg-primary text-primary-foreground shadow-card"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );
    const content = (
      <NavLink
        to={item.to}
        onClick={() => opts?.mobileSheet && setMoreOpen(false)}
        className={linkClass}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        {(!collapsed || opts?.mobileSheet) && <span className="truncate">{item.label}</span>}
        {isMessages && unread > 0 && (!collapsed || opts?.mobileSheet) && (
          <Badge
            variant={active ? "secondary" : "default"}
            className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px] tabular-nums justify-center"
          >
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
        {isMessages && unread > 0 && collapsed && !opts?.mobileSheet && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        )}
      </NavLink>
    );
    if (collapsed && !opts?.mobileSheet) {
      return (
        <Tooltip key={item.to}>
          <TooltipTrigger asChild><div className="relative">{content}</div></TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <div key={item.to} className="relative">{content}</div>;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <TooltipProvider delayDuration={200}>
        <aside
          className={cn(
            "hidden lg:flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
            collapsed ? "w-16" : "w-64"
          )}
        >
          <div className={cn("py-5 border-b border-border", collapsed ? "px-2" : "px-5")}>
            <Link to="/" className={cn("flex items-center gap-2.5 group", collapsed && "justify-center")}>
              <img src={eduflowLogo} alt="Eduflow" width={36} height={36} className="h-9 w-9 object-contain" />
              {!collapsed && <span className="font-bold tracking-tight text-lg text-primary">Eduflow</span>}
            </Link>
          </div>

          <nav className={cn("flex-1 py-4 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
            {groups.map((g, gi) => (
              <div key={g.label}>
                {gi > 0 && <div className="my-3 border-t border-border" />}
                {!collapsed && (
                  <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {g.label}
                  </p>
                )}
                <div className="space-y-1">
                  {g.items.map((item) => renderNavLink(item))}
                </div>
              </div>
            ))}
          </nav>

          {/* User card */}
          <div className={cn("border-t border-border space-y-2", collapsed ? "p-2" : "p-3")}>
            {role === "student" && coins && !collapsed && (
              <div className="flex gap-2">
                <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-warning-soft px-2 py-1.5 text-xs font-semibold text-warning">
                  <Star className="h-3.5 w-3.5 fill-current" /> {coins.star}
                </span>
                <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-soft px-2 py-1.5 text-xs font-semibold text-primary">
                  <Crown className="h-3.5 w-3.5 fill-current" /> {coins.crown}
                </span>
              </div>
            )}
            {!collapsed ? (
              <>
                <Link to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary transition-base">
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
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/profile" className="flex justify-center py-1">
                    <StudentAvatar size="sm" name={profile?.name || user?.email} items={profile?.items} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Profile</TooltipContent>
              </Tooltip>
            )}

            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="w-full flex items-center justify-center rounded-md py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-base"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </aside>
      </TooltipProvider>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={eduflowLogo} alt="Eduflow" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="font-bold text-primary">Eduflow</span>
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
            </div>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-30 h-14 items-center justify-end gap-2 border-b border-border bg-card/80 backdrop-blur px-6">
          <NotificationBell />
        </header>

        <main
          key={pathname}
          className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-6xl w-full mx-auto animate-fade-in"
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

        {/* Mobile bottom tab bar — icons only, 4 primary + More */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur">
          <ul className="grid grid-cols-5">
            {mobileTabs.map((item) => {
              const active = isActive(item.to);
              const isMessages = item.to === "/messages";
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    aria-label={item.label}
                    className={cn(
                      "flex items-center justify-center py-3 transition-base",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <span className="relative">
                      <item.icon className={cn("h-[22px] w-[22px]", active && "drop-shadow")} />
                      {isMessages && unread > 0 && (
                        <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold flex items-center justify-center tabular-nums">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </span>
                  </NavLink>
                </li>
              );
            })}
            <li>
              <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetTrigger asChild>
                  <button
                    aria-label="More"
                    className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-base"
                  >
                    <MoreHorizontal className="h-[22px] w-[22px]" />
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl">
                  <SheetHeader>
                    <SheetTitle>More</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-1 pb-6">
                    {moreItems.map((item) => renderNavLink(item, { mobileSheet: true }))}
                    <div className="my-2 border-t border-border" />
                    <button
                      onClick={() => { setMoreOpen(false); signOut(); }}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <LogOut className="h-[18px] w-[18px]" />Sign out
                    </button>
                    <button
                      onClick={() => { setMoreOpen(false); setConfirmDelete(true); }}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-[18px] w-[18px]" />Delete account
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            </li>
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
