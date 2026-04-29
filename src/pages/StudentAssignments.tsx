import { useEffect, useState } from "react";
import { CalendarDays, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Status = "not_started" | "in_progress" | "submitted";

type Row = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  unit_tag: string | null;
  due_date: string | null;
  status: Status;
};

const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
};

const STATUS_STYLES: Record<Status, string> = {
  not_started: "bg-secondary text-secondary-foreground",
  in_progress: "bg-primary/15 text-primary",
  submitted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export const StudentAssignments = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: asgn, error } = await supabase
      .from("assignments")
      .select("id, class_id, title, description, unit_tag, due_date")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const ids = (asgn ?? []).map((a) => a.id);
    const classIds = Array.from(new Set((asgn ?? []).map((a) => a.class_id)));

    const [{ data: statuses }, { data: cls }] = await Promise.all([
      ids.length
        ? supabase.from("assignment_status_records")
            .select("assignment_id, status")
            .eq("student_id", user.id)
            .in("assignment_id", ids)
        : Promise.resolve({ data: [] as { assignment_id: string; status: Status }[] }),
      classIds.length
        ? supabase.from("classes").select("id, name").in("id", classIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const statusMap = new Map<string, Status>();
    (statuses ?? []).forEach((s: any) => statusMap.set(s.assignment_id, s.status));
    const classMap: Record<string, string> = {};
    (cls ?? []).forEach((c: any) => { classMap[c.id] = c.name; });

    setClasses(classMap);
    setRows((asgn ?? []).map((a) => ({
      ...a,
      status: statusMap.get(a.id) ?? "not_started",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (assignmentId: string, status: Status) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setRows((prev) => prev.map((r) => r.id === assignmentId ? { ...r, status } : r));
    const { error } = await supabase
      .from("assignment_status_records")
      .upsert(
        { assignment_id: assignmentId, student_id: user.id, status },
        { onConflict: "assignment_id,student_id" }
      );
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{r.title}</p>
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{classes[r.class_id] ?? "Class"}</p>
                  {r.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {r.unit_tag && (
                      <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{r.unit_tag}</span>
                    )}
                    {r.due_date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />Due {new Date(r.due_date).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as Status)}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};