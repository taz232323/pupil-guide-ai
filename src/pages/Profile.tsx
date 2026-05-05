import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StudentAvatar, COSMETIC_EMOJI } from "@/components/StudentAvatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Lock, Sparkles, Check, Star } from "lucide-react";
import { Moon, Sun, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";
import { useAuth as useAuthForRole } from "@/hooks/useAuth";

type Category = "hair" | "face" | "outfit" | "background";

type CosmeticItem = {
  key: string;
  name: string;
  cost: number;
  emoji: string;
  category: Category;
};

const ITEMS: CosmeticItem[] = [
  { key: "hat_wizard",   name: "Wizard Hat",   cost: 10,  emoji: "🧙",  category: "hair" },
  { key: "halo",         name: "Halo",         cost: 40,  emoji: "😇",  category: "hair" },
  { key: "crown_silver", name: "Silver Crown", cost: 25,  emoji: "👑",  category: "hair" },
  { key: "glasses",      name: "Cool Shades",  cost: 15,  emoji: "🕶️", category: "face" },
  { key: "robot",        name: "Robot Face",   cost: 60,  emoji: "🤖",  category: "face" },
  { key: "rainbow_aura", name: "Rainbow Aura", cost: 100, emoji: "🌈",  category: "background" },
];

const CATEGORY_LABEL: Record<Category, string> = {
  hair: "Hair",
  face: "Face",
  outfit: "Outfit",
  background: "Background",
};

export default function Profile() {
  const { user, role } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<string[]>([]);
  const [originalEquipped, setOriginalEquipped] = useState<string[]>([]);
  const [coins, setCoins] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inappOn, setInappOn] = useState(true);
  const [emailOn, setEmailOn] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: purchases }, { data: coinRow }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_items, inapp_reminders_enabled, email_reminders_enabled").eq("id", user.id).maybeSingle(),
        supabase.from("shop_purchases").select("item_key").eq("student_id", user.id).eq("kind", "cosmetic").eq("status", "approved"),
        supabase.from("student_coins").select("star_coins").eq("student_id", user.id).maybeSingle(),
      ]);
      setName(prof?.full_name ?? "");
      const eq = (prof?.avatar_items ?? []) as string[];
      setEquipped(eq);
      setOriginalEquipped(eq);
      setInappOn((prof as any)?.inapp_reminders_enabled !== false);
      setEmailOn((prof as any)?.email_reminders_enabled !== false);
      setOwned(new Set((purchases ?? []).map((p: any) => p.item_key)));
      setCoins(coinRow?.star_coins ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const toggle = (key: string) => {
    if (!owned.has(key)) return;
    setEquipped((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const dirty =
    equipped.length !== originalEquipped.length ||
    equipped.some((k) => !originalEquipped.includes(k));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ full_name: name.trim() || null, avatar_items: equipped })
      .eq("id", user.id);
    setSaving(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    setOriginalEquipped(equipped);
    toast.success("Avatar saved");
  };

  return (
    <DashboardShell title="My profile">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Live preview */}
        <Card className="overflow-hidden">
          <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/20 px-6 pt-10 pb-8 flex flex-col items-center">
            <div className="absolute inset-0 opacity-40 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.2), transparent 50%), radial-gradient(circle at 80% 80%, hsl(var(--secondary)/0.25), transparent 50%)" }}
            />
            <div className="relative">
              <StudentAvatar name={name || "You"} items={equipped} size="lg" className="h-32 w-32 text-5xl ring-4 ring-background shadow-xl" />
            </div>
            <p className="relative mt-4 text-lg font-semibold">{name || "Unnamed student"}</p>
            <p className="relative text-xs text-muted-foreground mt-0.5">Live preview</p>
          </div>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label htmlFor="full-name">Display name</Label>
              <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">Your balance</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                {coins} <span className="font-normal text-muted-foreground">stars</span>
              </span>
            </div>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={!dirty || saving}>
                  <Check className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Avatar"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save your avatar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {equipped.length === 0
                      ? "You're saving with no items equipped."
                      : `You'll equip ${equipped.length} item${equipped.length === 1 ? "" : "s"}.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={save} disabled={saving}>
                    {saving ? "Saving..." : "Confirm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Avatar builder
            </CardTitle>
            <CardDescription>Pick items by category. Locked items show their unlock cost.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="hair">
              <TabsList className="grid grid-cols-4 w-full">
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <TabsTrigger key={c} value={c}>{CATEGORY_LABEL[c]}</TabsTrigger>
                ))}
              </TabsList>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
                const catItems = ITEMS.filter((i) => i.category === cat);
                return (
                  <TabsContent key={cat} value={cat} className="mt-5">
                    {loading ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : catItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                        No {CATEGORY_LABEL[cat].toLowerCase()} items yet — check back soon!
                      </div>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                        {catItems.map((item) => {
                          const isOwned = owned.has(item.key);
                          const isOn = equipped.includes(item.key);
                          return (
                            <button
                              type="button"
                              key={item.key}
                              onClick={() => toggle(item.key)}
                              disabled={!isOwned}
                              className={cn(
                                "group relative flex flex-col items-center rounded-xl border bg-card p-4 transition-all text-center",
                                isOwned && !isOn && "hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5",
                                isOn && "border-primary ring-2 ring-primary/20 bg-primary/5",
                                !isOwned && "opacity-90 cursor-not-allowed"
                              )}
                            >
                              {isOn && (
                                <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                              <div className={cn(
                                "relative h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center text-3xl mb-2",
                                !isOwned && "grayscale"
                              )}>
                                <span aria-hidden>{item.emoji ?? COSMETIC_EMOJI[item.key]}</span>
                                {!isOwned && (
                                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-[1px]">
                                    <Lock className="h-5 w-5 text-muted-foreground" />
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-medium leading-tight">{item.name}</span>
                              <div className="mt-2">
                                {isOwned ? (
                                  <Badge variant={isOn ? "default" : "secondary"} className="text-[10px]">
                                    {isOn ? "Equipped" : "Owned"}
                                  </Badge>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                    {item.cost}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!loading && catItems.some((i) => !owned.has(i.key)) && (
                      <p className="mt-4 text-xs text-muted-foreground text-center">
                        Earn star coins by completing assignments, then unlock items in the Shop.
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how the app looks. Your preference is saved to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background border">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 text-primary" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">
                  {theme === "dark" ? "Dark theme is on" : "Light theme is on"}
                </p>
              </div>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => {
                void setTheme(checked ? "dark" : "light");
                toast.success(checked ? "Dark mode enabled" : "Light mode enabled");
              }}
              aria-label="Toggle dark mode"
            />
          </div>
        </CardContent>
      </Card>

      {role === "student" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notification preferences</CardTitle>
            <CardDescription>Choose how you'd like to hear about upcoming assignment due dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">In-app reminders</p>
                <p className="text-xs text-muted-foreground">Get a notification 3 days and 24 hours before each assignment is due.</p>
              </div>
              <Switch
                checked={inappOn}
                onCheckedChange={async (v) => {
                  setInappOn(v);
                  const { error } = await supabase.from("profiles").update({ inapp_reminders_enabled: v }).eq("id", user!.id);
                  if (error) toast.error(error.message);
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Email reminders</p>
                <p className="text-xs text-muted-foreground">Get an email at the same times. (Email delivery activates once an email domain is connected.)</p>
              </div>
              <Switch
                checked={emailOn}
                onCheckedChange={async (v) => {
                  setEmailOn(v);
                  const { error } = await supabase.from("profiles").update({ email_reminders_enabled: v }).eq("id", user!.id);
                  if (error) toast.error(error.message);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
