import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export const Greeting = ({ subtitle }: { subtitle?: string }) => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const load = () => {
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
        .then(({ data }) => setName((data?.full_name as string) || (user.email?.split("@")[0] ?? "")));
    };
    load();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.userId === user.id) load();
    };
    window.addEventListener("profile:updated", handler);
    return () => window.removeEventListener("profile:updated", handler);
  }, [user]);

  return (
    <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated animate-fade-in">
      <p className="text-sm font-medium opacity-80">{timeGreeting()}</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
        {name || "Welcome back"} 👋
      </h1>
      {subtitle && <p className="mt-1 text-sm opacity-90 max-w-2xl">{subtitle}</p>}
    </div>
  );
};