import { useEffect, useState } from "react";
import { z } from "zod";
import { Plus, Trash2, CalendarDays, Tag, ClipboardList, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type ClassRow = { id: string; name: string; subject: string };
type Assignment = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  unit_tag: string | null;
  due_date: string | null;
  created_at: string;
};

const schema = z.object({
  class_id: z.string().uuid("Pick a class"),
  title: z.string().trim().min(1, "Title required").max(150),
  description: z.string().trim().max(2000).optional(),
  unit_tag: z.string().trim().max(80).optional(),
  due_date: z.string().optional(),
});

export const TeacherAssignments = () => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState<Assignment | null>(null);

  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitTag, setUnitTag] = useState("");
  const [dueDate, setDueDate] = useState("");

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
      class_id: classId, title, description, unit_tag: unitTag, due_date: dueDate,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); setSubmitting(false); return; }
    const { error } = await supabase.from("assignments").insert({
      class_id: parsed.data.class_id,
      teacher_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      unit_tag: parsed.data.unit_tag || null,
      due_date: parsed.data.due_date ? new Date(parsed.data.due_date).toISOString() : null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment created");
    setOpen(false);
    setClassId(""); setTitle(""); setDescription(""); setUnitTag(""); setDueDate("");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment deleted");
    load();
  };

  const classNameFor = (id: string) => classes.find((c) => c.id === id)?.name ?? "Class";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Assignments</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={classes.length === 0}>
              <Plus className="h-4 w-4 mr-1" />New assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create an assignment</DialogTitle>
              <DialogDescription>Students in the selected class will see it.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
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
                <Label htmlFor="a-title">Title</Label>
                <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-desc">Description</Label>
                <Textarea id="a-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
          <div className="divide-y divide-border">
            {assignments.map((a) => (
              <div key={a.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {classNameFor(a.class_id)} · posted <RelativeTime date={a.created_at} />
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
                <IconButton label="Delete assignment" onClick={() => setToDelete(a)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.title ?? ""}"?`}
        description="Students will lose visibility of this assignment and any submissions tied to it. This cannot be undone."
        confirmLabel="Delete assignment"
        destructive
        onConfirm={async () => { if (toDelete) await handleDelete(toDelete.id); }}
      />
    </Card>
  );
};