import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, X } from "lucide-react";
import { toast } from "sonner";

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

  const load = async () => {
    if (!user) return;
    const { data: classes } = await supabase.from("classes").select("id").eq("teacher_id", user.id);
    const ids = (classes ?? []).map((c) => c.id);
    if (ids.length === 0) { setRows([]); return; }
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
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const resolve = async (id: string, status: "approved" | "denied") => {
    const { error } = await supabase.from("shop_purchases").update({ status }).eq("id", id);
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
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.student_name} — {r.item_name}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Crown className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    {r.cost} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id, "denied")}>
                    <X className="h-4 w-4" /> Deny
                  </Button>
                  <Button size="sm" onClick={() => resolve(r.id, "approved")}>
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
