import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Plus, Copy, Users, Trash2, BookOpen, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { createClassViaRest } from "@/lib/supabaseRest";
import { SpinnerButton } from "@/components/SpinnerButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconButton } from "@/components/IconButton";
import { RowListSkeleton } from "@/components/Skeletons";
import { RelativeTime } from "@/components/RelativeTime";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { MountainSketch } from "@/components/MountainSketch";
import { cn } from "@/lib/utils";

const TILE = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-plum-soft text-plum",
  "bg-warning-soft text-warning",
] as const;

type ClassRow = {
  id: string;
  name: string;
  subject: string;
  join_code: string;
  created_at: string;
  member_count?: number;
};

const createSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  subject: z.string().trim().min(1, "Subject required").max(100),
});

export const TeacherClasses = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState<ClassRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: cls, error } = await supabase
      .from("classes")
      .select("id, name, subject, join_code, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    // member counts
    const withCounts = await Promise.all(
      (cls ?? []).map(async (c) => {
        const { count } = await supabase
          .from("class_members")
          .select("*", { count: "exact", head: true })
          .eq("class_id", c.id);
        return { ...c, member_count: count ?? 0 };
      })
    );
    setClasses(withCounts);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createSchema.safeParse({ name, subject });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("You're not signed in. Please sign in again.");
        return;
      }
      try {
        await createClassViaRest({
          teacherId: user.id,
          name: parsed.data.name,
          subject: parsed.data.subject,
        });
      } catch (error: any) {
        console.error("Create class failed:", error);
        if (error.code === "42501" || /permission denied|row-level security/i.test(error.message)) {
          toast.error("You don't have permission to create classes. Make sure your account is a teacher account.");
        } else if (error.code === "PGRST002") {
          toast.error("The database is still refreshing its class schema. Please try again in a moment.");
        } else if (/network|fetch|failed to fetch/i.test(error.message)) {
          toast.error("Couldn't reach the server. Check your connection and try again.");
        } else {
          toast.error(`Couldn't create class: ${error.message}`);
        }
        return;
      }
      toast.success("Class created");
      setOpen(false);
      setName("");
      setSubject("");
      load();
    } catch (err: any) {
      console.error("Unexpected error creating class:", err);
      toast.error(err?.message ?? "Something went wrong creating the class.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class deleted");
    load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Join code copied");
  };

  return (
    <Card>
      <CardHeader className="relative overflow-hidden flex flex-row items-center justify-between">
        <MountainSketch
          variant="range"
          className="pointer-events-none absolute -top-4 right-0 hidden sm:block w-64 text-muted-foreground/30"
        />
        <CardTitle className="text-base">My classes</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a class</DialogTitle>
              <DialogDescription>Students will use the join code to enroll.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cls-name">Class name</Label>
                <Input id="cls-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Period 3 Math" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-subject">Subject</Label>
                <Input id="cls-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Algebra II" required />
              </div>
              <DialogFooter>
                <SpinnerButton type="submit" loading={submitting} loadingText="Creating...">
                  Create class
                </SpinnerButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <RowListSkeleton count={3} />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            description="Create your first class to invite students and post assignments."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {classes.map((c, i) => (
              <Reveal key={c.id} delay={i * 60} flip>
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/teacher/classes/${c.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/teacher/classes/${c.id}`); }}
                className="group relative flex h-full flex-col gap-4 cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card hover-lift transition-spring"
              >
                <div className="pointer-events-none flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", TILE[i % 4])}>
                      <BookOpen className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold leading-tight">{c.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {c.subject} · created <RelativeTime date={c.created_at} />
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3" onClick={(e) => e.stopPropagation()}>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-tabular">
                    <Users className="h-3.5 w-3.5" /><CountUp value={c.member_count ?? 0} /> students
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">Join code</span>
                    <button
                      onClick={() => copyCode(c.join_code)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 font-mono text-xs transition-spring hover:bg-accent"
                      aria-label={`Copy join code ${c.join_code}`}
                    >
                      {c.join_code}
                      <Copy className="h-3 w-3" />
                    </button>
                    <IconButton label="Delete class" onClick={() => setToDelete(c)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </IconButton>
                  </div>
                </div>
              </div>
              </Reveal>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description="This permanently removes the class, its members, assignments, and submissions. This cannot be undone."
        confirmLabel="Delete class"
        destructive
        onConfirm={async () => { if (toDelete) await handleDelete(toDelete.id); }}
      />
    </Card>
  );
};