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
  SPECIES,
  FUR_HEX,
  FUR_PATTERNS,
  CLOTHES_HEX,
  type AvatarCategory,
  type AvatarState,
} from "@/components/StudentAvatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Lock, Sparkles, Check, Star, ShoppingBag, Gem, User } from "lucide-react";
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
  species: "Species",
  furColor: "Coat color",
  furPattern: "Coat pattern",
  eyes: "Eyes",
  clothesColor: "Clothing color",
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

const FUR_LABEL: Record<string, string> = {
  fur_orange: "Orange",
  fur_red: "Red",
  fur_brown: "Brown",
  fur_grey: "Grey",
  fur_black: "Black",
  fur_white: "White",
  fur_cream: "Cream",
};

const BUILDER: BuilderOption[] = [
  // Species (animals)
  ...Object.entries(SPECIES).map(([k, v]) => ({
    key: k, name: v.name, category: "species" as BuilderCategory,
  })),
  // Fur color — full palette (filtered per species at render time)
  ...Object.entries(FUR_HEX).map(([k, hex]) => ({
    key: k, name: FUR_LABEL[k] ?? k, category: "furColor" as BuilderCategory, swatch: hex,
  })),
  // Fur patterns
  ...Object.entries(FUR_PATTERNS).map(([k, label]) => ({
    key: k, name: label, category: "furPattern" as BuilderCategory,
  })),
  // Eyes
  { key: "eyes_default", name: "Default", category: "eyes" },
  { key: "eyes_happy",   name: "Happy",   category: "eyes" },
  { key: "eyes_wink",    name: "Wink",    category: "eyes" },
  { key: "eyes_sleepy",  name: "Sleepy",  category: "eyes" },
  { key: "eyes_star",    name: "Star",    category: "eyes" },
  // Clothing color
  { key: "clothes_purple", name: "Purple", category: "clothesColor", swatch: CLOTHES_HEX.clothes_purple },
  { key: "clothes_blue",   name: "Blue",   category: "clothesColor", swatch: CLOTHES_HEX.clothes_blue },
  { key: "clothes_green",  name: "Green",  category: "clothesColor", swatch: CLOTHES_HEX.clothes_green },
  { key: "clothes_red",    name: "Red",    category: "clothesColor", swatch: CLOTHES_HEX.clothes_red },
  { key: "clothes_yellow", name: "Yellow", category: "clothesColor", swatch: CLOTHES_HEX.clothes_yellow },
  { key: "clothes_pink",   name: "Pink",   category: "clothesColor", swatch: CLOTHES_HEX.clothes_pink },
  { key: "clothes_black",  name: "Black",  category: "clothesColor", swatch: CLOTHES_HEX.clothes_black },
  { key: "clothes_white",  name: "White",  category: "clothesColor", swatch: CLOTHES_HEX.clothes_white },
  // Headwear cosmetics (require purchase)
  { key: "hat_wizard",   name: "Wizard Hat",   category: "headwear", cost: 10, thumb: AVATAR_THUMBNAILS.hat_wizard },
  { key: "halo",         name: "Halo",         category: "headwear", cost: 40, thumb: AVATAR_THUMBNAILS.halo },
  { key: "crown_silver", name: "Silver Crown", category: "headwear", cost: 25, thumb: AVATAR_THUMBNAILS.crown_silver },
  // Accessories
  { key: "glasses",       name: "Glasses",    category: "accessory" },
  { key: "sunglasses",    name: "Sunglasses", category: "accessory", cost: 15 },
  { key: "round_glasses", name: "Round",      category: "accessory" },
  { key: "wayfarers",     name: "Wayfarers",  category: "accessory", cost: 20 },
  // Aura backgrounds
  { key: "aura_magic",   name: "Magic",   category: "aura", thumb: AVATAR_THUMBNAILS.aura_magic },
  { key: "rainbow_aura", name: "Rainbow", category: "aura", cost: 100, thumb: AVATAR_THUMBNAILS.rainbow_aura },
];

const OPTION_BY_KEY: Record<string, BuilderOption> = Object.fromEntries(BUILDER.map((o) => [o.key, o]));

const APPEARANCE_CATEGORIES: BuilderCategory[] = [
  "species",
  "eyes",
  "clothesColor",
];
const COSMETIC_CATEGORIES: BuilderCategory[] = ["headwear", "accessory", "aura"];

type Rarity = "common" | "rare" | "epic" | "legendary";
function rarityFor(cost?: number): Rarity {
  if (!cost) return "common";
  if (cost < 20) return "rare";
  if (cost < 60) return "epic";
  return "legendary";
}
const RARITY_STYLE: Record<Rarity, { ring: string; chip: string; label: string }> = {
  common:    { ring: "ring-border/40",            chip: "bg-muted text-muted-foreground",                                label: "Common"    },
  rare:      { ring: "ring-sky-400/60",           chip: "bg-sky-500/15 text-sky-600 dark:text-sky-300",                  label: "Rare"      },
  epic:      { ring: "ring-violet-400/70",        chip: "bg-violet-500/15 text-violet-600 dark:text-violet-300",         label: "Epic"      },
  legendary: { ring: "ring-amber-400/80",         chip: "bg-amber-500/20 text-amber-700 dark:text-amber-300",            label: "Legendary" },
};

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
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
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

  /** Buy a premium cosmetic inline. Uses shop_purchases — trigger handles cost & balance. */
  const purchase = async (opt: BuilderOption) => {
    if (!user || !opt.cost) return;
    if (owned.has(opt.key)) return;
    if (coins < opt.cost) { toast.error("Not enough star coins"); return; }
    setPurchasing(opt.key);
    const { error } = await supabase.from("shop_purchases").insert({
      student_id: user.id,
      item_key: opt.key,
      // The server trigger overrides these from shop_items.
      item_name: opt.name,
      kind: "cosmetic",
      currency: "star",
      cost: opt.cost,
    });
    setPurchasing(null);
    if (error) {
      toast.error(error.message.includes("Insufficient") ? "Not enough star coins" : error.message);
      return;
    }
    setOwned((prev) => new Set(prev).add(opt.key));
    setCoins((c) => c - opt.cost!);
    setPreviewAvatar((prev) => updateAvatarState(prev, opt.key));
    setJustUnlocked(opt.key);
    setTimeout(() => setJustUnlocked((v) => (v === opt.key ? null : v)), 1800);
    toast.success(`Unlocked ${opt.name}!`);
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
            {(() => {
              const renderCategoryPanel = (cat: BuilderCategory) => {
                let catItems = BUILDER.filter((o) => o.category === cat);
                if (cat === "furColor") {
                  const sp = SPECIES[previewAvatar.species];
                  if (sp) catItems = catItems.filter((o) => sp.allowedFur.includes(o.key));
                }
                // Owls use feathers — no fur pattern overlay.
                if (cat === "furPattern" && previewAvatar.species === "species_owl") {
                  return (
                    <p className="text-sm text-muted-foreground px-1 py-3">
                      Owls have smooth feathered plumage — no pattern needed.
                    </p>
                  );
                }
                const activeKey = previewAvatar[cat];
                const isCosmeticTab = COSMETIC_CATEGORIES.includes(cat);
                return (
                  <div className="flex sm:grid gap-3 sm:grid-cols-3 md:grid-cols-4 overflow-x-auto pb-2 sm:overflow-visible snap-x snap-mandatory -mx-1 px-1">
                    {(cat === "headwear" || cat === "accessory" || cat === "aura") && (
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
                      const rarity = rarityFor(opt.cost);
                      const rs = RARITY_STYLE[rarity];
                      const unlocking = justUnlocked === opt.key;
                      const canAfford = coins >= (opt.cost ?? 0);
                      const livePreview = !opt.thumb && !opt.swatch
                        ? (() => {
                            // For species tiles, always preview with that species' signature color
                            // so users see e.g. grey wolf, white rabbit, orange cat — not the
                            // currently-equipped fur recolored across all options.
                            if (opt.category === "species") {
                              const sp = SPECIES[opt.key];
                              const base = sp
                                ? { ...previewAvatar, species: opt.key, furColor: sp.defaultFur, headwear: "" }
                                : { ...previewAvatar, headwear: "" };
                              return getAvatarDataUri(base, name || "you");
                            }
                            return getAvatarDataUri(updateAvatarState({ ...previewAvatar, headwear: "" }, opt.key), name || "you");
                          })()
                        : null;
                      return (
                        <div
                          key={opt.key}
                          className={cn(
                            "snap-start shrink-0 sm:shrink min-w-[7.5rem] sm:min-w-0 group relative flex flex-col items-center rounded-xl border bg-card p-3 transition-all text-center",
                            isOn && "border-primary ring-2 ring-primary/20 bg-primary/5",
                            !isOn && requiresOwnership && isCosmeticTab && cn("ring-1", rs.ring),
                            unlocking && "animate-pulse ring-2 ring-amber-400"
                          )}
                        >
                          {/* Rarity chip for premium tiles */}
                          {requiresOwnership && isCosmeticTab && (
                            <span className={cn(
                              "absolute top-2 left-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                              rs.chip
                            )}>
                              {rs.label}
                            </span>
                          )}
                          {isOn && (
                            <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => selectOption(opt.key)}
                            disabled={!isOwned}
                            className={cn(
                              "w-full flex flex-col items-center focus:outline-none",
                              isOwned && !isOn && "hover:-translate-y-0.5 transition-transform",
                              !isOwned && "cursor-not-allowed"
                            )}
                          >
                            <div className={cn(
                              "relative h-14 w-14 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden mb-2 mt-3",
                              !isOwned && "grayscale opacity-80"
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
                          </button>
                          <div className="mt-2 min-h-[28px] w-full flex items-center justify-center">
                            {isOn ? (
                              <Badge variant="default" className="text-[10px]">Equipped</Badge>
                            ) : !isOwned ? (
                              <Button
                                type="button"
                                size="sm"
                                variant={canAfford ? "default" : "outline"}
                                disabled={!canAfford || purchasing === opt.key}
                                onClick={() => purchase(opt)}
                                className="h-7 px-2 text-[11px] gap-1"
                              >
                                <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                                {purchasing === opt.key ? "..." : canAfford ? `Buy · ${opt.cost}` : `Need ${opt.cost}`}
                              </Button>
                            ) : requiresOwnership ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                <Check className="h-3 w-3 text-emerald-500" /> Owned
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              };

              const SubTabs = ({ cats, defaultCat }: { cats: BuilderCategory[]; defaultCat: BuilderCategory }) => (
                <Tabs defaultValue={defaultCat}>
                  <TabsList className="flex w-full justify-start overflow-x-auto">
                    {cats.map((c) => (
                      <TabsTrigger key={c} value={c}>{CATEGORY_LABEL[c]}</TabsTrigger>
                    ))}
                  </TabsList>
                  {cats.map((cat) => (
                    <TabsContent key={cat} value={cat} className="mt-5">
                      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : renderCategoryPanel(cat)}
                    </TabsContent>
                  ))}
                </Tabs>
              );

              return (
                <Tabs defaultValue="appearance">
                  <TabsList className="mb-4">
                    <TabsTrigger value="appearance" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Appearance
                      <Badge variant="secondary" className="ml-1 text-[9px] px-1.5">Free</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="cosmetics" className="gap-1.5">
                      <Gem className="h-3.5 w-3.5" /> Cosmetics
                      <Badge variant="outline" className="ml-1 text-[9px] px-1.5 border-amber-400/60 text-amber-600 dark:text-amber-300">Premium</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="appearance">
                    <SubTabs cats={APPEARANCE_CATEGORIES} defaultCat="species" />
                  </TabsContent>
                  <TabsContent value="cosmetics">
                    <SubTabs cats={COSMETIC_CATEGORIES} defaultCat="headwear" />
                    <p className="mt-4 text-xs text-muted-foreground text-center inline-flex items-center justify-center gap-1.5 w-full">
                      <ShoppingBag className="h-3 w-3" />
                      Earn star coins from assignments &amp; daily practice — then unlock cosmetics right here.
                    </p>
                  </TabsContent>
                </Tabs>
              );
            })()}
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
