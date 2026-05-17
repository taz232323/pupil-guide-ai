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
import {
  StudentAvatar,
  DEFAULT_AVATAR_STATE,
  avatarStateFromItems,
  avatarStateToItems,
  clearAvatarCategory,
  sameAvatarState,
  updateAvatarState,
  getAvatarDataUri,
  AVATAR_THUMBNAILS,
  type AvatarCategory,
  type AvatarState,
} from "@/components/StudentAvatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Lock, Sparkles, Check, Star } from "lucide-react";
import { Moon, Sun, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";

/* ------------------------------------------------------------------ *
 *  AVATAR BUILDER CATALOG
 *  All parts share ONE base character frame so they always align.
 *  Cosmetics use the existing item ownership system (shop_purchases).
 *  Base parts (skin/hair-style/shirt-color) are unlocked by default.
 * ------------------------------------------------------------------ */

type BuilderCategory = AvatarCategory;

const CATEGORY_LABEL: Record<BuilderCategory, string> = {
  skinTone: "Skin",
  hairStyle: "Hair",
  hairColor: "Hair color",
  eyes: "Eyes",
  clothing: "Clothing",
  clothesColor: "Clothes color",
  headwear: "Headwear",
  accessory: "Accessory",
  aura: "Aura",
};

type BuilderOption = {
  key: string;             // unique key stored in avatar_items
  name: string;
  category: BuilderCategory;
  /** If set, requires ownership via shop_purchases. Otherwise free. */
  cost?: number;
  /** Swatch color shown in the picker tile. */
  swatch?: string;
  /** Optional thumbnail image. */
  thumb?: string;
};

const BUILDER: BuilderOption[] = [
  // Skin
  { key: "skin_light", name: "Light", category: "skinTone", swatch: "#ffdbb4" },
  { key: "skin_tan",   name: "Tan",   category: "skinTone", swatch: "#edb98a" },
  { key: "skin_brown", name: "Brown", category: "skinTone", swatch: "#d08b5b" },
  { key: "skin_deep",  name: "Deep",  category: "skinTone", swatch: "#614335" },
  // Hair styles (preview rendered live)
  { key: "hairstyle_short",  name: "Short",  category: "hairStyle" },
  { key: "hairstyle_long",   name: "Long",   category: "hairStyle" },
  { key: "hairstyle_curly",  name: "Curly",  category: "hairStyle" },
  { key: "hairstyle_bun",    name: "Bun",    category: "hairStyle" },
  { key: "hairstyle_buzz",   name: "Buzz",   category: "hairStyle" },
  { key: "hairstyle_dreads", name: "Dreads", category: "hairStyle" },
  { key: "hairstyle_big",    name: "Big",    category: "hairStyle" },
  // Hair color
  { key: "hair_brown",  name: "Brown",  category: "hairColor", swatch: "#724133" },
  { key: "hair_black",  name: "Black",  category: "hairColor", swatch: "#2c1b18" },
  { key: "hair_blonde", name: "Blonde", category: "hairColor", swatch: "#b58143" },
  { key: "hair_red",    name: "Red",    category: "hairColor", swatch: "#c93305" },
  // Eyes
  { key: "eyes_default", name: "Default", category: "eyes" },
  { key: "eyes_happy",   name: "Happy",   category: "eyes" },
  { key: "eyes_wink",    name: "Wink",    category: "eyes" },
  { key: "eyes_squint",  name: "Squint",  category: "eyes" },
  { key: "eyes_hearts",  name: "Hearts",  category: "eyes" },
  // Clothing styles
  { key: "clothes_hoodie",  name: "Hoodie",  category: "clothing" },
  { key: "clothes_blazer",  name: "Blazer",  category: "clothing" },
  { key: "clothes_shirt",   name: "T-shirt", category: "clothing" },
  { key: "clothes_vneck",   name: "V-neck",  category: "clothing" },
  { key: "clothes_overall", name: "Overall", category: "clothing" },
  { key: "clothes_collar",  name: "Sweater", category: "clothing" },
  // Clothes color
  { key: "clothes_purple", name: "Purple", category: "clothesColor", swatch: "#6d3bd1" },
  { key: "clothes_blue",   name: "Blue",   category: "clothesColor", swatch: "#5199e4" },
  { key: "clothes_green",  name: "Green",  category: "clothesColor", swatch: "#7ad9a1" },
  { key: "clothes_red",    name: "Red",    category: "clothesColor", swatch: "#ff5c5c" },
  { key: "clothes_black",  name: "Black",  category: "clothesColor", swatch: "#262e33" },
  { key: "clothes_white",  name: "White",  category: "clothesColor", swatch: "#ffffff" },
  // Headwear cosmetics (require purchase)
  { key: "hat_wizard", name: "Wizard Hat", category: "headwear", cost: 10, thumb: AVATAR_THUMBNAILS.hat_wizard },
  { key: "halo", name: "Halo", category: "headwear", cost: 40, thumb: AVATAR_THUMBNAILS.halo },
  { key: "crown_silver", name: "Silver Crown", category: "headwear", cost: 25, thumb: AVATAR_THUMBNAILS.crown_silver },
  // Accessories (DiceBear-rendered glasses)
  { key: "glasses",       name: "Glasses",    category: "accessory" },
  { key: "sunglasses",    name: "Sunglasses", category: "accessory", cost: 15 },
  { key: "round_glasses", name: "Round",      category: "accessory" },
  { key: "wayfarers",     name: "Wayfarers",  category: "accessory", cost: 20 },
  // Aura backgrounds
  { key: "aura_magic",   name: "Magic",   category: "aura", thumb: AVATAR_THUMBNAILS.aura_magic },
  { key: "rainbow_aura", name: "Rainbow", category: "aura", cost: 100, thumb: AVATAR_THUMBNAILS.rainbow_aura },
];

const OPTION_BY_KEY: Record<string, BuilderOption> = Object.fromEntries(BUILDER.map((o) => [o.key, o]));

const BUILDER_CATEGORIES: BuilderCategory[] = [
  "skinTone",
  "hairStyle",
  "hairColor",
  "eyes",
  "clothing",
  "clothesColor",
  "headwear",
  "accessory",
  "aura",
];

export default function Profile() {
  const { user, role } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [previewAvatar, setPreviewAvatar] = useState<AvatarState>(DEFAULT_AVATAR_STATE);
  const [savedAvatar, setSavedAvatar] = useState<AvatarState>(DEFAULT_AVATAR_STATE);
  const [coins, setCoins] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inappOn, setInappOn] = useState(true);
  const [emailOn, setEmailOn] = useState(true);
  const [lbUsername, setLbUsername] = useState("");
  const [lbOriginal, setLbOriginal] = useState("");
  const [savingLb, setSavingLb] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: purchases }, { data: coinRow }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_items, inapp_reminders_enabled, email_reminders_enabled, leaderboard_username").eq("id", user.id).maybeSingle(),
        supabase.from("shop_purchases").select("item_key").eq("student_id", user.id).eq("kind", "cosmetic").eq("status", "approved"),
        supabase.from("student_coins").select("star_coins").eq("student_id", user.id).maybeSingle(),
      ]);
      setName(prof?.full_name ?? "");
      setOriginalName(prof?.full_name ?? "");
      const loadedAvatar = avatarStateFromItems((prof?.avatar_items ?? []) as string[]);
      setPreviewAvatar(loadedAvatar);
      setSavedAvatar(loadedAvatar);
      setInappOn((prof as any)?.inapp_reminders_enabled !== false);
      setEmailOn((prof as any)?.email_reminders_enabled !== false);
      setLbUsername((prof as any)?.leaderboard_username ?? "");
      setLbOriginal((prof as any)?.leaderboard_username ?? "");
      setOwned(new Set((purchases ?? []).map((p: any) => p.item_key)));
      setCoins(coinRow?.star_coins ?? 0);
      setLoading(false);
    })();
  }, [user]);

  /** Equip an option, enforcing one-per-category. Cosmetic items must be owned. */
  const selectOption = (optionKey: string) => {
    const opt = OPTION_BY_KEY[optionKey];
    if (!opt) return;
    if (opt.cost && !owned.has(optionKey)) return;
    setPreviewAvatar((prev) => updateAvatarState(prev, optionKey));
  };

  /** Unequip the current item in a category (only meaningful for headwear). */
  const clearCategory = (category: BuilderCategory) => {
    setPreviewAvatar((prev) => clearAvatarCategory(prev, category));
  };

  const previewItems = avatarStateToItems(previewAvatar);
  const dirty = !sameAvatarState(previewAvatar, savedAvatar);

  const save = async () => {
    if (!user) return;
    const avatarItems = avatarStateToItems(previewAvatar);
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ avatar_items: avatarItems })
      .eq("id", user.id);
    setSaving(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    setSavedAvatar(previewAvatar);
    window.dispatchEvent(new CustomEvent("profile:updated", { detail: { userId: user.id } }));
    toast.success("Avatar saved");
  };

  const saveName = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Name can't be empty"); return; }
    if (trimmed === originalName) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles")
      .update({ full_name: trimmed })
      .eq("id", user.id);
    setSavingName(false);
    if (error) { toast.error(`Couldn't save name: ${error.message}`); return; }
    setOriginalName(trimmed);
    setName(trimmed);
    window.dispatchEvent(new CustomEvent("profile:updated", { detail: { userId: user.id, full_name: trimmed } }));
    toast.success("Name updated successfully");
  };

  return (
    <DashboardShell title="My profile">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Live preview */}
        <Card className="overflow-hidden">
          <div className="relative bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/30 px-6 pt-10 pb-8 flex flex-col items-center">
            <div className="absolute inset-0 opacity-50 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.25), transparent 55%), radial-gradient(circle at 80% 80%, hsl(var(--secondary)/0.3), transparent 55%)" }}
            />
            <div className="relative">
              {/* Soft glow pedestal behind the character card */}
              <div
                aria-hidden
                className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/30 via-transparent to-secondary/40 blur-xl opacity-70"
              />
              <StudentAvatar
                name={name || "You"}
                avatarState={previewAvatar}
                size="xl"
                frame="card"
                className="relative h-44 w-44 sm:h-48 sm:w-48 text-6xl ring-1 ring-border/60 shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.55)]"
              />
              {/* Faux ground shadow for game-card depth */}
              <div
                aria-hidden
                className="mx-auto mt-2 h-2 w-32 rounded-full bg-foreground/20 blur-md"
              />
            </div>
            <p className="relative mt-3 text-lg font-semibold tracking-tight">{name || "Unnamed student"}</p>
            <p className="relative text-xs text-muted-foreground mt-0.5 uppercase tracking-[0.18em]">Character preview</p>
          </div>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label htmlFor="full-name">Display name</Label>
              <div className="flex gap-2">
                <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                <Button
                  type="button"
                  onClick={saveName}
                  disabled={savingName || !name.trim() || name.trim() === originalName}
                >
                  {savingName ? "Saving..." : "Save"}
                </Button>
              </div>
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
                    {previewItems.length === 0
                      ? "You're saving with no items equipped."
                      : `You'll save ${previewItems.length} selection${previewItems.length === 1 ? "" : "s"}.`}
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
            <Tabs defaultValue="skinTone">
              <TabsList className="flex w-full justify-start overflow-x-auto">
                {BUILDER_CATEGORIES.map((c) => (
                  <TabsTrigger key={c} value={c}>{CATEGORY_LABEL[c]}</TabsTrigger>
                ))}
              </TabsList>
              {BUILDER_CATEGORIES.map((cat) => {
                const catItems = BUILDER.filter((o) => o.category === cat);
                const activeKey = previewAvatar[cat];
                return (
                  <TabsContent key={cat} value={cat} className="mt-5">
                    {loading ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : (
                      <>
                        {/* Mobile: horizontal scroll. Desktop: grid. */}
                        <div className="flex sm:grid gap-3 sm:grid-cols-3 md:grid-cols-4 overflow-x-auto pb-2 sm:overflow-visible snap-x snap-mandatory -mx-1 px-1">
                          {(cat === "headwear" || cat === "accessory") && (
                            <button
                              type="button"
                              onClick={() => clearCategory(cat)}
                              className={cn(
                                "snap-start shrink-0 sm:shrink min-w-[7rem] sm:min-w-0 flex flex-col items-center rounded-xl border bg-card p-3 transition-all text-center",
                                !activeKey && "border-primary ring-2 ring-primary/20 bg-primary/5",
                                activeKey && "hover:border-primary/40 hover:-translate-y-0.5"
                              )}
                            >
                              <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center text-2xl mb-2">∅</div>
                              <span className="text-sm font-medium leading-tight">None</span>
                            </button>
                          )}
                          {catItems.map((opt) => {
                            const requiresOwnership = !!opt.cost;
                            const isOwned = !requiresOwnership || owned.has(opt.key);
                            const isOn = activeKey === opt.key;
                            // Live mini preview: render current avatar but with this option applied.
                            const livePreview = !opt.thumb && !opt.swatch
                              ? getAvatarDataUri(updateAvatarState({ ...previewAvatar, headwear: "" }, opt.key), name || "you")
                              : null;
                            return (
                              <button
                                type="button"
                                key={opt.key}
                                onClick={() => selectOption(opt.key)}
                                disabled={!isOwned}
                                className={cn(
                                  "snap-start shrink-0 sm:shrink min-w-[7rem] sm:min-w-0 group relative flex flex-col items-center rounded-xl border bg-card p-3 transition-all text-center",
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
                                  "relative h-14 w-14 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden mb-2",
                                  !isOwned && "grayscale"
                                )}>
                                  {livePreview ? (
                                    <img src={livePreview} alt="" className="h-full w-full object-contain" draggable={false} />
                                  ) : opt.thumb ? (
                                    <img src={opt.thumb} alt="" className="h-11 w-11 object-contain" draggable={false} />
                                  ) : opt.swatch ? (
                                    <span
                                      aria-hidden
                                      className="block h-9 w-9 rounded-full border border-border/60 shadow-inner"
                                      style={{ background: opt.swatch }}
                                    />
                                  ) : null}
                                  {!isOwned && (
                                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[1px]">
                                      <Lock className="h-5 w-5 text-muted-foreground" />
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm font-medium leading-tight">{opt.name}</span>
                                <div className="mt-2 min-h-[18px]">
                                  {requiresOwnership && !isOwned && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                      {opt.cost}
                                    </span>
                                  )}
                                  {isOn && (
                                    <Badge variant="default" className="text-[10px]">Equipped</Badge>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {cat === "headwear" && catItems.some((o) => o.cost && !owned.has(o.key)) && (
                          <p className="mt-4 text-xs text-muted-foreground text-center">
                            Earn star coins by completing assignments, then unlock items in the Shop.
                          </p>
                        )}
                      </>
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
            <CardTitle className="text-base">Leaderboard username</CardTitle>
            <CardDescription>Shown on class leaderboards when your teacher turns on anonymous mode.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={lbUsername}
                onChange={(e) => setLbUsername(e.target.value)}
                maxLength={30}
                placeholder="e.g. NightOwl42"
              />
              <Button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const v = lbUsername.trim();
                  if (v.length < 2) { toast.error("Pick at least 2 characters"); return; }
                  if (v === lbOriginal) return;
                  setSavingLb(true);
                  const { error } = await supabase.from("profiles")
                    .update({ leaderboard_username: v }).eq("id", user.id);
                  setSavingLb(false);
                  if (error) { toast.error(error.message); return; }
                  setLbOriginal(v);
                  toast.success("Leaderboard username saved");
                }}
                disabled={savingLb || !lbUsername.trim() || lbUsername.trim() === lbOriginal}
              >
                {savingLb ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
