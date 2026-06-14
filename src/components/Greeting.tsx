import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Typewriter } from "@/components/Typewriter";

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
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-hero p-6 text-foreground shadow-card animate-fade-in">
      {/* soft ambient glow */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-plum/20 blur-3xl animate-blob-slow" />
      <p className="text-sm font-medium text-muted-foreground">
        <Typewriter text={timeGreeting()} speed={55} caret={false} />
      </p>
      <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-tight">
        <span className="text-gradient-primary">{name || "Welcome back"}</span> 👋
      </h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>}
    </div>
  );
};