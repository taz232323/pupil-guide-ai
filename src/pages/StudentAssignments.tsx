import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Tag, Upload, LinkIcon, ClipboardList, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { SpinnerButton } from "@/components/SpinnerButton";
import { CardListSkeleton } from "@/components/Skeletons";
import { RelativeTime } from "@/components/RelativeTime";

type Status = "not_started" | "in_progress" | "submitted";

type Row = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  unit_tag: string | null;
  due_date: string | null;
  status: Status;
  submission?: { file_path: string | null; link_url: string | null } | null;
  graded?: boolean;
  grade_score?: number | null;
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
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitFor, setSubmitFor] = useState<Row | null>(null);
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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

    const [{ data: statuses }, { data: cls }, { data: subs }, { data: grades }] = await Promise.all([
      ids.length
        ? supabase.from("assignment_status_records")
            .select("assignment_id, status")
            .eq("student_id", user.id)
            .in("assignment_id", ids)
        : Promise.resolve({ data: [] as { assignment_id: string; status: Status }[] }),
      classIds.length
        ? supabase.from("classes").select("id, name").in("id", classIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ids.length
        ? supabase.from("submissions")
            .select("assignment_id, file_path, link_url")
            .eq("student_id", user.id)
            .in("assignment_id", ids)
        : Promise.resolve({ data: [] as { assignment_id: string; file_path: string | null; link_url: string | null }[] }),
      ids.length
        ? supabase.from("assignment_grades")
            .select("assignment_id, overall_score, graded_at")
            .eq("student_id", user.id)
            .in("assignment_id", ids)
        : Promise.resolve({ data: [] as { assignment_id: string; overall_score: number | null; graded_at: string | null }[] }),
    ]);

    const statusMap = new Map<string, Status>();
    (statuses ?? []).forEach((s: any) => statusMap.set(s.assignment_id, s.status));
    const classMap: Record<string, string> = {};
    (cls ?? []).forEach((c: any) => { classMap[c.id] = c.name; });
    const subMap = new Map<string, { file_path: string | null; link_url: string | null }>();
    (subs ?? []).forEach((s: any) => subMap.set(s.assignment_id, { file_path: s.file_path, link_url: s.link_url }));
    const gradeMap = new Map<string, { score: number | null }>();
    (grades ?? []).forEach((g: any) => { if (g.graded_at) gradeMap.set(g.assignment_id, { score: g.overall_score }); });

    setClasses(classMap);
    setRows((asgn ?? []).map((a) => ({
      ...a,
      status: statusMap.get(a.id) ?? "not_started",
      submission: subMap.get(a.id) ?? null,
      graded: gradeMap.has(a.id),
      grade_score: gradeMap.get(a.id)?.score ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (assignmentId: string, status: Status) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setRows((prev) => prev.map((r) => r.id === assignmentId ? { ...r, status } : r));
    const { error } = await supabase.rpc("set_assignment_status", {
      _assignment_id: assignmentId,
      _status: status,
    });
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const openSubmit = (row: Row) => {
    setSubmitFor(row);
    setLink("");
    setFile(null);
  };

  const handleSubmit = async (mode: "file" | "link") => {
    if (!submitFor) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    try {
      const payload: { file_path?: string; link_url?: string } = {};
      if (mode === "file") {
        if (!file) { toast.error("Choose a file"); return; }
        if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${submitFor.id}/${user.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("submissions")
          .upload(path, file, { upsert: true });
        if (upErr) { toast.error(upErr.message); return; }
        payload.file_path = path;
      } else {
        const trimmed = link.trim();
        let parsed: URL;
        try { parsed = new URL(trimmed); } catch { toast.error("Invalid URL"); return; }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          toast.error("Link must start with http:// or https://");
          return;
        }
        payload.link_url = trimmed;
      }

      const { error } = await supabase.rpc("submit_assignment", {
        _assignment_id: submitFor.id,
        _answers: [],
        _file_path: payload.file_path ?? null,
        _link_url: payload.link_url ?? null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Submitted");
      setSubmitFor(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <CardListSkeleton count={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            description="Check back soon — your teacher hasn't posted anything for these classes."
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div
                key={r.id}
                className="py-3 flex items-start justify-between gap-4 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
                onClick={() => navigate(`/student/assignments/${r.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{r.title}</p>
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.graded && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                        <Award className="h-3 w-3" />Graded{r.grade_score != null ? ` · ${r.grade_score}` : ""}
                      </span>
                    )}
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
                        <CalendarDays className="h-3 w-3" />Due <RelativeTime date={r.due_date} />
                      </span>
                    )}
                    {r.submission?.link_url && (
                      <a href={r.submission.link_url} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-1 text-primary hover:underline">
                        <LinkIcon className="h-3 w-3" />Submitted link
                      </a>
                    )}
                    {r.submission?.file_path && (
                      <span className="inline-flex items-center gap-1">
                        <Upload className="h-3 w-3" />File submitted
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as Status)} disabled={r.status === "submitted"}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="submitted" disabled>Submitted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => openSubmit(r)}>
                    {r.status === "submitted" ? "Resubmit" : "Submit"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!submitFor} onOpenChange={(o) => !o && setSubmitFor(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit assignment</DialogTitle>
          <DialogDescription>{submitFor?.title}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="file">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="file">Upload file</TabsTrigger>
            <TabsTrigger value="link">Paste link</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="sub-file">File (max 20MB)</Label>
              <Input id="sub-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <DialogFooter>
              <SpinnerButton onClick={() => handleSubmit("file")} loading={busy} disabled={!file} loadingText="Submitting...">
                Submit file
              </SpinnerButton>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="link" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="sub-link">Link URL</Label>
              <Input id="sub-link" type="url" placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
            <DialogFooter>
              <SpinnerButton onClick={() => handleSubmit("link")} loading={busy} disabled={!link} loadingText="Submitting...">
                Submit link
              </SpinnerButton>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  );
};
