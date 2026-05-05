import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  onJoined?: () => void;
  variant?: "hero" | "compact";
  className?: string;
};

export function JoinClassCard({ onJoined, variant = "compact", className }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const v = code.trim();
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_class_by_code", { _code: v });
    setBusy(false);
    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("already enrolled")) {
        toast.info("You are already enrolled in this class");
      } else {
        toast.error(msg || "Couldn't join class");
      }
      return;
    }
    toast.success("Joined class");
    setCode("");
    onJoined?.();
  };

  if (variant === "hero") {
    return (
      <Card className={cn("overflow-hidden border-0 shadow-elevated", className)}>
        <div className="bg-gradient-soft px-6 py-14 sm:py-20 text-center">
          <div className="mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-card text-primary shadow-card">
            <KeyRound className="h-10 w-10" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome aboard! 👋</h2>
          <p className="mx-auto mt-2 max-w-md text-sm sm:text-base text-muted-foreground">
            Enter the 6-character join code your teacher shared with you to join your first class.
          </p>
          <div className="mt-6 mx-auto flex max-w-sm gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="h-12 text-center font-mono tracking-[0.4em] text-lg"
              maxLength={6}
            />
            <Button onClick={join} disabled={busy || code.trim().length < 4} size="lg" className="h-12 px-6">
              {busy ? "Joining..." : "Join"}
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Don't have one? Ask your teacher.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Join another class</p>
          <p className="text-xs text-muted-foreground">Enter a 6-character join code from your teacher.</p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="h-10 w-full sm:w-40 text-center font-mono tracking-[0.3em]"
            maxLength={6}
          />
          <Button onClick={join} disabled={busy || code.trim().length < 4} className="h-10">
            {busy ? "Joining..." : "Join"}
          </Button>
        </div>
      </div>
    </Card>
  );
}