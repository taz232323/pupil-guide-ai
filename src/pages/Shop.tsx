import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Crown, Sparkles, ShieldCheck, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { notifyStudentCoinsChanged } from "@/lib/studentRefreshEvents";
import wizardHatImg from "@/assets/cosmetics/wizard-hat.png";
import glassesImg from "@/assets/cosmetics/glasses.png";
import crownSilverImg from "@/assets/cosmetics/crown-silver.png";
import haloImg from "@/assets/cosmetics/halo.png";
import robotImg from "@/assets/cosmetics/robot.png";
import rainbowAuraImg from "@/assets/cosmetics/rainbow-aura.png";
import beamsAuraImg from "@/assets/avatar/layers/aura-beams.jpg";

// Image overrides for cosmetic shop tiles — keeps the shop visual in sync
// with the avatar renderer (see StudentAvatar COSMETIC_IMAGE).
const COSMETIC_TILE_IMAGE: Record<string, string> = {
  hat_wizard: wizardHatImg,
  glasses: glassesImg,
  crown_silver: crownSilverImg,
  halo: haloImg,
  robot: robotImg,
  rainbow_aura: rainbowAuraImg,
  aura_beams: beamsAuraImg,
};

type ShopItem = {
  item_key: string;
  item_name: string;
  description: string;
  emoji: string;
  kind: "cosmetic" | "privilege";
  currency: "star" | "crown";
  cost: number;
};

export function Shop() {
  const { user } = useAuth();
  const [coins, setCoins] = useState({ star: 0, crown: 0 });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);

  const refresh = async () => {
    if (!user) return;
    const [{ data: c }, { data: cl }, { data: p }, { data: si }] = await Promise.all([
      supabase.from("student_coins").select("star_coins, crown_coins").eq("student_id", user.id).maybeSingle(),
      supabase.from("class_members").select("class_id, classes!inner(id, name)").eq("student_id", user.id),
      supabase.from("shop_purchases").select("item_key, kind, status").eq("student_id", user.id),
      supabase.from("shop_items")
        .select("item_key, item_name, description, emoji, kind, currency, cost")
        .eq("active", true)
        .order("kind").order("cost"),
    ]);
    if (c) setCoins({ star: c.star_coins, crown: c.crown_coins });
    const cls = (cl ?? []).map((r: any) => ({ id: r.classes.id, name: r.classes.name }));
    setClasses(cls);
    if (!classId && cls[0]) setClassId(cls[0].id);
    setOwned(new Set((p ?? []).filter((x: any) => x.kind === "cosmetic" && x.status === "approved").map((x: any) => x.item_key)));
    setItems((si ?? []) as ShopItem[]);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("shop_items_public")
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_items" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [user]);

  const buy = async (item: ShopItem) => {
    if (!user) return;
    const kind = item.kind;
    if (kind === "privilege" && !classId) {
      toast.error("Pick a class first");
      return;
    }
    setLoading(item.item_key);
    // Server-side trigger fills item_name, kind, currency, cost, and status from the canonical shop_items table.
    const { error } = await supabase.from("shop_purchases").insert({
      student_id: user.id,
      class_id: kind === "privilege" ? classId : null,
      item_key: item.item_key,
      // The fields below are required by the table schema but will be overwritten by the trigger.
      item_name: item.item_name,
      kind,
      currency: item.currency,
      cost: item.cost,
    });
    setLoading(null);
    if (error) {
      toast.error(error.message.includes("Insufficient") ? "Not enough coins" : error.message);
      return;
    }
    toast.success(kind === "cosmetic" ? `Purchased ${item.item_name}` : `Requested ${item.item_name} — pending approval`);
    notifyStudentCoinsChanged({ userId: user.id, reason: "shop_purchase" });
    refresh();
  };

  const cosmetics = items.filter((i) => i.kind === "cosmetic");
  const privileges = items.filter((i) => i.kind === "privilege");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">Shop</CardTitle>
            <CardDescription>Spend your coins on cosmetics and privileges.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {coins.star}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
              <Crown className="h-3.5 w-3.5 fill-plum text-plum" /> {coins.crown}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cosmetics">
          <TabsList>
            <TabsTrigger value="cosmetics"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Cosmetics</TabsTrigger>
            <TabsTrigger value="privileges"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Privileges</TabsTrigger>
          </TabsList>

          <TabsContent value="cosmetics" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cosmetics.map((c) => {
                const isOwned = owned.has(c.item_key);
                const balance = c.currency === "star" ? coins.star : coins.crown;
                const canAfford = balance >= c.cost;
                return (
                  <div key={c.item_key} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-md bg-muted inline-flex items-center justify-center text-2xl overflow-hidden">
                        {COSMETIC_TILE_IMAGE[c.item_key] ? (
                          <img
                            src={COSMETIC_TILE_IMAGE[c.item_key]}
                            alt=""
                            className="h-10 w-10 object-contain"
                            draggable={false}
                          />
                        ) : (
                          c.emoji
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{c.item_name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        {c.currency === "star"
                          ? <Star className="h-4 w-4 fill-gold text-gold" />
                          : <Crown className="h-4 w-4 fill-plum text-plum" />}
                        {c.cost}
                      </span>
                      <Button
                        size="sm"
                        disabled={isOwned || !canAfford || loading === c.item_key}
                        onClick={() => buy(c)}
                      >
                        {isOwned ? "Owned" : !canAfford ? "Not enough" : "Buy"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {cosmetics.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">No cosmetics available yet.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="privileges" className="mt-4 space-y-4">
            {classes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Class:</span>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {privileges.map((p) => {
                const balance = p.currency === "star" ? coins.star : coins.crown;
                const canAfford = balance >= p.cost;
                return (
                  <div key={p.item_key} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-md bg-muted inline-flex items-center justify-center text-2xl shrink-0">{p.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{p.item_name}</div>
                        <div className="text-xs text-muted-foreground">{p.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        {p.currency === "star"
                          ? <Star className="h-4 w-4 fill-gold text-gold" />
                          : <Crown className="h-4 w-4 fill-plum text-plum" />}
                        {p.cost}
                      </span>
                      <Button
                        size="sm"
                        disabled={!canAfford || !classId || loading === p.item_key}
                        onClick={() => buy(p)}
                      >
                        {!canAfford ? "Not enough" : "Request"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {privileges.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">No privileges available yet.</p>
              )}
            </div>
            {classes.length === 0 && (
              <div className="mt-4">
                <EmptyState
                  icon={BookOpen}
                  title="Join a class first"
                  description="Privilege requests are sent to your teacher, so you'll need to be in a class to request them."
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
