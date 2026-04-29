import { GraduationCap, Star, Crown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export const DashboardShell = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const { user, signOut } = useAuth();
  const [coins, setCoins] = useState<{ star: number; crown: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("student_coins")
        .select("star_coins, crown_coins")
        .eq("student_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) setCoins({ star: data.star_coins, crown: data.crown_coins });
      else setCoins(null);
    };
    load();
    const channel = supabase
      .channel("coins:" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_coins", filter: `student_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { star_coins: number; crown_coins: number } | null;
          if (row) setCoins({ star: row.star_coins, crown: row.crown_coins });
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleDelete = async () => {
    if (!confirm("Permanently delete your account? This cannot be undone.")) return;
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account deleted");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground inline-flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-semibold">EduFlow</span>
          </div>
          <div className="flex items-center gap-3">
            {coins && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  {coins.star}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
                  <Crown className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  {coins.crown}
                </span>
              </div>
            )}
            <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>
            {coins && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/profile"><User className="h-4 w-4 mr-1" />Profile</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
              Delete account
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
};