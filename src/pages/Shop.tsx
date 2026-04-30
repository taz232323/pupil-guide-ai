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

type Cosmetic = { key: string; name: string; cost: number; emoji: string; desc: string };
type Privilege = { key: string; name: string; cost: number; desc: string };

const COSMETICS: Cosmetic[] = [
  { key: "hat_wizard", name: "Wizard Hat", cost: 10, emoji: "🧙", desc: "A pointy hat for your avatar." },
  { key: "glasses", name: "Cool Shades", cost: 15, emoji: "🕶️", desc: "Stay cool in class." },
  { key: "crown_silver", name: "Silver Crown", cost: 25, emoji: "👑", desc: "Royal vibes, silver tier." },
  { key: "halo", name: "Halo", cost: 40, emoji: "😇", desc: "For the truly studious." },
  { key: "robot", name: "Robot Face", cost: 60, emoji: "🤖", desc: "Beep boop." },
  { key: "rainbow_aura", name: "Rainbow Aura", cost: 100, emoji: "🌈", desc: "Glow around your avatar." },
];

const PRIVILEGES: Privilege[] = [
  { key: "homework_pass", name: "Homework Pass", cost: 50, desc: "Skip one homework assignment (teacher approval required)." },
  { key: "seat_swap", name: "Seat Swap", cost: 30, desc: "Swap seats with a classmate for a day." },
];

export function Shop() {
  const { user } = useAuth();
  const [coins, setCoins] = useState({ star: 0, crown: 0 });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const [{ data: c }, { data: cl }, { data: p }] = await Promise.all([
      supabase.from("student_coins").select("star_coins, crown_coins").eq("student_id", user.id).maybeSingle(),
      supabase.from("class_members").select("class_id, classes!inner(id, name)").eq("student_id", user.id),
      supabase.from("shop_purchases").select("item_key, kind, status").eq("student_id", user.id),
    ]);
    if (c) setCoins({ star: c.star_coins, crown: c.crown_coins });
    const cls = (cl ?? []).map((r: any) => ({ id: r.classes.id, name: r.classes.name }));
    setClasses(cls);
    if (!classId && cls[0]) setClassId(cls[0].id);
    setOwned(new Set((p ?? []).filter((x: any) => x.kind === "cosmetic" && x.status === "approved").map((x: any) => x.item_key)));
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const buy = async (item: Cosmetic | Privilege, kind: "cosmetic" | "privilege") => {
    if (!user) return;
    if (kind === "privilege" && !classId) {
      toast.error("Pick a class first");
      return;
    }
    setLoading(item.key);
    // Server-side trigger fills item_name, kind, currency, cost, and status from the canonical shop_items table.
    const { error } = await supabase.from("shop_purchases").insert({
      student_id: user.id,
      class_id: kind === "privilege" ? classId : null,
      item_key: item.key,
      // The fields below are required by the table schema but will be overwritten by the trigger.
      item_name: item.name,
      kind,
      currency: kind === "cosmetic" ? "star" : "crown",
      cost: item.cost,
    });
    setLoading(null);
    if (error) {
      toast.error(error.message.includes("Insufficient") ? "Not enough coins" : error.message);
      return;
    }
    toast.success(kind === "cosmetic" ? `Purchased ${item.name}` : `Requested ${item.name} — pending approval`);
    refresh();
  };

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
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> {coins.star}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
              <Crown className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" /> {coins.crown}
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
              {COSMETICS.map((c) => {
                const isOwned = owned.has(c.key);
                const canAfford = coins.star >= c.cost;
                return (
                  <div key={c.key} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-md bg-muted inline-flex items-center justify-center text-2xl">{c.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{c.desc}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> {c.cost}
                      </span>
                      <Button
                        size="sm"
                        disabled={isOwned || !canAfford || loading === c.key}
                        onClick={() => buy(c, "cosmetic")}
                      >
                        {isOwned ? "Owned" : !canAfford ? "Not enough" : "Buy"}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
              {PRIVILEGES.map((p) => {
                const canAfford = coins.crown >= p.cost;
                return (
                  <div key={p.key} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.desc}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500" /> {p.cost}
                      </span>
                      <Button
                        size="sm"
                        disabled={!canAfford || !classId || loading === p.key}
                        onClick={() => buy(p, "privilege")}
                      >
                        {!canAfford ? "Not enough" : "Request"}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
