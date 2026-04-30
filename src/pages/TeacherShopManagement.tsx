import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Star, Crown, Sparkles, ShieldCheck, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { TeacherPrivilegeRequests } from "./TeacherPrivilegeRequests";

type Kind = "cosmetic" | "privilege";
type Currency = "star" | "crown";

type ShopItem = {
  item_key: string;
  item_name: string;
  description: string;
  emoji: string;
  kind: Kind;
  currency: Currency;
  cost: number;
  active: boolean;
};

const empty = (): ShopItem => ({
  item_key: "",
  item_name: "",
  description: "",
  emoji: "🎁",
  kind: "cosmetic",
  currency: "star",
  cost: 10,
  active: true,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

function ItemForm({
  initial,
  isEdit,
  onSubmit,
  onCancel,
}: {
  initial: ShopItem;
  isEdit: boolean;
  onSubmit: (item: ShopItem) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ShopItem>(initial);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof ShopItem>(k: K, v: ShopItem[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_name.trim()) return toast.error("Name is required");
    if (form.cost < 0 || form.cost > 100000) return toast.error("Cost must be 0–100000");
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        item_name: form.item_name.trim().slice(0, 80),
        description: form.description.trim().slice(0, 500),
        emoji: form.emoji.trim().slice(0, 8) || "🎁",
        item_key: isEdit ? form.item_key : slugify(form.item_key || form.item_name) || `item_${Date.now()}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.item_name} onChange={(e) => update("item_name", e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label htmlFor="emoji">Emoji</Label>
          <Input id="emoji" value={form.emoji} onChange={(e) => update("emoji", e.target.value)} maxLength={8} />
        </div>
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} maxLength={500} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={form.kind} onValueChange={(v: Kind) => update("kind", v)} disabled={isEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cosmetic">Cosmetic</SelectItem>
              <SelectItem value="privilege">Privilege</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Coin type</Label>
          <Select value={form.currency} onValueChange={(v: Currency) => update("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="star">Star</SelectItem>
              <SelectItem value="crown">Crown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="cost">Price</Label>
          <Input
            id="cost"
            type="number"
            min={0}
            max={100000}
            value={form.cost}
            onChange={(e) => update("cost", Number.parseInt(e.target.value || "0", 10))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : "Add item"}</Button>
      </DialogFooter>
    </form>
  );
}

export function TeacherShopManagement() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [creating, setCreating] = useState<Kind | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shop_items")
      .select("item_key, item_name, description, emoji, kind, currency, cost, active")
      .order("kind")
      .order("cost");
    if (error) toast.error(error.message);
    setItems((data ?? []) as ShopItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("shop_items_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const upsert = async (item: ShopItem, isEdit: boolean): Promise<void> => {
    if (isEdit) {
      const { error } = await supabase
        .from("shop_items")
        .update({
          item_name: item.item_name,
          description: item.description,
          emoji: item.emoji,
          currency: item.currency,
          cost: item.cost,
        })
        .eq("item_key", item.item_key);
      if (error) { toast.error(error.message); return; }
      toast.success("Item updated");
    } else {
      const { error } = await supabase.from("shop_items").insert({
        item_key: item.item_key,
        item_name: item.item_name,
        description: item.description,
        emoji: item.emoji,
        kind: item.kind,
        currency: item.currency,
        cost: item.cost,
        active: true,
      });
      if (error) {
        if (error.code === "23505") { toast.error("An item with that key already exists"); return; }
        toast.error(error.message);
        return;
      }
      toast.success("Item added");
    }
    setEditing(null);
    setCreating(null);
    load();
  };

  const remove = async (item: ShopItem): Promise<void> => {
    if (!confirm(`Delete "${item.item_name}"? Existing student purchases are kept.`)) return;
    const { error } = await supabase.from("shop_items").delete().eq("item_key", item.item_key);
    if (error) { toast.error(error.message); return; }
    toast.success("Item deleted");
    load();
  };

  const renderList = (kind: Kind) => {
    const list = items.filter((i) => i.kind === kind);
    if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
    if (list.length === 0)
      return <p className="text-sm text-muted-foreground">No {kind} items yet. Add one to get started.</p>;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((it) => (
          <div key={it.item_key} className="rounded-lg border border-border p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-md bg-muted inline-flex items-center justify-center text-2xl shrink-0">{it.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it.item_name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{it.description || "No description"}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-sm font-medium">
                {it.currency === "star"
                  ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  : <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                {it.cost}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(it)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(it)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">Shop management</CardTitle>
              <CardDescription>Edit, add, or remove items students can buy with their coins.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cosmetic">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <TabsList>
                <TabsTrigger value="cosmetic"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Cosmetics</TabsTrigger>
                <TabsTrigger value="privilege"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Privileges</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Dialog open={creating === "cosmetic"} onOpenChange={(o) => setCreating(o ? "cosmetic" : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> Cosmetic</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New cosmetic</DialogTitle></DialogHeader>
                    <ItemForm
                      initial={{ ...empty(), kind: "cosmetic", currency: "star" }}
                      isEdit={false}
                      onSubmit={(it) => upsert(it, false)}
                      onCancel={() => setCreating(null)}
                    />
                  </DialogContent>
                </Dialog>
                <Dialog open={creating === "privilege"} onOpenChange={(o) => setCreating(o ? "privilege" : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-3.5 w-3.5" /> Privilege</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New privilege</DialogTitle></DialogHeader>
                    <ItemForm
                      initial={{ ...empty(), kind: "privilege", currency: "crown", cost: 30 }}
                      isEdit={false}
                      onSubmit={(it) => upsert(it, false)}
                      onCancel={() => setCreating(null)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <TabsContent value="cosmetic" className="mt-4">{renderList("cosmetic")}</TabsContent>
            <TabsContent value="privilege" className="mt-4">{renderList("privilege")}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit item</DialogTitle></DialogHeader>
          {editing && (
            <ItemForm
              initial={editing}
              isEdit
              onSubmit={(it) => upsert(it, true)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <TeacherPrivilegeRequests />
    </div>
  );
}
