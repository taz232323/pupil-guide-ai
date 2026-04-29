import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudentAvatar, COSMETIC_EMOJI } from "@/components/StudentAvatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ITEM_NAMES: Record<string, string> = {
  hat_wizard: "Wizard Hat",
  glasses: "Cool Shades",
  crown_silver: "Silver Crown",
  halo: "Halo",
  robot: "Robot Face",
  rainbow_aura: "Rainbow Aura",
};

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: purchases }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_items").eq("id", user.id).maybeSingle(),
        supabase.from("shop_purchases").select("item_key").eq("student_id", user.id).eq("kind", "cosmetic").eq("status", "approved"),
      ]);
      setName(prof?.full_name ?? "");
      setEquipped((prof?.avatar_items ?? []) as string[]);
      setOwned(Array.from(new Set((purchases ?? []).map((p: any) => p.item_key))));
      setLoading(false);
    })();
  }, [user]);

  const toggle = (key: string) => {
    setEquipped((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ full_name: name.trim() || null, avatar_items: equipped })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
  };

  return (
    <DashboardShell title="My profile">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>How others see you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <StudentAvatar name={name || "You"} items={equipped} size="lg" />
            <p className="text-sm font-medium">{name || "Unnamed student"}</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {equipped.length === 0 ? (
                <span className="text-xs text-muted-foreground">No items equipped</span>
              ) : equipped.map((k) => (
                <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                  {COSMETIC_EMOJI[k]} {ITEM_NAMES[k] ?? k}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avatar builder</CardTitle>
            <CardDescription>Equip items you've unlocked from the shop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="full-name">Display name</Label>
              <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Your collection</p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : owned.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You don't own any cosmetics yet. Visit the shop to unlock items.
                </p>
              ) : (
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                  {owned.map((key) => {
                    const isOn = equipped.includes(key);
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => toggle(key)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                          isOn ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                        )}
                      >
                        <span className="text-2xl">{COSMETIC_EMOJI[key] ?? "✨"}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{ITEM_NAMES[key] ?? key}</span>
                          <span className="text-xs text-muted-foreground">{isOn ? "Equipped" : "Tap to equip"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
