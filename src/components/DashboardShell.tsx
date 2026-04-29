import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const DashboardShell = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const { user, signOut } = useAuth();

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
            <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>
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