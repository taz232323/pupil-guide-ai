import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Upload, LinkIcon, ClipboardList, Award, ClipboardCheck, ChevronRight } from "lucide-react";
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
import { Reveal } from "@/components/Reveal";
import { ProgressRing } from "@/components/ProgressRing";
import { cn } from "@/lib/utils";

const TILE = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-plum-soft text-plum",
  "bg-warning-soft text-warning",
];

type Status = "not_started" | "in_progress" | "submitted";

type Filter = "all" | "due_soon" | "in_progress" | "submitted" | "graded";

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
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
};

const STATUS_STYLES: Record<Status, string> = {
  not_started: "bg-warning-soft text-warning",
  in_progress: "bg-primary-soft text-primary",
  submitted: "bg-success-soft text-success",
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
  const [filter, setFilter] = useState<Filter>("all");
  const [classFilter, setClassFilter] = useState<string>("all");

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

  const isDueSoon = (r: Row) => {
    if (r.status === "submitted" || !r.due_date) return false;
    const days = (new Date(r.due_date).getTime() - Date.now()) / 86_400_000;
    return days <= 3;
  };

  const matchesFilter = (r: Row) => {
    switch (filter) {
      case "due_soon": return isDueSoon(r);
      case "in_progress": return r.status === "in_progress";
      case "submitted": return r.status === "submitted";
      case "graded": return !!r.graded;
      default: return true;
    }
  };

  const inClass = (r: Row) => classFilter === "all" || r.class_id === classFilter;

  const visible = useMemo(
    () => rows.filter((r) => inClass(r) && matchesFilter(r)),
    [rows, filter, classFilter]
  );

  // Section splits derived from the already-loaded rows (presentation only).
  const dueSoon = useMemo(() => visible.filter((r) => r.status !== "submitted"), [visible]);
  const submitted = useMemo(() => visible.filter((r) => r.status === "submitted"), [visible]);

  const counts = useMemo(() => {
    const scoped = rows.filter(inClass);
    return {
      total: scoped.length,
      dueSoon: scoped.filter(isDueSoon).length,
      inProgress: scoped.filter((r) => r.status === "in_progress").length,
      submitted: scoped.filter((r) => r.status === "submitted").length,
      graded: scoped.filter((r) => r.graded).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, classFilter]);

  const donutPct = counts.total ? Math.round((counts.submitted / counts.total) * 100) : 0;

  const comingUp = useMemo(
    () =>
      rows
        .filter((r) => inClass(r) && r.status !== "submitted" && r.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, classFilter]
  );

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
      let payload: { file_path?: string; link_url?: string } = {};
      if (mode === "file") {
        if (!file) { toast.error("Choose a file"); return; }
        if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
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

      const { error } = await supabase
        .from("submissions")
        .upsert(
          { assignment_id: submitFor.id, student_id: user.id, ...payload },
          { onConflict: "assignment_id,student_id" }
        );
      if (error) { toast.error(error.message); return; }
      toast.success("Submitted");
      setSubmitFor(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const classOptions = Object.entries(classes);

  return (
    <>
    {loading ? (
      <CardListSkeleton count={3} />
    ) : rows.length === 0 ? (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            description="Check back soon — your teacher hasn't posted anything for these classes."
          />
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* Main column */}
        <div className="space-y-5 min-w-0">
          {/* Tab bar + class filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="due_soon">Due soon</TabsTrigger>
                <TabsTrigger value="in_progress">In progress</TabsTrigger>
                <TabsTrigger value="submitted">Submitted</TabsTrigger>
                <TabsTrigger value="graded">Graded</TabsTrigger>
              </TabsList>
            </Tabs>
            {classOptions.length > 0 && (
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Due soon — subject-tile cards */}
          {dueSoon.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Due soon</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dueSoon.map((r, i) => (
                    <Reveal
                      key={r.id}
                      delay={i * 60}
                      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-spring hover-lift cursor-pointer"
                    >
                      <div onClick={() => navigate(`/student/assignments/${r.id}`)} className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-spring group-hover:scale-110", TILE[i % 4])}>
                            <ClipboardList className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-tight truncate">{r.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{classes[r.class_id] ?? "Class"}</p>
                          </div>
                          <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0", STATUS_STYLES[r.status])}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </div>
                        {r.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {r.unit_tag && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">{r.unit_tag}</span>
                          )}
                          {r.due_date && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />Due <RelativeTime date={r.due_date} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as Status)} disabled={r.status === "submitted"}>
                          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="submitted" disabled>Submitted</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" onClick={() => openSubmit(r)}>
                          {r.status === "submitted" ? "Resubmit" : "Submit"}
                        </Button>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submitted — list with score */}
          {submitted.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Submitted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {submitted.map((r, i) => (
                    <Reveal
                      key={r.id}
                      delay={i * 50}
                      className="group flex items-center gap-3 -mx-2 px-2 py-3 rounded-lg cursor-pointer transition-spring hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3 w-full" onClick={() => navigate(`/student/assignments/${r.id}`)}>
                        <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TILE[i % 4])}>
                          <ClipboardCheck className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{classes[r.class_id] ?? "Class"}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {r.due_date && (
                            <span className="hidden sm:inline text-xs text-muted-foreground">
                              <RelativeTime date={r.due_date} />
                            </span>
                          )}
                          {r.submission?.link_url && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <LinkIcon className="h-3 w-3" />Link
                            </span>
                          )}
                          {r.submission?.file_path && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Upload className="h-3 w-3" />File
                            </span>
                          )}
                          {r.graded ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                              <Award className="h-3 w-3" />
                              {r.grade_score != null ? <span className="font-tabular">{r.grade_score}</span> : "Graded"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                              Submitted
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {dueSoon.length === 0 && submitted.length === 0 && (
            <Card>
              <CardContent className="py-10">
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing here"
                  description="No assignments match this filter."
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar — Overview + Coming up */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <ProgressRing value={donutPct} size={120}>
                  <span className="font-tabular text-2xl font-bold tracking-tight">{counts.total}</span>
                  <span className="text-[10px] text-muted-foreground">total</span>
                </ProgressRing>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-warning" />Due soon
                  </span>
                  <span className="font-tabular font-medium">{counts.dueSoon}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary" />In progress
                  </span>
                  <span className="font-tabular font-medium">{counts.inProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-success" />Submitted
                  </span>
                  <span className="font-tabular font-medium">{counts.submitted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-plum" />Graded
                  </span>
                  <span className="font-tabular font-medium">{counts.graded}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {comingUp.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Coming up</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {comingUp.map((r, i) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/student/assignments/${r.id}`)}
                        className="group flex w-full items-center gap-3 -mx-2 px-2 py-2 rounded-lg text-left transition-spring hover:bg-muted/40"
                      >
                        <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TILE[i % 4])}>
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          {r.due_date && (
                            <p className="text-xs text-muted-foreground">Due <RelativeTime date={r.due_date} /></p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )}

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