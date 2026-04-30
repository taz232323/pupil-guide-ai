import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/RelativeTime";
import { RowListSkeleton } from "@/components/Skeletons";

type Row = {
  id: string;
  student_id: string;
  item_name: string;
  cost: number;
  created_at: string;
  status: "pending" | "approved" | "denied";
  student_name?: string;
};

export function TeacherPrivilegeRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: classes } = await supabase.from("classes").select("id").eq("teacher_id", user.id);
    const ids = (classes ?? []).map((c) => c.id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }
    const { data } = await supabase
      .from("shop_purchases")
      .select("id, student_id, item_name, cost, created_at, status")
      .eq("kind", "privilege")
      .eq("status", "pending")
      .in("class_id", ids)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Row[];
    if (list.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name").in("id", list.map((r) => r.student_id));
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      list.forEach((r) => (r.student_name = map.get(r.student_id) || "Student"));
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const resolve = async (id: string, status: "approved" | "denied") => {
    setBusyId(id);
    const { error } = await supabase.from("shop_purchases").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Approved" : "Denied & refunded");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Privilege requests</CardTitle>
        <CardDescription>Approve or deny student purchases. Denied requests refund coins.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <RowListSkeleton count={2} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.student_name} — {r.item_name}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Crown className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    {r.cost} · <RelativeTime date={r.created_at} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => resolve(r.id, "denied")}>
                    <X className="h-4 w-4" /> Deny
                  </Button>
                  <Button size="sm" disabled={busyId === r.id} onClick={() => resolve(r.id, "approved")}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
