import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Plus, Trash2, CalendarDays, Tag, ClipboardList, BookOpen, ClipboardCheck, LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { SpinnerButton } from "@/components/SpinnerButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconButton } from "@/components/IconButton";
import { CardListSkeleton } from "@/components/Skeletons";
import { RelativeTime } from "@/components/RelativeTime";
import { QuestionBuilder, DraftQuestion, validateQuestions } from "@/components/assignments/QuestionBuilder";
import { Reveal } from "@/components/Reveal";
import { ProgressRing } from "@/components/ProgressRing";
import { cn } from "@/lib/utils";
import {
  ASSIGNMENT_TYPES,
  DEFAULT_ASSIGNMENT_TYPE,
  DEFAULT_RESOURCE_KIND,
  RESOURCE_KINDS,
  type AssignmentType,
  type ResourceKind,
  type ResourceLink,
  getAssignmentTypeMeta,
  getResourceKindMeta,
  normalizeResourceLinks,
} from "@/lib/assignmentMetadata";

const TILE = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-plum-soft text-plum",
  "bg-warning-soft text-warning",
];

type ClassRow = { id: string; name: string; subject: string };
type Assignment = {
  id: string;
  class_id: string;
  assignment_type?: string | null;
  title: string;
  description: string | null;
  unit_tag: string | null;
  due_date: string | null;
  created_at: string;
};

const schema = z.object({
  class_id: z.string().uuid("Pick a class"),
  assignment_type: z.enum(["practice", "written_response", "quiz", "project", "discussion", "upload", "resource_review"]),
  title: z.string().trim().min(1, "Title required").max(150),
  description: z.string().trim().max(2000).optional(),
  unit_tag: z.string().trim().max(80).optional(),
  due_date: z.string().optional(),
  material_notes: z.string().trim().max(4000).optional(),
});

export const TeacherAssignments = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState<Assignment | null>(null);

  const [classId, setClassId] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(DEFAULT_ASSIGNMENT_TYPE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitTag, setUnitTag] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [materialNotes, setMaterialNotes] = useState("");
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: cls }, { data: asgn, error }] = await Promise.all([
      supabase.from("classes").select("id, name, subject").order("created_at", { ascending: false }),
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setClasses(cls ?? []);
    setAssignments((asgn ?? []) as Assignment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      class_id: classId,
      assignment_type: assignmentType,
      title,
      description,
      unit_tag: unitTag,
      due_date: dueDate,
      material_notes: materialNotes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const resources = normalizeResourceLinks(resourceLinks);
    for (const resource of resources) {
      try {
        const url = new URL(resource.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        toast.error(`Check the URL for "${resource.title}"`);
        return;
      }
    }
    const qErr = validateQuestions(questions);
    if (qErr) { toast.error(qErr); return; }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); setSubmitting(false); return; }
    const { data: created, error } = await supabase.from("assignments").insert({
      class_id: parsed.data.class_id,
      teacher_id: user.id,
      assignment_type: parsed.data.assignment_type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      unit_tag: parsed.data.unit_tag || null,
      due_date: parsed.data.due_date ? new Date(parsed.data.due_date).toISOString() : null,
      material_notes: parsed.data.material_notes || null,
      resource_links: resources,
      reminders_enabled: remindersEnabled,
    }).select("id").single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    if (created && questions.length) {
      const rows = questions.map((q, i) => ({
        assignment_id: created.id,
        position: i,
        question_type: q.question_type,
        prompt: q.prompt.trim(),
        options: q.question_type === "multiple_choice" ? q.options : null,
        correct_index: q.question_type === "multiple_choice" ? q.correct_index : null,
        max_score: q.max_score,
      }));
      const { error: qerr } = await supabase.from("assignment_questions").insert(rows);
      if (qerr) { toast.error(`Assignment created, but questions failed: ${qerr.message}`); }
    }
    toast.success("Assignment created");
    setOpen(false);
    setClassId("");
    setAssignmentType(DEFAULT_ASSIGNMENT_TYPE);
    setTitle("");
    setDescription("");
    setUnitTag("");
    setDueDate("");
    setMaterialNotes("");
    setResourceLinks([]);
    setQuestions([]);
    setRemindersEnabled(true);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment deleted");
    load();
  };

  const classNameFor = (id: string) => classes.find((c) => c.id === id)?.name ?? "Class";

  // Derive a status pill from the due date only (real data — no fabricated state).
  const statusFor = (a: Assignment) => {
    if (!a.due_date) return { label: "Open", cls: "bg-primary-soft text-primary" };
    const due = new Date(a.due_date).getTime();
    const now = Date.now();
    if (due < now) return { label: "Closed", cls: "bg-muted text-muted-foreground" };
    const days = (due - now) / 86_400_000;
    if (days <= 3) return { label: "Due soon", cls: "bg-warning-soft text-warning" };
    return { label: "Active", cls: "bg-success-soft text-success" };
  };

  const stats = useMemo(() => {
    let active = 0, soon = 0, closed = 0;
    assignments.forEach((a) => {
      const s = statusFor(a).label;
      if (s === "Closed") closed++;
      else if (s === "Due soon") soon++;
      else active++;
    });
    return { active, soon, closed, total: assignments.length };
  }, [assignments]);

  const upcoming = useMemo(
    () =>
      assignments
        .filter((a) => a.due_date && new Date(a.due_date).getTime() >= Date.now())
        .sort((x, y) => new Date(x.due_date!).getTime() - new Date(y.due_date!).getTime())
        .slice(0, 4),
    [assignments]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-xl">All assignments</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Track student work and grading across your classes.</p>
          </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={classes.length === 0}>
              <Plus className="h-4 w-4 mr-1" />New assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create an assignment</DialogTitle>
              <DialogDescription>Students in the selected class will see it.</DialogDescription>
            </DialogHeader>
            <form noValidate onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment type</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ASSIGNMENT_TYPES.map((type) => {
                    const selected = assignmentType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setAssignmentType(type.value)}
                        className={cn(
                          "flex min-h-[78px] items-start gap-3 rounded-md border bg-card p-3 text-left transition-base hover:border-primary/40 hover:bg-primary-soft/30",
                          selected && "border-primary bg-primary-soft text-primary"
                        )}
                        aria-pressed={selected}
                      >
                        <type.icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{type.label}</span>
                          <span className={cn("block text-xs leading-relaxed text-muted-foreground", selected && "text-primary/80")}>
                            {type.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-title">Title</Label>
                <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-desc">Description</Label>
                <Textarea id="a-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div>
                  <Label htmlFor="a-material-notes">Notes, slides, and class materials</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add the directions or class information students need before they start.
                  </p>
                </div>
                <Textarea
                  id="a-material-notes"
                  rows={3}
                  placeholder="Key notes, slide context, reading directions, or links students should review first."
                  value={materialNotes}
                  onChange={(e) => setMaterialNotes(e.target.value)}
                />
                <ResourceLinkBuilder resources={resourceLinks} onChange={setResourceLinks} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="a-unit">Unit tag</Label>
                  <Input id="a-unit" placeholder="Algebra - Unit 3" value={unitTag} onChange={(e) => setUnitTag(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-due">Due date</Label>
                  <Input id="a-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <div>
                  <Label htmlFor="a-reminders" className="cursor-pointer">Send due-date reminders</Label>
                  <p className="text-xs text-muted-foreground">Students get a notification 3 days and 24 hours before due.</p>
                </div>
                <Switch id="a-reminders" checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label>Questions (optional)</Label>
                <p className="text-xs text-muted-foreground">Add questions students will answer in the app.</p>
                <QuestionBuilder questions={questions} onChange={setQuestions} />
              </div>
              <DialogFooter>
                <SpinnerButton type="submit" loading={submitting} loadingText="Creating...">
                  Create
                </SpinnerButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <CardListSkeleton count={3} />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            description="Create a class first, then you can post assignments to it."
          />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            description="Click Create to post your first assignment."
          />
        ) : (
          <div className="space-y-1.5">
            {assignments.map((a, i) => {
              const status = statusFor(a);
              return (
              <Reveal
                key={a.id}
                delay={i * 60}
                className="py-3 px-3 -mx-3 flex items-center gap-3 cursor-pointer rounded-xl border border-transparent hover:border-primary/15 hover:bg-muted/40 transition-spring hover-lift"
              >
              <div
                className="flex items-center gap-3 w-full"
                onClick={() => navigate(`/teacher/assignments/${a.id}`)}
              >
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TILE[i % TILE.length])}>
                  {(() => {
                    const TypeIcon = getAssignmentTypeMeta(a.assignment_type).icon;
                    return <TypeIcon className="h-5 w-5" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{classNameFor(a.class_id)}</span>
                    <span>{getAssignmentTypeMeta(a.assignment_type).label}</span>
                    {a.unit_tag && (
                      <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{a.unit_tag}</span>
                    )}
                    {a.due_date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />Due <RelativeTime date={a.due_date} />
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn("hidden sm:inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", status.cls)}>
                  {status.label}
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  <IconButton label="Delete assignment" onClick={() => setToDelete(a)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </IconButton>
                </div>
              </div>
              </Reveal>
              );
            })}
          </div>
        )}
      </CardContent>
      </Card>

      {/* Right sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <ProgressRing
              value={stats.total ? Math.round((stats.active / stats.total) * 100) : 0}
              size={88}
            >
              <span className="font-tabular text-2xl font-bold tracking-tight">{stats.total}</span>
              <span className="text-[10px] text-muted-foreground">total</span>
            </ProgressRing>
            <ul className="flex-1 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />Active
                </span>
                <span className="font-tabular font-medium">{stats.active}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-warning" />Due soon
                </span>
                <span className="font-tabular font-medium">{stats.soon}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />Closed
                </span>
                <span className="font-tabular font-medium">{stats.closed}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due right now.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((a, i) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 cursor-pointer rounded-lg -mx-1 px-1 py-1 hover:bg-muted/40 transition-base"
                    onClick={() => navigate(`/teacher/assignments/${a.id}`)}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TILE[i % TILE.length])}>
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due <RelativeTime date={a.due_date!} />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plum-soft text-plum">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Assignment bank</p>
              <p className="text-xs text-muted-foreground">Reuse and adapt past work.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.title ?? ""}"?`}
        description="Students will lose visibility of this assignment and any submissions tied to it. This cannot be undone."
        confirmLabel="Delete assignment"
        destructive
        onConfirm={async () => { if (toDelete) await handleDelete(toDelete.id); }}
      />
    </div>
  );
};

function ResourceLinkBuilder({
  resources,
  onChange,
}: {
  resources: ResourceLink[];
  onChange: (resources: ResourceLink[]) => void;
}) {
  const addResource = () =>
    onChange([...resources, { title: "", url: "", kind: DEFAULT_RESOURCE_KIND }]);

  const updateResource = (index: number, patch: Partial<ResourceLink>) => {
    const next = [...resources];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeResource = (index: number) => onChange(resources.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 pt-1">
      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((resource, index) => {
            const KindIcon = getResourceKindMeta(resource.kind).icon;
            return (
              <div key={index} className="grid gap-2 rounded-md border bg-background p-2 sm:grid-cols-[132px_1fr]">
                <Select
                  value={resource.kind}
                  onValueChange={(value) => updateResource(index, { kind: value as ResourceKind })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_KINDS.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid gap-2 sm:grid-cols-[1fr_1.25fr_auto]">
                  <div className="relative">
                    <KindIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label={`Resource ${index + 1} title`}
                      className="h-9 pl-8"
                      placeholder="Title"
                      value={resource.title}
                      onChange={(e) => updateResource(index, { title: e.target.value })}
                    />
                  </div>
                  <div className="relative">
                    <LinkIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label={`Resource ${index + 1} URL`}
                      className="h-9 pl-8"
                      type="url"
                      placeholder="https://..."
                      value={resource.url}
                      onChange={(e) => updateResource(index, { url: e.target.value })}
                    />
                  </div>
                  <IconButton
                    type="button"
                    label="Remove resource"
                    className="h-9 w-9 justify-self-end text-destructive hover:text-destructive"
                    onClick={() => removeResource(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={addResource}>
        <Plus className="h-3.5 w-3.5 mr-1" />Add material link
      </Button>
    </div>
  );
}
